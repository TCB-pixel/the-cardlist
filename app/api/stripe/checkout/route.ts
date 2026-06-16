import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

// สร้าง Checkout Session
// body: { type, items, userId, regId, eventId, email }
//   - type: "shop" | "general_pack"
//   - items: [{ id, name, price, qty, image_url? }]
export async function POST(request: NextRequest) {
  const { type, items, userId, regId, eventId, email } = await request.json();
  const stripe = getStripe();

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  // เก็บ items แบบกระชับใน metadata (Stripe จำกัด 500 ตัวอักษร/ค่า)
  // webhook จะอ่านชุดนี้ไปสร้าง order_items
  const itemsForMeta = JSON.stringify(
    items.map((i: any) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
    }))
  );

  if (itemsForMeta.length > 500) {
    return NextResponse.json(
      { error: "ตะกร้ามีสินค้ามากเกินไปสำหรับ checkout (เกินขีดจำกัด metadata)" },
      { status: 400 }
    );
  }

  const metadata: Stripe.MetadataParam = {
    type: type ?? "shop",
    user_id: userId ?? "",
    reg_id: regId ?? "",
    event_id: eventId ?? "",
    items: type === "shop" ? itemsForMeta : "",
  };

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "promptpay"],
      line_items: items.map((item: any) => ({
        price_data: {
          currency: "thb",
          product_data: {
            name: item.name,
            ...(item.image_url ? { images: [item.image_url] } : {}),
          },
          unit_amount: item.price * 100,
        },
        quantity: item.qty,
      })),
      mode: "payment",
      // เซ็ต metadata ทั้งบน session และ payment_intent เพื่อให้ webhook อ่านได้แน่นอน
      metadata,
      payment_intent_data: { metadata },
      ...(email ? { customer_email: email } : {}),
      success_url: `${SITE_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/shop`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ดึง session status (ใช้ในหน้า /shop/success)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId)
    return NextResponse.json({ error: "No session_id" }, { status: 400 });

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({
      amount_total: session.amount_total,
      customer_email:
        session.customer_details?.email ?? session.customer_email ?? null,
      payment_status: session.payment_status,
      status: session.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
