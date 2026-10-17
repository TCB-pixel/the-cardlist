import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { checkRedeemToken, parseRedeemToken } from "@/lib/passport";

export const dynamic = "force-dynamic";

// ---------- GET ?t=<QR บนมือถือลูกค้า> : ดูแสตมป์และรางวัลที่รอแลก ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "passport:redeem");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = parseRedeemToken(new URL(req.url).searchParams.get("t") ?? "");
  if (!parsed) return NextResponse.json({ error: "QR ไม่ใช่ของ Passport" }, { status: 400 });
  const { data: p } = await adminDb.from("passports").select("*").eq("code", parsed.code).maybeSingle();
  if (!p || !checkRedeemToken(p, parsed.window, parsed.sig)) {
    return NextResponse.json({ error: "QR หมดอายุหรือไม่ถูกต้อง — ให้ลูกค้าเปิดหน้า \"รางวัลของฉัน\" ใหม่" }, { status: 409 });
  }

  // พนักงานเห็นแค่ชื่อเล่นและรหัสสมาชิก (ไม่เห็นข้อมูลส่วนตัวอื่น)
  const [{ data: member }, { data: prof }] = p.user_id ? await Promise.all([
    adminDb.from("passport_members").select("nickname").eq("user_id", p.user_id).maybeSingle(),
    adminDb.from("profiles").select("member_code").eq("id", p.user_id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];

  const [{ data: stamps }, { data: wallet }] = await Promise.all([
    adminDb.from("passport_stamps").select("stamped_at, event_id, passport_stations(name, track)").eq("passport_id", p.id).order("stamped_at"),
    adminDb.from("passport_redemptions").select("id, kind, status, created_at, redeemed_at, redeemed_by, passport_rewards(tier, name, color, needs_payment)").eq("passport_id", p.id).order("created_at"),
  ]);

  // เตือนถ้าได้แสตมป์จุดในงานครบภายในเวลาสั้นผิดปกติ (ครบ 4 จุดใน 2 นาที)
  const warn: string[] = [];
  const byEvent = new Map<string, number[]>();
  for (const s of (stamps ?? []) as any[]) {
    if (s.passport_stations?.track !== "passport" || !s.event_id) continue;
    const arr = byEvent.get(s.event_id) ?? [];
    arr.push(new Date(s.stamped_at).getTime()); byEvent.set(s.event_id, arr);
  }
  for (const arr of Array.from(byEvent.values())) {
    if (arr.length >= 4 && arr[arr.length - 1] - arr[0] < 2 * 60_000) warn.push("ได้แสตมป์ครบทุกจุดภายใน 2 นาที — ลองถามลูกค้าว่าเดินครบทุกจุดจริงไหม");
  }

  return NextResponse.json({
    passport: { id: p.id, code: p.code, kind: p.kind, isTest: p.is_test, activatedAt: p.activated_at, soldAt: p.sold_at,
      nickname: member?.nickname ?? null, memberCode: prof?.member_code ?? null },
    stamps: (stamps ?? []).map((s: any) => ({ name: s.passport_stations?.name, track: s.passport_stations?.track, at: s.stamped_at })),
    wallet: (wallet ?? []).map((w: any) => ({
      id: w.id, kind: w.kind, status: w.status, redeemedAt: w.redeemed_at, redeemedBy: w.redeemed_by,
      tier: w.passport_rewards?.tier ?? "COMPLETE", name: w.passport_rewards?.name ?? "ของรางวัล Learn To Play (ของหมดในระบบ)",
      color: w.passport_rewards?.color ?? "#e9d29a", needsPayment: !!w.passport_rewards?.needs_payment,
    })),
    warn,
  });
}

// ---------- POST {id} : ยืนยันแลกของ (แลกซ้ำไม่ได้) ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "passport:redeem");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await req.json().catch(() => ({}));
  const { data, error } = await adminDb.from("passport_redemptions")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_by: auth.caller.email })
    .eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "รายการนี้แลกไปแล้ว" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
