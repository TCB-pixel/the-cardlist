"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type VendorBooking = {
  id: string;
  shop_name: string;
  contact_name: string;
  phone: string;
  description: string;
  booth_type: "single" | "double" | "large";
  booth_price: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_note: string | null;
  created_at: string;
  profiles: { username: string; display_name: string | null } | null;
  events: { title: string; date: string } | null;
};

const BOOTH_LABEL = { single: "โต๊ะเดี่ยว", double: "โต๊ะคู่", large: "บูธใหญ่" };
const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  approved:  "bg-green-50 text-green-700",
  rejected:  "bg-red-50 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-500",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "รอตรวจสอบ", approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ", cancelled: "ยกเลิก",
};

type FilterStatus = "all" | "pending" | "approved" | "rejected";

export default function AdminVendorBookingsPage() {
  const supabase = createClient();
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selected, setSelected] = useState<VendorBooking | null>(null);
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vendor_bookings")
      .select("*, profiles(username, display_name), events(title, date)")
      .order("created_at", { ascending: false });
    setBookings((data as VendorBooking[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    setUpdating(true);
    await supabase.from("vendor_bookings").update({
      status,
      admin_note: note || null,
    }).eq("id", id);
    await load();
    setSelected(null);
    setNote("");
    setUpdating(false);
  }

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);
  const pendingCount = bookings.filter(b => b.status === "pending").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">การจองโต๊ะ Vendor</h2>
          {pendingCount > 0 && (
            <p className="text-[11px] text-amber-600 mt-0.5 font-medium">
              รอตรวจสอบ {pendingCount} รายการ
            </p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "pending", "approved", "rejected"] as FilterStatus[]).map((f) => {
          const labels = { all: "ทั้งหมด", pending: "รอตรวจสอบ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };
          const count = f === "all" ? bookings.length : bookings.filter(b => b.status === f).length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${filter === f ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500"}`}>
              {labels[f]} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm border-2 border-dashed border-zinc-200 rounded-2xl">
          ไม่มีรายการ
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["ร้านค้า", "อีเวนต์", "ประเภทโต๊ะ", "ราคา", "สถานะ", ""].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.id} className={`border-b border-zinc-50 hover:bg-zinc-50 ${i === filtered.length-1 ? "border-none" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-zinc-900">{b.shop_name}</p>
                    <p className="text-[10px] text-zinc-400">{b.contact_name} · {b.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-zinc-700">{b.events?.title ?? "-"}</p>
                    <p className="text-[10px] text-zinc-400">
                      {b.events?.date ? new Date(b.events.date).toLocaleDateString("th-TH", { day:"numeric", month:"short" }) : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-700">{BOOTH_LABEL[b.booth_type]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-zinc-900">฿{b.booth_price.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status]}`}>
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {b.status === "pending" && (
                      <button onClick={() => { setSelected(b); setNote(b.admin_note ?? ""); }}
                        className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">
                        ตรวจสอบ
                      </button>
                    )}
                    {b.status !== "pending" && (
                      <button onClick={() => { setSelected(b); setNote(b.admin_note ?? ""); }}
                        className="text-xs text-zinc-400 hover:text-zinc-700">
                        ดูรายละเอียด
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">รายละเอียดการจอง</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-400 text-lg">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                ["ร้านค้า", selected.shop_name],
                ["ผู้ติดต่อ", `${selected.contact_name} · ${selected.phone}`],
                ["อีเวนต์", selected.events?.title ?? "-"],
                ["วันที่", selected.events?.date ? new Date(selected.events.date).toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"}) : "-"],
                ["ประเภทโต๊ะ", BOOTH_LABEL[selected.booth_type]],
                ["ราคา", `฿${selected.booth_price.toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[11px] text-zinc-400">{k}</span>
                  <span className="text-[11px] font-semibold text-zinc-900 text-right max-w-[60%]">{v}</span>
                </div>
              ))}
              {selected.description && (
                <div>
                  <p className="text-[11px] text-zinc-400 mb-1">รายละเอียดสินค้า</p>
                  <p className="text-[11px] text-zinc-700 bg-zinc-50 rounded-xl px-3 py-2">{selected.description}</p>
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
                  หมายเหตุถึง Vendor (ไม่บังคับ)
                </label>
                <textarea rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder="เช่น ขอเอกสารเพิ่มเติม, ตำแหน่งโต๊ะ B3..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>
            {selected.status === "pending" && (
              <div className="flex gap-2 px-5 py-4 border-t border-zinc-100">
                <button onClick={() => updateStatus(selected.id, "rejected")} disabled={updating}
                  className="flex-1 border border-red-200 text-red-500 text-xs font-semibold py-2.5 rounded-xl hover:bg-red-50 disabled:opacity-40">
                  ไม่อนุมัติ
                </button>
                <button onClick={() => updateStatus(selected.id, "approved")} disabled={updating}
                  className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
                  {updating ? "กำลังบันทึก..." : "อนุมัติ"}
                </button>
              </div>
            )}
            {selected.status !== "pending" && (
              <div className="px-5 py-4 border-t border-zinc-100">
                <div className={`text-center py-2 rounded-xl text-xs font-semibold ${STATUS_STYLE[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
