import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// service role client — bypass RLS (ตาราง lottery ปิด RLS หมด เข้าถึงผ่านไฟล์นี้เท่านั้น)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ดึง user จาก Authorization header — ไม่บังคับต้องล็อกอิน (guest ดูสถานะ lottery ได้ แต่ขอสิทธิ์ไม่ได้)
async function getUser(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// ---------- GET : ดูสถานะ lottery ของสินค้าหลายชิ้นพร้อมกัน (?productIds=a,b,c) ----------
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("productIds") ?? "";
  const productIds = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (productIds.length === 0) return NextResponse.json({ lotteries: {} });

  const user = await getUser(req);

  // เอาเฉพาะ lottery ที่ยัง "เปิดรับ" หรือ "สุ่มไปแล้ว" (ไม่เอา cancelled)
  const { data: lotteries, error } = await admin
    .from("product_lotteries")
    .select("id, product_id, quota, status, created_at, drawn_at")
    .in("product_id", productIds)
    .in("status", ["open", "drawn"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // เอา lottery ล่าสุดต่อสินค้าหนึ่งชิ้น (เผื่อมีประวัติหลายรอบ)
  const latestByProduct = new Map<string, (typeof lotteries)[number]>();
  for (const l of lotteries ?? []) {
    if (!latestByProduct.has(l.product_id)) latestByProduct.set(l.product_id, l);
  }

  const lotteryIds = Array.from(latestByProduct.values()).map((l) => l.id);
  let myEntries: Record<string, { status: string; purchase_deadline: string | null }> = {};
  if (user && lotteryIds.length > 0) {
    const { data: entries } = await admin
      .from("lottery_entries")
      .select("lottery_id, status, purchase_deadline")
      .in("lottery_id", lotteryIds)
      .eq("user_id", user.id);
    for (const e of entries ?? []) {
      myEntries[e.lottery_id] = { status: e.status, purchase_deadline: e.purchase_deadline };
    }
  }

  const result: Record<
    string,
    { lotteryId: string; status: string; quota: number; myEntry: { status: string; purchaseDeadline: string | null } | null }
  > = {};
  for (const [productId, l] of latestByProduct.entries()) {
    result[productId] = {
      lotteryId: l.id,
      status: l.status,
      quota: l.quota,
      myEntry: myEntries[l.id]
        ? { status: myEntries[l.id].status, purchaseDeadline: myEntries[l.id].purchase_deadline }
        : null,
    };
  }

  return NextResponse.json({ lotteries: result });
}

// ---------- POST : ขอสิทธิ์ซื้อ (ต้องล็อกอิน) ----------
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนขอสิทธิ์ซื้อ" }, { status: 401 });

    const { productId } = await req.json();
    if (!productId) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 400 });

    const { data: lottery, error: lotErr } = await admin
      .from("product_lotteries")
      .select("id, status")
      .eq("product_id", productId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lotErr) return NextResponse.json({ error: lotErr.message }, { status: 500 });
    if (!lottery) return NextResponse.json({ error: "สินค้านี้ไม่มีรอบขอสิทธิ์ที่เปิดอยู่" }, { status: 400 });

    const { data: entry, error: insErr } = await admin
      .from("lottery_entries")
      .insert({ lottery_id: lottery.id, user_id: user.id, status: "pending" })
      .select("id, status")
      .single();

    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "คุณขอสิทธิ์ซื้อรายการนี้ไปแล้ว" }, { status: 400 });
      }
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ entry });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
