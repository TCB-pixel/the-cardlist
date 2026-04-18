"use client";
import { useState } from "react";

const TIERS = ["ทั้งหมด", "bronze", "silver", "gold", "platinum"];
const TIER_LABEL: Record<string, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };
const TIER_COLOR: Record<string, string> = { bronze: "#CD7F32", silver: "#A8A9AD", gold: "#EF9F27", platinum: "#7F77DD" };

const MEMBERS = [
  { id: "1", username: "thanakorn_c", displayName: "Thanakorn C.", email: "thanakorn@email.com", tier: "gold", points: 1240, orders: 38, joined: "1 ม.ค. 2025" },
  { id: "2", username: "somchai_p", displayName: "Somchai P.", email: "somchai@email.com", tier: "silver", points: 620, orders: 12, joined: "15 ก.พ. 2025" },
  { id: "3", username: "nattaya_w", displayName: "Nattaya W.", email: "nattaya@email.com", tier: "bronze", points: 180, orders: 4, joined: "10 มี.ค. 2025" },
  { id: "4", username: "priya_k", displayName: "Priya K.", email: "priya@email.com", tier: "platinum", points: 3200, orders: 89, joined: "5 มิ.ย. 2024" },
  { id: "5", username: "alex_t", displayName: "Alex T.", email: "alex@email.com", tier: "gold", points: 1580, orders: 45, joined: "20 ก.ค. 2024" },
  { id: "6", username: "wirut_s", displayName: "Wirut S.", email: "wirut@email.com", tier: "silver", points: 780, orders: 18, joined: "3 ส.ค. 2024" },
];

export default function AdminMembersPage() {
  const [members, setMembers] = useState(MEMBERS);
  const [filterTier, setFilterTier] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof MEMBERS[0] | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editTier, setEditTier] = useState("");

  const filtered = members.filter((m) => {
    if (filterTier !== "ทั้งหมด" && m.tier !== filterTier) return false;
    if (search && !m.username.includes(search) && !m.displayName.toLowerCase().includes(search.toLowerCase()) && !m.email.includes(search)) return false;
    return true;
  });

  function openDetail(m: typeof MEMBERS[0]) {
    setSelected(m); setEditPoints(String(m.points)); setEditTier(m.tier);
  }

  function saveEdit() {
    if (!selected) return;
    setMembers((prev) => prev.map((m) => m.id === selected.id ? { ...m, points: Number(editPoints), tier: editTier } : m));
    setSelected(null);
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 w-64">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#a1a1aa" strokeWidth="1.2"/><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <input className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 flex-1 outline-none" placeholder="ค้นหาสมาชิก..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {TIERS.map((t) => (
            <button key={t} onClick={() => setFilterTier(t)}
              className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition-colors ${filterTier === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
              {t === "ทั้งหมด" ? "ทั้งหมด" : TIER_LABEL[t]}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} สมาชิก</span>
      </div>

      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {["สมาชิก", "Tier", "Points", "Orders", "สมัครวันที่", ""].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {m.displayName[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-900">{m.displayName}</p>
                      <p className="text-[10px] text-zinc-400">@{m.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: TIER_COLOR[m.tier] }}></span>
                    <span className="text-xs font-semibold" style={{ color: TIER_COLOR[m.tier] }}>{TIER_LABEL[m.tier]}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs font-semibold text-zinc-900">{m.points.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-xs text-zinc-600">{m.orders}</td>
                <td className="px-5 py-3.5 text-xs text-zinc-500">{m.joined}</td>
                <td className="px-5 py-3.5">
                  <button onClick={() => openDetail(m)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">จัดการ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">จัดการสมาชิก</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-400 text-lg">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold">{selected.displayName[0]}</div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{selected.displayName}</p>
                  <p className="text-xs text-zinc-400">@{selected.username} · {selected.email}</p>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1">Tier</label>
                <select className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" value={editTier} onChange={(e) => setEditTier(e.target.value)}>
                  {["bronze", "silver", "gold", "platinum"].map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1">Points</label>
                <input type="number" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setSelected(null)} className="flex-1 border border-zinc-200 text-xs py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={saveEdit} className="flex-1 bg-zinc-900 text-white text-xs py-2.5 rounded-xl">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
