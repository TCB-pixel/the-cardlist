import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// บันทึกว่าสมาชิกกดลิงก์ไปเพจแล้ว — ต้องแนบ Authorization: Bearer <access_token>
// หมายเหตุ: นี่คือ "กดลิงก์" ไม่ใช่ "กดไลค์" Facebook ไม่เปิด API ให้ตรวจสอบการไลค์
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "token ไม่ถูกต้อง" }, { status: 401 });

  // บันทึกครั้งแรกครั้งเดียว กดซ้ำไม่ทับเวลาเดิม
  const { data, error: upErr } = await admin
    .from("profiles")
    .update({ fb_clicked_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("fb_clicked_at", null)
    .select("fb_clicked_at")
    .maybeSingle();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, first_time: !!data });
}
