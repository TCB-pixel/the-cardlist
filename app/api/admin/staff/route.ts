import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

// สุ่มรหัสผ่านชั่วคราว (ตัดตัวอักษรที่สับสน เช่น 0/O, 1/l/I ออก)
function genPassword(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

// ---------- GET : ดึงรายชื่อทั้งหมด ----------
export async function GET() {
  const { data, error } = await admin
    .from("admin_staff")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: (data as Row[]).map(toAdminUser) });
}

// ---------- POST : เพิ่มสมาชิก + สร้าง Auth user + รหัสผ่านชั่วคราว ----------
export async function POST(req: Request) {
  try {
    const { name, email, role, active } = await req.json();
    if (!name || !email || !role) {
      return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
    }

    const tempPassword = genPassword();

    // 1) สร้าง login (อีเมล + รหัสผ่าน) — email_confirm: true เพื่อใช้งานได้ทันที
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
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
      // ถ้าบันทึก DB ไม่ผ่าน ลบ Auth user ทิ้ง (กัน user ค้าง)
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: dbErr.message }, { status: 400 });
    }

    return NextResponse.json({ member: toAdminUser(row as Row), tempPassword });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : แก้ไขชื่อ/role/สถานะ ----------
export async function PATCH(req: Request) {
  try {
    const { id, name, role, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (role !== undefined) update.role = role;
    if (active !== undefined) update.active = active;

    const { data: row, error } = await admin
      .from("admin_staff")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // ถ้าระงับ/เปิดบัญชี ให้ ban/unban ใน Auth ด้วย เพื่อบล็อกการ login จริง
    if (active !== undefined && (row as Row).user_id) {
      await admin.auth.admin.updateUserById((row as Row).user_id as string, {
        ban_duration: active ? "none" : "876000h", // ~100 ปี = ระงับ
      });
    }

    return NextResponse.json({ member: toAdminUser(row as Row) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ลบสมาชิก + ลบ Auth user ----------
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const { data: row } = await admin
      .from("admin_staff")
      .select("user_id")
      .eq("id", id)
      .single();

    await admin.from("admin_staff").delete().eq("id", id);
    if (row?.user_id) await admin.auth.admin.deleteUser(row.user_id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
