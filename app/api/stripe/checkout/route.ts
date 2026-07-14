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
    // paymentMethod: "card" (มีค่าธรรมเนียม 3% แสดงแยกให้เห็นชัดเจน) หรือ "promptpay" (ไม่มีค่าธรรมเนียม)
    const paymentMethod: "card" | "promptpay" = body.paymentMethod === "promptpay" ? "promptpay" : "card";

    if (items.length === 0) {
      return NextResponse.json(
        { error: "ไม่มีสินค้าในตะกร้า" },
        { status: 400 }
      );
    }

    // ── เช็คสต็อกให้พอก่อนเปิดหน้าจ่ายเงิน — กันลูกค้าจ่ายเงินไปแล้วของหมด ──
    const supabase = getSupabase();
    const ids = items.map((it: any) => it.id).filter(Boolean);
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, stock")
      .in("id", ids);

    if (prodErr) {
      return NextResponse.json({ error: "ตรวจสอบสต็อกไม่สำเร็จ" }, { status: 500 });
    }

    const stockMap = new Map((products ?? []).map((p) => [p.id, p]));
    for (const it of items) {
      const p = stockMap.get(it.id);
      const wantQty = Number(it.qty);
      if (!p) {
        return NextResponse.json({ error: `ไม่พบสินค้า: ${it.name ?? it.id}` }, { status: 400 });
      }
      if (p.stock < wantQty) {
        return NextResponse.json(
          { error: `${p.name} เหลือแค่ ${p.stock} ชิ้น (ขอซื้อ ${wantQty} ชิ้น) กรุณาปรับจำนวนในตะกร้า` },
          { status: 400 }
        );
      }
    }

    // ── สินค้าที่ต้อง "ขอสิทธิ์ซื้อ" (lottery) — ซื้อได้เฉพาะคนที่ได้สิทธิ์ "won" และยังไม่หมดเวลาเท่านั้น ──
    const { data: activeLotteries } = await supabase
      .from("product_lotteries")
      .select("id, product_id, status, created_at")
      .in("product_id", ids)
      .in("status", ["open", "drawn"])
      .order("created_at", { ascending: false });

    const latestLotteryByProduct = new Map<string, { id: string; status: string }>();
    for (const l of activeLotteries ?? []) {
      if (!latestLotteryByProduct.has(l.product_id)) {
        latestLotteryByProduct.set(l.product_id, { id: l.id, status: l.status });
      }
    }

    if (latestLotteryByProduct.size > 0) {
      if (!userId) {
        return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนซื้อสินค้าที่ต้องขอสิทธิ์" }, { status: 401 });
      }
      const lotteryIds = Array.from(latestLotteryByProduct.values()).map((l) => l.id);
      const { data: myEntries } = await supabase
        .from("lottery_entries")
        .select("lottery_id, status, purchase_deadline")
        .in("lottery_id", lotteryIds)
        .eq("user_id", userId)
        .eq("status", "won");

      const validWinByLottery = new Map(
        (myEntries ?? [])
          .filter((e) => !e.purchase_deadline || new Date(e.purchase_deadline) > new Date())
          .map((e) => [e.lottery_id, true])
      );

      for (const it of items) {
        const lot = latestLotteryByProduct.get(it.id);
        if (!lot) continue; // สินค้านี้ไม่ใช่ lottery
        if (!validWinByLottery.has(lot.id)) {
          const p = stockMap.get(it.id);
          return NextResponse.json(
            { error: `${p?.name ?? it.name} ต้องขอสิทธิ์ซื้อและได้รับสิทธิ์ก่อนถึงจะซื้อได้ (หรือสิทธิ์ของคุณหมดเวลาแล้ว)` },
            { status: 403 }
          );
        }
      }
    }

    const stripe = getStripe();

    // เก็บ items แบบกระชับลง metadata (Stripe จำกัด 500 ตัวอักษร/ฟิลด์) — ไม่รวมค่าธรรมเนียมบัตร
    // (ค่าธรรมเนียมไม่ใช่สินค้า ไม่ต้องตัดสต็อก/สร้าง order_items ให้)
    const compactItems = items.map((it: any) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price),
      qty: Number(it.qty),
    }));
    const itemsJson = JSON.stringify(compactItems);

    // ── ค่าธรรมเนียมบัตรเครดิต/เดบิต 3% — แสดงเป็นรายการแยกชัดเจน ไม่ซ่อนในราคาสินค้า ──
    // เก็บเฉพาะตอนจ่ายด้วยบัตรเท่านั้น ไม่เก็บกับ PromptPay
    const subtotal = compactItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    const cardFee = paymentMethod === "card" ? Math.round(subtotal * 0.03) : 0;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((it: any) => ({
      price_data: {
        currency: "thb",
        product_data: {
          name: it.name,
          ...(it.image_url ? { images: [it.image_url] } : {}),
        },
        unit_amount: Number(it.price) * 100,
      },
      quantity: Number(it.qty),
    }));

    if (cardFee > 0) {
      lineItems.push({
        price_data: {
          currency: "thb",
          product_data: {
            name: "ค่าธรรมเนียมการชำระด้วยบัตรเครดิต/เดบิต (3%)",
          },
          unit_amount: cardFee * 100,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: [paymentMethod],
      locale: "th",
      customer_email: email ?? undefined,
      line_items: lineItems,
      // ✅ ฟอร์มที่อยู่จัดส่ง (เฉพาะไทย) + เบอร์โทร โผล่บนหน้า Stripe
      shipping_address_collection: { allowed_countries: ["TH"] },
      phone_number_collection: { enabled: true },
      metadata: {
        type: "shop",
        user_id: userId ?? "",
        email: email ?? "",
        items: itemsJson,
        card_fee: String(cardFee),
      },
      success_url: `${SITE_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/shop`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
