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
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const description = pi.description ?? "";
    const supabase = getSupabase();

    // ─── Priority Guest Ticket ───
    if (description.includes("Priority Guest Ticket")) {
      // เช็คว่าสร้าง ticket ไปแล้วหรือยัง
      const { data: existing } = await supabase
        .from("event_tickets")
        .select("id")
        .eq("charge_id", pi.id)
        .single();

      if (existing) {
        console.log("Ticket already exists for:", pi.id);
        return NextResponse.json({ ok: true });
      }

      // หา event ล่าสุด
      const { data: ev } = await supabase
        .from("events")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // ดึง user_id จาก metadata
      const userId = pi.metadata?.user_id ?? null;
      const eventId = pi.metadata?.event_id ?? ev?.id;

      if (!userId) {
        console.error("Cannot find user_id in metadata");
        return NextResponse.json({ error: "User not found" }, { status: 200 });
      }

      // สร้าง QR Code
      const qrCode = `PG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const { error: insertErr } = await supabase.from("event_tickets").insert({
        user_id: userId,
        event_id: eventId,
        status: "approved",
        qr_code: qrCode,
        charge_id: pi.id,
        free_pack_redeemed: false,
        free_pack_quota: 5,
        free_pack_used: 0,
        ma5_slot: null,
      });

      if (insertErr) {
        console.error("Insert ticket error:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      // ส่ง LINE notify
      const { data: profile } = await supabase
        .from("profiles")
        .select("line_user_id")
        .eq("id", userId)
        .single();

      if (profile?.line_user_id) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/api/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.line_user_id,
            type: "ticket_approved",
            data: { eventTitle: ev?.title ?? "งาน", qrCode },
          }),
        });
      }

      console.log("✅ Priority ticket created:", qrCode);
    }

    // ─── General Pack ───
    else if (description.includes("General Pack") || pi.metadata?.type === "general_pack") {
      const userId = pi.metadata?.user_id ?? null;
      const regId = pi.metadata?.reg_id ?? null;
      const eventId = pi.metadata?.event_id ?? null;

      if (!userId || !regId) {
        console.error("General Pack metadata missing:", { userId, regId, paymentIntentId: pi.id });
        return NextResponse.json({ ok: true });
      }

      // กัน webhook ยิงซ้ำ / ผู้ใช้ refresh / Stripe retry
      const { data: existingReg } = await supabase
        .from("general_registrations")
        .select("id, pack_paid, pack_payment_id")
        .eq("id", regId)
        .single();

      if (existingReg?.pack_paid) {
        console.log("General Pack already marked paid:", regId);
        return NextResponse.json({ ok: true });
      }

      const { error: updateErr } = await supabase
        .from("general_registrations")
        .update({
          pack_paid: true,
          pack_payment_id: pi.id,
        })
        .eq("id", regId)
        .eq("user_id", userId);

      if (updateErr) {
        console.error("General Pack update error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // ส่ง LINE notify หลังชำระเงินสำเร็จ
      const [{ data: profile }, { data: ev }] = await Promise.all([
        supabase
          .from("profiles")
          .select("line_user_id")
          .eq("id", userId)
          .single(),
        eventId
          ? supabase.from("events").select("title").eq("id", eventId).single()
          : Promise.resolve({ data: null } as any),
      ]);

      if (profile?.line_user_id) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/api/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.line_user_id,
            type: "broadcast",
            data: {
              message: `✅ ชำระเงินสำเร็จ!

📍 งาน: ${ev?.title ?? "งาน"}
🛍️ สิทธิ์ซื้อ Booster Pack ราคาป้าย 1 ซอง

แสดง QR Code หน้างานเพื่อรับสิทธิ์ครับ 🙌`,
            },
          }),
        });
      }

      console.log("✅ General Pack paid:", regId);
    }


    // ─── Shop Order ───
    else if (description.includes("Shop Order") || pi.metadata?.type === "shop") {
      const email = pi.receipt_email ?? "";
      let userId: string | null = null;

      if (email) {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const user = users.find((u) => u.email === email);
        if (user) userId = user.id;
      }

      // parse items จาก metadata
      let items: any[] = [];
      try {
        items = JSON.parse(pi.metadata?.items ?? "[]");
      } catch {}

      if (userId && items.length > 0) {
        // สร้าง order
        const { data: order, error: orderErr } = await supabase
          .from("orders")
          .insert({
            user_id: userId,
            total_amount: pi.amount / 100,
            status: "paid",
            payment_id: pi.id,
          })
          .select("id")
          .single();

        if (!orderErr && order) {
          // insert order_items
          await supabase.from("order_items").insert(
            items.map((item: any) => ({
              order_id: order.id,
              product_id: item.id,
              name: item.name,
              price: item.price,
              qty: item.qty,
            }))
          );

          // ตัดสต็อก
          for (const item of items) {
            await supabase.rpc("decrement_stock", {
              product_id: item.id,
              qty: item.qty,
            });
          }
        }
      }

      console.log("✅ Shop order created for:", email);
    }
  }

  return NextResponse.json({ ok: true });
}
