// พรีออเดอร์: ใช้ช่อง stock เป็นโควต้าที่เปิดรับ (หมด = ปิดรับ) ที่เหลือใช้ flow ซื้อ/ตัดสต็อกเดิมทั้งหมด
// มัดจำ: ถ้าตั้ง preorder_deposit ลูกค้าจ่ายแค่ค่ามัดจำต่อชิ้นตอนสั่ง ส่วนที่เหลือชำระตอนสินค้าเข้า
// วันวางจำหน่ายเก็บเป็นวันที่ล้วน (YYYY-MM-DD) ปิดรับเก็บเป็นเวลา แสดงตามเวลาไทย

export type PreorderFields = {
  is_preorder?: boolean | null;
  preorder_release_date?: string | null;
  preorder_deposit?: number | string | null;
  preorder_close_at?: string | null;
  price: number | string;
};

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

export function formatReleaseDate(d: string | null | undefined, withYear = true, locale: string = "th-TH"): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00+07:00`);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(locale, {
    day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "Asia/Bangkok",
  });
}

export function formatCloseAt(iso: string | null | undefined, locale: string = "th-TH"): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  const date = dt.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  const time = dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
  return locale === "th-TH" ? `${date} ${time} น.` : `${date} ${time}`;
}

export function isPreorderClosed(p: { is_preorder?: boolean | null; preorder_close_at?: string | null }, now = Date.now()): boolean {
  return !!p.is_preorder && !!p.preorder_close_at && new Date(p.preorder_close_at).getTime() <= now;
}

/** ค่ามัดจำต่อชิ้น (ถ้าสินค้านี้เก็บมัดจำ) — ต้องมากกว่า 0 และน้อยกว่าราคาเต็ม */
export function depositOf(p: PreorderFields): number | null {
  if (!p.is_preorder) return null;
  const dep = Number(p.preorder_deposit);
  const full = Number(p.price);
  return Number.isFinite(dep) && dep > 0 && dep < full ? dep : null;
}

/** ราคาที่ลูกค้าจ่ายจริงตอนสั่งต่อชิ้น */
export function payableOf(p: PreorderFields): number {
  return depositOf(p) ?? Number(p.price);
}

// ต่อท้ายชื่อสินค้าให้ลูกค้าเห็นตรงกันทุกที่ (หน้า Stripe, ใบเสร็จ, การ์ด LINE, อีเมล, หลังบ้าน)
export function preorderLabel(name: string, p: PreorderFields): string {
  const dep = depositOf(p);
  const d = formatReleaseDate(p.preorder_release_date);
  const parts = ["พรีออเดอร์"];
  if (dep) parts.push(`มัดจำ ${baht(dep)} จากราคา ${baht(Number(p.price))}`);
  if (d) parts.push(`วางจำหน่าย ${d}`);
  return `${name} (${parts.join(" · ")})`;
}
