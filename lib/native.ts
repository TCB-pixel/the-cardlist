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
