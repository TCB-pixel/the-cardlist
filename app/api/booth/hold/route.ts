import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/require-admin";
import { fmtDay, getUserFromRequest, loadEvent, quote, releaseExpired } from "@/lib/booth";
import { validateDiscount } from "@/lib/discount";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

// กันโต๊ะ + เปิดหน้าชำระเงิน Stripe
// ลำดับสำคัญ: กันโต๊ะที่ฐานข้อมูลก่อน (unique index กันซ้ำ) แล้วค่อยสร้าง session — จ่ายไม่ทัน/ปิดหน้า = โต๊ะหลุดเอง
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "เข้าสู่ระบบก่อนจองโต๊ะ" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const paymentMethod: "card" | "promptpay" = body.paymentMethod === "card" ? "card" : "promptpay";
  const shop = String(body.vendor?.shop ?? "").trim().slice(0, 80);
  const contact = String(body.vendor?.name ?? "").trim().slice(0, 80);
  const phone = String(body.vendor?.phone ?? "").replace(/\D/g, "");
  if (!shop || !contact) return NextResponse.json({ error: "กรอกชื่อร้านและชื่อผู้ติดต่อ" }, { status: 400 });
  if (!/^0\d{8,9}$/.test(phone)) return NextResponse.json({ error: "เบอร์โทรไม่ถูกต้อง" }, { status: 400 });

  await releaseExpired();
  const ev = await loadEvent(String(body.eventId ?? ""));
  if (!ev || !ev.active) return NextResponse.json({ error: "ไม่พบงานนี้หรือปิดรับจองแล้ว" }, { status: 404 });

  const q = quote(ev, body.tables, body.days);
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: 400 });

  // โค้ดส่วนลด: เฉพาะแพ็กเกจครบทุกวัน และตรวจที่เซิร์ฟเวอร์ซ้ำเสมอ
  let discount: { id: string; code: string; amount: number } | null = null;
  const codeIn = String(body.code ?? "").trim();
  if (codeIn) {
    if (!q.isFull) return NextResponse.json({ error: "โค้ดส่วนลดใช้ได้เมื่อจองครบทุกวันเท่านั้น" }, { status: 400 });
    const r = await validateDiscount({ code: codeIn, scope: "tables", userId: user.id, subtotal: q.subtotal, itemCount: q.lines.length });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    discount = { id: r.id, code: r.code, amount: r.amount };
  }
  const discountAmount = discount?.amount ?? 0;
  const base = q.subtotal - discountAmount;
  const cardFee = paymentMethod === "card" ? Math.round(base * 0.03) : 0;
  const total = base + cardFee;
  if (total <= 0) return NextResponse.json({ error: "ยอดชำระไม่ถูกต้อง" }, { status: 400 });

  // ยกเลิก hold เก่าของผู้ใช้คนเดิม (ไม่ให้กันโต๊ะค้างหลายชุด)
  const { data: old } = await adminDb.from("booth_bookings").select("id, stripe_session_id")
    .eq("user_id", user.id).eq("event_id", ev.id).eq("status", "hold");
  for (const o of old ?? []) await cancelHold(o.id, o.stripe_session_id);

  const holdExpires = new Date(Date.now() + ev.hold_minutes * 60_000);
  const { data: booking, error: bErr } = await adminDb.from("booth_bookings").insert({
    event_id: ev.id, user_id: user.id, status: "hold", days: q.days,
    subtotal: q.subtotal, discount_code: discount?.code ?? null, discount_code_id: discount?.id ?? null,
    discount_amount: discountAmount, card_fee: cardFee, total,
    hold_expires_at: holdExpires.toISOString(),
    shop_name: shop, contact_name: contact, phone,
  }).select("id").single();
  if (bErr || !booking) return NextResponse.json({ error: "กันโต๊ะไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });

  // กันโต๊ะ: แถวละ (โต๊ะ, วัน) — ถ้าชนกับของคนอื่น unique index จะปฏิเสธทั้งชุด
  const rows = q.lines.flatMap((l) =>
    q.days.map((d) => ({
      booking_id: booking.id, event_id: ev.id, table_id: l.table_id, day: d,
      price: Math.round((l.price / q.days.length) * 100) / 100,
    }))
  );
  const { error: tErr } = await adminDb.from("booth_booking_tables").insert(rows);
  if (tErr) {
    await adminDb.from("booth_bookings").delete().eq("id", booking.id);
    if (tErr.code === "23505") {
      return NextResponse.json({ error: "มีผู้จองโต๊ะที่คุณเลือกไปก่อนแล้ว กรุณาเลือกโต๊ะใหม่" }, { status: 409 });
    }
    return NextResponse.json({ error: "กันโต๊ะไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const daysLabel = q.isFull ? `ครบ ${q.days.length} วัน` : `วันที่ ${q.days.map(fmtDay).join(", ")}`;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = q.lines.map((l) => ({
      price_data: {
        currency: "thb",
        product_data: { name: `${ev.title} — ${l.label} ${l.table_id} (${l.size}) · ${daysLabel}` },
        unit_amount: Math.round(l.price * 100),
      },
      quantity: 1,
    }));
    if (cardFee > 0) {
      lineItems.push({
        price_data: { currency: "thb", product_data: { name: "ค่าธรรมเนียมการชำระด้วยบัตรเครดิต/เดบิต (3%)" }, unit_amount: cardFee * 100 },
        quantity: 1,
      });
    }

    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (discountAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountAmount * 100, currency: "thb", duration: "once", name: `โค้ด ${discount!.code}`,
      });
      discounts = [{ coupon: coupon.id }];
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: [paymentMethod],
      locale: "th",
      customer_email: user.email ?? undefined,
      line_items: lineItems,
      discounts,
      // Stripe ต้องการอายุอย่างน้อย 30 นาที — ตั้งให้เกินเวลากันโต๊ะ 1 นาที จ่ายช้าสุดก็ยังทันก่อนโต๊ะหลุด
      expires_at: nowSec + ev.hold_minutes * 60 + 60,
      metadata: { type: "booth", booking_id: booking.id, user_id: user.id, event_id: ev.id },
      success_url: `${SITE_URL}/booth/success?booking=${booking.id}`,
      cancel_url: `${SITE_URL}/booth?event=${ev.id}`,
    });
    await adminDb.from("booth_bookings").update({ stripe_session_id: session.id }).eq("id", booking.id);
    return NextResponse.json({ url: session.url, bookingId: booking.id, holdExpiresAt: holdExpires.toISOString() });
  } catch (e: any) {
    // สร้างหน้าชำระไม่สำเร็จ → คืนโต๊ะทันที
    await cancelHold(booking.id, null);
    console.error("booth hold stripe error:", e?.message);
    return NextResponse.json({ error: "เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

async function cancelHold(bookingId: string, sessionId: string | null) {
  await adminDb.from("booth_booking_tables").update({ active: false }).eq("booking_id", bookingId);
  await adminDb.from("booth_bookings").update({ status: "cancelled" }).eq("id", bookingId).eq("status", "hold");
  if (sessionId) {
    try {
      await new Stripe(process.env.STRIPE_SECRET_KEY!).checkout.sessions.expire(sessionId);
    } catch {
      /* หมดอายุ/จ่ายแล้ว ก็ข้าม */
    }
  }
}
