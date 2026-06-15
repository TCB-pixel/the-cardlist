import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const { amount, description, paymentMethod, email, userId, eventId, items } = await request.json();
  const stripe = getStripe();

  try {
    if (paymentMethod === "promptpay") {
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
        receipt_email: email ?? undefined,
        // เก็บ metadata สำคัญ
        metadata: {
          type: description.includes("Priority Guest") ? "priority_ticket" : "shop",
          user_id: userId ?? "",
          event_id: eventId ?? "",
          items: items ? JSON.stringify(items) : "",
        },
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
    }

    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });

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
