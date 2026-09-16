import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const { eventId } = await request.json();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: event } = await supabase
    .from("events")
    .select("title, date, location, require_fb_follow, lucky_draw_enabled, lucky_draw_prizes")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "ไม่พบอีเวนต์นี้" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("line_user_id, display_name, fb_clicked_at")
    .eq("id", session.user.id)
    .single();

  // งานที่บังคับฟอลเพจ: ต้องกดลิงก์ไปเพจก่อน — สตาฟยืนยันการฟอลจริงอีกครั้งตอนสแกน QR หน้างาน
  if (event.require_fb_follow && !profile?.fb_clicked_at) {
    return NextResponse.json(
      { error: "กรุณากดติดตามเพจ Facebook ก่อนลงทะเบียน", reason: "fb_follow_required" },
      { status: 403 }
    );
  }

  // เช็คว่าลงทะเบียนไปแล้วไหม
  const { data: existing } = await supabase
    .from("general_registrations")
    .select("id, qr_code")
    .eq("user_id", session.user.id)
    .eq("event_id", eventId)
    .single();

  if (existing) {
    return NextResponse.json({ qrCode: existing.qr_code, alreadyRegistered: true });
  }

  // สร้าง QR code
  const qrCode = `GEN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const { error } = await supabase.from("general_registrations").insert({
    user_id: session.user.id,
    event_id: eventId,
    qr_code: qrCode,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ส่ง LINE แจ้งเตือน
  if (profile?.line_user_id) {
    const prizes: string[] = event.lucky_draw_enabled ? (event.lucky_draw_prizes ?? []) : [];
    const perkLines = [
      "• ซื้อ Pokemon M1-M5 ราคาป้าย 1 ซอง / คน",
      ...prizes.map((p) => `• ลุ้นรับ ${p}`),
    ].join("\n");

    const eventDate = event.date
      ? new Date(event.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
      : "";

    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/api/line-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: profile.line_user_id,
        type: "broadcast",
        data: {
          message: `✅ ลงทะเบียนเข้างานสำเร็จ!\n\n📍 งาน: ${event.title ?? "งาน"}\n📅 วันที่: ${eventDate}\n📌 สถานที่: ${event.location ?? ""}\n\n🎫 สิทธิ์ของคุณ:\n${perkLines}\n\n🔑 QR Code: ${qrCode}\n\nแสดง QR Code ในโปรไฟล์หน้างานได้เลยครับ 🙌`,
        },
      }),
    });
  }

  return NextResponse.json({ qrCode, alreadyRegistered: false });
}
