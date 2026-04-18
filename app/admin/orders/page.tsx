"use client";
import { useState } from "react";

const STATUSES = ["ทั้งหมด", "pending", "paid", "shipped", "completed", "cancelled"];
const STATUS_LABEL: Record<string, string> = { pending: "รอชำระ", paid: "ชำระแล้ว", shipped: "จัดส่งแล้ว", completed: "สำเร็จ", cancelled: "ยกเลิก" };
const STATUS_STYLE: Record<string, string> = { pending: "bg-amber-50 text-amber-700", paid: "bg-blue-50 text-blue-700", shipped: "bg-indigo-50 text-indigo-700", completed: "bg-green-50 text-green-700", cancelled: "bg-red-50 text-red-700" };

const ORDERS = [
  { id: "ORD-2401", member: "thanakorn_c", email: "thanakorn@email.com", item: "Charizard ex SAR × 1", total: 1850, status: "completed", date: "15 เม.ย. 2026" },
  { id: "ORD-2400", member: "somchai_p", email: "somchai@email.com", item: "Booster Box OP-10 × 1", total: 3200, status: "pending", date: "15 เม.ย. 2026" },
  { id: "ORD-2399", member: "nattaya_w", email: "nattaya@email.com", item: "Monkey D. Luffy SEC × 1", total: 4200, status: "shipped", date: "14 เม.ย. 2026" },
  { id: "ORD-2398", member: "priya_k", email: "priya@email.com", item: "Black Lotus LP × 1", total: 120000, status: "pending", date: "13 เม.ย. 2026" },
  { id: "ORD-2397", member: "alex_t", email: "alex@email.com", item: "Oko Foil × 1", total: 4500, status: "completed", date: "12 เม.ย. 2026" },
  { id: "ORD-2396", member: "wirut_s", email: "wirut@email.com", item: "Son Goku SPR × 2", total: 1780, status: "shipped", date: "12 เม.ย. 2026" },
  { id: "ORD-2395", member: "mana_p", email: "mana@email.com", item: "Booster Box SV8a × 1", total: 2800, status: "paid", date: "11 เม.ย. 2026" },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState(ORDERS);
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = orders.filter((o) => {
    if (filterStatus !== "ทั้งหมด" && o.status !== filterStatus) return false;
    if (search && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.member.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function updateStatus(id: string, status: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    setSelected(null);
  }

  const selectedOrder = orders.find((o) => o.id === selected);

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 w-60">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#a1a1aa" strokeWidth="1.2"/><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <input className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 flex-1 outline-none" placeholder="ค้นหา Order ID, สมาชิก..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition-colors ${filterStatus === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white hover:bg-zinc-50"}`}>
              {s === "ทั้งหมด" ? "ทั้งหมด" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {["Order ID", "สมาชิก", "สินค้า", "ยอด", "วันที่", "สถานะ", ""].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                <td className="px-5 py-3.5 text-xs font-mono font-semibold text-zinc-700">{o.id}</td>
                <td className="px-5 py-3.5">
                  <p className="text-xs font-medium text-zinc-900">@{o.member}</p>
                  <p className="text-[10px] text-zinc-400">{o.email}</p>
                </td>
                <td className="px-5 py-3.5 text-xs text-zinc-700">{o.item}</td>
                <td className="px-5 py-3.5 text-xs font-bold text-zinc-900">฿{o.total.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-xs text-zinc-500">{o.date}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => setSelected(o.id)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">จัดการ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">{selectedOrder.id}</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-400 text-lg">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[["สมาชิก", `@${selectedOrder.member}`], ["อีเมล", selectedOrder.email], ["สินค้า", selectedOrder.item], ["ยอดรวม", `฿${selectedOrder.total.toLocaleString()}`], ["วันที่", selectedOrder.date]].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-xs text-zinc-400">{k}</span>
                  <span className="text-xs font-semibold text-zinc-900">{v}</span>
                </div>
              ))}
              <div>
                <p className="text-xs text-zinc-400 mb-2">อัปเดตสถานะ</p>
                <div className="grid grid-cols-2 gap-2">
                  {["pending", "paid", "shipped", "completed", "cancelled"].map((s) => (
                    <button key={s} onClick={() => updateStatus(selectedOrder.id, s)}
                      className={`text-xs py-2 rounded-xl border font-semibold transition-colors ${selectedOrder.status === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
