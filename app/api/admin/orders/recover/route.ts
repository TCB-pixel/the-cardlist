import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { routeByType, sessionParams } from "@/lib/stripe-fulfilment";

// กู้ออเดอร์ที่ลูกค้าจ่ายเงินแล้วแต่ webhook ไม่ได้สร้างให้
// (เช่น webhook ยังไม่ได้ตั้งใน Stripe หรือ signing secret ไม่ตรง)
// ใช้เส้นทางสร้างออเดอร์ตัวเดียวกับ webhook — createShopOrder กันยิงซ้ำด้วย payment_id อยู่แล้ว

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------- GET : ดูรายการจ่ายเงินล่าสุดใน Stripe เทียบกับออเดอร์ในระบบ ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "orders:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY" }, { status: 503 });
  }

  try {
    const stripe = getStripe();
    const supabase = getSupabase();

    const sessions = await stripe.checkout.sessions.list({ limit: 50 });
    const paid = sessions.data.filter((s) => s.payment_status === "paid");

    const paymentIds = paid.map((s) =>
      typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? s.id
    );
    const { data: existing } = paymentIds.length
      ? await supabase.from("orders").select("payment_id").in("payment_id", paymentIds)
      : { data: [] as { payment_id: string }[] };
    const have = new Set((existing ?? []).map((o) => o.payment_id));

    return NextResponse.json({
      sessions: paid.map((s) => {
        const pid = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? s.id;
        return {
          sessionId: s.id,
          paymentId: pid,
          type: s.metadata?.type ?? "",
          email: s.customer_details?.email ?? s.customer_email ?? null,
          name: s.customer_details?.name ?? null,
          amount: (s.amount_total ?? 0) / 100,
          createdAt: new Date(s.created * 1000).toISOString(),
          inSystem: have.has(pid),
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "ดึงข้อมูลจาก Stripe ไม่สำเร็จ" }, { status: 500 });
  }
}

// ---------- POST : สร้างออเดอร์ย้อนหลังจาก session ที่จ่ายแล้ว ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "orders:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "ไม่พบ session id" }, { status: 400 });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: `รายการนี้ยังไม่ได้ชำระเงิน (${session.payment_status}) — ไม่สร้างออเดอร์` },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    await routeByType(supabase, sessionParams(session));

    const params = sessionParams(session);
    const { data: order } = await supabase
      .from("orders")
      .select("id, payment_id, total_amount, created_at")
      .eq("payment_id", params.paymentId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json(
        { error: `สร้างออเดอร์ไม่สำเร็จ — type ของรายการนี้คือ "${params.type || "(ว่าง)"}" ซึ่งไม่ใช่ shop` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "กู้ออเดอร์ไม่สำเร็จ" }, { status: 500 });
  }
}
