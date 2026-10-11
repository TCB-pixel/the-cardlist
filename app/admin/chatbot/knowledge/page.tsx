"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

type Knowledge = {
  id: string;
  title: string;
  category: string;
  content: string;
  active: boolean;
  updated_at: string;
};

type FormState = { title: string; category: string; content: string };

const CATEGORIES = ["งานแข่ง", "สินค้า", "ร้าน", "กติกา"];
const EMPTY: FormState = { title: "", category: "ร้าน", content: "" };

const CAT_STYLE: Record<string, string> = {
  "งานแข่ง": "bg-red-50 text-red-700", "สินค้า": "bg-blue-50 text-blue-700",
  "ร้าน": "bg-zinc-100 text-zinc-600", "กติกา": "bg-green-50 text-green-700",
};

export default function AdminKnowledgePage() {
  const supabase = createClient();
  const { can } = useAdmin();
  const canEdit = can("chatbot:edit");
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ทั้งหมด");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Knowledge | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/chatbot/knowledge");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setItems(data.knowledge ?? []);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setSaveError(""); setShowModal(true); }
  function openEdit(k: Knowledge) {
    setEditing(k);
    setForm({ title: k.title, category: k.category, content: k.content });
    setSaveError(""); setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      setSaveError("กรอกหัวข้อและเนื้อหาให้ครบ");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = editing
        ? await authedFetch("/api/admin/chatbot/knowledge", { method: "PATCH", body: JSON.stringify({ id: editing.id, ...form }) })
        : await authedFetch("/api/admin/chatbot/knowledge", { method: "POST", body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setShowModal(false);
      await load();
    } catch (e: any) {
      setSaveError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(k: Knowledge) {
    const res = await authedFetch("/api/admin/chatbot/knowledge", { method: "PATCH", body: JSON.stringify({ id: k.id, active: !k.active }) });
    const data = await res.json();
    if (!res.ok) setError(data.error || "บันทึกไม่สำเร็จ");
    await load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await authedFetch("/api/admin/chatbot/knowledge", { method: "DELETE", body: JSON.stringify({ id: deleteId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      setDeleteId(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "ลบไม่สำเร็จ");
      setDeleteId(null);
    }
  }

  const shown = filter === "ทั้งหมด" ? items : items.filter((k) => k.category === filter);
  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

  return (
    <div className="p-6">
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5">
        <p className="text-[11px] text-amber-800 leading-relaxed">
          บอท LINE จะตอบลูกค้าจากข้อมูลในหน้านี้<b>เท่านั้น</b> — ถ้าไม่มีข้อมูล บอทจะส่งคำถามให้แอดมินอนุมัติแทน
          เขียนให้ครบและชัดเจน (ราคา เวลา เงื่อนไข) บอทจะตอบได้เองมากขึ้น · หัวข้อที่ &quot;ปิด&quot; บอทจะไม่เห็น
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {["ทั้งหมด", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === c ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
              {c}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
            <span className="text-base leading-none font-light">+</span> เพิ่มข้อมูล
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-red-600">{error}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-xs text-zinc-400 py-10">กำลังโหลด...</p>
      ) : shown.length === 0 ? (
        <p className="text-center text-xs text-zinc-400 py-10">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((k) => (
            <div key={k.id} className={`bg-white border border-zinc-100 rounded-2xl p-4 flex flex-col ${k.active ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${CAT_STYLE[k.category] ?? ""}`}>{k.category}</span>
                  <p className="text-sm font-semibold text-zinc-900 mt-1.5">{k.title}</p>
                </div>
                {!k.active && <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-500 flex-shrink-0">ปิดอยู่</span>}
              </div>
              <p className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed flex-1">{k.content}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-50">
                <span className="text-[10px] text-zinc-400">
                  แก้ไขล่าสุด {new Date(k.updated_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(k)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">{k.active ? "ปิด" : "เปิด"}</button>
                    <button onClick={() => openEdit(k)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">แก้ไข</button>
                    <button onClick={() => setDeleteId(k.id)} className="text-xs text-red-400 border border-red-100 rounded-lg px-2.5 py-1 hover:bg-red-50">ลบ</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลร้าน"}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {saveError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-red-600">{saveError}</p>
                </div>
              )}
              <div>
                <label className={labelCls}>หัวข้อ *</label>
                <input className={inputCls} placeholder="เช่น ค่าสมัครงานแข่ง One Piece" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>หมวด</label>
                <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>เนื้อหา *</label>
                <textarea rows={8} className={inputCls} placeholder="เขียนข้อมูลให้ครบ เช่น ราคา วัน เวลา เงื่อนไข วิธีสมัคร" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl w-80 mx-4 p-6 text-center">
            <p className="text-sm font-bold text-zinc-900 mb-2">ยืนยันการลบข้อมูล?</p>
            <p className="text-xs text-zinc-400 mb-5">ถ้าแค่อยากซ่อนจากบอทชั่วคราว ใช้ปุ่ม &quot;ปิด&quot; แทนได้</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-zinc-200 text-xs py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 text-white text-xs py-2.5 rounded-xl">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
