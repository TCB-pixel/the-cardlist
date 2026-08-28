import { createClient } from "@supabase/supabase-js";
import { AdminRole, Permission, can } from "@/lib/rbac";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
export const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type Caller = { userId: string; email: string; role: AdminRole };

export type AuthResult =
  | { ok: true; caller: Caller }
  | { ok: false; status: number; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// ตรวจสิทธิ์ผู้เรียกฝั่ง server — ต้องแนบ Authorization: Bearer <access_token>
// (middleware คุ้มเฉพาะหน้า /admin ไม่คุ้ม /api/admin ต้องเช็คในแต่ละ route เอง)
//
// หมายเหตุ: Supabase Auth เก็บอีเมลเป็นตัวพิมพ์เล็กเสมอ จึงเทียบด้วยตัวพิมพ์เล็ก
// และตอนบันทึกลง admin_staff ต้อง normalize เป็นพิมพ์เล็กด้วย ไม่งั้นจะหากันไม่เจอ
// ─────────────────────────────────────────────────────────────────────────────
export async function requireAdmin(req: Request, permission?: Permission): Promise<AuthResult> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "ไม่ได้เข้าสู่ระบบ" };

  const { data: { user }, error } = await adminDb.auth.getUser(token);
  if (error || !user?.email) return { ok: false, status: 401, error: "token ไม่ถูกต้อง" };
  const email = user.email.toLowerCase();

  // เช็ค admin_users (owner ระดับสูงสุด) ก่อน แล้วค่อย admin_staff
  const { data: au } = await adminDb
    .from("admin_users")
    .select("role, active")
    .eq("email", email)
    .maybeSingle();

  const { data: st } = au ? { data: null } : await adminDb
    .from("admin_staff")
    .select("role, active")
    .eq("email", email)
    .maybeSingle();

  const row = au ?? st;
  if (!row) return { ok: false, status: 403, error: "ไม่มีสิทธิ์เข้าถึง" };
  if (row.active === false) return { ok: false, status: 403, error: "บัญชีถูกระงับ" };

  const role = row.role as AdminRole;
  if (permission && !can(role, permission)) {
    return { ok: false, status: 403, error: "ไม่มีสิทธิ์ทำรายการนี้" };
  }

  return { ok: true, caller: { userId: user.id, email, role } };
}

// สร้าง slug จากชื่อ — รองรับภาษาไทย (เก็บอักษรไทยไว้ ตัดอักขระพิเศษออก)
export function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9฀-๿-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
