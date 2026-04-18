"use client";
import Link from "next/link";

const STATS = [
  { label: "รายได้วันนี้", value: "฿24,500", change: "+12%", up: true },
  { label: "คำสั่งซื้อใหม่", value: "18", change: "+3 จากเมื่อวาน", up: true },
  { label: "สมาชิกทั้งหมด", value: "1,284", change: "+8 วันนี้", up: true },
  { label: "สินค้าใกล้หมด", value: "5", change: "ต้องเติมสต็อก", up: false },
];

const QUICK_ACTIONS = [
  { href: "/admin/products?action=add", label: "เพิ่มสินค้าใหม่", icon: "+" },
  { href: "/admin/events?action=add", label: "สร้างอีเวนต์", icon: "+" },
  { href: "/admin/news?action=add", label: "เขียนบทความ", icon: "+" },
  { href: "/admin/members", label: "ดูสมาชิก", icon: "→" },
];

const RECENT_ORDERS = [
  { id: "ORD-2401", member: "thanakorn_c", item: "Charizard ex SAR", total: 1850, status: "completed" },
  { id: "ORD-2400", member: "somchai_p", item: "Booster Box OP-10", total: 3200, status: "pending" },
  { id: "ORD-2399", member: "nattaya_w", item: "Monkey D. Luffy SEC", total: 4200, status: "shipped" },
  { id: "ORD-2398", member: "priya_k", item: "Black Lotus LP", total: 120000, status: "pending" },
  { id: "ORD-2397", member: "alex_t", item: "Oko Foil", total: 4500, status: "completed" },
];

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  shipped:   "bg-blue-50 text-blue-700",
  pending:   "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  completed: "สำเร็จ", shipped: "จัดส่งแล้ว", pending: "รอชำระ", cancelled: "ยกเลิก",
};

const STOCK_ALERTS = [
  { name: "Monkey D. Luffy SEC", tcg: "One Piece", stock: 2 },
  { name: "Charizard ex SAR", tcg: "Pokémon", stock: 3 },
  { name: "Black Lotus LP", tcg: "MTG", stock: 1 },
];

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-white border border-zinc-100 rounded-2xl p-4">
            <p className="text-[11px] text-zinc-400 font-medium mb-2">{s.label}</p>
            <p className="text-2xl font-bold text-zinc-900">{s.value}</p>
            <p className={`text-[11px] mt-1 ${s.up ? "text-green-600" : "text-red-500"}`}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 tracking-widest uppercase mb-3">การดำเนินการด่วน</h2>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href}
              className="bg-zinc-900 text-white rounded-2xl p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors">
              <span className="text-xs font-semibold">{a.label}</span>
              <span className="text-lg font-light opacity-60">{a.icon}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Recent Orders */}
        <div className="col-span-2 bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">คำสั่งซื้อล่าสุด</h2>
            <Link href="/admin/orders" className="text-xs text-zinc-400 hover:text-zinc-900">ดูทั้งหมด →</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50">
                {["Order ID", "สมาชิก", "สินค้า", "ยอด", "สถานะ"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT_ORDERS.map((o, i) => (
                <tr key={o.id} className={`border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${i === RECENT_ORDERS.length - 1 ? "border-none" : ""}`}>
                  <td className="px-5 py-3 text-xs font-mono text-zinc-500">{o.id}</td>
                  <td className="px-5 py-3 text-xs text-zinc-700">@{o.member}</td>
                  <td className="px-5 py-3 text-xs text-zinc-900 font-medium">{o.item}</td>
                  <td className="px-5 py-3 text-xs font-semibold text-zinc-900">฿{o.total.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Stock alerts */}
          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">สต็อกใกล้หมด</h2>
              <Link href="/admin/products" className="text-xs text-zinc-400">จัดการ →</Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {STOCK_ALERTS.map((p) => (
                <div key={p.name} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-900">{p.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{p.tcg}</p>
                  </div>
                  <span className="text-xs font-bold text-red-500">{p.stock} ใบ</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">อีเวนต์ที่กำลังมา</h2>
              <Link href="/admin/events" className="text-xs text-zinc-400">จัดการ →</Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {[
                { title: "OP Regional Bangkok", date: "26 เม.ย.", slots: "18/128" },
                { title: "Pokémon League Cup", date: "3 พ.ค.", slots: "20/32" },
                { title: "MTG Commander Night", date: "10 พ.ค.", slots: "12/16" },
              ].map((ev) => (
                <div key={ev.title} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-900">{ev.title}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{ev.date}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500">{ev.slots}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
