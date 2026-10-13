import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/require-admin";
import { getUserFromRequest } from "@/lib/booth";

// ผู้จองยกเลิกรายการที่ยังรอชำระ (คืนโต๊ะทันที) — รายการที่จ่ายแล้วยกเลิกเองไม่ได้ ต้องติดต่อทีมงาน
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  const { bookingId } = await req.json().catch(() => ({}));

  const { data: b } = await adminDb.from("booth_bookings").select("id, status, stripe_session_id")
    .eq("id", String(bookingId ?? "")).eq("user_id", user.id).maybeSingle();
  if (!b) return NextResponse.json({ error: "ไม่พบรายการจอง" }, { status: 404 });
  if (b.status !== "hold") return NextResponse.json({ error: "รายการนี้ยกเลิกเองไม่ได้ กรุณาติดต่อทีมงาน" }, { status: 400 });

  await adminDb.from("booth_booking_tables").update({ active: false }).eq("booking_id", b.id);
  await adminDb.from("booth_bookings").update({ status: "cancelled" }).eq("id", b.id).eq("status", "hold");
  if (b.stripe_session_id) {
    try {
      await new Stripe(process.env.STRIPE_SECRET_KEY!).checkout.sessions.expire(b.stripe_session_id);
    } catch {
      /* ข้าม */
    }
  }
  return NextResponse.json({ ok: true });
}
