import { NextResponse } from "next/server";
import { getUserFromRequest, loadEvent, quote } from "@/lib/booth";
import { validateDiscount } from "@/lib/discount";

// ตรวจโค้ดส่วนลดเบื้องต้น (แสดงให้เห็นก่อนชำระ) — ตอนจองจริงเซิร์ฟเวอร์ตรวจซ้ำอีกครั้ง
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "เข้าสู่ระบบก่อนใช้โค้ดส่วนลด" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const ev = await loadEvent(String(body.eventId ?? ""));
  if (!ev || !ev.active) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  const q = quote(ev, body.tables, body.days);
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: 400 });
  if (!q.isFull) {
    return NextResponse.json({ error: "โค้ดส่วนลดใช้ได้เมื่อจองครบทุกวันเท่านั้น" }, { status: 400 });
  }

  const r = await validateDiscount({
    code: String(body.code ?? ""), scope: "tables", userId: user.id, eventId: ev.id,
    subtotal: q.subtotal, itemCount: q.lines.length,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, code: r.code, label: r.label, amount: r.amount });
}
