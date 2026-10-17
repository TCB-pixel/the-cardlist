import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { AGE_RANGES, CONSENT_VERSION, MINOR_AGES, currentUserId, memberStatus } from "@/lib/passport-auth";

export const dynamic = "force-dynamic";

// สมัคร Passport: ชื่อเล่น · ช่วงอายุ · เกมที่เล่น (ไม่บังคับ) · ยินยอมใช้ข้อมูลเพื่อระบบ (บังคับ) · รับข่าวสาร (ไม่บังคับ)
// อายุต่ำกว่า 20 ปี ต้องติ๊กผู้ปกครองยินยอม และไม่ขอยินยอมรับข่าวสาร
const GAMES = ["Pokémon", "One Piece", "Magic: The Gathering", "Gundam", "Union Arena", "Dragon Ball", "Lorcana", "Battle of Talingchan", "อื่น ๆ"];

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ auth: "login" }, { status: 401 });
  const m = await memberStatus(userId);
  return NextResponse.json({ auth: m.joined ? "ok" : "join", member: m, games: GAMES, ages: AGE_RANGES, version: CONSENT_VERSION });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "need_login" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  // ถอนความยินยอม: รับข่าวสาร หรือเลิกใช้ Passport (ข้อมูลแสตมป์เดิมยังอยู่ จนกว่าขอลบบัญชีที่ /account/delete)
  if (b.action === "withdraw_marketing" || b.action === "withdraw_passport") {
    const purpose = b.action === "withdraw_marketing" ? "marketing" : "passport";
    const { error } = await adminDb.from("member_consents").insert({ user_id: userId, purpose, granted: false, version: CONSENT_VERSION, source: "passport_settings" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const nickname = String(b.nickname ?? "").trim().slice(0, 40);
  const age = String(b.age_range ?? "");
  const minor = MINOR_AGES.includes(age);
  if (!nickname) return NextResponse.json({ error: "กรอกชื่อเล่น" }, { status: 400 });
  if (!AGE_RANGES.some((a) => a.v === age)) return NextResponse.json({ error: "เลือกช่วงอายุ" }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "ต้องยินยอมให้ใช้ข้อมูลเพื่อระบบ Passport ก่อน" }, { status: 400 });
  if (minor && b.guardian !== true) return NextResponse.json({ error: "อายุต่ำกว่า 20 ปี ต้องได้รับความยินยอมจากผู้ปกครอง" }, { status: 400 });
  const games = Array.isArray(b.games) ? b.games.filter((g: unknown) => typeof g === "string" && GAMES.includes(g)).slice(0, 10) : [];
  const marketing = !minor && b.marketing === true;

  const { error: e1 } = await adminDb.from("passport_members").upsert({
    user_id: userId, nickname, age_range: age, games, updated_at: new Date().toISOString(),
  });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const { error: e2 } = await adminDb.from("member_consents").insert([
    { user_id: userId, purpose: "passport", granted: true, version: CONSENT_VERSION, guardian: minor },
    { user_id: userId, purpose: "marketing", granted: marketing, version: CONSENT_VERSION, guardian: minor },
  ]);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
