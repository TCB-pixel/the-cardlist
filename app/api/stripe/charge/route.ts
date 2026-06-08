import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: NextRequest) {
  const { amount, description, paymentMethod, email } = await request.json();
  const stripe = getStripe();

  try {
    if (paymentMethod === "promptpay") {
      // PromptPay — confirm ทันที
      const pm = await stripe.paymentMethods.create({
        type: "promptpay",
        billing_details: { email: email ?? "guest@thecardlist.com" },
      });
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "thb",
        payment_method: pm.id,
        payment_method_types: ["promptpay"],
        description,
        confirm: true,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/payment/complete`,
      });

      const qrImage = (paymentIntent.next_action as any)
        ?.promptpay_display_qr_code?.image_url_png ?? null;

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        qrImage,
        status: paymentIntent.status,
        type: "promptpay",
      });

    } else {
      // Credit Card — สร้าง PaymentIntent แล้วให้ frontend confirm ด้วย card
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "thb",
        payment_method_types: ["card"],
        description,
        receipt_email: email ?? undefined,
      });

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        type: "card",
      });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get("paymentIntentId");
  if (!paymentIntentId) return NextResponse.json({ error: "No paymentIntentId" }, { status: 400 });

  const stripe = getStripe();
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
