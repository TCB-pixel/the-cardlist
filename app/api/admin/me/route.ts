import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AdminRole } from "@/lib/rbac";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// คืนข้อมูล + role จริงของผู้ที่เข้าสู่ระบบอยู่ ให้ฝั่ง client ใช้ตัดสินสิทธิ์เมนู
// ต้องแนบ Authorization: Bearer <access_token>
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user?.email) return NextResponse.json({ error: "token ไม่ถูกต้อง" }, { status: 401 });
  const email = user.email;

  // เช็ค admin_users (owner ระดับสูงสุด) ก่อน แล้วค่อย admin_staff
  const { data: au } = await admin
    .from("admin_users")
    .select("id, name, role, active, last_login, created_at")
    .eq("email", email)
    .maybeSingle();

  const { data: st } = au ? { data: null } : await admin
    .from("admin_staff")
    .select("id, name, role, active, last_login, created_at")
    .eq("email", email)
    .maybeSingle();

  const row = au ?? st;
  if (!row) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  if (row.active === false) return NextResponse.json({ error: "บัญชีถูกระงับ" }, { status: 403 });

  const meta = user.user_metadata ?? {};
  const name = row.name || meta.display_name || meta.username || email.split("@")[0];

  return NextResponse.json({
    id: row.id,
    userId: user.id,
    name,
    email,
    role: row.role as AdminRole,
    avatar: (name?.[0] || "?").toUpperCase(),
    joinedAt: fmtDate(row.created_at),
    lastLogin: row.last_login ? fmtDate(row.last_login) : "เพิ่งเข้าสู่ระบบ",
    active: row.active !== false,
  });
}
