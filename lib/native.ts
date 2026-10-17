import { Capacitor, registerPlugin } from "@capacitor/core";

// ─────────────────────────────────────────────────────────────────────────────
// ของเนทีฟเมื่อเว็บถูกเปิดในแอปมือถือ The Cardlist (โปรเจกต์ mobile/ — Capacitor)
// เปิดในเบราว์เซอร์ปกติ = isNativeApp() เป็น false ทุกฟังก์ชันไม่ทำอะไร หน้าเว็บทำงานเหมือนเดิม
// ─────────────────────────────────────────────────────────────────────────────

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

type ScanResult = { ScanResult: string; format: number };
type BarcodeScannerPlugin = {
  scanBarcode(options: Record<string, unknown>): Promise<ScanResult>;
};

// ชื่อต้องตรงกับปลั๊กอิน @capacitor/barcode-scanner ในแอป (ไม่ใส่ตัว web — ใช้เฉพาะในแอป)
const BarcodeScanner = registerPlugin<BarcodeScannerPlugin>("CapacitorBarcodeScanner");

export function canScanNatively(): boolean {
  return isNativeApp() && Capacitor.isPluginAvailable("CapacitorBarcodeScanner");
}

// ── ล็อกอิน LINE จากแอป ─────────────────────────────────────────────────────
// เปิดหน้า LINE ในเบราว์เซอร์ของเครื่อง (ใช้แอป LINE ล็อกอินอัตโนมัติได้) แล้วเด้งกลับเข้าแอป
// ฝั่งเซิร์ฟเวอร์: lib/app-login.ts · app/auth/app-return · app/api/auth/app-exchange · app/auth/app-callback

type BrowserPlugin = { open(o: { url: string }): Promise<void>; close(): Promise<void> };
type AppPlugin = {
  addListener(event: "appUrlOpen", cb: (e: { url: string }) => void): Promise<{ remove(): Promise<void> }>;
};
const Browser = registerPlugin<BrowserPlugin>("Browser");
const App = registerPlugin<AppPlugin>("App");

const VERIFIER_KEY = "app_login_verifier";
export const APP_SCHEME = "com.thecardlist.app";

function base64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function lineLoginPath(next?: string | null): string {
  return next ? `/api/auth/line?next=${encodeURIComponent(next)}` : "/api/auth/line";
}

// ใช้แทน window.location.href = "/api/auth/line…" — ในเว็บทำงานเหมือนเดิม ในแอปเปิดเบราว์เซอร์ของเครื่อง
export async function goLineLogin(next?: string | null) {
  if (!isNativeApp() || !Capacitor.isPluginAvailable("Browser")) {
    window.location.href = lineLoginPath(next);
    return;
  }
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  try { localStorage.setItem(VERIFIER_KEY, verifier); } catch {}
  const url = `${window.location.origin}${lineLoginPath(next)}${next ? "&" : "?"}app=1&cc=${challenge}`;
  await Browser.open({ url });
}

// อ่าน verifier แล้วลบทิ้ง (ใช้ได้ครั้งเดียว)
export function takeLoginVerifier(): string {
  try {
    const v = localStorage.getItem(VERIFIER_KEY) ?? "";
    localStorage.removeItem(VERIFIER_KEY);
    return v;
  } catch {
    return "";
  }
}

// ฟังลิงก์ที่เด้งกลับเข้าแอป (com.thecardlist.app://auth?code=…) — เรียกครั้งเดียวตอนเปิดแอป
export function listenAppLinks(): () => void {
  if (!isNativeApp()) return () => {};
  const handle = App.addListener("appUrlOpen", ({ url }) => {
    if (!url.startsWith(`${APP_SCHEME}://auth`)) return;
    const code = new URL(url.replace(`${APP_SCHEME}://`, "https://app.invalid/")).searchParams.get("code");
    Browser.close().catch(() => {});
    if (code) window.location.href = `/auth/app-callback?code=${encodeURIComponent(code)}`;
  });
  return () => { handle.then((h) => h.remove()).catch(() => {}); };
}

// ── สแกน QR ────────────────────────────────────────────────────────────────

// QR ของเว็บเรา (เช่น แสตมป์ Passport /passport/s/…) → คืน path ภายในเว็บ · QR อื่น → null
export function internalPathFromQr(text: string): string | null {
  try {
    const u = new URL(text);
    const host = u.hostname.replace(/^www\./, "");
    if (u.protocol !== "https:" || host !== "thecardlistbkk.com") return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

// เปิดกล้องเนทีฟเต็มจอ อ่าน QR 1 ครั้ง — ผู้ใช้กดยกเลิก = null
export async function scanQrNative(instructions: string): Promise<string | null> {
  try {
    const r = await BarcodeScanner.scanBarcode({
      hint: 0, // QR_CODE
      scanInstructions: instructions,
      scanButton: false,
      scanText: " ",
      cameraDirection: 1, // กล้องหลัง
      scanOrientation: 1, // แนวตั้ง
    });
    const text = r?.ScanResult?.trim();
    return text ? text : null;
  } catch {
    return null;
  }
}
