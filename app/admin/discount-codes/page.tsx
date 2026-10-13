"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

type Code = {
  id: string; code: string; type: "percent" | "fixed"; value: number; applies_to: "all" | "tables" | "shop";
  min_items: number | null; min_amount: number | null; starts_at: string | null; expires_at: string | null;
  max_uses: number | null; per_user_limit: number | null; used_count: number; active: boolean; note: string | null;
};
type Form = {
  id?: string; code: string; type: "percent" | "fixed"; value: string; applies_to: "all" | "tables" | "shop";
  min_items: string; min_amount: string; starts_at: string; expires_at: string;
  max_uses: string; per_user_limit: string; active: boolean; note: string;
};

const EMPTY: Form = {
  code: "", type: "percent", value: "", applies_to: "all", min_items: "", min_amount: "",
  starts_at: "", expires_at: "", max_uses: "", per_user_limit: "", active: true, note: "",
};
const APPLIES: Record<string, string> = { all: "ทุกอย่าง", tables: "จองโต๊ะ", shop: "ร้านค้า" };
const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";
const labelCls = "text-[11px] font-semibold text-zinc-500 block mb-1";
const isoToLocal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "");
const localToIso = (v: string) => (v ? new Date(`${v}:00+07:00`).toISOString() : null);

export default function DiscountCodesPage() {
  const { can } = useAdmin();
  const canEdit = can("booth:edit");
  const supabase = useMemo(() => createClient(), []);
  const [codes, setCodes] = useState<Code[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const authed = useCallback(async (input: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
  }, [supabase]);

  const load = useCallback(async () => {
    const res = await authed("/api/admin/discount-codes");
    const j = await res.json();
    if (res.ok) setCodes(j.codes ?? []);
  }, [authed]);
  useEffect(() => { load(); }, [load]);

  function edit(c: Code | null) {
    setMsg(null);
    if (!c) return setForm({ ...EMPTY });
    setForm({
      id: c.id, code: c.code, type: c.type, value: String(c.value), applies_to: c.applies_to,
      min_items: c.min_items?.toString() ?? "", min_amount: c.min_amount?.toString() ?? "",
      starts_at: isoToLocal(c.starts_at), expires_at: isoToLocal(c.expires_at),
      max_uses: c.max_uses?.toString() ?? "", per_user_limit: c.per_user_limit?.toString() ?? "",
      active: c.active, note: c.note ?? "",
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true); setMsg(null);
    try {
      const res = await authed("/api/admin/discount-codes", {
        method: "POST",
        body: JSON.stringify({
          ...form, starts_at: localToIso(form.starts_at), expires_at: localToIso(form.expires_at),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
      setMsg({ ok: true, text: "บันทึกแล้ว" });
      setForm(null);
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "บันทึกไม่สำเร็จ" });
    } finally { setSaving(false); }
  }

  async function toggle(c: Code) {
    const res = await authed("/api/admin/discount-codes", {
      method: "POST",
      body: JSON.stringify({ ...c, id: c.id, active: !c.active }),
    });
    if (!res.ok) alert((await res.json()).error ?? "ไม่สำเร็จ");
    load();
  }

  async function remove(c: Code) {
    if (!window.confirm(`ลบโค้ด ${c.code}?`)) return;
    const res = await authed("/api/admin/discount-codes", { method: "POST", body: JSON.stringify({ action: "delete", id: c.id }) });
    const j = await res.json();
    if (!res.ok) alert(j.error ?? "ลบไม่สำเร็จ");
    load();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">โค้ดส่วนลด</h1>
          <p className="text-xs text-zinc-400 mt-0.5">ระบบคำนวณส่วนลดที่เซิร์ฟเวอร์ตอนชำระเงิน · ตอนนี้ใช้กับการจองโต๊ะ (เฉพาะจองครบทุกวัน)</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/booth" className="text-xs font-semibold border border-zinc-200 rounded-xl px-4 py-2 text-zinc-700">ผังโต๊ะ</Link>
          {canEdit && <button onClick={() => edit(null)} className="text-xs font-semibold bg-zinc-900 text-white rounded-xl px-4 py-2">+ เพิ่มโค้ด</button>}
        </div>
      </div>

      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="bg-white border border-zinc-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-zinc-900 font-mono">
                {c.code}
                <span className="ml-2 text-xs font-sans font-normal text-zinc-600">{c.type === "percent" ? `ลด ${c.value}%` : `ลด ฿${Number(c.value).toLocaleString()}`}</span>
                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded font-sans ${c.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>{c.active ? "ใช้งานอยู่" : "ปิด"}</span>
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                ใช้กับ{APPLIES[c.applies_to]} · ใช้ไปแล้ว {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} ครั้ง
                {c.per_user_limit ? ` · คนละ ${c.per_user_limit} ครั้ง` : ""}
                {c.min_items ? ` · ขั้นต่ำ ${c.min_items} รายการ` : ""}{c.min_amount ? ` · ขั้นต่ำ ฿${Number(c.min_amount).toLocaleString()}` : ""}
                {c.expires_at ? ` · หมดอายุ ${new Date(c.expires_at).toLocaleDateString("th-TH")}` : ""}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <button onClick={() => edit(c)} className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700">แก้ไข</button>
                <button onClick={() => toggle(c)} className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700">{c.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>
                <button onClick={() => remove(c)} className="text-xs border border-red-100 rounded-lg px-3 py-1.5 text-red-600">ลบ</button>
              </div>
            )}
          </div>
        ))}
        {codes.length === 0 && <p className="text-sm text-zinc-400">ยังไม่มีโค้ด</p>}
      </div>

      {form && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-zinc-900">{form.id ? "แก้ไขโค้ด" : "เพิ่มโค้ดใหม่"}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>โค้ด (A–Z 0–9 _ -)</label><input className={`${inputCls} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div><label className={labelCls}>ประเภทส่วนลด</label>
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Form["type"] })}>
                <option value="percent">เปอร์เซ็นต์ (%)</option><option value="fixed">จำนวนเงิน (฿)</option>
              </select></div>
            <div><label className={labelCls}>{form.type === "percent" ? "ลดกี่ %" : "ลดกี่บาท"}</label><input type="number" min={0} className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <div><label className={labelCls}>ใช้กับ</label>
              <select className={inputCls} value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value as Form["applies_to"] })}>
                <option value="all">ทุกอย่าง</option><option value="tables">การจองโต๊ะ</option><option value="shop">ร้านค้า</option>
              </select></div>
            <div><label className={labelCls}>ขั้นต่ำ (จำนวนโต๊ะ/รายการ)</label><input type="number" min={0} className={inputCls} value={form.min_items} onChange={(e) => setForm({ ...form, min_items: e.target.value })} /></div>
            <div><label className={labelCls}>ขั้นต่ำ (ยอดเงิน ฿)</label><input type="number" min={0} className={inputCls} value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} /></div>
            <div><label className={labelCls}>เริ่มใช้ได้ (เว้นว่าง = ทันที)</label><input type="datetime-local" className={inputCls} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><label className={labelCls}>หมดอายุ (เว้นว่าง = ไม่หมด)</label><input type="datetime-local" className={inputCls} value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
            <div><label className={labelCls}>ใช้ได้ทั้งหมดกี่ครั้ง</label><input type="number" min={0} className={inputCls} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></div>
            <div><label className={labelCls}>ใช้ได้คนละกี่ครั้ง</label><input type="number" min={0} className={inputCls} value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} /></div>
            <div className="col-span-2"><label className={labelCls}>บันทึกภายใน</label><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> เปิดใช้งาน
          </label>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving || !canEdit} className="bg-zinc-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            <button onClick={() => setForm(null)} className="text-xs text-zinc-500">ปิด</button>
            {msg && <span className={`text-[11px] font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
