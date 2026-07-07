import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── ตรวจสิทธิ์แอดมินฝั่ง server (frontend ซ่อนปุ่มอย่างเดียวไม่พอ) ──
async function requireAdmin(request: NextRequest) {
  const supabase = getAdminSupabase();

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false as const, error: "ไม่ได้เข้าสู่ระบบ" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return { ok: false as const, error: "token ไม่ถูกต้อง" };

  // เช็คจากตาราง admin_users ก่อน แล้วค่อย admin_staff
  const { data: au } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (au) return { ok: true as const, supabase, email: user.email };

  const { data: st } = await supabase
    .from("admin_staff")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (st) return { ok: true as const, supabase, email: user.email };

  return { ok: false as const, error: "ไม่มีสิทธิ์เข้าถึง" };
}

// ── GET: รายการออเดอร์ทั้งหมด + รายการสินค้า ──
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { data: orders, error } = await auth.supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: orders ?? [] });
}

// ── PATCH: อัปเดตสถานะ / เลขพัสดุ ──
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await request.json();
  const orderId: string | null = body.orderId ?? null;
  if (!orderId) return NextResponse.json({ error: "missing orderId" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.status === "string") updates.status = body.status;           // paid | shipped | cancelled
  if (typeof body.tracking_no === "string") updates.tracking_no = body.tracking_no;
  if (typeof body.note === "string") updates.note = body.note;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
