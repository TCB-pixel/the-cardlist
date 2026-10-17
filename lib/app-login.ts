import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// ล็อกอิน LINE จากแอปมือถือ: LINE ล็อกอินในเบราว์เซอร์ของเครื่อง แล้วส่ง "รหัสใช้ครั้งเดียว" กลับเข้าแอป
// รหัสเข้ารหัส (AES-256-GCM) อายุ 3 นาที และผูกกับ challenge ที่แอปสร้าง — แอปอื่นดักลิงก์ได้ก็ใช้ไม่ได้
// เพราะไม่มี verifier ที่อยู่ในแอปเรา (แบบเดียวกับ PKCE)
// ไม่มีตารางใหม่ ไม่มี env ใหม่: กุญแจได้จาก service role key ผ่าน SHA-256
// ─────────────────────────────────────────────────────────────────────────────

export const APP_CHALLENGE_COOKIE = "line_app_cc";
export const APP_SCHEME = "com.thecardlist.app";
const TTL_MS = 3 * 60 * 1000;

type Payload = { rt: string; ch: string; dest: string; exp: number };

function key(): Buffer {
  return createHash("sha256").update("cardlist-app-login-v1:" + process.env.SUPABASE_SERVICE_ROLE_KEY!).digest();
}

export function isChallenge(v: string | null | undefined): v is string {
  return !!v && /^[A-Za-z0-9_-]{43}$/.test(v);
}

export function sealAppCode(refreshToken: string, challenge: string, dest: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify({ rt: refreshToken, ch: challenge, dest, exp: Date.now() + TTL_MS } satisfies Payload), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

// คืน refresh token + ปลายทาง ถ้ารหัสถูกต้อง ยังไม่หมดอายุ และ verifier ตรงกับ challenge — ไม่งั้น null
export function openAppCode(code: string, verifier: string): { refreshToken: string; dest: string } | null {
  try {
    const raw = Buffer.from(code, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const p = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as Payload;
    if (Date.now() > p.exp) return null;
    if (createHash("sha256").update(verifier).digest("base64url") !== p.ch) return null;
    return { refreshToken: p.rt, dest: p.dest };
  } catch {
    return null;
  }
}
