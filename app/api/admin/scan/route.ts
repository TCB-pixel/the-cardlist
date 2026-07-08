import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ตรวจสิทธิ์ผู้เรียก (แอดมินระดับใดก็ได้ — staff สแกนหน้างานได้) — ต้องแนบ Bearer token
async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return false;

  const { data: au } = await supabase
    .from("admin_users")
    .select("active")
    .eq("email", user.email)
    .maybeSingle();
  if (au) return au.active !== false;

  const { data: st } = await supabase
    .from("admin_staff")
    .select("active")
    .eq("email", user.email)
    .maybeSingle();
  return !!st && st.active !== false;
}

async function sendLineNotify(lineUserId: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !lineUserId) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: message }] }),
  });
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request)))
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qrCode = searchParams.get("qr");

  if (!qrCode) return NextResponse.json({ error: "No QR code" }, { status: 400 });

  const supabase = getSupabase();

  if (qrCode.startsWith("GEN-")) {
    const { data, error } = await supabase
      .from("general_registrations")
      .select("*")
      .eq("qr_code", qrCode)
      .single();

    if (error || !data) return NextResponse.json({ error: "ไม่พบ QR Code นี้ในระบบ" }, { status: 404 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url, line_user_id")
      .eq("id", data.user_id)
      .single();

    const { data: event } = await supabase
      .from("events")
      .select("title, date, location")
      .eq("id", data.event_id)
      .single();

    return NextResponse.json({ type: "general", data: { ...data, profiles: profile, events: event } });
  }

  if (qrCode.startsWith("PG-") || qrCode.startsWith("TCK-")) {
    const { data, error } = await supabase
      .from("event_tickets")
      .select("*")
      .eq("qr_code", qrCode)
      .single();

    if (error || !data) return NextResponse.json({ error: "ไม่พบ QR Code นี้ในระบบ" }, { status: 404 });
    if (data.status !== "approved") return NextResponse.json({ error: "บัตรยังไม่ได้รับการอนุมัติ" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url, line_user_id")
      .eq("id", data.user_id)
      .single();

    const { data: event } = await supabase
      .from("events")
      .select("title, date, location")
      .eq("id", data.event_id)
      .single();

    return NextResponse.json({ type: "priority", data: { ...data, profiles: profile, events: event } });
  }

  return NextResponse.json({ error: "QR Code ไม่ถูกต้อง (ต้องขึ้นต้นด้วย GEN- หรือ PG-)" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request)))
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });

  const { id, type, field, value, qrCode } = await request.json();
  const supabase = getSupabase();
  const table = type === "general" ? "general_registrations" : "event_tickets";

  const { error } = await supabase.from(table).update({ [field]: value }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ดึงข้อมูล user เพื่อส่ง LINE notify
  const { data: ticket } = await supabase.from(table).select("user_id, event_id").eq("id", id).single();
  if (ticket) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("line_user_id, display_name")
      .eq("id", ticket.user_id)
      .single();

    const { data: event } = await supabase
      .from("events")
      .select("title")
      .eq("id", ticket.event_id)
      .single();

    if (profile?.line_user_id) {
      let message = "";
      const eventTitle = event?.title ?? "งาน";
      const name = profile.display_name ?? "คุณ";

      if (type === "general" && field === "pack_used") {
        message = `✅ ใช้สิทธิ์สำเร็จ!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\n🛍️ ซื้อ Pokemon Pack ราคาป้าย 1 ซอง\n✓ สิทธิ์ถูกใช้แล้ว`;
      } else if (type === "general" && field === "lottery_result") {
        if (value === "booster_box") {
          message = `🌑 ยินดีด้วย! ได้สิทธิ์ Booster Box เงามืดคุกคาม!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\nแจ้ง Staff เพื่อซื้อในราคา MSRP ได้เลยครับ 🙌`;
        } else {
          message = `❌ ไม่ได้รับสิทธิ์พิเศษรอบนี้\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\nขอบคุณที่ร่วมงานนะครับ 🙌`;
        }
      } else if (type === "priority" && field === "free_pack_redeemed") {
        message = `✅ รับ Booster Pack สำเร็จ!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\n🎁 Booster Pack M1-M5 ฟรี 5 ซอง\n✓ สิทธิ์ถูกใช้แล้ว`;
      } else if (type === "priority" && field === "lottery_result") {
        if (value === "booster_box") {
          message = `🌑 ยินดีด้วย! ได้สิทธิ์ Booster Box เงามืดคุกคาม!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\nแจ้ง Staff เพื่อซื้อในราคา MSRP ได้เลยครับ 🙌`;
        } else if (value === "etb") {
          message = `⚡ ยินดีด้วย! ได้สิทธิ์ซื้อ Ascend Heroes ETB ฿2,190!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\nแจ้ง Staff เพื่อรับสิทธิ์ได้เลยครับ 🙌`;
        } else if (value === "abyss_eye") {
          message = `🔵 ยินดีด้วย! ได้สิทธิ์ซื้อ M5 Abyss Eye ฿1,490!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\nแจ้ง Staff เพื่อรับสิทธิ์ได้เลยครับ 🙌`;
        } else {
          message = `❌ ไม่ได้รับสิทธิ์พิเศษรอบนี้\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\nขอบคุณที่ร่วมงานนะครับ 🙌`;
        }
      }

      if (message) await sendLineNotify(profile.line_user_id, message);
    }
  }

  return NextResponse.json({ ok: true });
}
