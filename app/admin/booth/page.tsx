"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

type TypePricing = { label: string; size: string; full: number; per_day: number };
type EventRow = {
  id: string; title: string; location: string | null; days: string[];
  partial_open_at: string | null; hold_minutes: number; max_tables: number;
  pricing: Record<string, TypePricing>; active: boolean; paidCount: number;
  layoutInfo: { tables: number; types: string[]; viewBox: number[] } | null;
};
type Booking = {
  id: string; status: string; days: string[]; tables: string[]; total: number; subtotal: number;
  discount_code: string | null; discount_amount: number; shop_name: string | null;
  contact_name: string | null; phone: string | null; created_at: string; hold_expires_at: string;
};

const STATUS: Record<string, { text: string; cls: string }> = {
  hold: { text: "รอชำระ", cls: "bg-amber-50 text-amber-700" },
  paid: { text: "ชำระแล้ว", cls: "bg-green-50 text-green-700" },
  expired: { text: "หมดเวลา", cls: "bg-zinc-100 text-zinc-500" },
  cancelled: { text: "ยกเลิก", cls: "bg-zinc-100 text-zinc-500" },
  needs_refund: { text: "ต้องคืนเงิน", cls: "bg-red-50 text-red-600" },
};
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";
const labelCls = "text-[11px] font-semibold text-zinc-500 block mb-1";

// ISO ↔ datetime-local (เวลาไทย)
const isoToLocal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "");
const localToIso = (v: string) => (v ? new Date(`${v}:00+07:00`).toISOString() : null);

type Form = {
  id?: string; title: string; location: string; days: string; partial_open_at: string;
  hold_minutes: number; max_tables: number; active: boolean;
  pricing: Record<string, TypePricing>; svg: string; svgName: string; viewBox: string;
};
const EMPTY: Form = {
  title: "", location: "", days: "", partial_open_at: "", hold_minutes: 30, max_tables: 4, active: false,
  pricing: {}, svg: "", svgName: "", viewBox: "",
};

export default function AdminBoothPage() {
  const { can } = useAdmin();
  const canEdit = can("booth:edit");
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [typesInLayout, setTypesInLayout] = useState<string[]>([]);
  const [bookingsFor, setBookingsFor] = useState<EventRow | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const authed = useCallback(async (input: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
  }, [supabase]);

  const load = useCallback(async () => {
    const res = await authed("/api/admin/booth?action=events");
    const j = await res.json();
    if (res.ok) setEvents(j.events ?? []);
  }, [authed]);
  useEffect(() => { load(); }, [load]);

  async function loadBookings(e: EventRow) {
    setBookingsFor(e);
    const res = await authed(`/api/admin/booth?action=bookings&eventId=${e.id}`);
    const j = await res.json();
    setBookings(res.ok ? j.bookings ?? [] : []);
  }

  function edit(e: EventRow | null) {
    setMsg(null);
    if (!e) { setForm({ ...EMPTY }); setTypesInLayout([]); return; }
    setTypesInLayout(e.layoutInfo?.types ?? []);
    setForm({
      id: e.id, title: e.title, location: e.location ?? "", days: e.days.join(", "),
      partial_open_at: isoToLocal(e.partial_open_at), hold_minutes: e.hold_minutes, max_tables: e.max_tables,
      active: e.active, pricing: e.pricing ?? {}, svg: "", svgName: "",
      viewBox: e.layoutInfo?.viewBox?.join(" ") ?? "",
    });
  }

  async function pickSvg(file: File | undefined) {
    if (!file || !form) return;
    const text = await file.text();
    setForm({ ...form, svg: text, svgName: file.name, viewBox: "" });
    setMsg({ ok: true, text: `เลือกไฟล์ ${file.name} แล้ว — กดบันทึกเพื่ออ่านผังและสร้างโต๊ะ` });
  }

  async function save() {
    if (!form) return;
    setSaving(true); setMsg(null);
    try {
      const vb = form.viewBox.trim() ? form.viewBox.trim().split(/[\s,]+/).map(Number) : undefined;
      const res = await authed("/api/admin/booth", {
        method: "POST",
        body: JSON.stringify({
          action: "saveEvent", id: form.id, title: form.title, location: form.location,
          days: form.days.split(/[\s,]+/).filter(Boolean),
          partial_open_at: localToIso(form.partial_open_at),
          hold_minutes: Number(form.hold_minutes), max_tables: Number(form.max_tables),
          active: form.active, pricing: form.pricing, svg: form.svg || undefined, viewBox: vb,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
      setMsg({ ok: true, text: j.tables ? `บันทึกแล้ว · อ่านผังได้ ${j.tables} โต๊ะ` : "บันทึกแล้ว" });
      await load();
      if (!form.id && j.id) {
        const fresh = (await (await authed("/api/admin/booth?action=events")).json()).events as EventRow[];
        const e = fresh.find((x) => x.id === j.id);
        if (e) edit(e);
      } else if (form.svg) {
        const fresh = (await (await authed("/api/admin/booth?action=events")).json()).events as EventRow[];
        const e = fresh.find((x) => x.id === form.id);
        if (e) edit(e);
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "บันทึกไม่สำเร็จ" });
    } finally { setSaving(false); }
  }

  async function cancelBooking(b: Booking) {
    const paid = b.status === "paid" || b.status === "needs_refund";
    if (!window.confirm(paid
      ? `ยกเลิกการจองของ ${b.shop_name} และปล่อยโต๊ะคืน?\n\nรายการนี้ชำระเงินแล้ว — ระบบไม่คืนเงินให้อัตโนมัติ ต้องคืนที่ Stripe เอง`
      : `ยกเลิกการจองของ ${b.shop_name} และปล่อยโต๊ะคืน?`)) return;
    const res = await authed("/api/admin/booth", { method: "POST", body: JSON.stringify({ action: "cancelBooking", bookingId: b.id }) });
    const j = await res.json();
    if (!res.ok) return alert(j.error ?? "ยกเลิกไม่สำเร็จ");
    if (j.refundNeeded) alert("ปล่อยโต๊ะแล้ว — อย่าลืมคืนเงินลูกค้าที่ Stripe");
    if (bookingsFor) loadBookings(bookingsFor);
    load();
  }

  const priceTypes = form ? Array.from(new Set([...typesInLayout, ...Object.keys(form.pricing)])).sort() : [];

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">ผังโต๊ะงาน & การจอง</h1>
          <p className="text-xs text-zinc-400 mt-0.5">อัปโหลดไฟล์ผัง SVG ของแต่ละงาน ตั้งราคา และดูรายการจองของ Vendor</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/discount-codes" className="text-xs font-semibold border border-zinc-200 rounded-xl px-4 py-2 text-zinc-700">โค้ดส่วนลด</Link>
          {canEdit && <button onClick={() => edit(null)} className="text-xs font-semibold bg-zinc-900 text-white rounded-xl px-4 py-2">+ เพิ่มงาน</button>}
        </div>
      </div>

      <div className="space-y-2">
        {events.length === 0 && <p className="text-sm text-zinc-400">ยังไม่มีงาน</p>}
        {events.map((e) => (
          <div key={e.id} className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{e.title} <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded ${e.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>{e.active ? "เปิดรับจอง" : "ปิด"}</span></p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {e.days.join(" · ")} · {e.layoutInfo ? `${e.layoutInfo.tables} โต๊ะ` : "ยังไม่มีผัง"} · ชำระแล้ว {e.paidCount} รายการ
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => loadBookings(e)} className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700">ดูรายการจอง</button>
              {canEdit && <button onClick={() => edit(e)} className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700">แก้ไข</button>}
              <a href={`/booth?event=${e.id}`} target="_blank" className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700">เปิดหน้าจอง ↗</a>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-zinc-900">{form.id ? "แก้ไขงาน" : "เพิ่มงานใหม่"}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={labelCls}>ชื่องาน</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className={labelCls}>สถานที่</label><input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className={labelCls}>วันจัดงาน (ปปปป-ดด-วว คั่นด้วยคอมมา)</label><input className={inputCls} placeholder="2026-11-20, 2026-11-21, 2026-11-22" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></div>
            <div><label className={labelCls}>เปิดให้จองบางวันตั้งแต่ (เว้นว่าง = เปิดทันที)</label><input type="datetime-local" className={inputCls} value={form.partial_open_at} onChange={(e) => setForm({ ...form, partial_open_at: e.target.value })} /></div>
            <div><label className={labelCls}>เวลากันโต๊ะระหว่างชำระ (นาที · 30–120)</label><input type="number" min={30} max={120} className={inputCls} value={form.hold_minutes} onChange={(e) => setForm({ ...form, hold_minutes: Number(e.target.value) })} /></div>
            <div><label className={labelCls}>จองได้สูงสุดต่อครั้ง (โต๊ะ)</label><input type="number" min={1} max={50} className={inputCls} value={form.max_tables} onChange={(e) => setForm({ ...form, max_tables: Number(e.target.value) })} /></div>
          </div>

          <div>
            <label className={labelCls}>ไฟล์ผัง (SVG)</label>
            <input type="file" accept=".svg,image/svg+xml" onChange={(e) => pickSvg(e.target.files?.[0])} className="text-xs" />
            <p className="text-[10px] text-zinc-400 mt-1">
              เลขโต๊ะในไฟล์ต้องเป็นข้อความ เช่น A01, S02 อยู่ในกรอบโต๊ะ · ประเภทโต๊ะ = ตัวอักษรหน้าเลข · {form.svgName ? `เลือกแล้ว: ${form.svgName}` : form.id ? "ไม่เลือกไฟล์ = ใช้ผังเดิม" : ""}
            </p>
          </div>

          {form.id && (
            <div>
              <label className={labelCls}>ส่วนของผังที่แสดง (x y กว้าง สูง)</label>
              <input className={inputCls} value={form.viewBox} placeholder="185 0 600 540" onChange={(e) => setForm({ ...form, viewBox: e.target.value })} />
            </div>
          )}

          <div>
            <p className={labelCls}>ราคาตามประเภทโต๊ะ {priceTypes.length === 0 && <span className="font-normal text-zinc-400">— บันทึกพร้อมไฟล์ผังก่อน แล้วประเภทโต๊ะจะขึ้นให้ตั้งราคา</span>}</p>
            <div className="space-y-2">
              {priceTypes.map((t) => {
                const p = form.pricing[t] ?? { label: `โต๊ะ ${t}`, size: "", full: 0, per_day: 0 };
                const set = (patch: Partial<TypePricing>) => setForm({ ...form, pricing: { ...form.pricing, [t]: { ...p, ...patch } } });
                return (
                  <div key={t} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border border-zinc-100 rounded-xl p-2.5">
                    <div><label className={labelCls}>ประเภท {t} · ชื่อ</label><input className={inputCls} value={p.label} onChange={(e) => set({ label: e.target.value })} /></div>
                    <div><label className={labelCls}>ขนาด</label><input className={inputCls} placeholder="1.8 × 1.8 ม." value={p.size} onChange={(e) => set({ size: e.target.value })} /></div>
                    <div><label className={labelCls}>แพ็กเกจครบทุกวัน (฿)</label><input type="number" className={inputCls} value={p.full || ""} onChange={(e) => set({ full: Number(e.target.value) })} /></div>
                    <div><label className={labelCls}>บางวัน ต่อวัน (฿)</label><input type="number" className={inputCls} value={p.per_day || ""} onChange={(e) => set({ per_day: Number(e.target.value) })} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> เปิดรับจอง (แสดงในหน้าเว็บ)
          </label>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving || !canEdit} className="bg-zinc-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            <button onClick={() => setForm(null)} className="text-xs text-zinc-500">ปิด</button>
            {msg && <span className={`text-[11px] font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        </div>
      )}

      {bookingsFor && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-zinc-900">รายการจอง · {bookingsFor.title}</p>
            <button onClick={() => setBookingsFor(null)} className="text-xs text-zinc-400">ปิด</button>
          </div>
          {bookings.length === 0 ? <p className="text-xs text-zinc-400">ยังไม่มีรายการจอง</p> : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="border border-zinc-100 rounded-xl px-3 py-2.5 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900">
                      {b.shop_name} <span className="text-zinc-400 font-normal">· {b.contact_name} · {b.phone}</span>
                      <span className={`ml-2 text-[10px] px-2 py-0.5 rounded ${STATUS[b.status]?.cls ?? "bg-zinc-100"}`}>{STATUS[b.status]?.text ?? b.status}</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">โต๊ะ {b.tables.join(", ")} · {b.days.map((d) => d.slice(5)).join(", ")}</p>
                    <p className="text-[11px] text-zinc-500">ยอด {baht(b.total)}{b.discount_code ? ` · โค้ด ${b.discount_code} (-${baht(b.discount_amount)})` : ""} · {new Date(b.created_at).toLocaleString("th-TH")}</p>
                  </div>
                  {canEdit && b.status !== "cancelled" && b.status !== "expired" && (
                    <button onClick={() => cancelBooking(b)} className="text-[11px] text-red-600 border border-red-100 rounded-lg px-3 py-1.5">ยกเลิก/ปล่อยโต๊ะ</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
