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
  const { data: profile } = await supabase
    .from("profiles")
    .select("line_user_id, display_name")
    .eq("id", session.user.id)
    .single();

  if (profile?.line_user_id) {
    const { data: event } = await supabase
      .from("events")
      .select("title, date, location")
      .eq("id", eventId)
      .single();

    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/api/line-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: profile.line_user_id,
        type: "broadcast",
        data: {
          message: `✅ ลงทะเบียนเข้างานสำเร็จ!\n\n📍 งาน: ${event?.title ?? "งาน"}\n📅 วันที่: ${event?.date ? new Date(event.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : ""}\n📌 สถานที่: ${event?.location ?? ""}\n\n🎫 สิทธิ์ของคุณ:\n• ซื้อ Pokemon M1-M5 ราคาป้าย 1 ซอง / คน\n\n🔑 QR Code: ${qrCode}\n\nแสดง QR Code ในโปรไฟล์หน้างานได้เลยครับ 🙌`,
        },
      }),
    });
  }

  return NextResponse.json({ qrCode, alreadyRegistered: false });
}
