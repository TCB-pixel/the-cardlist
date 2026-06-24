import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

// GET — ใช้โดยหน้า /shop/success เพื่อแสดงสรุปคำสั่งซื้อ
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "missing session_id" }, { status: 400 });
    }
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({
      amount_total: session.amount_total,
      customer_email:
        session.customer_details?.email ?? session.customer_email ?? null,
      payment_status: session.payment_status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

    // เก็บ items แบบกระชับลง metadata (Stripe จำกัด 500 ตัวอักษร/ฟิลด์)
    const compactItems = items.map((it: any) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price),
      qty: Number(it.qty),
    }));
    const itemsJson = JSON.stringify(compactItems);

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
        user_id: userId ?? "",
        email: email ?? "",
        items: itemsJson,
      },
      success_url: `${SITE_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/shop`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
