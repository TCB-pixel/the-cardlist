// พรีออเดอร์: ใช้ช่อง stock เป็นโควต้าที่เปิดรับ (หมด = ปิดรับ) ที่เหลือใช้ flow ซื้อ/ตัดสต็อกเดิมทั้งหมด
// วันวางจำหน่ายเก็บเป็นวันที่ล้วน (YYYY-MM-DD) แสดงตามเวลาไทย

export function formatReleaseDate(d: string | null | undefined, withYear = true): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00+07:00`);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("th-TH", {
    day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "Asia/Bangkok",
  });
}

// ต่อท้ายชื่อสินค้าให้ลูกค้าเห็นตรงกันทุกที่ (หน้า Stripe, ใบเสร็จ, การ์ด LINE, อีเมล, หลังบ้าน)
export function preorderLabel(name: string, releaseDate?: string | null): string {
  const d = formatReleaseDate(releaseDate);
  return `${name} (พรีออเดอร์${d ? ` · วางจำหน่าย ${d}` : ""})`;
}
