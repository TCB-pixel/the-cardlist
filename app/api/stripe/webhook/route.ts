import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { routeByType, sessionParams } from "@/lib/stripe-fulfilment";

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
  const body = await request.text(); // ต้องใช้ raw body เพื่อ verify signature
  const sig = request.headers.get("stripe-signature")!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = getSupabase();

  try {
    switch (event.type) {
      // ── PaymentIntent โดยตรง (Priority ฿690 ผ่าน PromptPay QR) ──
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const description = pi.description ?? "";
        const type =
          pi.metadata?.type ||
          (description.includes("Priority Guest") ? "priority" : "");

        // shop ให้ session เป็นคนสร้าง (ที่อยู่จัดส่งอยู่บน session ไม่ใช่ PI)
        if (type.toLowerCase() === "shop") {
          console.log("ข้าม shop ใน PI path — ใช้ checkout.session แทน:", pi.id);
          break;
        }

        await routeByType(supabase, {
          type,
          userId: pi.metadata?.user_id || null,
          regId: pi.metadata?.reg_id || null,
          eventId: pi.metadata?.event_id || null,
          email: pi.receipt_email || null,
          itemsJson: pi.metadata?.items || null,
          amountTotal: pi.amount,
          paymentId: pi.id,
          shipping: null,
          cardFee: 0,
          shippingFee: Number(pi.metadata?.shipping_fee || 0),
        });
        break;
      }

      // ── Checkout เสร็จ: เช็ก payment_status ก่อน (PromptPay เป็น async) ──
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.payment_status !== "paid") {
          console.log("Checkout completed แต่ยังไม่จ่าย (รอ async):", s.id, s.payment_status);
          break;
        }
        await routeByType(supabase, sessionParams(s));
        break;
      }

      // ── PromptPay จ่ายสำเร็จแบบ delayed ──
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        await routeByType(supabase, sessionParams(s));
        break;
      }

      // ── PromptPay จ่ายไม่สำเร็จ / หมดเวลา ──
      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        console.warn("Checkout async payment failed:", s.id, s.metadata?.type);
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    // คืน 500 ให้ Stripe retry — idempotency guard กันทำซ้ำไว้แล้ว
    console.error("Webhook handler error:", err?.message ?? err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
