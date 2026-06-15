import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// สร้าง Checkout Session
export async function POST(request: NextRequest) {
  const { items } = await request.json();
  const stripe = getStripe();

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
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/shop`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ดึง session status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "No session_id" }, { status: 400 });

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({
      amount_total: session.amount_total,
      customer_email: session.customer_email,
      payment_status: session.payment_status,
      status: session.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
