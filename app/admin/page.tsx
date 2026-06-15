"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const QUICK_ACTIONS = [
  { href: "/admin/products?action=add", label: "เพิ่มสินค้าใหม่", icon: "+" },
  { href: "/admin/events?action=add", label: "สร้างอีเวนต์", icon: "+" },
  { href: "/admin/news?action=add", label: "เขียนบทความ", icon: "+" },
  { href: "/admin/members", label: "ดูสมาชิก", icon: "→" },
];

const STOCK_ALERTS = [
  { name: "Monkey D. Luffy SEC", tcg: "One Piece", stock: 2 },
  { name: "Charizard ex SAR", tcg: "Pokémon", stock: 3 },
  { name: "Black Lotus LP", tcg: "MTG", stock: 1 },
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

export default function AdminDashboard() {
  // Event stats
  const [shopStats, setShopStats] = useState({ revenue: 0, orders: 0 });
  const [eventStats, setEventStats] = useState({
    generalTotal: 0,
    generalPaidPack: 0,
    generalNotPaid: 0,
    priorityApproved: 0,
    priorityPending: 0,
    priorityRejected: 0,
    priorityTotal: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const res = await fetch("/api/admin/dashboard-stats");
      const data = await res.json();
      if (data.eventStats) setEventStats(data.eventStats);
      if (data.shopRevenue !== undefined) setShopStats({ revenue: data.shopRevenue, orders: data.shopOrderCount ?? 0 });
      if (data.recentOrders) setRecentOrders(data.recentOrders);
      setLoadingStats(false);
    }
    loadStats();
  }, []);

  return (
    <div className="p-6 space-y-6">

      {/* ─── Event Stats ─── */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 tracking-widest uppercase mb-3">
          📊 สถิติการลงทะเบียน — The Cardlist Event @ Siam Discovery
        </h2>
        {loadingStats ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-zinc-100 rounded-2xl p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {/* General Total */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-400 font-medium mb-2">General ลงทะเบียนแล้ว</p>
              <p className="text-2xl font-bold text-zinc-900">{eventStats.generalTotal} <span className="text-sm font-normal text-zinc-400">คน</span></p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                  ✅ ซื้อ Pack {eventStats.generalPaidPack} คน
                </span>
              </div>
              <div className="mt-1">
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                  💰 ยังไม่ซื้อ {eventStats.generalNotPaid} คน
                </span>
              </div>
            </div>

            {/* Priority Total */}
            <div className="bg-white border border-amber-100 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-400 font-medium mb-2">Priority Guest</p>
              <p className="text-2xl font-bold text-amber-600">{eventStats.priorityTotal} <span className="text-sm font-normal text-zinc-400">/ 100 ใบ</span></p>
              <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-amber-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((eventStats.priorityTotal / 100) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">เหลือ {100 - eventStats.priorityTotal} ใบ</p>
            </div>

            {/* Priority Approved */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-400 font-medium mb-2">Priority อนุมัติแล้ว</p>
              <p className="text-2xl font-bold text-green-600">{eventStats.priorityApproved} <span className="text-sm font-normal text-zinc-400">คน</span></p>
              <div className="mt-2">
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                  ⏳ รอยืนยัน {eventStats.priorityPending} คน
                </span>
              </div>
            </div>

            {/* Revenue from event */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-400 font-medium mb-2">รายได้จาก Event</p>
              <p className="text-2xl font-bold text-zinc-900">
                ฿{((eventStats.priorityApproved * 690) + (eventStats.generalPaidPack * 49)).toLocaleString()}
              </p>
              <div className="mt-2 space-y-0.5">
                <p className="text-[10px] text-zinc-400">Priority: ฿{(eventStats.priorityApproved * 690).toLocaleString()}</p>
                <p className="text-[10px] text-zinc-400">Pack ฿49: ฿{(eventStats.generalPaidPack * 49).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown table */}
        {!loadingStats && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-zinc-700 mb-3">General — แยกตามสถานะ Pack</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-600">✅ ซื้อ Pack ล่วงหน้า (฿49)</span>
                  <span className="text-sm font-bold text-green-600">{eventStats.generalPaidPack} คน</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-600">💰 ยังไม่ซื้อ (จ่ายหน้างาน)</span>
                  <span className="text-sm font-bold text-amber-600">{eventStats.generalNotPaid} คน</span>
                </div>
                <div className="border-t border-zinc-100 pt-2 flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-zinc-700">รวม General</span>
                  <span className="text-sm font-bold text-zinc-900">{eventStats.generalTotal} คน</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-zinc-700 mb-3">Priority Guest — แยกตาม Status</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-600">✅ อนุมัติแล้ว</span>
                  <span className="text-sm font-bold text-green-600">{eventStats.priorityApproved} คน</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-600">⏳ รอยืนยัน</span>
                  <span className="text-sm font-bold text-amber-600">{eventStats.priorityPending} คน</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-600">❌ ปฏิเสธ</span>
                  <span className="text-sm font-bold text-red-500">{eventStats.priorityRejected} คน</span>
                </div>
                <div className="border-t border-zinc-100 pt-2 flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-zinc-700">เหลือขาย</span>
                  <span className="text-sm font-bold text-zinc-900">{100 - eventStats.priorityTotal} / 100 ใบ</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Revenue Report ─── */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 tracking-widest uppercase mb-3">
          💰 รายได้แยกตามประเภท
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {/* Event Revenue */}
          <div className="bg-white border border-amber-100 rounded-2xl p-4">
            <p className="text-[11px] text-zinc-400 font-medium mb-2">🎫 รายได้จาก Event</p>
            <p className="text-2xl font-bold text-amber-600">
              ฿{((eventStats.priorityApproved * 690) + (eventStats.generalPaidPack * 49)).toLocaleString()}
            </p>
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] text-zinc-400">Priority ฿690 × {eventStats.priorityApproved} = ฿{(eventStats.priorityApproved * 690).toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400">Pack ฿49 × {eventStats.generalPaidPack} = ฿{(eventStats.generalPaidPack * 49).toLocaleString()}</p>
            </div>
          </div>

          {/* Shop Revenue */}
          <div className="bg-white border border-blue-100 rounded-2xl p-4">
            <p className="text-[11px] text-zinc-400 font-medium mb-2">🛍️ รายได้จาก Shop</p>
            <p className="text-2xl font-bold text-blue-600">฿{shopStats.revenue.toLocaleString()}</p>
            <div className="mt-2">
              <p className="text-[10px] text-zinc-400">{shopStats.orders} คำสั่งซื้อ</p>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-zinc-900 rounded-2xl p-4">
            <p className="text-[11px] text-zinc-400 font-medium mb-2">รายได้รวมทั้งหมด</p>
            <p className="text-2xl font-bold text-white">
              ฿{((eventStats.priorityApproved * 690) + (eventStats.generalPaidPack * 49) + shopStats.revenue).toLocaleString()}
            </p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-400">Event</span>
                <span className="text-amber-400">฿{((eventStats.priorityApproved * 690) + (eventStats.generalPaidPack * 49)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-400">Shop</span>
                <span className="text-blue-400">฿{shopStats.revenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
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
          {recentOrders.length === 0 ? (
            <div className="py-10 text-center text-xs text-zinc-400">ไม่มีคำสั่งซื้อ</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50">
                  {["Order ID", "สมาชิก", "ยอด", "สถานะ"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o, i) => (
                  <tr key={o.id} className={`border-b border-zinc-50 hover:bg-zinc-50 ${i === recentOrders.length - 1 ? "border-none" : ""}`}>
                    <td className="px-5 py-3 text-xs font-mono text-zinc-500">{o.id?.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-xs text-zinc-700">@{o.profiles?.username ?? "—"}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-zinc-900">฿{o.total_amount?.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[o.status] ?? "bg-zinc-50 text-zinc-500"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
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

          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Link ด่วน — Event</h2>
            </div>
            <div className="divide-y divide-zinc-50">
              <Link href="/admin/tickets" className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50">
                <p className="text-xs font-medium text-zinc-900">บัตรเข้างาน Priority</p>
                <span className="text-[10px] text-zinc-400">→</span>
              </Link>
              <Link href="/admin/scan" className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50">
                <p className="text-xs font-medium text-zinc-900">Staff Scanner</p>
                <span className="text-[10px] text-zinc-400">→</span>
              </Link>
              <Link href="/admin/members" className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50">
                <p className="text-xs font-medium text-zinc-900">จัดการสมาชิก</p>
                <span className="text-[10px] text-zinc-400">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
