import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
      .from("priority_tickets")
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
  const { id, type, field, value, qrCode } = await request.json();
  const supabase = getSupabase();
  const table = type === "general" ? "general_registrations" : "priority_tickets";

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
        message = `✅ ใช้สิทธิ์สำเร็จ!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\n🏷️ ซื้อ Pokemon Pack ราคาป้าย 1 ซอง\n✓ สิทธิ์ถูกใช้แล้ว`;
      } else if (type === "priority" && field === "free_pack_redeemed") {
        message = `✅ รับของฟรีสำเร็จ!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\n🎁 รับ Pokemon M2 (JP) ฟรี 1 ซอง\n✓ สิทธิ์ถูกใช้แล้ว`;
      } else if (type === "priority" && field === "price_pack_used") {
        message = `✅ ใช้สิทธิ์ซื้อ Pack สำเร็จ!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\n🏷️ ซื้อ M1/M3/M4 ราคาป้าย\n📊 ใช้ไปแล้ว ${value} ซอง`;
      } else if (type === "priority" && field === "ma5_slot") {
        if (value === true) {
          message = `🏆 ยินดีด้วย! ได้สิทธิ์ MA5 Box!\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\n🎲 คุณได้รับสิทธิ์ซื้อ Pokemon MA5 Box ราคาป้าย\nแจ้ง Staff เพื่อรับสิทธิ์ได้เลยครับ 🙌`;
        } else {
          message = `❌ ไม่ได้รับสิทธิ์ MA5 Box\n\n👤 ${name}\n📍 งาน: ${eventTitle}\n\nขออภัยครับ คุณไม่ได้รับสิทธิ์ซื้อ MA5 Box ในรอบนี้\nยังมีสิทธิ์รับ M2 ฟรี + ซื้อ Booster Pack ราคาป้ายอยู่นะครับ 🙌`;
        }
      }

      if (message) await sendLineNotify(profile.line_user_id, message);
    }
  }

  return NextResponse.json({ ok: true });
}
