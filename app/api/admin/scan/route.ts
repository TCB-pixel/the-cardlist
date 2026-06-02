import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qrCode = searchParams.get("qr");

  if (!qrCode) return NextResponse.json({ error: "No QR code" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // เช็ค General
  if (qrCode.startsWith("GEN-")) {
    const { data, error } = await supabase
      .from("general_registrations")
      .select("*")
      .eq("qr_code", qrCode)
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message ?? "ไม่พบ QR Code นี้ในระบบ" }, { status: 404 });

    // ดึง profile แยก
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", data.user_id)
      .single();

    // ดึง event แยก
    const { data: event } = await supabase
      .from("events")
      .select("title, date, location")
      .eq("id", data.event_id)
      .single();

    return NextResponse.json({ type: "general", data: { ...data, profiles: profile, events: event } });
  }

  // เช็ค Priority
  if (qrCode.startsWith("PG-") || qrCode.startsWith("TCK-")) {
    const { data, error } = await supabase
      .from("priority_tickets")
      .select("*")
      .eq("qr_code", qrCode)
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message ?? "ไม่พบ QR Code นี้ในระบบ" }, { status: 404 });
    if (data.status !== "approved") return NextResponse.json({ error: "บัตรยังไม่ได้รับการอนุมัติ" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
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
  const { id, type, field, value } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const table = type === "general" ? "general_registrations" : "priority_tickets";
  const { error } = await supabase.from(table).update({ [field]: value }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
