"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/lib/admin-context";
import { adminFetch } from "@/lib/admin-fetch";
import { TCG_LIST, tcgLabel } from "@/lib/tcg";

type Row = {
  id: string; game: string; lang: string; set_code: string; set_name: string; card_number: string;
  variant: string; name: string; rarity: string | null; card_type: string | null;
  image_url: string | null; source: string; updated_at: string;
};

const EMPTY = { game: "Gundam", lang: "en", set_code: "", set_name: "", card_number: "", name: "", rarity: "", card_type: "", variant: "normal", image_url: "" };
const SOURCE_LABEL: Record<string, string> = { tcgdex: "TCGdex", optcgapi: "optcgapi", manual: "ทีมร้านเพิ่มเอง" };

const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

// ฐานข้อมูลการ์ดของ Collection Tracker / Deck Builder — ดูจำนวน ค้นหา และเพิ่มการ์ดที่แหล่งข้อมูลฟรียังไม่มี
export default function AdminTcgCardsPage() {
  const { can } = useAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [game, setGame] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q, game, source });
    const res = await adminFetch(`/api/admin/tcg-cards?${params}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "โหลดไม่สำเร็จ");
    else { setRows(json.cards); setCounts(json.counts); }
    setLoading(false);
  }, [q, game, source]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function save() {
    setSaving(true);
    setFormError("");
    const res = await adminFetch("/api/admin/tcg-cards", { method: "POST", body: JSON.stringify(form) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setFormError(json.error ?? "บันทึกไม่สำเร็จ"); return; }
    setForm({ ...EMPTY, game: form.game, lang: form.lang, set_code: form.set_code, set_name: form.set_name });
    load();
  }

  async function remove(r: Row) {
    if (!window.confirm(`ลบการ์ด "${r.name}" (${r.card_number})? การ์ดในคอลเลกชันลูกค้าที่ผูกไว้จะเหลือแค่ชื่อที่พิมพ์`)) return;
    const res = await adminFetch(`/api/admin/tcg-cards?id=${r.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) window.alert(json.error ?? "ลบไม่สำเร็จ");
    else load();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900">ฐานข้อมูลการ์ด</h1>
          <p className="text-[11px] text-zinc-500 mt-1">ใช้ในช่องค้นการ์ดของ Collection / Deck Builder · Pokémon และ One Piece ดึงอัตโนมัติ · เกมอื่นเพิ่มเองที่นี่ · ไม่มีราคาการ์ด</p>
        </div>
        {can("products:create") && (
          <button onClick={() => setShowForm(!showForm)} className="bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
            {showForm ? "ปิดฟอร์ม" : "+ เพิ่มการ์ดเอง"}
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {TCG_LIST.map((g) => (
          <div key={g} className="bg-white border border-zinc-100 rounded-xl px-3 py-2">
            <p className="text-sm font-bold text-zinc-900">{(counts[g] ?? 0).toLocaleString()}</p>
            <p className="text-[11px] text-zinc-500">{tcgLabel(g)}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={labelCls}>เกม *</label>
              <select className={inputCls} value={form.game} onChange={set("game")}>{TCG_LIST.map((g) => <option key={g} value={g}>{tcgLabel(g)}</option>)}</select></div>
            <div><label className={labelCls}>ภาษา *</label>
              <select className={inputCls} value={form.lang} onChange={set("lang")}><option value="en">EN</option><option value="th">TH</option><option value="ja">JP</option></select></div>
            <div><label className={labelCls}>รหัสเซต *</label><input className={inputCls} value={form.set_code} onChange={set("set_code")} placeholder="GD01" /></div>
            <div><label className={labelCls}>ชื่อเซต</label><input className={inputCls} value={form.set_name} onChange={set("set_name")} /></div>
            <div><label className={labelCls}>เลขการ์ด *</label><input className={inputCls} value={form.card_number} onChange={set("card_number")} placeholder="GD01-001" /></div>
            <div className="col-span-2"><label className={labelCls}>ชื่อการ์ด *</label><input className={inputCls} value={form.name} onChange={set("name")} /></div>
            <div><label className={labelCls}>Rarity</label><input className={inputCls} value={form.rarity} onChange={set("rarity")} /></div>
            <div><label className={labelCls}>ประเภท</label><input className={inputCls} value={form.card_type} onChange={set("card_type")} placeholder="Unit / Pilot ..." /></div>
            <div><label className={labelCls}>Variant</label><input className={inputCls} value={form.variant} onChange={set("variant")} /></div>
            <div className="col-span-2"><label className={labelCls}>ลิงก์รูป (https://)</label><input className={inputCls} value={form.image_url} onChange={set("image_url")} /></div>
          </div>
          {formError && <p className="text-xs text-red-600 mt-3">{formError}</p>}
          <button onClick={save} disabled={saving} className="mt-4 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40">
            {saving ? "กำลังบันทึก..." : "บันทึกการ์ด"}
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-3">
        <input className={`${inputCls} max-w-xs`} placeholder="ค้นชื่อหรือเลขการ์ด" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputCls} w-auto`} value={game} onChange={(e) => setGame(e.target.value)}>
          <option value="">ทุกเกม</option>{TCG_LIST.map((g) => <option key={g} value={g}>{tcgLabel(g)}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">ทุกแหล่ง</option><option value="tcgdex">TCGdex</option><option value="optcgapi">optcgapi</option><option value="manual">ทีมร้านเพิ่มเอง</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-red-700">{error}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      <div className="bg-white border border-zinc-100 rounded-2xl overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {["การ์ด", "เกม", "เซต", "Rarity", "แหล่ง", ""].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-zinc-500">กำลังโหลด...</td></tr>}
            {!loading && !error && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-zinc-500">ไม่พบการ์ด</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-50 last:border-none">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-12 rounded-md bg-zinc-100 overflow-hidden flex-shrink-0">
                      {r.image_url && <img src={r.image_url} alt={r.name} loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-900">{r.name}</p>
                      <p className="text-[11px] text-zinc-500">{r.card_number}{r.variant !== "normal" ? ` · ${r.variant}` : ""}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-700">{tcgLabel(r.game)} · {r.lang.toUpperCase()}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-700">{r.set_name || r.set_code}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-700">{r.rarity ?? "—"}</td>
                <td className="px-4 py-2.5 text-[11px] text-zinc-500">{SOURCE_LABEL[r.source] ?? r.source}</td>
                <td className="px-4 py-2.5 text-right">
                  {r.source === "manual" && can("products:delete") && (
                    <button onClick={() => remove(r)} className="text-[11px] text-red-600 underline">ลบ</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500 mt-3">แสดงสูงสุด 50 แถวล่าสุด — พิมพ์ค้นหาเพื่อหาการ์ดที่ต้องการ</p>
    </div>
  );
}
