import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { can } from "@/lib/rbac";
import { bangkokNow, newPassportCode, PASSPORT_PRICE } from "@/lib/passport";

export const dynamic = "force-dynamic";

// ---------- GET : ตัวเลขสดของ Passport (?test=1 = ดูชุดทดสอบ) ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "passport:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const isTest = new URL(req.url).searchParams.get("test") === "1";
  const manage = can(auth.caller.role, "passport:manage");
  const today = bangkokNow().date;

  const [ev, st, rw, ps, stamps, packs, red] = await Promise.all([
    adminDb.from("passport_events").select("*").eq("is_test", isTest).order("sort"),
    adminDb.from("passport_stations").select("id, code, event_id, track, name, logo_path, qr_mode, display_key, active, sort").eq("is_test", isTest).order("sort"),
    adminDb.from("passport_rewards").select("*").eq("is_test", isTest).order("track").order("sort"),
    adminDb.from("passports").select("id, kind, status, sold_price").eq("is_test", isTest),
    adminDb.from("passport_stamps").select("passport_id, station_id, event_id, stamped_at, passports!inner(is_test)").eq("passports.is_test", isTest),
    adminDb.from("passport_packs").select("id, opened_at, passports!inner(is_test)").eq("passports.is_test", isTest),
    adminDb.from("passport_redemptions").select("id, kind, status, reward_id, passports!inner(is_test)").eq("passports.is_test", isTest),
  ]);
  const passports = ps.data ?? [], allStamps = stamps.data ?? [];

  const byStation = new Map<string, { total: number; today: number }>();
  const eventsByPassport = new Map<string, Set<string>>();
  for (const s of allStamps as any[]) {
    const c = byStation.get(s.station_id) ?? { total: 0, today: 0 };
    c.total++;
    if (bangkokNow(new Date(s.stamped_at)).date === today) c.today++;
    byStation.set(s.station_id, c);
    if (s.event_id) {
      const set = eventsByPassport.get(s.passport_id) ?? new Set();
      set.add(s.event_id); eventsByPassport.set(s.passport_id, set);
    }
  }
  const multi = (n: number) => Array.from(eventsByPassport.values()).filter((v) => v.size >= n).length;
  const sold = passports.filter((p: any) => p.kind === "card" && p.status !== "unsold");
  const redemptions = red.data ?? [];
  const given = new Map<string, number>();
  for (const r of redemptions as any[]) if (r.reward_id) given.set(r.reward_id, (given.get(r.reward_id) ?? 0) + 1);

  return NextResponse.json({
    isTest, manage, price: PASSPORT_PRICE,
    kpi: {
      sold: sold.length,
      revenue: sold.reduce((a: number, p: any) => a + (p.sold_price ?? 0), 0),
      activated: sold.filter((p: any) => p.status === "active").length,
      unsoldCards: passports.filter((p: any) => p.kind === "card" && p.status === "unsold").length,
      freeLearners: passports.filter((p: any) => p.kind === "free").length,
      stamps: allStamps.length,
      repeat2: multi(2), repeat3: multi(3),
      packsEarned: (packs.data ?? []).length,
      packsOpened: (packs.data ?? []).filter((p: any) => p.opened_at).length,
      pending: redemptions.filter((r: any) => r.status === "pending").length,
      redeemed: redemptions.filter((r: any) => r.status === "redeemed").length,
      learnComplete: redemptions.filter((r: any) => r.kind === "learn_complete").length,
    },
    events: ev.data ?? [],
    stations: (st.data ?? []).map((s: any) => ({
      ...s, display_key: manage ? s.display_key : undefined,
      total: byStation.get(s.id)?.total ?? 0, today: byStation.get(s.id)?.today ?? 0,
    })),
    rewards: (rw.data ?? []).map((r: any) => ({ ...r, given: given.get(r.id) ?? 0 })),
  });
}

// ---------- POST : ขาย / สร้างการ์ด / แก้รางวัล จุด งาน ----------
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const origin = new URL(req.url).origin;
  const claimUrl = (p: { code: string; claim_secret: string }) => `${origin}/passport/claim/${p.code}.${p.claim_secret}`;

  if (action === "sell") {
    // พนักงานรับเงินที่ Loyverse แล้วกดบันทึก — ถ้าสแกนการ์ดพิมพ์มา (code) = เปลี่ยนการ์ดใบนั้นเป็น "ขายแล้ว"
    const auth = await requireAdmin(req, "passport:redeem");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const sale = { status: "sold", sold_price: PASSPORT_PRICE, sold_at: new Date().toISOString(), sold_by: auth.caller.email };
    if (body.code) {
      const code = String(body.code).toUpperCase().replace(/^.*\/claim\//, "").split(".")[0];
      const { data, error } = await adminDb.from("passports").update(sale)
        .eq("code", code).eq("kind", "card").eq("status", "unsold").select("code, claim_secret, is_test").maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: "ไม่พบการ์ดนี้ หรือการ์ดถูกขายไปแล้ว" }, { status: 409 });
      return NextResponse.json({ code: data.code, claimUrl: claimUrl(data), isTest: data.is_test });
    }
    for (let i = 0; i < 5; i++) {
      const { data, error } = await adminDb.from("passports").insert({
        code: newPassportCode(), kind: "card", is_test: !!body.test, ...sale,
      }).select("code, claim_secret, is_test").single();
      if (data) return NextResponse.json({ code: data.code, claimUrl: claimUrl(data), isTest: data.is_test });
      if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "สร้างรหัสไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
  }

  const auth = await requireAdmin(req, "passport:manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (action === "cards") {
    // สร้างการ์ดเปล่าสำหรับพิมพ์ (ยังเปิดใช้ไม่ได้จนกว่าพนักงานกดขาย)
    const n = Math.min(500, Math.max(1, Number(body.count) || 0));
    const rows = Array.from({ length: n }, () => ({ code: newPassportCode(), kind: "card", status: "unsold", is_test: !!body.test }));
    const { data, error } = await adminDb.from("passports").insert(rows).select("code, claim_secret");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cards: (data ?? []).map((c) => ({ code: c.code, url: claimUrl(c) })) });
  }

  if (action === "reward") {
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.stock !== undefined) {
      const stock = Math.max(0, Math.floor(Number(body.stock)));
      const { count } = await adminDb.from("passport_redemptions").select("id", { count: "exact", head: true }).eq("reward_id", body.id);
      patch.stock = stock;
      patch.initial_stock = stock + (count ?? 0);
    }
    const { error } = await adminDb.from("passport_rewards").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "station") {
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.qr_mode === "daily" || body.qr_mode === "rotating") patch.qr_mode = body.qr_mode;
    const { error } = await adminDb.from("passport_stations").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "event") {
    const patch: Record<string, unknown> = {};
    for (const k of ["open_time", "close_time"]) if (/^\d{2}:\d{2}(:\d{2})?$/.test(body[k] ?? "")) patch[k] = body[k];
    const { error } = await adminDb.from("passport_events").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
