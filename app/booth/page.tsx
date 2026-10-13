"use client";
import { goLogin } from "@/lib/auth-next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import BoothMap, { TableState } from "@/components/BoothMap";
import type { BoothLayout } from "@/lib/booth-layout";
import { PRODUCT_TYPES } from "@/lib/booth-vendor";

type TypePricing = { label: string; size: string; full: number; per_day: number };
type EventData = {
  id: string; title: string; location: string | null; days: string[];
  partial_open_at: string | null; hold_minutes: number; max_tables: number;
  pricing: Record<string, TypePricing>; layout: BoothLayout | null;
  rules: string | null; rules_version: number;
};
type VendorForm = {
  shop_name: string; contact_name: string; phone: string; line_id: string; social_url: string;
  product_types: string[]; product_detail: string; logo_url: string;
};
const EMPTY_VENDOR: VendorForm = {
  shop_name: "", contact_name: "", phone: "", line_id: "", social_url: "", product_types: [], product_detail: "", logo_url: "",
};
type MyBooking = {
  id: string; status: string; days: string[]; tables: string[]; total: number;
  discount_code: string | null; discount_amount: number; hold_expires_at: string;
  booth_events: { title: string } | null;
};

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
const STATUS: Record<string, { text: string; cls: string }> = {
  hold: { text: "รอชำระเงิน", cls: "bg-amber-50 text-amber-700" },
  paid: { text: "ชำระแล้ว", cls: "bg-green-50 text-green-700" },
  expired: { text: "หมดเวลา", cls: "bg-zinc-100 text-zinc-500" },
  cancelled: { text: "ยกเลิก", cls: "bg-zinc-100 text-zinc-500" },
  needs_refund: { text: "รอทีมงานติดต่อ", cls: "bg-red-50 text-red-600" },
};

export default function BoothPage() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<{ id: string; title: string; location: string | null; days: string[] }[] | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [data, setData] = useState<{ event: EventData; booked: Record<string, string[]>; partialOpen: boolean } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; label: string; amount: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [vendor, setVendor] = useState<VendorForm>(EMPTY_VENDOR);
  const [vendorSaved, setVendorSaved] = useState(false); // มีข้อมูลร้านเดิมที่เคยบันทึก → โชว์แบบย่อ
  const [editingVendor, setEditingVendor] = useState(true);
  const restored = useRef(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [rulesFor, setRulesFor] = useState<"promptpay" | "card" | null>(null);
  const [rulesRead, setRulesRead] = useState(false);
  const [rulesOk, setRulesOk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<MyBooking[]>([]);

  const authed = useCallback(async (input: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
  }, [supabase]);

  // รายชื่องาน
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/booth/event");
        const j = await res.json();
        const list = j.events ?? [];
        setEvents(list);
        const wanted = new URLSearchParams(window.location.search).get("event");
        if (wanted && list.some((e: any) => e.id === wanted)) setEventId(wanted);
        else if (list.length === 1) setEventId(list[0].id);
      } catch {
        setEvents([]);
      }
    })();
  }, []);

  // ข้อมูลร้านที่เคยลงทะเบียนไว้ (ใช้ซ้ำทุกงาน)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await authed("/api/booth/vendor");
      if (!res.ok) return;
      const p = (await res.json()).profile;
      if (p) {
        setVendor({
          shop_name: p.shop_name ?? "", contact_name: p.contact_name ?? "", phone: p.phone ?? "",
          line_id: p.line_id ?? "", social_url: p.social_url ?? "",
          product_types: p.product_types ?? [], product_detail: p.product_detail ?? "", logo_url: p.logo_url ?? "",
        });
        setVendorSaved(true);
        setEditingVendor(false);
      }
    })();
  }, [supabase, authed]);

  const loadEvent = useCallback(async (id: string, first: boolean) => {
    try {
      const res = await fetch(`/api/booth/event?id=${id}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "โหลดไม่สำเร็จ");
      setData(j);
      if (first) {
        let initDays: string[] = j.event.days;
        try {
          const saved = JSON.parse(sessionStorage.getItem("booth_pick_" + id) ?? "null");
          if (saved && j.partialOpen && Array.isArray(saved.days)) {
            const ok = saved.days.filter((d: string) => j.event.days.includes(d));
            if (ok.length) initDays = ok;
          }
          if (saved && Array.isArray(saved.sel)) {
            const valid = new Set((j.event.layout?.tables ?? []).map((t: any) => t.id));
            setSel(saved.sel.filter((t: string) => valid.has(t)));
          }
        } catch { /* ignore */ }
        setDays(initDays);
        restored.current = true;
      }
    } catch (e: any) {
      if (first) setLoadErr(e?.message ?? "โหลดไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    loadEvent(eventId, true);
    const t = setInterval(() => loadEvent(eventId, false), 30000);
    return () => clearInterval(t);
  }, [eventId, loadEvent]);

  const loadMine = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await authed("/api/booth/my");
    if (res.ok) setMine((await res.json()).bookings ?? []);
  }, [supabase, authed]);
  useEffect(() => { loadMine(); }, [loadMine]);

  // บันทึกที่เลือกไว้ (เฉพาะแท็บนี้) เผื่อต้องไปล็อกอินแล้วกลับมา
  useEffect(() => {
    if (!eventId || !restored.current) return;
    try { sessionStorage.setItem("booth_pick_" + eventId, JSON.stringify({ days, sel })); } catch { /* ignore */ }
  }, [eventId, days, sel]);

  const ev = data?.event ?? null;
  const partialOpen = data?.partialOpen ?? false;
  const isFull = !!ev && days.length === ev.days.length;
  const typeOrder = useMemo(() => Array.from(new Set((ev?.layout?.tables ?? []).map((t) => t.type))).sort(), [ev]);
  const typeOf = useCallback((id: string) => ev?.layout?.tables.find((t) => t.id === id)?.type ?? "", [ev]);

  const freeFor = useCallback((id: string) => {
    const b = data?.booked[id] ?? [];
    return !days.some((d) => b.includes(d));
  }, [data, days]);

  // เปลี่ยนวัน → โต๊ะที่ไม่ว่างในวันใหม่หลุดจากรายการ และโค้ดต้องตรวจใหม่
  useEffect(() => {
    setSel((cur) => cur.filter((t) => freeFor(t)));
    setApplied(null); setCodeMsg(null);
  }, [days, freeFor]);

  const lines = sel.map((id) => {
    const p = ev?.pricing[typeOf(id)];
    const price = !p ? 0 : isFull ? p.full : p.per_day * days.length;
    return { id, p, price };
  });
  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  const discount = isFull && applied ? Math.min(applied.amount, subtotal) : 0;
  const freeCount = ev?.layout?.tables.filter((t) => typeOf(t.id) in (ev.pricing) && freeFor(t.id)).length ?? 0;
  const totalTables = ev?.layout?.tables.length ?? 0;

  function toggleDay(d: string) {
    if (!ev || !partialOpen) return;
    setDays((cur) => (cur.includes(d) ? (cur.length === 1 ? cur : cur.filter((x) => x !== d)) : [...cur, d].sort()));
  }

  function toggleTable(id: string) {
    if (!ev) return;
    setMsg(null); setApplied(null); setCodeMsg(null);
    setSel((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= ev.max_tables) {
        setMsg(`จองได้สูงสุด ${ev.max_tables} โต๊ะต่อครั้ง`);
        return cur;
      }
      return [...cur, id];
    });
  }

  async function applyCode() {
    setCodeMsg(null);
    if (!code.trim()) return setCodeMsg({ ok: false, text: "กรอกโค้ดก่อนกดใช้โค้ด" });
    if (!isFull) return setCodeMsg({ ok: false, text: "โค้ดส่วนลดใช้ได้เมื่อจองครบทุกวันเท่านั้น" });
    if (sel.length === 0) return setCodeMsg({ ok: false, text: "เลือกโต๊ะก่อนใช้โค้ด" });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return setCodeMsg({ ok: false, text: "เข้าสู่ระบบก่อนใช้โค้ดส่วนลด" });
    setBusy("code");
    try {
      const res = await authed("/api/booth/code", { method: "POST", body: JSON.stringify({ eventId, code, days, tables: sel }) });
      const j = await res.json();
      if (!res.ok) { setApplied(null); return setCodeMsg({ ok: false, text: j.error ?? "ใช้โค้ดไม่สำเร็จ" }); }
      setApplied({ code: j.code, label: j.label, amount: j.amount });
      setCodeMsg({ ok: true, text: `ใช้โค้ด ${j.code} แล้ว · ${j.label}` });
    } finally { setBusy(null); }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setLogoMsg(null);
    if (file.size > 2 * 1024 * 1024) return setLogoMsg("ไฟล์ใหญ่เกิน 2 MB");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setLogoMsg("รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLogoMsg("เข้าสู่ระบบก่อนอัปโหลดโลโก้"); return; }
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/booth/logo", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: fd });
      const j = await res.json();
      if (!res.ok) return setLogoMsg(j.error ?? "อัปโหลดไม่สำเร็จ");
      setVendor((v) => ({ ...v, logo_url: j.url }));
    } catch {
      setLogoMsg("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally { setLogoBusy(false); }
  }

  // ตรวจข้อมูลก่อนเปิดหน้าต่างกฎระเบียบ — ผู้จองต้องเห็นและยอมรับกฎก่อนไปชำระเงินทุกครั้ง
  async function startPay(method: "promptpay" | "card") {
    setMsg(null);
    if (sel.length === 0) return setMsg("เลือกโต๊ะอย่างน้อย 1 โต๊ะก่อนชำระเงิน");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { goLogin(); return; }
    const err = vendorError(vendor);
    if (err) { setEditingVendor(true); return setMsg(err); }
    if (ev?.rules && ev.rules.trim()) {
      setRulesRead(false); setRulesOk(false); setRulesFor(method);
      return;
    }
    await pay(method);
  }

  async function pay(method: "promptpay" | "card") {
    setBusy(method);
    try {
      const res = await authed("/api/booth/hold", {
        method: "POST",
        body: JSON.stringify({
          eventId, days, tables: sel, code: isFull && applied ? applied.code : "", paymentMethod: method, vendor,
          acceptRules: rulesOk, rulesVersion: ev?.rules_version,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setRulesFor(null);
        setMsg(j.error ?? "จองไม่สำเร็จ");
        if (j.rulesChanged && eventId) loadEvent(eventId, false);
        if (eventId) loadEvent(eventId, false);
        return;
      }
      window.location.href = j.url;
    } catch {
      setMsg("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally { setBusy(null); }
  }

  async function cancelHold(id: string) {
    if (!window.confirm("ยกเลิกรายการนี้และคืนโต๊ะใช่ไหม?")) return;
    const res = await authed("/api/booth/cancel", { method: "POST", body: JSON.stringify({ bookingId: id }) });
    const j = await res.json();
    if (!res.ok) alert(j.error ?? "ยกเลิกไม่สำเร็จ");
    loadMine();
    if (eventId) loadEvent(eventId, false);
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400";

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar title="จองโต๊ะ Vendor" />

      <div className="px-4 py-4 space-y-4 lg:max-w-3xl lg:mx-auto">
        {events === null && <p className="text-center text-sm text-zinc-400 py-16">กำลังโหลด...</p>}
        {events && events.length === 0 && (
          <div className="bg-white border border-zinc-100 rounded-2xl p-8 text-center">
            <p className="text-sm font-semibold text-zinc-700">ยังไม่เปิดรับจองโต๊ะ</p>
            <p className="text-xs text-zinc-400 mt-1">ติดตามข่าวสารเพื่อรอวันเปิดจองงานถัดไป</p>
            <Link href="/news" className="inline-block mt-4 text-xs font-semibold border border-zinc-200 rounded-xl px-5 py-2 text-zinc-700">ดูข่าวสาร</Link>
          </div>
        )}

        {events && events.length > 1 && !eventId && (
          <div className="space-y-2">
            {events.map((e) => (
              <button key={e.id} onClick={() => setEventId(e.id)} className="w-full text-left bg-white border border-zinc-100 rounded-2xl p-4">
                <p className="text-sm font-semibold text-zinc-900">{e.title}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{e.location} · {e.days.map(dayLabel).join(", ")}</p>
              </button>
            ))}
          </div>
        )}

        {loadErr && <p className="text-sm text-red-600">{loadErr}</p>}

        {ev && ev.layout && (
          <>
            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-base font-semibold text-zinc-900">{ev.title}</h1>
                  <p className="text-xs text-zinc-500 mt-0.5">{ev.location ? `${ev.location} · ` : ""}{ev.days.map(dayLabel).join(" · ")}</p>
                </div>
                <p className="text-xs text-zinc-500">โต๊ะว่างในวันที่เลือก <b className="text-zinc-900">{freeCount}</b> / {totalTables}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                {typeOrder.filter((t) => ev.pricing[t]).map((t) => {
                  const p = ev.pricing[t];
                  return (
                    <div key={t} className="border border-zinc-100 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-zinc-900">{p.label} <span className="text-zinc-400 font-normal">· {p.size}</span></p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">แพ็กเกจ {ev.days.length} วัน <b className="text-zinc-900">{baht(p.full)}</b></p>
                      <p className="text-[11px] text-zinc-400">บางวัน {baht(p.per_day)} / วัน</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-zinc-500 mb-2">1. เลือกวันที่มาออกบูธ</p>
              <div className="flex gap-2 flex-wrap">
                {ev.days.map((d) => {
                  const on = days.includes(d);
                  return (
                    <button key={d} onClick={() => toggleDay(d)} aria-pressed={on}
                      className={`text-sm px-4 py-2 rounded-xl border transition-colors ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200"} ${!partialOpen ? "opacity-70 cursor-default" : ""}`}>
                      {dayLabel(d)}
                    </button>
                  );
                })}
              </div>
              <p className={`text-[11px] mt-2 ${partialOpen ? "text-zinc-500" : "text-amber-700"}`}>
                {partialOpen
                  ? `เลือกวันที่มาได้ตามต้องการ · จองครบ ${ev.days.length} วันได้ราคาแพ็กเกจและใช้โค้ดส่วนลดได้`
                  : `ตอนนี้เปิดจองเฉพาะแพ็กเกจครบ ${ev.days.length} วัน${ev.partial_open_at ? ` · เปิดให้จองบางวันตั้งแต่ ${new Date(ev.partial_open_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })}` : ""}`}
              </p>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-zinc-500 mb-2">2. เลือกโต๊ะบนผัง (สูงสุด {ev.max_tables} โต๊ะ)</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm border border-zinc-400 bg-white inline-block" />ว่าง</span>
                {typeOrder.length > 1 && <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm border border-amber-600 bg-amber-100 inline-block" />โต๊ะ {typeOrder.slice(1).join("/")} ว่าง</span>}
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-zinc-900 inline-block" />ที่เลือก</span>
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm border border-dashed border-zinc-300 bg-zinc-100 inline-block" />ไม่ว่างในวันที่เลือก</span>
              </div>
              <div className="border border-zinc-100 rounded-xl p-1.5 bg-white overflow-x-auto">
                <div style={{ minWidth: 520 }}>
                <BoothMap
                  layout={ev.layout}
                  typeOrder={typeOrder}
                  stateOf={(id): TableState => (sel.includes(id) ? "selected" : freeFor(id) && ev.pricing[typeOf(id)] ? "free" : "booked")}
                  onToggle={toggleTable}
                  label={(id) => `โต๊ะ ${id}${freeFor(id) ? "" : " ไม่ว่าง"}`}
                />
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-zinc-900">สรุปการจอง</p>
                <span className={`text-[11px] px-2 py-0.5 rounded ${isFull ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {isFull ? `แพ็กเกจครบ ${ev.days.length} วัน` : `บางวัน: ${days.map(dayLabel).join(", ")}`}
                </span>
              </div>

              {lines.length === 0 ? (
                <p className="text-xs text-zinc-400 py-2">แตะโต๊ะบนผังเพื่อเลือก</p>
              ) : (
                <div className="space-y-1">
                  {lines.map((l) => (
                    <div key={l.id} className="flex justify-between text-sm">
                      <span className="text-zinc-800">{l.p?.label} {l.id} <span className="text-zinc-400 text-xs">· {l.p?.size}{!isFull && l.p ? ` · ${baht(l.p.per_day)} × ${days.length} วัน` : ""}</span></span>
                      <span className="text-zinc-900">{baht(l.price)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-zinc-100 mt-3 pt-3">
                <label htmlFor="code" className="text-[11px] text-zinc-500 block mb-1">โค้ดส่วนลด (ใช้ได้เมื่อจองครบ {ev.days.length} วัน)</label>
                <div className="flex gap-2">
                  <input id="code" className={`${inputCls} uppercase`} value={code} placeholder="กรอกโค้ด" autoComplete="off"
                    onChange={(e) => { setCode(e.target.value); setCodeMsg(null); if (applied) setApplied(null); }} />
                  <button onClick={applyCode} disabled={busy !== null} className="px-4 text-xs font-semibold border border-zinc-200 rounded-xl text-zinc-700 disabled:opacity-40">ใช้โค้ด</button>
                </div>
                {codeMsg && <p className={`text-[11px] mt-1.5 ${codeMsg.ok ? "text-green-600" : "text-red-600"}`}>{codeMsg.text}</p>}
              </div>

              <div className="border-t border-zinc-100 mt-3 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500"><span>ยอดโต๊ะ</span><span>{baht(subtotal)}</span></div>
                {discount > 0 && applied && (
                  <div className="flex justify-between text-xs text-green-600"><span>ส่วนลด {applied.code} ({applied.label})</span><span>-{baht(discount)}</span></div>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-zinc-700">รวม ({sel.length} โต๊ะ)</span>
                  <span className="text-xl font-bold text-zinc-900">{baht(subtotal - discount)}</span>
                </div>
              </div>

              <div className="border-t border-zinc-100 mt-3 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-500">3. ข้อมูลร้านของคุณ (ลงทะเบียนครั้งเดียว ใช้ได้ทุกงาน)</p>
                  {vendorSaved && !editingVendor && (
                    <button onClick={() => setEditingVendor(true)} className="text-[11px] text-zinc-500 underline">แก้ไข</button>
                  )}
                </div>

                {!editingVendor ? (
                  <div className="bg-zinc-50 rounded-xl px-3 py-2.5 text-xs text-zinc-700 flex items-center gap-3">
                    {vendor.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vendor.logo_url} alt="โลโก้ร้าน" className="w-12 h-12 rounded-lg object-contain bg-white border border-zinc-100 flex-shrink-0" />
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-zinc-900">{vendor.shop_name}</p>
                      <p>{vendor.contact_name} · {vendor.phone}</p>
                      <p className="text-zinc-500">{vendor.product_types.join(", ")}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {vendor.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vendor.logo_url} alt="โลโก้ร้าน" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-zinc-400 text-center leading-tight px-1">โลโก้<br />ร้าน</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <label className="inline-block text-xs font-semibold border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700 cursor-pointer">
                          {logoBusy ? "กำลังอัปโหลด..." : vendor.logo_url ? "เปลี่ยนโลโก้" : "อัปโหลดโลโก้ร้าน"}
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={logoBusy}
                            onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                        {vendor.logo_url && !logoBusy && (
                          <button type="button" onClick={() => setVendor({ ...vendor, logo_url: "" })} className="ml-2 text-[11px] text-zinc-400 underline">ลบ</button>
                        )}
                        <p className="text-[10px] text-zinc-400 mt-1">PNG / JPG / WebP ไม่เกิน 2 MB · ใช้ประชาสัมพันธ์ร้านในงาน</p>
                        {logoMsg && <p className="text-[11px] text-red-600 mt-0.5">{logoMsg}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="ชื่อร้าน / แบรนด์ *" value={vendor.shop_name} onChange={(e) => setVendor({ ...vendor, shop_name: e.target.value })} />
                      <input className={inputCls} placeholder="ชื่อผู้ติดต่อ *" value={vendor.contact_name} onChange={(e) => setVendor({ ...vendor, contact_name: e.target.value })} />
                      <input className={inputCls} placeholder="เบอร์โทร *" inputMode="tel" value={vendor.phone} onChange={(e) => setVendor({ ...vendor, phone: e.target.value })} />
                      <input className={inputCls} placeholder="LINE ID (ถ้ามี)" value={vendor.line_id} onChange={(e) => setVendor({ ...vendor, line_id: e.target.value })} />
                    </div>
                    <input className={inputCls} placeholder="ลิงก์เพจ/โซเชียลร้าน เช่น Facebook, Instagram (ถ้ามี)" value={vendor.social_url} onChange={(e) => setVendor({ ...vendor, social_url: e.target.value })} />

                    <div>
                      <p className="text-[11px] text-zinc-500 mb-1.5">ประเภทสินค้าที่จะจำหน่าย * (เลือกได้หลายข้อ)</p>
                      <div className="flex flex-wrap gap-2">
                        {PRODUCT_TYPES.map((t) => {
                          const on = vendor.product_types.includes(t);
                          return (
                            <button key={t} type="button" aria-pressed={on}
                              onClick={() => setVendor({ ...vendor, product_types: on ? vendor.product_types.filter((x) => x !== t) : [...vendor.product_types, t] })}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200"}`}>
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <textarea className={inputCls} rows={2} maxLength={300}
                      placeholder={vendor.product_types.includes("อื่นๆ") ? "รายละเอียดสินค้า (จำเป็น เพราะเลือก \"อื่นๆ\")" : "รายละเอียดสินค้าเพิ่มเติม (ถ้ามี) เช่น เกมที่ขาย ยี่ห้อ"}
                      value={vendor.product_detail} onChange={(e) => setVendor({ ...vendor, product_detail: e.target.value })} />
                    <p className="text-[10px] text-zinc-400">ข้อมูลนี้ทีมงานใช้ติดต่อและตรวจสอบสินค้าที่จำหน่ายในงาน · บันทึกอัตโนมัติเมื่อกดชำระเงิน</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 mt-3">
                <button onClick={() => startPay("promptpay")} disabled={busy !== null}
                  className="btn-primary w-full py-3.5 text-center text-sm font-semibold disabled:opacity-50">
                  {busy === "promptpay" ? "กำลังไปหน้าชำระเงิน..." : `ชำระผ่าน PromptPay — ${baht(subtotal - discount)} (ไม่มีค่าธรรมเนียม)`}
                </button>
                <button onClick={() => startPay("card")} disabled={busy !== null}
                  className="w-full py-3.5 text-center text-sm font-semibold rounded-xl border border-zinc-200 text-zinc-700 disabled:opacity-50">
                  {busy === "card" ? "กำลังไปหน้าชำระเงิน..." : `ชำระด้วยบัตรเครดิต/เดบิต — ${baht(subtotal - discount + Math.round((subtotal - discount) * 0.03))}`}
                </button>
                <p className="text-[10px] text-zinc-400 text-center">
                  เมื่อกดชำระ ระบบกันโต๊ะให้ {ev.hold_minutes} นาที ถ้าไม่ชำระภายในเวลา โต๊ะจะถูกปล่อยคืน · บัตรมีค่าธรรมเนียม 3% คิดจากยอดหลังหักส่วนลด
                </p>
              </div>
              {msg && <p className="text-xs text-red-600 mt-2">{msg}</p>}
            </div>
          </>
        )}

        {mine.length > 0 && (
          <div className="bg-white border border-zinc-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-zinc-900 mb-2">การจองของฉัน</p>
            <div className="space-y-2">
              {mine.filter((b) => b.status !== "cancelled" && b.status !== "expired").map((b) => (
                <div key={b.id} className="border border-zinc-100 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-zinc-900">{b.booth_events?.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS[b.status]?.cls ?? "bg-zinc-100"}`}>{STATUS[b.status]?.text ?? b.status}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">โต๊ะ {b.tables.join(", ")} · {b.days.map(dayLabel).join(", ")}</p>
                  <p className="text-[11px] text-zinc-500">ยอด {baht(b.total)}{b.discount_code ? ` · โค้ด ${b.discount_code}` : ""}</p>
                  {b.status === "hold" && (
                    <button onClick={() => cancelHold(b.id)} className="mt-1.5 text-[11px] text-red-600 underline">ยกเลิกและคืนโต๊ะ</button>
                  )}
                </div>
              ))}
              {mine.every((b) => b.status === "cancelled" || b.status === "expired") && <p className="text-xs text-zinc-400">ยังไม่มีรายการจองที่มีผล</p>}
            </div>
          </div>
        )}
      </div>

      {/* หน้าต่างกฎระเบียบภายในงาน — ต้องเลื่อนอ่านจนจบและกดยอมรับก่อนไปชำระเงิน */}
      {rulesFor && ev && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="กฎระเบียบภายในงาน">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col" style={{ maxHeight: "88vh" }}>
            <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-zinc-900">กฎระเบียบสำหรับ Vendor ภายในงาน</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">{ev.title} · กรุณาอ่านให้ครบก่อนชำระเงิน</p>
            </div>
            <div
              className="px-5 py-4 overflow-y-auto flex-1 text-sm text-zinc-700 leading-relaxed whitespace-pre-line"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRulesRead(true);
              }}
              ref={(el) => { if (el && !rulesRead && el.scrollHeight <= el.clientHeight + 8) setRulesRead(true); }}
            >
              {ev.rules}
            </div>
            <div className="px-5 py-4 border-t border-zinc-100 flex-shrink-0 space-y-3">
              {!rulesRead && <p className="text-[11px] text-amber-700">เลื่อนอ่านให้จบก่อน จึงจะกดยอมรับได้</p>}
              <label className={`flex items-start gap-2 text-xs ${rulesRead ? "text-zinc-800" : "text-zinc-400"}`}>
                <input type="checkbox" className="mt-0.5" disabled={!rulesRead} checked={rulesOk} onChange={(e) => setRulesOk(e.target.checked)} />
                <span>ข้าพเจ้าได้อ่านและยอมรับกฎระเบียบภายในงานทั้งหมด และยืนยันว่าข้อมูลร้านที่กรอกเป็นความจริง</span>
              </label>
              <div className="flex gap-2">
                <button onClick={() => setRulesFor(null)} disabled={busy !== null} className="flex-1 py-3 text-sm rounded-xl border border-zinc-200 text-zinc-600">ยกเลิก</button>
                <button onClick={() => rulesFor && pay(rulesFor)} disabled={!rulesOk || busy !== null}
                  className="flex-[2] py-3 text-sm font-semibold rounded-xl bg-zinc-900 text-white disabled:opacity-40">
                  {busy ? "กำลังไปหน้าชำระเงิน..." : "ยอมรับและไปชำระเงิน"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function vendorError(v: VendorForm): string | null {
  if (v.shop_name.trim().length < 2) return "กรอกชื่อร้าน/แบรนด์";
  if (v.contact_name.trim().length < 2) return "กรอกชื่อผู้ติดต่อ";
  if (!/^0\d{8,9}$/.test(v.phone.replace(/\D/g, ""))) return "เบอร์โทรไม่ถูกต้อง";
  if (v.product_types.length === 0) return "เลือกประเภทสินค้าที่จะจำหน่ายอย่างน้อย 1 ข้อ";
  if (v.product_types.includes("อื่นๆ") && !v.product_detail.trim()) return "ระบุรายละเอียดสินค้าในช่อง \"อื่นๆ\"";
  return null;
}
