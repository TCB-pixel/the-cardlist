import { adminDb } from "@/lib/require-admin";
import type { BoothLayout } from "@/lib/booth-layout";

// ระบบจองโต๊ะ Vendor แบบเลือกจากผัง — ตรรกะฝั่งเซิร์ฟเวอร์ที่ใช้ร่วมกัน
// ราคา/ส่วนลดคำนวณที่นี่เท่านั้น ไม่เชื่อตัวเลขที่ส่งมาจากเบราว์เซอร์

export type TypePricing = { label: string; size: string; full: number; per_day: number };
export type Pricing = Record<string, TypePricing>;

export type BoothEvent = {
  id: string;
  title: string;
  location: string | null;
  days: string[]; // YYYY-MM-DD
  partial_open_at: string | null;
  hold_minutes: number;
  max_tables: number;
  pricing: Pricing;
  layout: BoothLayout | null;
  active: boolean;
};

export async function getUserFromRequest(req: Request): Promise<{ id: string; email: string | null } | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await adminDb.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

// ปล่อยโต๊ะของรายการจองที่หมดเวลาชำระ (เรียกก่อนอ่าน/จองทุกครั้ง)
export async function releaseExpired() {
  const { error } = await adminDb.rpc("booth_release_expired");
  if (error) console.error("booth_release_expired:", error.message);
}

export async function loadEvent(id: string): Promise<BoothEvent | null> {
  const { data } = await adminDb.from("booth_events").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return {
    ...(data as any),
    days: ((data as any).days as string[]).map((d) => String(d).slice(0, 10)),
  } as BoothEvent;
}

// โต๊ะ → วันที่ถูกจองแล้ว (รวมรายการที่กำลังรอชำระ)
export async function getBooked(eventId: string): Promise<Record<string, string[]>> {
  const { data } = await adminDb
    .from("booth_booking_tables")
    .select("table_id, day")
    .eq("event_id", eventId)
    .eq("active", true);
  const out: Record<string, string[]> = {};
  for (const r of data ?? []) {
    (out[(r as any).table_id] ??= []).push(String((r as any).day).slice(0, 10));
  }
  return out;
}

export function isPartialOpen(ev: Pick<BoothEvent, "partial_open_at">, now = Date.now()) {
  return !ev.partial_open_at || new Date(ev.partial_open_at).getTime() <= now;
}

export type QuoteLine = { table_id: string; type: string; label: string; size: string; price: number };
export type Quote =
  | { ok: true; days: string[]; isFull: boolean; lines: QuoteLine[]; subtotal: number }
  | { ok: false; error: string };

export function quote(ev: BoothEvent, tableIds: unknown, daysIn: unknown): Quote {
  if (!ev.layout) return { ok: false, error: "งานนี้ยังไม่มีผังโต๊ะ" };
  const days = Array.from(new Set(Array.isArray(daysIn) ? daysIn.map(String) : [])).sort();
  if (days.length === 0) return { ok: false, error: "เลือกวันที่มาออกบูธอย่างน้อย 1 วัน" };
  if (days.some((d) => !ev.days.includes(d))) return { ok: false, error: "วันที่เลือกไม่ตรงกับวันจัดงาน" };
  const isFull = days.length === ev.days.length;
  if (!isFull && !isPartialOpen(ev)) {
    return { ok: false, error: "ตอนนี้เปิดจองเฉพาะแพ็กเกจครบทุกวัน — เปิดให้จองบางวันภายหลัง" };
  }

  const ids = Array.from(new Set(Array.isArray(tableIds) ? tableIds.map(String) : []));
  if (ids.length === 0) return { ok: false, error: "เลือกโต๊ะอย่างน้อย 1 โต๊ะ" };
  if (ids.length > ev.max_tables) return { ok: false, error: `จองได้สูงสุด ${ev.max_tables} โต๊ะต่อครั้ง` };

  const byId = new Map(ev.layout.tables.map((t) => [t.id, t]));
  const lines: QuoteLine[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (!t) return { ok: false, error: `ไม่พบโต๊ะ ${id} ในผัง` };
    const p = ev.pricing[t.type];
    if (!p) return { ok: false, error: `โต๊ะ ${id} ยังไม่เปิดขาย` };
    lines.push({
      table_id: id, type: t.type, label: p.label, size: p.size,
      price: isFull ? p.full : p.per_day * days.length,
    });
  }
  return { ok: true, days, isFull, lines, subtotal: lines.reduce((s, l) => s + l.price, 0) };
}

export function fmtDay(d: string) {
  return new Date(`${d}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
}
