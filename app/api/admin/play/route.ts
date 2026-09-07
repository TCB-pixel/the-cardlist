import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

async function sendLineNotify(lineUserId: string | null, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !lineUserId) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: message }] }),
    });
  } catch {
    // แจ้งเตือน LINE ล้มเหลวไม่ควรทำให้การบันทึกรอบเล่นพัง
  }
}

// ---------- GET : ค้นสมาชิกจากรหัส/QR เพื่อดูข้อมูลก่อนกดบันทึก ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "play:scan");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "ไม่พบรหัสสมาชิก" }, { status: 400 });

  const { data: profile } = await adminDb
    .from("profiles")
    .select("id, member_code, display_name, username, avatar_url, tier, phone")
    .eq("member_code", code)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "ไม่พบรหัสสมาชิกนี้ในระบบ" }, { status: 404 });

  const [{ count: total }, { data: recent }, { data: grants }] = await Promise.all([
    adminDb.from("play_sessions").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    adminDb.from("play_sessions").select("tcg, played_at").eq("user_id", profile.id)
      .order("played_at", { ascending: false }).limit(5),
    adminDb.from("stamp_reward_grants")
      .select("id, status, granted_at, used_at, stamp_rewards(name, required_visits, price)")
      .eq("user_id", profile.id),
  ]);

  return NextResponse.json({
    profile,
    totalVisits: total ?? 0,
    recent: recent ?? [],
    grants: grants ?? [],
  });
}

// ---------- POST : บันทึกว่ามาเล่น 1 รอบ (แจกสิทธิ์อัตโนมัติถ้าถึงเกณฑ์) ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "play:scan");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { member_code, tcg, event_id } = await req.json();
    if (!member_code?.trim()) return NextResponse.json({ error: "ไม่พบรหัสสมาชิก" }, { status: 400 });
    if (!tcg?.trim()) return NextResponse.json({ error: "เลือกเกมที่เล่น" }, { status: 400 });

    // ฟังก์ชันใน DB ทำทั้งบันทึกและแจกสิทธิ์ในทรานแซกชันเดียว กันแจกเกินโควตา
    const { data, error } = await adminDb.rpc("record_play_session", {
      p_member_code: member_code.trim(),
      p_tcg: tcg.trim(),
      p_scanned_by_email: auth.caller.email,
      p_event_id: event_id || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.ok) return NextResponse.json({ error: data?.error ?? "บันทึกไม่สำเร็จ" }, { status: 404 });

    const name = data.user?.display_name ?? "คุณ";
    const lineId = data.user?.line_user_id ?? null;

    if (Array.isArray(data.new_rewards) && data.new_rewards.length > 0) {
      const list = data.new_rewards
        .map((r: any) => `🎁 ${r.name}${r.price ? ` (฿${Number(r.price).toLocaleString()})` : ""}`)
        .join("\n");
      await sendLineNotify(lineId,
        `🎉 ยินดีด้วย! คุณได้รับสิทธิ์พิเศษ\n\n👤 ${name}\n🎮 มาเล่นครบ ${data.total_visits} ครั้ง\n\n${list}\n\nแจ้ง Staff หน้างานเพื่อใช้สิทธิ์ได้เลยครับ 🙌`);
    } else {
      await sendLineNotify(lineId,
        `✅ บันทึกการมาเล่นแล้ว\n\n👤 ${name}\n🎮 ${tcg}\n📊 สะสมครบ ${data.total_visits} ครั้ง`);
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ยกเลิกรอบที่เพิ่งสแกนผิด ----------
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req, "play:manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

  const { error } = await adminDb.from("play_sessions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
