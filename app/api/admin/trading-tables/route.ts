import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AdminRole, can } from "@/lib/rbac";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

// ---------- GET : ดึงรายการจองโต๊ะเทรดของ event พร้อมชื่อผู้จอง ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!can(auth.caller.role, "events:view")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลนี้" }, { status: 403 });
  }

  const eventId = req.nextUrl.searchParams.get("event_id");
  if (!eventId) return NextResponse.json({ error: "ไม่พบ event_id" }, { status: 400 });

  const { data: bookings, error: bkErr } = await admin
    .from("trading_table_bookings")
    .select("id, user_id, table_type, table_number, booking_date, slot_start, slot_end, status, created_at")
    .eq("event_id", eventId)
    .order("booking_date", { ascending: true })
    .order("slot_start", { ascending: true });
  if (bkErr) return NextResponse.json({ error: bkErr.message }, { status: 500 });

  const userIds = Array.from(new Set((bookings ?? []).map((b) => b.user_id)));
  let profileMap = new Map<string, { username: string; display_name: string | null; phone: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, display_name, phone")
      .in("id", userIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, { username: p.username, display_name: p.display_name, phone: p.phone }]));
  }

  const rows = (bookings ?? []).map((b) => ({
    ...b,
    username: profileMap.get(b.user_id)?.username ?? "-",
    displayName: profileMap.get(b.user_id)?.display_name ?? "-",
    phone: profileMap.get(b.user_id)?.phone ?? null,
  }));

  return NextResponse.json({ bookings: rows });
}
