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

type ShopShipping = {
  name: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null; // อำเภอ / เขต
  state: string | null; // จังหวัด
  postal_code: string | null;
  country: string | null;
};

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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// ส่งอีเมลยืนยันคำสั่งซื้อผ่าน Resend (best-effort — ล้มเหลวไม่ทำให้ webhook พัง)
// ─────────────────────────────────────────────────────────────
async function sendOrderConfirmEmail(o: {
  email: string | null;
  items: any[];
  total: number; // บาท
  shipping: ShopShipping | null;
  orderId: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !o.email) {
    console.log("ข้ามอีเมลยืนยัน (ไม่มี RESEND_API_KEY หรือ email)");
    return;
  }
  const from =
    process.env.ORDER_EMAIL_FROM ?? "The Cardlist <orders@thecardlistbkk.com>";

  const itemsHtml = o.items
    .map(
      (it: any) =>
        `<tr>
          <td style="padding:6px 0;color:#27272a">${escapeHtml(String(it.name ?? ""))}</td>
          <td style="padding:6px 0;color:#71717a;text-align:center">x${Number(it.qty)}</td>
          <td style="padding:6px 0;color:#27272a;text-align:right">฿${(
            Number(it.price) * Number(it.qty)
          ).toLocaleString()}</td>
        </tr>`
    )
    .join("");

  const a = o.shipping;
  const addrHtml = a
    ? `${escapeHtml(a.name ?? "")}<br>` +
      `${escapeHtml(a.line1 ?? "")} ${escapeHtml(a.line2 ?? "")}<br>` +
      `${escapeHtml(a.city ?? "")} ${escapeHtml(a.state ?? "")} ${escapeHtml(
        a.postal_code ?? ""
      )}<br>` +
      `โทร ${escapeHtml(a.phone ?? "")}`
    : "-";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto;color:#18181b">
    <h2 style="margin:0 0 4px">ยืนยันคำสั่งซื้อ ✅</h2>
    <p style="color:#71717a;margin:0 0 16px">ขอบคุณที่สั่งซื้อกับ The Cardlist</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7">
      ${itemsHtml}
    </table>
    <p style="text-align:right;font-weight:700;margin:12px 0 20px">รวมทั้งหมด ฿${o.total.toLocaleString()}</p>
    <p style="font-weight:600;margin:0 0 4px">📦 ที่อยู่จัดส่ง</p>
    <p style="color:#3f3f46;font-size:14px;line-height:1.6;margin:0 0 20px">${addrHtml}</p>
    <p style="color:#a1a1aa;font-size:12px">เลขคำสั่งซื้อ: ${o.orderId}</p>
    <p style="color:#3f3f46;font-size:14px">ทีมงานจะแพ็คและจัดส่งให้เร็วๆ นี้ครับ 🙌</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [o.email],
        subject: "ยืนยันคำสั่งซื้อ • The Cardlist",
        html,
      }),
    });
    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Resend failed (ข้ามไป):", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Priority Guest Ticket ฿690  (ไม่แก้ไข)
// ─────────────────────────────────────────────────────────────
async function createPriorityTicket(
  supabase: SupabaseClient,
  opts: { userId: string | null; eventId: string | null; paymentId: string }
) {
  const { userId, paymentId } = opts;

  if (!userId) {
    console.error("Priority: ไม่พบ user_id ใน metadata:", paymentId);
    return;
  }

  // กันยิงซ้ำ
  const { data: existing } = await supabase
    .from("event_tickets")
    .select("id")
    .eq("charge_id", paymentId)
    .maybeSingle();

  if (existing) {
    console.log("Priority ticket already exists for:", paymentId);
    return;
  }

  const { data: ev } = await supabase
    .from("events")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const eventId = opts.eventId || ev?.id || null;

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
// General Pack ฿49  (ไม่แก้ไข)
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

  // กันยิงซ้ำ
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
// Shop Order  (ปรับใหม่: บันทึกที่อยู่จัดส่ง + ส่งอีเมล + LINE)
// ─────────────────────────────────────────────────────────────
async function createShopOrder(
  supabase: SupabaseClient,
  opts: {
    userId: string | null;
    email: string | null;
    itemsJson: string | null;
    amountTotal: number; // หน่วยสตางค์
    paymentId: string;
    shipping: ShopShipping | null;
  }
) {
  const { email, itemsJson, amountTotal, paymentId, shipping } = opts;

  // กันยิงซ้ำ
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existingOrder) {
    console.log("Shop order already exists for:", paymentId);
    return;
  }

  // หา user — ใช้ metadata.user_id ก่อน ถ้าไม่มีค่อย fallback ด้วย email
  let userId = opts.userId || null;
  if (!userId && email) {
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
      email: email,
      total_amount: amountTotal / 100,
      status: "paid",
      payment_id: paymentId,
      // ── ที่อยู่จัดส่ง (มาจากฟอร์ม Stripe) ──
      recipient_name: shipping?.name ?? null,
      phone: shipping?.phone ?? null,
      address_line1: shipping?.line1 ?? null,
      address_line2: shipping?.line2 ?? null,
      district: shipping?.city ?? null,
      province: shipping?.state ?? null,
      postal_code: shipping?.postal_code ?? null,
      country: shipping?.country ?? "TH",
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

  // ── ยืนยันคำสั่งซื้อ: อีเมล + LINE (best-effort) ──
  await sendOrderConfirmEmail({
    email,
    items,
    total: amountTotal / 100,
    shipping,
    orderId: order.id,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("line_user_id")
    .eq("id", userId)
    .single();

  if (profile?.line_user_id) {
    const itemLines = items
      .map((it: any) => `• ${it.name} x${it.qty}`)
      .join("\n");
    const a = shipping;
    const addrText = a
      ? `${a.name ?? ""}\n${a.line1 ?? ""} ${a.line2 ?? ""}\n${a.city ?? ""} ${
          a.state ?? ""
        } ${a.postal_code ?? ""}\nโทร ${a.phone ?? ""}`
      : "-";
    await sendLineNotify({
      lineUserId: profile.line_user_id,
      type: "broadcast",
      data: {
        message: `✅ ชำระเงินสำเร็จ! ขอบคุณที่สั่งซื้อกับ The Cardlist

🧾 รายการ:
${itemLines}

รวม ฿${(amountTotal / 100).toLocaleString()}

📦 จัดส่งถึง:
${addrText}

ทีมงานจะแพ็คและจัดส่งให้เร็วๆ นี้ครับ 🙌`,
      },
    });
  }

  console.log("✅ Shop order created for:", userId);
}

// ─────────────────────────────────────────────────────────────
// แยกประเภทตาม type แล้วเรียก handler ที่ตรงกัน
// ─────────────────────────────────────────────────────────────
async function routeByType(
  supabase: SupabaseClient,
  p: {
    type: string;
    userId: string | null;
    regId: string | null;
    eventId: string | null;
    email: string | null;
    itemsJson: string | null;
    amountTotal: number;
    paymentId: string;
    shipping: ShopShipping | null;
  }
) {
  const t = (p.type || "").toLowerCase();

  if (t === "priority" || t === "priority_ticket") {
    await createPriorityTicket(supabase, {
      userId: p.userId,
      eventId: p.eventId,
      paymentId: p.paymentId,
    });
  } else if (t === "general_pack") {
    await markGeneralPackPaid(supabase, {
      userId: p.userId,
      regId: p.regId,
      eventId: p.eventId,
      paymentId: p.paymentId,
    });
  } else if (t === "shop") {
    await createShopOrder(supabase, {
      userId: p.userId,
      email: p.email,
      itemsJson: p.itemsJson,
      amountTotal: p.amountTotal,
      paymentId: p.paymentId,
      shipping: p.shipping,
    });
  } else {
    console.warn("ไม่รู้จัก payment type:", t, p.paymentId);
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

// แปลง Checkout Session → พารามิเตอร์มาตรฐานสำหรับ routeByType
function sessionParams(s: Stripe.Checkout.Session) {
  const paymentId =
    typeof s.payment_intent === "string"
      ? s.payment_intent
      : s.payment_intent?.id ?? s.id;

  // ที่อยู่จัดส่ง: รองรับทั้ง shipping_details (เดิม) และ collected_information (ใหม่)
  const anyS = s as any;
  const sd =
    anyS.shipping_details ??
    anyS.collected_information?.shipping_details ??
    null;
  const cd = s.customer_details ?? null;
  const addr = sd?.address ?? cd?.address ?? null;

  const shipping: ShopShipping = {
    name: sd?.name ?? cd?.name ?? null,
    phone: cd?.phone ?? null,
    line1: addr?.line1 ?? null,
    line2: addr?.line2 ?? null,
    city: addr?.city ?? null,
    state: addr?.state ?? null,
    postal_code: addr?.postal_code ?? null,
    country: addr?.country ?? null,
  };

  return {
    type: s.metadata?.type ?? "",
    userId: s.metadata?.user_id || null,
    regId: s.metadata?.reg_id || null,
    eventId: s.metadata?.event_id || null,
    email: cd?.email ?? s.customer_email ?? null,
    itemsJson: s.metadata?.items || null,
    amountTotal: s.amount_total ?? 0,
    paymentId,
    shipping,
  };
}
