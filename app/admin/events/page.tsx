"use client";
import { useState } from "react";

type Event = { id: string; title: string; location: string; date: string; time: string; tcg: string; format: string; maxSlots: number; bookedSlots: number; fee: number; desc: string; };

const INIT_EVENTS: Event[] = [
  { id: "1", title: "OP Regional Bangkok", location: "สยามพารากอน Hall A", date: "2026-04-26", time: "09:00", tcg: "One Piece", format: "Swiss Format", maxSlots: 128, bookedSlots: 110, fee: 300, desc: "One Piece TCG Regional Tournament — Swiss Format 8 rounds" },
  { id: "2", title: "Pokémon League Cup", location: "The Cardlist Store", date: "2026-05-03", time: "13:00", tcg: "Pokémon", format: "Bo3", maxSlots: 32, bookedSlots: 12, fee: 150, desc: "In-Store Pokémon League Cup — Best of 3" },
  { id: "3", title: "MTG Commander Night", location: "The Cardlist Store", date: "2026-05-10", time: "18:00", tcg: "MTG", format: "Commander", maxSlots: 16, bookedSlots: 4, fee: 100, desc: "Weekly Commander Night — 4-player pods" },
];

const EMPTY: Omit<Event, "id" | "bookedSlots"> = { title: "", location: "The Cardlist Store", date: "", time: "13:00", tcg: "One Piece", format: "Swiss Format", maxSlots: 32, fee: 0, desc: "" };

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>(INIT_EVENTS);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openAdd() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(ev: Event) { setEditing(ev); setForm({ title: ev.title, location: ev.location, date: ev.date, time: ev.time, tcg: ev.tcg, format: ev.format, maxSlots: ev.maxSlots, fee: ev.fee, desc: ev.desc }); setShowModal(true); }
  function handleSave() {
    if (!form.title || !form.date) return;
    if (editing) { setEvents((p) => p.map((e) => e.id === editing.id ? { ...form, id: editing.id, bookedSlots: editing.bookedSlots } : e)); }
    else { setEvents((p) => [...p, { ...form, id: Date.now().toString(), bookedSlots: 0 }]); }
    setShowModal(false);
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-zinc-400">{events.length} อีเวนต์</span>
        <button onClick={openAdd} className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
          <span className="text-base leading-none font-light">+</span> สร้างอีเวนต์
        </button>
      </div>

      <div className="space-y-3">
        {events.map((ev) => {
          const pct = Math.round((ev.bookedSlots / ev.maxSlots) * 100);
          const remaining = ev.maxSlots - ev.bookedSlots;
          return (
            <div key={ev.id} className="bg-white border border-zinc-100 rounded-2xl px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-zinc-900">{ev.title}</h3>
                    <span className="text-[9px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded tracking-wider">{ev.tcg}</span>
                    <span className="text-[9px] text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded">{ev.format}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{ev.location} · {ev.date} · {ev.time} น.</p>
                  <p className="text-xs text-zinc-400 mt-1">{ev.desc}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex-1 max-w-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-zinc-500">ที่นั่ง {remaining} เหลือ / {ev.maxSlots}</span>
                        <span className="text-[10px] text-zinc-400">{pct}% เต็ม</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-zinc-900"}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-zinc-900">ค่าสมัคร ฿{ev.fee}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(ev)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50">แก้ไข</button>
                  <button onClick={() => setDeleteId(ev.id)} className="text-xs text-red-400 border border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50">ลบ</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไขอีเวนต์" : "สร้างอีเวนต์ใหม่"}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>ชื่ออีเวนต์ *</label>
                <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>สถานที่</label>
                <input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>คำอธิบาย</label>
                <textarea rows={2} className={inputCls} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>วันที่ *</label><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><label className={labelCls}>เวลา</label><input type="time" className={inputCls} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                <div><label className={labelCls}>TCG</label>
                  <select className={inputCls} value={form.tcg} onChange={(e) => setForm({ ...form, tcg: e.target.value })}>
                    {["One Piece", "Pokémon", "MTG", "Dragon Ball"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>รูปแบบ</label><input className={inputCls} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} /></div>
                <div><label className={labelCls}>จำนวนที่นั่งสูงสุด</label><input type="number" className={inputCls} value={form.maxSlots} onChange={(e) => setForm({ ...form, maxSlots: Number(e.target.value) })} /></div>
                <div><label className={labelCls}>ค่าสมัคร (บาท)</label><input type="number" className={inputCls} value={form.fee} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} /></div>
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={handleSave} className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl">{editing ? "บันทึก" : "สร้างอีเวนต์"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl w-80 mx-4 p-6 text-center">
            <p className="text-sm font-bold text-zinc-900 mb-2">ยืนยันการลบอีเวนต์?</p>
            <p className="text-xs text-zinc-400 mb-5">การจองทั้งหมดของอีเวนต์นี้จะถูกยกเลิก</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-zinc-200 text-xs py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={() => { setEvents((p) => p.filter((e) => e.id !== deleteId)); setDeleteId(null); }} className="flex-1 bg-red-500 text-white text-xs py-2.5 rounded-xl">ลบอีเวนต์</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
