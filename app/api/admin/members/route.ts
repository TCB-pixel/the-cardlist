import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AdminRole, can } from "@/lib/rbac";
import { getTier, TierKey } from "@/lib/tiers";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────────────────
// ตรวจสิทธิ์ผู้เรียกฝั่ง server — ต้องแนบ Authorization: Bearer <access_token>
// ─────────────────────────────────────────────────────────────────────────────
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

type MemberRow = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  tier: TierKey;
  totalSpend: number;
  points: number;
  orders: number;
  joined: string;
};

// ---------- GET : ดึงรายชื่อสมาชิกจริงพร้อมยอดสะสม + tier (คำนวณสด) ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!can(auth.caller.role, "members:view")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลสมาชิก" }, { status: 403 });
  }

  // 1) โปรไฟล์ทั้งหมด
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, username, display_name, email, avatar_url, points, created_at")
    .order("created_at", { ascending: false });
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  // 2) ออเดอร์ที่นับเป็นยอดซื้อสะสม (paid / completed / shipped) — ดึงเฉพาะ user_id + total_amount
  const { data: orders, error: ordErr } = await admin
    .from("orders")
    .select("user_id, total_amount, status")
    .in("status", ["paid", "completed", "shipped"]);
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  // 3) รวมยอดสะสม + จำนวนออเดอร์ต่อ user_id
  const spendMap = new Map<string, number>();
  const orderCountMap = new Map<string, number>();
  for (const o of orders ?? []) {
    if (!o.user_id) continue;
    spendMap.set(o.user_id, (spendMap.get(o.user_id) ?? 0) + Number(o.total_amount ?? 0));
    orderCountMap.set(o.user_id, (orderCountMap.get(o.user_id) ?? 0) + 1);
  }

  // 4) ประกอบผลลัพธ์ — tier คำนวณสดจากยอดสะสมจริงเสมอ (ไม่ใช้ profiles.tier)
  const members: MemberRow[] = (profiles ?? []).map((p) => {
    const totalSpend = spendMap.get(p.id) ?? 0;
    return {
      id: p.id,
      username: p.username ?? "",
      displayName: p.display_name ?? p.username ?? "ไม่มีชื่อ",
      email: p.email ?? "",
      avatarUrl: p.avatar_url ?? null,
      tier: getTier(totalSpend),
      totalSpend,
      points: p.points ?? 0,
      orders: orderCountMap.get(p.id) ?? 0,
      joined: p.created_at,
    };
  });

  // เรียงตามยอดสะสมมากไปน้อย
  members.sort((a, b) => b.totalSpend - a.totalSpend);

  return NextResponse.json({ members });
}

// ---------- PATCH : แก้ไข points ของสมาชิก (tier คำนวณสดจากยอดซื้อ ไม่สามารถแก้ตรงได้) ----------
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!can(auth.caller.role, "members:edit")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขข้อมูลสมาชิก" }, { status: 403 });
    }

    const body = await req.json();
    const { id, points } = body;
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });
    if (points === undefined || !Number.isFinite(Number(points))) {
      return NextResponse.json({ error: "points ไม่ถูกต้อง" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ points: Number(points) })
      .eq("id", id)
      .select("id, points")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ profile: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
