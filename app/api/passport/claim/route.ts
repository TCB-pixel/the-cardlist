import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { DEVICE_COOKIE, DEVICE_COOKIE_OPTS, hashDevice, newDeviceToken, readDeviceToken } from "@/lib/passport";

export const dynamic = "force-dynamic";

// สแกน QR บนการ์ด Passport ที่ซื้อแล้ว → ผูกพาสปอร์ตกับเครื่องนี้
// สแกนซ้ำบนเครื่องใหม่ = ย้ายพาสปอร์ตมาเครื่องใหม่ (กู้คืนเมื่อเปลี่ยนมือถือ)
export async function POST(req: Request) {
  const { code, secret } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || typeof secret !== "string") return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { data: card } = await adminDb.from("passports").select("*")
    .eq("code", code.toUpperCase()).eq("kind", "card").maybeSingle();
  if (!card || card.claim_secret !== secret) return NextResponse.json({ error: "invalid" }, { status: 404 });
  if (card.status === "unsold") return NextResponse.json({ error: "not_sold" }, { status: 409 });

  const device = readDeviceToken(req) ?? newDeviceToken();
  const hash = hashDevice(device);

  // พาสปอร์ตอื่นที่ผูกกับเครื่องนี้อยู่: แบบฟรี (Learn To Play) → ย้ายแสตมป์และรางวัลเข้าการ์ด · การ์ดใบอื่น → ปลดออกจากเครื่อง
  const { data: others } = await adminDb.from("passports").select("id, kind, is_test")
    .eq("device_hash", hash).neq("id", card.id);
  for (const o of others ?? []) {
    if (o.kind === "free" && o.is_test === card.is_test) {
      const [{ data: mine }, { data: theirs }] = await Promise.all([
        adminDb.from("passport_stamps").select("station_id").eq("passport_id", card.id),
        adminDb.from("passport_stamps").select("id, station_id").eq("passport_id", o.id),
      ]);
      const have = new Set((mine ?? []).map((s) => s.station_id));
      const move = (theirs ?? []).filter((s) => !have.has(s.station_id)).map((s) => s.id);
      if (move.length) await adminDb.from("passport_stamps").update({ passport_id: card.id }).in("id", move);
      const { data: cardLearn } = await adminDb.from("passport_redemptions").select("id")
        .eq("passport_id", card.id).eq("kind", "learn_complete").maybeSingle();
      if (!cardLearn) await adminDb.from("passport_redemptions").update({ passport_id: card.id }).eq("passport_id", o.id).eq("kind", "learn_complete");
      await adminDb.from("passports").delete().eq("id", o.id);
    } else {
      await adminDb.from("passports").update({ device_hash: null }).eq("id", o.id);
    }
  }

  const { error } = await adminDb.from("passports").update({
    status: "active", device_hash: hash, activated_at: card.activated_at ?? new Date().toISOString(),
  }).eq("id", card.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ ok: true, code: card.code, firstTime: !card.activated_at, isTest: card.is_test });
  res.cookies.set(DEVICE_COOKIE, device, DEVICE_COOKIE_OPTS);
  return res;
}
