import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AdminRole, MANAGEABLE_ROLES } from "@/lib/rbac";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MIN_PW = 6; // ความยาวรหัสผ่านขั้นต่ำของ Supabase

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

type Row = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: "owner" | "head_staff" | "staff";
  active: boolean;
  last_login: string | null;
  created_at: string;
};

// แปลงแถวใน DB -> รูปแบบ AdminUser ที่หน้า page.tsx ใช้
function toAdminUser(r: Row) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatar: (r.name?.[0] || "?").toUpperCase(),
    joinedAt: fmtDate(r.created_at),
    lastLogin: r.last_login ? fmtDate(r.last_login) : "ยังไม่ได้เข้าสู่ระบบ",
    active: r.active,
  };
}

// สุ่มรหัสผ่านชั่วคราว (ตัดตัวอักษรที่สับสน เช่น 0/O, 1/l/I ออก) — ใช้เมื่อเว้นว่าง
function genPassword(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// ตรวจสิทธิ์ผู้เรียกฝั่ง server — ต้องแนบ Authorization: Bearer <access_token>
// (middleware คุ้มเฉพาะหน้า /admin ไม่คุ้ม /api/admin ต้องเช็คในแต่ละ route เอง)
// ─────────────────────────────────────────────────────────────────────────────
type Caller = { userId: string; email: string; role: AdminRole };

async function requireAdmin(
  req: Request
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

  // เช็ค admin_users (owner ระดับสูงสุด) ก่อน แล้วค่อย admin_staff
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

// ผู้เรียก (callerRole) มีสิทธิ์จัดการผู้ใช้ระดับ targetRole ไหม (owner→ทุกระดับ, head_staff→staff)
function canManageRole(callerRole: AdminRole, targetRole: AdminRole): boolean {
  return MANAGEABLE_ROLES[callerRole].includes(targetRole);
}

// ---------- GET : ดึงรายชื่อทั้งหมด (แอดมินทุกระดับดูได้) ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await admin
    .from("admin_staff")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: (data as Row[]).map(toAdminUser) });
}

// ---------- POST : เพิ่มสมาชิก + สร้าง Auth user + ตั้ง/สุ่มรหัสผ่าน ----------
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { name, email: rawEmail, role, active, password } = await req.json();
    if (!name || !rawEmail || !role) {
      return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
    }
    // Supabase Auth เก็บอีเมลเป็นตัวพิมพ์เล็กเสมอ ส่วนการค้นใน admin_staff ใช้ .eq() ซึ่ง
    // case-sensitive — ถ้าเก็บตามที่แอดมินพิมพ์ (เช่น "Kritanut34@") จะหาไม่เจอและล็อกอินไม่ได้
    const email = String(rawEmail).trim().toLowerCase();

    // ต้องมีสิทธิ์สร้างผู้ใช้ระดับนี้ (กัน head_staff สร้าง owner/head_staff)
    if (!canManageRole(auth.caller.role, role as AdminRole)) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์สร้างผู้ใช้ระดับนี้" }, { status: 403 });
    }

    // ถ้าพิมพ์รหัสเองมา -> ต้องยาวอย่างน้อย MIN_PW / ถ้าเว้นว่าง -> สุ่มให้
    let finalPassword: string;
    if (password) {
      if (String(password).length < MIN_PW) {
        return NextResponse.json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PW} ตัวอักษร` }, { status: 400 });
      }
      finalPassword = String(password);
    } else {
      finalPassword = genPassword();
    }

    // 1) สร้าง login (อีเมล + รหัสผ่าน) — email_confirm: true เพื่อใช้งานได้ทันที
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    // 2) บันทึกลงตาราง admin_staff
    const { data: row, error: dbErr } = await admin
      .from("admin_staff")
      .insert({ user_id: authData.user.id, name, email, role, active: active ?? true })
      .select("*")
      .single();

    if (dbErr) {
      await admin.auth.admin.deleteUser(authData.user.id); // rollback
      return NextResponse.json({ error: dbErr.message }, { status: 400 });
    }

    // คืนรหัสผ่านที่ตั้งไว้กลับไปให้หน้าจอแสดง (ก๊อปส่งพนักงาน)
    return NextResponse.json({ member: toAdminUser(row as Row), password: finalPassword });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : แก้ไขชื่อ/role/สถานะ + รีเซ็ตรหัสผ่าน (ถ้าส่ง password มา) ----------
export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id, name, role, active, password } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    // ดึง target มาก่อนเพื่อเช็คลำดับสิทธิ์
    const { data: target, error: tErr } = await admin
      .from("admin_staff")
      .select("role, user_id")
      .eq("id", id)
      .maybeSingle();
    if (tErr || !target) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

    // ต้องมีสิทธิ์จัดการ role ปัจจุบันของ target
    if (!canManageRole(auth.caller.role, target.role as AdminRole)) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขผู้ใช้รายนี้" }, { status: 403 });
    }
    // ถ้ามีการเปลี่ยน role — ต้องมีสิทธิ์กำหนด role ใหม่ด้วย
    if (role !== undefined && !canManageRole(auth.caller.role, role as AdminRole)) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์กำหนด role นี้" }, { status: 403 });
    }
    // กันปิดใช้งานบัญชีตัวเอง (กันล็อกเอาต์ตัวเอง)
    if (active === false && target.user_id === auth.caller.userId) {
      return NextResponse.json({ error: "ปิดใช้งานบัญชีตัวเองไม่ได้" }, { status: 400 });
    }

    // ตรวจรหัสผ่านก่อน (ถ้ามีการตั้งใหม่)
    if (password && String(password).length < MIN_PW) {
      return NextResponse.json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PW} ตัวอักษร` }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (role !== undefined) update.role = role;
    if (active !== undefined) update.active = active;

    let row: Row;
    if (Object.keys(update).length > 0) {
      const { data, error } = await admin
        .from("admin_staff")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      row = data as Row;
    } else {
      const { data, error } = await admin.from("admin_staff").select("*").eq("id", id).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      row = data as Row;
    }

    // ระงับ/เปิดบัญชี -> ban/unban ใน Auth ด้วย
    if (active !== undefined && row.user_id) {
      await admin.auth.admin.updateUserById(row.user_id, {
        ban_duration: active ? "none" : "876000h",
      });
    }

    // รีเซ็ตรหัสผ่าน (ถ้าส่งมา)
    let changedPassword: string | undefined;
    if (password && row.user_id) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(row.user_id, {
        password: String(password),
      });
      if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 });
      changedPassword = String(password);
    }

    return NextResponse.json({
      member: toAdminUser(row),
      ...(changedPassword ? { password: changedPassword } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ลบสมาชิก + ลบ Auth user ----------
export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const { data: row } = await admin
      .from("admin_staff")
      .select("user_id, role")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

    // ต้องมีสิทธิ์จัดการ role ของ target (กัน head_staff ลบ owner/head_staff)
    if (!canManageRole(auth.caller.role, row.role as AdminRole)) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ลบผู้ใช้รายนี้" }, { status: 403 });
    }
    // กันลบบัญชีตัวเอง
    if (row.user_id === auth.caller.userId) {
      return NextResponse.json({ error: "ลบบัญชีตัวเองไม่ได้" }, { status: 400 });
    }

    await admin.from("admin_staff").delete().eq("id", id);
    if (row.user_id) await admin.auth.admin.deleteUser(row.user_id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
