import { adminDb } from "@/lib/require-admin";

// โค้ดส่วนลด — ตรวจและคำนวณที่เซิร์ฟเวอร์เสมอ

export type DiscountScope = "tables" | "shop";

export type DiscountResult =
  | { ok: true; id: string; code: string; type: "percent" | "fixed"; value: number; amount: number; label: string }
  | { ok: false; error: string };

const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;

export async function validateDiscount(opts: {
  code: string;
  scope: DiscountScope;
  userId: string | null;
  eventId?: string | null; // งานที่กำลังจอง — โค้ดที่ผูกงานไว้ใช้ได้เฉพาะงานนั้น
  subtotal: number;
  itemCount: number;
}): Promise<DiscountResult> {
  const raw = (opts.code ?? "").trim();
  if (!CODE_RE.test(raw)) return { ok: false, error: "ไม่พบโค้ดนี้ ตรวจตัวสะกดอีกครั้ง" };
  const code = raw.toUpperCase();

  const { data: c } = await adminDb.from("discount_codes").select("*").eq("code", code).maybeSingle();
  if (!c || !c.active) return { ok: false, error: "ไม่พบโค้ดนี้ ตรวจตัวสะกดอีกครั้ง" };

  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { ok: false, error: "โค้ดนี้ยังไม่เริ่มใช้งาน" };
  if (c.expires_at && new Date(c.expires_at).getTime() <= now) return { ok: false, error: "โค้ดนี้หมดอายุแล้ว" };
  if (c.applies_to !== "all" && c.applies_to !== opts.scope) {
    return { ok: false, error: opts.scope === "tables" ? "โค้ดนี้ใช้กับการจองโต๊ะไม่ได้" : "โค้ดนี้ใช้กับร้านค้าไม่ได้" };
  }
  if (c.event_id && c.event_id !== opts.eventId) return { ok: false, error: "โค้ดนี้ใช้ได้เฉพาะงานที่กำหนด ใช้กับงานนี้ไม่ได้" };
  if (c.min_items && opts.itemCount < c.min_items) {
    return { ok: false, error: `โค้ดนี้ใช้ได้เมื่อจอง ${c.min_items} รายการขึ้นไป` };
  }
  if (c.min_amount && opts.subtotal < Number(c.min_amount)) {
    return { ok: false, error: `โค้ดนี้ใช้ได้เมื่อยอดตั้งแต่ ฿${Number(c.min_amount).toLocaleString()}` };
  }

  // นับสิทธิ์ที่ใช้ไปแล้ว + รายการที่กำลังรอชำระ (กันหลายคนกดพร้อมกันจนเกินโควต้า)
  const nowIso = new Date().toISOString();
  const countUsed = async (userId?: string) => {
    let q1 = adminDb.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", c.id);
    let q2 = adminDb.from("booth_bookings").select("id", { count: "exact", head: true })
      .eq("discount_code_id", c.id).eq("status", "hold").gt("hold_expires_at", nowIso);
    let q3 = adminDb.from("booth_bookings").select("id", { count: "exact", head: true })
      .eq("discount_code_id", c.id).eq("status", "unpaid");
    if (userId) { q1 = q1.eq("user_id", userId); q2 = q2.eq("user_id", userId); q3 = q3.eq("user_id", userId); }
    const [{ count: a }, { count: b }, { count: d }] = await Promise.all([q1, q2, q3]);
    return (a ?? 0) + (b ?? 0) + (d ?? 0);
  };
  if (c.max_uses && (await countUsed()) >= c.max_uses) return { ok: false, error: "โค้ดนี้ถูกใช้ครบจำนวนแล้ว" };
  if (c.per_user_limit) {
    if (!opts.userId) return { ok: false, error: "เข้าสู่ระบบก่อนใช้โค้ดนี้" };
    if ((await countUsed(opts.userId)) >= c.per_user_limit) return { ok: false, error: "คุณใช้โค้ดนี้ครบสิทธิ์แล้ว" };
  }

  const value = Number(c.value);
  const amount = c.type === "percent"
    ? Math.round((opts.subtotal * value) / 100)
    : Math.min(value, opts.subtotal);
  return {
    ok: true, id: c.id, code, type: c.type, value, amount,
    label: c.type === "percent" ? `ลด ${value}%` : `ลด ฿${value.toLocaleString()}`,
  };
}
