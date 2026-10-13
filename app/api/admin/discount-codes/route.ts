import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

const CODE_RE = /^[A-Z0-9_-]{2,40}$/;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function date(v: unknown): string | null | undefined {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "booth:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data } = await adminDb.from("discount_codes").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ codes: data ?? [] });
}

// สร้าง/แก้โค้ด (ใส่ id = แก้) · { action: "delete", id } ลบได้เฉพาะโค้ดที่ยังไม่เคยถูกใช้
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "booth:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => ({}));

  if (body.action === "delete") {
    const { count } = await adminDb.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", body.id);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "โค้ดนี้เคยถูกใช้แล้ว ลบไม่ได้ ให้ปิดใช้งานแทน" }, { status: 400 });
    const { error } = await adminDb.from("discount_codes").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: "ลบไม่สำเร็จ (อาจมีการจองที่อ้างอิงอยู่) ให้ปิดใช้งานแทน" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const code = String(body.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "โค้ดใช้ได้เฉพาะ A–Z 0–9 _ - ยาว 2–40 ตัว" }, { status: 400 });
  const type = body.type === "fixed" ? "fixed" : "percent";
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "มูลค่าส่วนลดต้องมากกว่า 0" }, { status: 400 });
  if (type === "percent" && value > 100) return NextResponse.json({ error: "ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100" }, { status: 400 });
  const applies = ["all", "tables", "shop"].includes(body.applies_to) ? body.applies_to : "all";

  const minItems = num(body.min_items), minAmount = num(body.min_amount), maxUses = num(body.max_uses), perUser = num(body.per_user_limit);
  if ([minItems, minAmount, maxUses, perUser].some((n) => Number.isNaN(n))) return NextResponse.json({ error: "ตัวเลขเงื่อนไขไม่ถูกต้อง" }, { status: 400 });
  const startsAt = date(body.starts_at), expiresAt = date(body.expires_at);
  if (startsAt === undefined || expiresAt === undefined) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  if (startsAt && expiresAt && startsAt >= expiresAt) return NextResponse.json({ error: "วันหมดอายุต้องหลังวันเริ่มใช้" }, { status: 400 });

  const row = {
    code, type, value, applies_to: applies,
    min_items: minItems, min_amount: minAmount, max_uses: maxUses, per_user_limit: perUser,
    starts_at: startsAt, expires_at: expiresAt,
    active: body.active !== false, note: String(body.note ?? "").trim() || null,
  };

  if (body.id) {
    const { error } = await adminDb.from("discount_codes").update(row).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.code === "23505" ? "มีโค้ดนี้อยู่แล้ว" : error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const { error } = await adminDb.from("discount_codes").insert(row);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "มีโค้ดนี้อยู่แล้ว" : error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
