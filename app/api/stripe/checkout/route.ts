import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: any[] = Array.isArray(body.items) ? body.items : [];
    const userId: string | null = body.userId ?? null;
    const email: string | null = body.email ?? null;

    if (items.length === 0) {
      return NextResponse.json(
        { error: "ไม่มีสินค้าในตะกร้า" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const supabase = getAdminSupabase();

    // ราคารวม (บาท)
    const subtotalBaht = items.reduce(
      (sum: number, it: any) => sum + Number(it.price) * Number(it.qty),
      0
    );

    // 1) สร้างออเดอร์สถานะ pending ไว้ก่อน (กันปัญหา metadata 500 ตัวอักษรของ Stripe)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        email,
        amount_total: subtotalBaht * 100, // เก็บเป็นสตางค์
        currency: "thb",
        status: "pending",
        payment_status: "unpaid",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "สร้างคำสั่งซื้อไม่สำเร็จ: " + (orderErr?.message ?? "") },
        { status: 500 }
      );
    }

    // 2) บันทึกรายการสินค้าในออเดอร์
    const itemRows = items.map((it: any) => ({
      order_id: order.id,
      product_id: it.id ?? null,
      name: it.name,
      price: Number(it.price), // บาท
      qty: Number(it.qty),
      image_url: it.image_url ?? null,
    }));
    await supabase.from("order_items").insert(itemRows);

    // 3) สร้าง Stripe Checkout Session พร้อม "เก็บที่อยู่จัดส่ง"
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "promptpay"],
      locale: "th",
      customer_email: email ?? undefined,
      line_items: items.map((it: any) => ({
        price_data: {
          currency: "thb",
          product_data: {
            name: it.name,
            ...(it.image_url ? { images: [it.image_url] } : {}),
          },
          unit_amount: Number(it.price) * 100,
        },
        quantity: Number(it.qty),
      })),
      // ✅ ฟอร์มที่อยู่จัดส่ง (เฉพาะไทย) + เบอร์โทร โผล่บนหน้า Stripe
      shipping_address_collection: { allowed_countries: ["TH"] },
      phone_number_collection: { enabled: true },
      metadata: {
        type: "shop",
        order_id: order.id,
        user_id: userId ?? "",
        email: email ?? "",
      },
      payment_intent_data: {
        metadata: {
          type: "shop",
          order_id: order.id,
        },
      },
      success_url: `${SITE_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/shop`,
    });

    // 4) ผูก session id กับออเดอร์
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
