import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { currentUserId, memberStatus } from "@/lib/passport-auth";

export const dynamic = "force-dynamic";

// สแกน QR บนการ์ด Passport ที่ซื้อแล้ว → ผูกการ์ดกับบัญชีสมาชิก (LINE)
// เปลี่ยนมือถือ = ล็อกอิน LINE ใหม่ ไม่ต้องสแกนการ์ดซ้ำ
export async function POST(req: Request) {
  const { code, secret } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || typeof secret !== "string") return NextResponse.json({ error: "invalid" }, { status: 400 });

  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "need_login" }, { status: 401 });
  if (!(await memberStatus(userId)).joined) return NextResponse.json({ error: "need_join" }, { status: 403 });

  const { data: card } = await adminDb.from("passports").select("*")
    .eq("code", code.toUpperCase()).eq("kind", "card").maybeSingle();
  if (!card || card.claim_secret !== secret) return NextResponse.json({ error: "invalid" }, { status: 404 });
  if (card.status === "unsold") return NextResponse.json({ error: "not_sold" }, { status: 409 });
  if (card.user_id && card.user_id !== userId) return NextResponse.json({ error: "taken" }, { status: 409 });
  if (card.user_id === userId) return NextResponse.json({ ok: true, code: card.code, firstTime: false, isTest: card.is_test });

  // 1 บัญชีถือการ์ดได้ 1 ใบ (แยกชุดจริง/ทดสอบ)
  const { data: other } = await adminDb.from("passports").select("code")
    .eq("user_id", userId).eq("kind", "card").eq("is_test", card.is_test).maybeSingle();
  if (other) return NextResponse.json({ error: "has_card", code: other.code }, { status: 409 });

  // พาสปอร์ตฟรี (Learn To Play) ของบัญชีนี้ → ย้ายแสตมป์และรางวัลเข้าการ์ด แล้วลบพาสปอร์ตฟรี
  const { data: free } = await adminDb.from("passports").select("id")
    .eq("user_id", userId).eq("kind", "free").eq("is_test", card.is_test).maybeSingle();
  if (free) {
    const [{ data: mine }, { data: theirs }] = await Promise.all([
      adminDb.from("passport_stamps").select("station_id").eq("passport_id", card.id),
      adminDb.from("passport_stamps").select("id, station_id").eq("passport_id", free.id),
    ]);
    const have = new Set((mine ?? []).map((s) => s.station_id));
    const move = (theirs ?? []).filter((s) => !have.has(s.station_id)).map((s) => s.id);
    if (move.length) await adminDb.from("passport_stamps").update({ passport_id: card.id }).in("id", move);
    await adminDb.from("passport_redemptions").update({ passport_id: card.id }).eq("passport_id", free.id).eq("kind", "learn_complete");
    await adminDb.from("passports").delete().eq("id", free.id);
  }

  const { data: updated, error } = await adminDb.from("passports").update({
    status: "active", user_id: userId, activated_at: card.activated_at ?? new Date().toISOString(),
  }).eq("id", card.id).is("user_id", null).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "taken" }, { status: 409 });

  return NextResponse.json({ ok: true, code: card.code, firstTime: true, isTest: card.is_test });
}
