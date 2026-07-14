import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AdminRole, can } from "@/lib/rbac";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com";

type Caller = { userId: string; email: string; role: AdminRole };

async function requireAdmin(
  req: NextRequest
): Promise<{ ok: true; caller: Caller } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "ไม่ได้เข้าสู่ระบบ" };

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user?.email) return { ok: false, status: 401, error: "token ไม่ถูกต้อง" };
  const email = user.email;

  const { data: au } = await admin
    .from("admin_users")
    .select("role, active")
    .eq("email", email)
    .maybeSingle();
  if (au) {
    if (au.active === false) return { ok: false, status: 403, error: "บัญชีถูกระงับ" };
    return { ok: true, caller: { userId: user.id, email, role: au.role as AdminRole } };
  }

  const { data: st } = await admin
    .from("admin_staff")
    .select("role, active")
    .eq("email", email)
    .maybeSingle();
  if (st) {
    if (st.active === false) return { ok: false, status: 403, error: "บัญชีถูกระงับ" };
    return { ok: true, caller: { userId: user.id, email, role: st.role as AdminRole } };
  }

  return { ok: false, status: 403, error: "ไม่มีสิทธิ์เข้าถึง" };
}

// ---------- GET : ดูรายการ lottery ทั้งหมด (พร้อมจำนวนผู้ขอ) หรือรายละเอียด lottery เดียว ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const lotteryId = req.nextUrl.searchParams.get("lotteryId");

  if (lotteryId) {
    const { data: lottery, error: lotErr } = await admin
      .from("product_lotteries")
      .select("*, products(name, image_url, price)")
      .eq("id", lotteryId)
      .single();
    if (lotErr || !lottery) return NextResponse.json({ error: "ไม่พบ lottery" }, { status: 404 });

    const { data: entries } = await admin
      .from("lottery_entries")
      .select("id, user_id, status, won_at, purchase_deadline, created_at, profiles(username, line_user_id)")
      .eq("lottery_id", lotteryId)
      .order("created_at", { ascending: true });

    return NextResponse.json({ lottery, entries: entries ?? [] });
  }

  const { data: lotteries, error } = await admin
    .from("product_lotteries")
    .select("*, products(name, image_url, price, stock)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // นับจำนวนผู้ขอสิทธิ์ต่อ lottery
  const ids = (lotteries ?? []).map((l) => l.id);
  const counts: Record<string, { pending: number; won: number; lost: number }> = {};
  if (ids.length > 0) {
    const { data: allEntries } = await admin
      .from("lottery_entries")
      .select("lottery_id, status")
      .in("lottery_id", ids);
    for (const e of allEntries ?? []) {
      const c = (counts[e.lottery_id] ??= { pending: 0, won: 0, lost: 0 });
      if (e.status === "pending") c.pending++;
      else if (e.status === "won" || e.status === "purchased") c.won++;
      else if (e.status === "lost" || e.status === "expired") c.lost++;
    }
  }

  return NextResponse.json({
    lotteries: (lotteries ?? []).map((l) => ({ ...l, entryCounts: counts[l.id] ?? { pending: 0, won: 0, lost: 0 } })),
  });
}

// ---------- POST : เปิด lottery ใหม่ให้สินค้า ----------
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!can(auth.caller.role, "products:edit")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์จัดการ lottery" }, { status: 403 });
    }

    const { productId, quota } = await req.json();
    if (!productId || !quota || Number(quota) <= 0) {
      return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ (productId, quota)" }, { status: 400 });
    }

    // กันเปิดซ้ำถ้าสินค้านี้มี lottery ที่ยัง open อยู่แล้ว
    const { data: existing } = await admin
      .from("product_lotteries")
      .select("id")
      .eq("product_id", productId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "สินค้านี้มี lottery ที่เปิดรับอยู่แล้ว" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("product_lotteries")
      .insert({ product_id: productId, quota: Number(quota), created_by: auth.caller.userId })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ lottery: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : ปิดรับคำขอ + สุ่มผู้ชนะ, หรือยกเลิก lottery ----------
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!can(auth.caller.role, "products:edit")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์จัดการ lottery" }, { status: 403 });
    }

    const { lotteryId, action } = await req.json();
    if (!lotteryId || !action) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

    const { data: lottery, error: lotErr } = await admin
      .from("product_lotteries")
      .select("*, products(name)")
      .eq("id", lotteryId)
      .single();
    if (lotErr || !lottery) return NextResponse.json({ error: "ไม่พบ lottery" }, { status: 404 });
    if (lottery.status !== "open") {
      return NextResponse.json({ error: "lottery นี้ปิดรับ/สุ่มไปแล้ว" }, { status: 400 });
    }

    if (action === "cancel") {
      const { error } = await admin
        .from("product_lotteries")
        .update({ status: "cancelled" })
        .eq("id", lotteryId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "close_and_draw") {
      const { data: pending, error: pendErr } = await admin
        .from("lottery_entries")
        .select("id, user_id")
        .eq("lottery_id", lotteryId)
        .eq("status", "pending");
      if (pendErr) return NextResponse.json({ error: pendErr.message }, { status: 500 });

      const pool = pending ?? [];
      // สุ่มลำดับ (Fisher-Yates) แล้วตัด quota แรกเป็นผู้ชนะ
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const quota = Math.min(lottery.quota, pool.length);
      const winners = pool.slice(0, quota);
      const losers = pool.slice(quota);

      const now = new Date();
      const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (winners.length > 0) {
        await admin
          .from("lottery_entries")
          .update({ status: "won", won_at: now.toISOString(), purchase_deadline: deadline.toISOString() })
          .in("id", winners.map((w) => w.id));
      }
      if (losers.length > 0) {
        await admin
          .from("lottery_entries")
          .update({ status: "lost" })
          .in("id", losers.map((l) => l.id));
      }

      await admin
        .from("product_lotteries")
        .update({ status: "drawn", drawn_at: now.toISOString() })
        .eq("id", lotteryId);

      // แจ้งผู้ชนะผ่าน LINE (best-effort — ล้มเหลวไม่ทำให้ API พัง)
      const productName = (lottery as any).products?.name ?? "สินค้า";
      for (const w of winners) {
        try {
          const { data: profile } = await admin
            .from("profiles")
            .select("line_user_id")
            .eq("id", w.user_id)
            .single();
          if (profile?.line_user_id) {
            await fetch(`${SITE_URL}/api/notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lineUserId: profile.line_user_id,
                type: "broadcast",
                data: {
                  message: `🎉 ยินดีด้วย! คุณได้รับสิทธิ์ซื้อ "${productName}"\n\n⏰ มีเวลา 24 ชั่วโมงในการกดซื้อในแอป The Cardlist ก่อนสิทธิ์จะหมดอายุ (ถึง ${deadline.toLocaleString("th-TH")})\n\nรีบเข้าไปกดซื้อได้เลยครับ 🙌`,
                },
              }),
            });
          }
        } catch (err) {
          console.error("แจ้งเตือนผู้ชนะ lottery ไม่สำเร็จ:", w.user_id, err);
        }
      }

      return NextResponse.json({ ok: true, winnersCount: winners.length, losersCount: losers.length });
    }

    return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
