import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

// ─────────────────────────────────────────────────────────────
// Helper: ส่ง LINE notify (ไม่ throw ถ้า fail เพื่อไม่ให้ webhook พัง)
// ─────────────────────────────────────────────────────────────
async function sendLineNotify(payload: Record<string, unknown>) {
  try {
    await fetch(`${SITE_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("LINE notify failed (ข้ามไป):", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Priority Guest Ticket ฿690 (ผ่าน PaymentIntent โดยตรง)
// ─────────────────────────────────────────────────────────────
async function createPriorityTicket(
  supabase: SupabaseClient,
  opts: { userId: string | null; eventId: string | null; paymentId: string }
) {
  const { userId, paymentId } = opts;

  // กันยิงซ้ำ: ถ้ามี ticket ที่ผูก charge_id นี้แล้ว ไม่ทำซ้ำ
  const { data: existing } = await supabase
    .from("event_tickets")
    .select("id")
    .eq("charge_id", paymentId)
    .maybeSingle();

  if (existing) {
    console.log("Priority ticket already exists for:", paymentId);
    return;
  }

  // หา event ล่าสุดถ้าไม่มี event_id ส่งมา
  const { data: ev } = await supabase
    .from("events")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const eventId = opts.eventId ?? ev?.id ?? null;

  if (!userId) {
    console.error("Priority: ไม่พบ user_id ใน metadata:", paymentId);
    return;
  }

  const qrCode = `PG-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;

  const { error: insertErr } = await supabase.from("event_tickets").insert({
    user_id: userId,
    event_id: eventId,
    status: "approved",
    qr_code: qrCode,
    charge_id: paymentId,
    free_pack_redeemed: false,
    free_pack_quota: 5,
    free_pack_used: 0,
    ma5_slot: null,
  });

  if (insertErr) {
    console.error("Insert priority ticket error:", insertErr);
    throw new Error(insertErr.message);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("line_user_id")
    .eq("id", userId)
    .single();

  if (profile?.line_user_id) {
    await sendLineNotify({
      lineUserId: profile.line_user_id,
      type: "ticket_approved",
      data: { eventTitle: ev?.title ?? "งาน", qrCode },
    });
  }

  console.log("✅ Priority ticket created:", qrCode);
}

// ─────────────────────────────────────────────────────────────
// General Pack ฿49 (ผ่าน Checkout Session)
// ─────────────────────────────────────────────────────────────
async function markGeneralPackPaid(
  supabase: SupabaseClient,
  opts: {
    userId: string | null;
    regId: string | null;
    eventId: string | null;
    paymentId: string;
  }
) {
  const { userId, regId, eventId, paymentId } = opts;

  if (!userId || !regId) {
    console.error("General Pack metadata ไม่ครบ:", { userId, regId, paymentId });
    return;
  }

  // กันยิงซ้ำ / refresh / Stripe retry
  const { data: existingReg } = await supabase
    .from("general_registrations")
    .select("id, pack_paid")
    .eq("id", regId)
    .maybeSingle();

  if (existingReg?.pack_paid) {
    console.log("General Pack already marked paid:", regId);
    return;
  }

  const { error: updateErr } = await supabase
    .from("general_registrations")
    .update({ pack_paid: true, pack_payment_id: paymentId })
    .eq("id", regId)
    .eq("user_id", userId);

  if (updateErr) {
    console.error("General Pack update error:", updateErr);
    throw new Error(updateErr.message);
  }

  const [{ data: profile }, { data: ev }] = await Promise.all([
    supabase.from("profiles").select("line_user_id").eq("id", userId).single(),
    eventId
      ? supabase.from("events").select("title").eq("id", eventId).single()
      : Promise.resolve({ data: null } as any),
  ]);

  if (profile?.line_user_id) {
    await sendLineNotify({
      lineUserId: profile.line_user_id,
      type: "broadcast",
      data: {
        message: `✅ ชำระเงินสำเร็จ!

📍 งาน: ${ev?.title ?? "งาน"}
🛍️ สิทธิ์ซื้อ Booster Pack ราคาป้าย 1 ซอง

แสดง QR Code หน้างานเพื่อรับสิทธิ์ครับ 🙌`,
      },
    });
  }

  console.log("✅ General Pack paid:", regId);
}

// ─────────────────────────────────────────────────────────────
// Shop Order (ผ่าน Checkout Session)
// ─────────────────────────────────────────────────────────────
async function createShopOrder(
  supabase: SupabaseClient,
  opts: {
    email: string | null;
    itemsJson: string | null;
    amountTotal: number; // หน่วยสตางค์
    paymentId: string;
  }
) {
  const { email, itemsJson, amountTotal, paymentId } = opts;

  // กันยิงซ้ำ: ถ้ามี order ที่ผูก payment_id นี้แล้ว ไม่ทำซ้ำ
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existingOrder) {
    console.log("Shop order already exists for:", paymentId);
    return;
  }

  let userId: string | null = null;
  if (email) {
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers();
    const user = users.find((u) => u.email === email);
    if (user) userId = user.id;
  }

  let items: any[] = [];
  try {
    items = JSON.parse(itemsJson ?? "[]");
  } catch {
    items = [];
  }

  if (!userId || items.length === 0) {
    console.error("Shop order: ไม่พบ user หรือไม่มี items", { email, paymentId });
    return;
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      total_amount: amountTotal / 100,
      status: "paid",
      payment_id: paymentId,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    console.error("Create shop order error:", orderErr);
    throw new Error(orderErr?.message ?? "create order failed");
  }

  await supabase.from("order_items").insert(
    items.map((item: any) => ({
      order_id: order.id,
      product_id: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty,
    }))
  );

  for (const item of items) {
    await supabase.rpc("decrement_stock", {
      product_id: item.id,
      qty: item.qty,
    });
  }

  console.log("✅ Shop order created for:", email);
}

// ─────────────────────────────────────────────────────────────
// แยกประเภทแล้วเรียก handler ตาม metadata.type ของ Checkout Session
// ─────────────────────────────────────────────────────────────
async function handleCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const type = session.metadata?.type ?? "";
  const paymentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? session.id;

  if (type === "general_pack") {
    await markGeneralPackPaid(supabase, {
      userId: session.metadata?.user_id ?? null,
      regId: session.metadata?.reg_id ?? null,
      eventId: session.metadata?.event_id ?? null,
      paymentId,
    });
  } else if (type === "shop") {
    await createShopOrder(supabase, {
      email:
        session.customer_details?.email ??
        session.customer_email ??
        null,
      itemsJson: session.metadata?.items ?? null,
      amountTotal: session.amount_total ?? 0,
      paymentId,
    });
  } else {
    console.warn("Checkout session ไม่มี metadata.type ที่รู้จัก:", session.id, type);
  }
}

// ─────────────────────────────────────────────────────────────
// Webhook entry point
// ─────────────────────────────────────────────────────────────
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
      // ── Priority Guest ฿690 (PaymentIntent โดยตรง) ──
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const description = pi.description ?? "";

        // รับเฉพาะ Priority เท่านั้น — General/Shop ย้ายไปใช้ Checkout แล้ว
        if (
          description.includes("Priority Guest Ticket") ||
          pi.metadata?.type === "priority"
        ) {
          await createPriorityTicket(supabase, {
            userId: pi.metadata?.user_id ?? null,
            eventId: pi.metadata?.event_id ?? null,
            paymentId: pi.id,
          });
        }
        break;
      }

      // ── Checkout เสร็จ: เช็ก payment_status ก่อน เพราะ PromptPay เป็น async ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          await handleCheckoutSession(supabase, session);
        } else {
          // PromptPay ยังไม่จ่าย → รอ async_payment_succeeded
          console.log(
            "Checkout completed แต่ยังไม่จ่าย (รอ async):",
            session.id,
            session.payment_status
          );
        }
        break;
      }

      // ── PromptPay จ่ายสำเร็จแบบ delayed ──
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSession(supabase, session);
        break;
      }

      // ── PromptPay จ่ายไม่สำเร็จ / หมดเวลา ──
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.warn(
          "Checkout async payment failed:",
          session.id,
          session.metadata?.type
        );
        // ปล่อยให้ลูกค้าเริ่ม checkout ใหม่ได้ ไม่ต้องอัปเดตอะไร
        break;
      }

      default:
        // event อื่นที่เรา subscribe แต่ไม่ได้ใช้
        break;
    }
  } catch (err: any) {
    // คืน 500 เพื่อให้ Stripe retry — idempotency guard กันการทำซ้ำไว้แล้ว
    console.error("Webhook handler error:", err?.message ?? err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
