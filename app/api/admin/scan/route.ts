import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qrCode = searchParams.get("qr");

  if (!qrCode) return NextResponse.json({ error: "No QR code" }, { status: 400 });

  // ใช้ Service Role Key เพื่อ bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // เช็ค General
  if (qrCode.startsWith("GEN-")) {
    const { data, error } = await supabase
      .from("general_registrations")
      .select("*, profiles(display_name, username, avatar_url), events(title, date, location)")
      .eq("qr_code", qrCode)
      .single();

    if (error || !data) return NextResponse.json({ error: "ไม่พบ QR Code นี้ในระบบ" }, { status: 404 });

    return NextResponse.json({ type: "general", data });
  }

  // เช็ค Priority
  if (qrCode.startsWith("PG-") || qrCode.startsWith("TCK-")) {
    const { data, error } = await supabase
      .from("priority_tickets")
      .select("*, profiles(display_name, username, avatar_url), events(title, date, location)")
      .eq("qr_code", qrCode)
      .single();

    if (error || !data) return NextResponse.json({ error: "ไม่พบ QR Code นี้ในระบบ" }, { status: 404 });
    if (data.status !== "approved") return NextResponse.json({ error: "บัตรยังไม่ได้รับการอนุมัติ" }, { status: 400 });

    return NextResponse.json({ type: "priority", data });
  }

  return NextResponse.json({ error: "QR Code ไม่ถูกต้อง" }, { status: 400 });
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
