// ── ขนส่งที่ร้านใช้ และหน้าติดตามพัสดุ ──
// เพิ่มขนส่งใหม่ที่นี่ที่เดียว หน้าแอดมินและข้อความแจ้งลูกค้าจะตามมาเอง
//
// หมายเหตุ: ลิงก์ชี้ไปที่หน้าติดตามหลักของขนส่งโดยไม่ฝังเลขพัสดุใน URL
// เพราะยังตรวจไม่ได้ว่าหน้าของแต่ละเจ้ารับเลขทาง query string จริงไหม — ถ้าเดาผิด ลูกค้าจะเจอหน้าเปล่า
// จึงให้ลูกค้าคัดลอกเลขจากข้อความไปวางเอง ซึ่งไม่มีทางพัง
// ถ้าตรวจแล้วว่ารับเลขทาง URL ได้ ค่อยใส่ฟังก์ชัน trackUrl ที่ฝังเลขได้ภายหลัง

export type Carrier = {
  id: string;
  name: string;
  // รูปแบบเลขพัสดุคร่าวๆ ไว้เตือนแอดมินเวลาพิมพ์ผิด (ไม่ใช่การปฏิเสธ — ขนส่งเปลี่ยนรูปแบบได้)
  hint: string;
  pattern: RegExp;
  // หน้าติดตามพัสดุของขนส่ง
  trackPage: string;
  // ลิงก์ที่ฝังเลขได้ (ถ้ายืนยันแล้วว่าใช้ได้จริง) — ไม่ใส่ = ใช้ trackPage
  trackUrl?: (trackingNo: string) => string;
};

export const CARRIERS: Carrier[] = [
  {
    id: "kerry",
    name: "Kerry Express",
    hint: "เช่น KEX1234567890",
    pattern: /^[A-Z0-9]{9,16}$/i,
    trackPage: "https://th.kerryexpress.com/th/track/",
  },
  {
    id: "thaipost",
    name: "ไปรษณีย์ไทย",
    hint: "เช่น EF123456789TH (2 ตัวอักษร + 9 ตัวเลข + TH)",
    pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/i,
    trackPage: "https://track.thailandpost.co.th/",
  },
];

export function carrierById(id: string | null | undefined): Carrier | null {
  return CARRIERS.find((c) => c.id === id) ?? null;
}

export function trackingLink(carrierId: string | null | undefined, trackingNo: string): string | null {
  const c = carrierById(carrierId);
  if (!c) return null;
  return c.trackUrl ? c.trackUrl(trackingNo) : c.trackPage;
}

// ทำความสะอาดเลขพัสดุ: ตัดช่องว่าง/ขีดที่คัดลอกติดมา แล้วเป็นตัวพิมพ์ใหญ่
export function cleanTracking(raw: string): string {
  return (raw ?? "").replace(/[\s\-]/g, "").toUpperCase();
}

export function trackingLooksValid(carrierId: string | null | undefined, raw: string): boolean {
  const c = carrierById(carrierId);
  if (!c) return true; // ไม่รู้ขนส่ง = ไม่ตัดสิน
  return c.pattern.test(cleanTracking(raw));
}
