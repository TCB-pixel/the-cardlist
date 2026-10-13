import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { getUserFromRequest } from "@/lib/booth";
import { validateVendor } from "@/lib/booth-vendor";

// ข้อมูลร้านของ Vendor (ใช้ซ้ำได้ทุกงาน) — ดู/บันทึกได้เฉพาะของตัวเอง
export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  const { data } = await adminDb.from("vendor_profiles").select("*").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ profile: data ?? null });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "เข้าสู่ระบบก่อนบันทึกข้อมูลร้าน" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const v = validateVendor(body, user.id);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const { error } = await adminDb.from("vendor_profiles").upsert(
    { user_id: user.id, ...v.value, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
