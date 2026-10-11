import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { resendCustomerLineCard } from "@/lib/order-notify";

// ส่งการ์ดยืนยันออเดอร์ให้ลูกค้าทาง LINE อีกครั้ง
// - ส่งเฉพาะ LINE ลูกค้า ไม่แจ้งทีมงาน ไม่ส่งอีเมล
// - ส่งได้ทีละ 1 ออเดอร์ และจดเวลาที่ส่งไว้ในหมายเหตุออเดอร์ กันกดซ้ำโดยไม่รู้ตัว
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "orders:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "ไม่พบ order id" }, { status: 400 });
    }

    const { data: order } = await adminDb
      .from("orders")
      .select("id, note, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์นี้" }, { status: 404 });

    const r = await resendCustomerLineCard(adminDb, orderId);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });

    const stamp = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    const note = [order.note, `📨 ส่งการ์ดยืนยันซ้ำทาง LINE โดย ${auth.caller.email} เมื่อ ${stamp}`]
      .filter(Boolean)
      .join(" | ");
    await adminDb.from("orders").update({ note: note.slice(0, 1000) }).eq("id", orderId);

    return NextResponse.json({ ok: true, to: r.to });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
