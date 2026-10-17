import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { adminDb } from "@/lib/require-admin";

// ─────────────────────────────────────────────────────────────────────────────
// CARDLIST PASSPORT — ฟังก์ชันฝั่ง server ที่ใช้ร่วมกัน (ห้าม import จาก client)
// QR ของจุดสแกน: <code>.<window>.<sig>
//   daily    → window = YYYYMMDD (เวลาไทย) ใช้ได้เฉพาะวันนั้น ช่วงเวลางาน
//   rotating → window = floor(epoch / 30 วินาที) ยอมคลาดได้ ±1 ช่วง
// QR แลกของบนมือถือลูกค้า: R.<passport code>.<window 60 วินาที>.<sig>
// ─────────────────────────────────────────────────────────────────────────────

export const PASSPORT_PRICE = 100;
const ROTATE_SEC = 30;
const REDEEM_SEC = 60;
// กันกดรัว: จุดในงานห่างกันอย่างน้อย 20 วินาที · โต๊ะสอนเล่นห่างกันอย่างน้อย 10 นาที (งานจริงเท่านั้น)
const PASSPORT_GAP_MS = 20_000;
const LEARN_GAP_MS = 10 * 60_000;

export type Station = {
  id: string; code: string; event_id: string | null; track: "passport" | "learn"; name: string;
  logo_path: string | null; qr_mode: "daily" | "rotating"; secret: string; display_key: string;
  is_test: boolean; active: boolean; sort: number;
};
export type PEvent = {
  id: string; slug: string; name: string; venue: string | null; starts_on: string; ends_on: string;
  open_time: string; close_time: string; is_test: boolean; sort: number;
};
export type Passport = {
  id: string; code: string; kind: "card" | "free"; status: "unsold" | "sold" | "active";
  claim_secret: string; redeem_secret: string; user_id: string | null; is_test: boolean;
};

function sign(secret: string, data: string, len = 16) {
  return createHmac("sha256", secret).update(data).digest("base64url").slice(0, len);
}
function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// เวลาไทย (UTC+7 ไม่มี DST)
export function bangkokNow(d = new Date()) {
  const t = new Date(d.getTime() + 7 * 3600_000);
  const iso = t.toISOString();
  return { date: iso.slice(0, 10), ymd: iso.slice(0, 10).replace(/-/g, ""), time: iso.slice(11, 19) };
}

export function eventOpenNow(ev: PEvent, d = new Date()) {
  const { date, time } = bangkokNow(d);
  return date >= ev.starts_on && date <= ev.ends_on && time >= ev.open_time && time <= ev.close_time;
}

export function stationToken(st: Pick<Station, "code" | "secret" | "qr_mode">, opts?: { ymd?: string; now?: number }) {
  const window = st.qr_mode === "daily"
    ? (opts?.ymd ?? bangkokNow().ymd)
    : String(Math.floor((opts?.now ?? Date.now()) / 1000 / ROTATE_SEC));
  return `${st.code}.${window}.${sign(st.secret, `${st.code}:${window}`)}`;
}

export function parseStationToken(token: string) {
  const m = /^([A-Z0-9-]{2,40})\.(\d{6,10})\.([A-Za-z0-9_-]{16})$/.exec(token.trim());
  return m ? { code: m[1], window: m[2], sig: m[3] } : null;
}

// คืนค่าเหตุผลที่ไม่ผ่าน หรือ null ถ้า QR ใช้ได้ตอนนี้
export function checkStationToken(st: Station, window: string, sig: string): string | null {
  if (!safeEq(sign(st.secret, `${st.code}:${window}`), sig)) return "invalid";
  if (st.qr_mode === "daily") {
    if (window !== bangkokNow().ymd) return "expired";
  } else {
    const now = Math.floor(Date.now() / 1000 / ROTATE_SEC);
    if (Math.abs(now - Number(window)) > 1) return "expired";
  }
  return null;
}

export function redeemToken(p: Pick<Passport, "code" | "redeem_secret">, now = Date.now()) {
  const w = String(Math.floor(now / 1000 / REDEEM_SEC));
  return `R.${p.code}.${w}.${sign(p.redeem_secret, `${p.code}:${w}`)}`;
}
export function parseRedeemToken(token: string) {
  const m = /^R\.(CL-[A-Z0-9]{6})\.(\d{6,10})\.([A-Za-z0-9_-]{16})$/.exec(token.trim());
  return m ? { code: m[1], window: m[2], sig: m[3] } : null;
}
export function checkRedeemToken(p: Pick<Passport, "code" | "redeem_secret">, window: string, sig: string) {
  if (!safeEq(sign(p.redeem_secret, `${p.code}:${window}`), sig)) return false;
  return Math.abs(Math.floor(Date.now() / 1000 / REDEEM_SEC) - Number(window)) <= 1;
}

// รหัสพาสปอร์ต CL-XXXXXX (ไม่มีตัวที่สับสน 0/O 1/I)
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newPassportCode() {
  const b = randomBytes(6);
  return "CL-" + Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
}

// พาสปอร์ตของสมาชิก: การ์ดมาก่อนพาสปอร์ตฟรี · isTest ไม่ระบุ = เอาการ์ดใบไหนก็ได้ (ของจริงก่อน)
export async function passportForUser(userId: string | null, isTest?: boolean): Promise<Passport | null> {
  if (!userId) return null;
  let q = adminDb.from("passports").select("*").eq("user_id", userId).eq("status", "active");
  if (isTest !== undefined) q = q.eq("is_test", isTest);
  const { data } = await q.order("kind", { ascending: true }).order("is_test", { ascending: true }).limit(1).maybeSingle();
  return (data as Passport) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ข้อมูลพาสปอร์ตทั้งหมดที่หน้า /passport ต้องใช้
// ─────────────────────────────────────────────────────────────────────────────
export async function passportState(p: Passport | null, isTestHint = false, member: { nickname: string | null } | null = null) {
  const isTest = p?.is_test ?? isTestHint;
  const [{ data: events }, { data: stations }, { data: rewards }] = await Promise.all([
    adminDb.from("passport_events").select("id, slug, name, venue, starts_on, ends_on, open_time, close_time, is_test, sort").eq("is_test", isTest).order("sort"),
    adminDb.from("passport_stations").select("id, code, event_id, track, name, logo_path, sort").eq("is_test", isTest).eq("active", true).order("sort"),
    adminDb.from("passport_rewards").select("id, track, tier, name, color, stock, initial_stock, sort").eq("is_test", isTest).eq("active", true).order("sort"),
  ]);
  let stamps: { station_id: string; stamped_at: string }[] = [];
  let packs: { id: string; event_id: string | null; opened_at: string | null }[] = [];
  let wallet: any[] = [];
  if (p) {
    const [s, pk, w] = await Promise.all([
      adminDb.from("passport_stamps").select("station_id, stamped_at").eq("passport_id", p.id),
      adminDb.from("passport_packs").select("id, event_id, opened_at").eq("passport_id", p.id).order("created_at"),
      adminDb.from("passport_redemptions").select("id, kind, status, created_at, redeemed_at, passport_rewards(tier, name, color, needs_payment)").eq("passport_id", p.id).order("created_at"),
    ]);
    stamps = s.data ?? []; packs = pk.data ?? []; wallet = w.data ?? [];
  }
  const stamped = new Map(stamps.map((s) => [s.station_id, s.stamped_at]));
  const today = bangkokNow().date;
  return {
    passport: p ? { code: p.code, kind: p.kind, isTest: p.is_test } : null,
    member,
    price: PASSPORT_PRICE,
    events: (events ?? []).map((ev: any) => ({
      id: ev.id, slug: ev.slug, name: ev.name, venue: ev.venue, startsOn: ev.starts_on, endsOn: ev.ends_on,
      today: today >= ev.starts_on && today <= ev.ends_on,
      stations: (stations ?? []).filter((s: any) => s.track === "passport" && s.event_id === ev.id)
        .map((s: any) => ({ id: s.id, name: s.name, stampedAt: stamped.get(s.id) ?? null })),
    })),
    learn: (stations ?? []).filter((s: any) => s.track === "learn")
      .map((s: any) => ({ id: s.id, name: s.name, logo: s.logo_path, stampedAt: stamped.get(s.id) ?? null })),
    packsUnopened: packs.filter((x) => !x.opened_at).length,
    rewards: (rewards ?? []).map((r: any) => ({ track: r.track, tier: r.tier, name: r.name, color: r.color, left: r.stock, total: r.initial_stock })),
    wallet: wallet.map((w: any) => ({
      id: w.id, kind: w.kind, status: w.status, createdAt: w.created_at, redeemedAt: w.redeemed_at,
      tier: w.passport_rewards?.tier ?? (w.kind === "learn_complete" ? "COMPLETE" : "—"),
      name: w.passport_rewards?.name ?? "ของรางวัล Learn To Play (ของหมด — ติดต่อพนักงาน)",
      color: w.passport_rewards?.color ?? "#e9d29a",
      needsPayment: !!w.passport_rewards?.needs_payment,
    })),
    redeemToken: p ? redeemToken(p) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ปั๊มแสตมป์ — คืนผลให้หน้า /passport/s/[token] แสดงแอนิเมชัน
// ─────────────────────────────────────────────────────────────────────────────
export type StampResult =
  | { ok: false; reason: "invalid" | "expired" | "closed" | "need_login" | "need_join" | "need_card" | "too_fast"; station?: { name: string; track: string; logo: string | null }; waitSec?: number }
  | { ok: true; already: boolean; station: { name: string; track: string; logo: string | null };
      event: { name: string } | null; count: number; total: number; packEarned: boolean; learnComplete: boolean };

export async function stampWithToken(token: string, userId: string | null, joined: boolean): Promise<{ result: StampResult }> {
  const parsed = parseStationToken(token);
  if (!parsed) return { result: { ok: false, reason: "invalid" } };
  const { data: st } = await adminDb.from("passport_stations").select("*").eq("code", parsed.code).maybeSingle();
  if (!st || !st.active) return { result: { ok: false, reason: "invalid" } };
  const station = st as Station;
  const stInfo = { name: station.name, track: station.track, logo: station.logo_path };

  const bad = checkStationToken(station, parsed.window, parsed.sig);
  if (bad) return { result: { ok: false, reason: bad as "invalid" | "expired", station: stInfo } };

  // งานต้องเปิดอยู่ตอนนี้ (จุดในงาน = งานของจุดนั้น · โต๊ะสอนเล่น = งานใดก็ได้ที่เปิดอยู่ในชุดเดียวกัน จริง/ทดสอบ)
  const { data: evs } = await adminDb.from("passport_events").select("*").eq("is_test", station.is_test);
  const openEv = (evs ?? []).find((e: any) => (station.event_id ? e.id === station.event_id : true) && eventOpenNow(e as PEvent)) as PEvent | undefined;
  if (!openEv) return { result: { ok: false, reason: "closed", station: stInfo } };

  // ต้องล็อกอิน LINE และสมัคร Passport (ยินยอม PDPA) ก่อน
  if (!userId) return { result: { ok: false, reason: "need_login", station: stInfo } };
  if (!joined) return { result: { ok: false, reason: "need_join", station: stInfo } };

  let p = await passportForUser(userId, station.is_test);
  if (station.track === "passport") {
    if (!p || p.kind !== "card") return { result: { ok: false, reason: "need_card", station: stInfo } };
  } else if (!p) {
    // Learn To Play ฟรี: สร้างพาสปอร์ตแบบ free ผูกกับบัญชีนี้
    for (let i = 0; i < 5 && !p; i++) {
      const { data, error } = await adminDb.from("passports").insert({
        code: newPassportCode(), kind: "free", status: "active", user_id: userId,
        is_test: station.is_test, activated_at: new Date().toISOString(),
      }).select("*").single();
      if (error?.code === "23505") p = await passportForUser(userId, station.is_test);
      else p = (data as Passport) ?? null;
    }
    if (!p) throw new Error("create_free_passport_failed");
  }

  const { data: existing } = await adminDb.from("passport_stamps").select("id")
    .eq("passport_id", p.id).eq("station_id", station.id).maybeSingle();
  let already = !!existing;

  if (!already) {
    // กันกดรัว — ดูแสตมป์ล่าสุดใน track เดียวกัน
    const gap = station.track === "learn" ? (station.is_test ? 0 : LEARN_GAP_MS) : PASSPORT_GAP_MS;
    if (gap > 0) {
      const { data: last } = await adminDb.from("passport_stamps")
        .select("stamped_at, passport_stations!inner(track)")
        .eq("passport_id", p.id).eq("passport_stations.track", station.track)
        .order("stamped_at", { ascending: false }).limit(1).maybeSingle();
      if (last) {
        const wait = gap - (Date.now() - new Date(last.stamped_at).getTime());
        if (wait > 0) return { result: { ok: false, reason: "too_fast", station: stInfo, waitSec: Math.ceil(wait / 1000) } };
      }
    }
    const { error } = await adminDb.from("passport_stamps").insert({
      passport_id: p.id, station_id: station.id, event_id: station.event_id ?? openEv.id,
    });
    if (error) {
      if (error.code === "23505") already = true; // สแกนซ้อนกันพร้อมกัน
      else throw new Error(error.message);
    }
  }

  // นับความคืบหน้า
  const { data: group } = await adminDb.from("passport_stations").select("id")
    .eq("active", true).eq("is_test", station.is_test).eq("track", station.track)
    .match(station.event_id ? { event_id: station.event_id } : {});
  const ids = (group ?? []).map((g: any) => g.id);
  const { count } = await adminDb.from("passport_stamps").select("id", { count: "exact", head: true })
    .eq("passport_id", p.id).in("station_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const n = count ?? 0, total = ids.length;

  let packEarned = false, learnComplete = false;
  if (!already && n >= total && total > 0) {
    if (station.track === "passport") {
      const { error } = await adminDb.from("passport_packs").insert({ passport_id: p.id, event_id: station.event_id, source: "event_complete" });
      packEarned = !error;
    } else {
      const { data } = await adminDb.rpc("passport_grant_learn", { p_passport: p.id });
      learnComplete = Array.isArray(data) && data.length > 0;
    }
  }

  const evName = station.event_id ? (evs ?? []).find((e: any) => e.id === station.event_id)?.name ?? null : null;
  return {
    result: { ok: true, already, station: stInfo, event: evName ? { name: evName } : null, count: n, total, packEarned, learnComplete },
  };
}
