"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Image from "next/image";

const STATUS_LABEL: Record<string, string> = { pending: "รอยืนยัน", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" };
const STATUS_STYLE: Record<string, string> = { pending: "bg-amber-50 text-amber-700", approved: "bg-green-50 text-green-700", rejected: "bg-red-50 text-red-700" };

async function notifyLineTicket(lineUserId: string, ticket: any) {
  if (!lineUserId) return;
  await fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lineUserId,
      type: "ticket_approved",
      data: {
        eventTitle: ticket.events?.title ?? "งาน",
        qrCode: ticket.qr_code,
      },
    }),
  });
}

async function notifyLineTicketRejected(lineUserId: string, ticket: any) {
  if (!lineUserId) return;
  await fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lineUserId,
      type: "ticket_rejected",
      data: { eventTitle: ticket.events?.title ?? "งาน" },
    }),
  });
}

export default function AdminTicketsPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState("pending");
  const [updating, setUpdating] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("event_tickets")
      .select(`*, profiles ( username, display_name, avatar_url, line_user_id ), events ( title, date )`)
      .order("created_at", { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(ticket: any) {
    setUpdating(true);
    setNotifyStatus("กำลังอนุมัติ...");
    await supabase.from("event_tickets").update({ status: "approved" }).eq("id", ticket.id);

    // ส่ง LINE แจ้งเตือน
    if (ticket.profiles?.line_user_id) {
      await notifyLineTicket(ticket.profiles.line_user_id, ticket);
      setNotifyStatus("✅ อนุมัติแล้ว และส่ง LINE แจ้งเตือนแล้ว");
    } else {
      setNotifyStatus("✅ อนุมัติแล้ว (ไม่มี LINE account)");
    }

    await load();
    setSelected(null);
    setUpdating(false);
    setTimeout(() => setNotifyStatus(""), 3000);
  }

  async function reject(ticket: any) {
    setUpdating(true);
    await supabase.from("event_tickets").update({ status: "rejected" }).eq("id", ticket.id);

    if (ticket.profiles?.line_user_id) {
      await notifyLineTicketRejected(ticket.profiles.line_user_id, ticket);
    }

    await load();
    setSelected(null);
    setUpdating(false);
  }

  const filtered = tickets.filter((t) => filter === "ทั้งหมด" || t.status === filter);

  return (
    <div className="p-6">
      {notifyStatus && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-xs text-green-700 font-semibold">{notifyStatus}</p>
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {["pending", "approved", "rejected", "ทั้งหมด"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition-colors ${filter === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white hover:bg-zinc-50"}`}>
            {s === "ทั้งหมด" ? "ทั้งหมด" : STATUS_LABEL[s]}
            {s !== "ทั้งหมด" && (
              <span className="ml-1.5 opacity-60">{tickets.filter((t) => t.status === s).length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["สมาชิก", "งาน", "บัตร", "LINE", "วันที่", "สถานะ", ""].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-zinc-400">ไม่มีรายการ</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                  <td className="px-5 py-3.5">
                    <p className="text-xs font-medium text-zinc-900">{t.profiles?.display_name ?? t.profiles?.username ?? "—"}</p>
                    <p className="text-[10px] text-zinc-400">@{t.profiles?.username}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs text-zinc-900">{t.events?.title ?? "—"}</p>
                    <p className="text-[10px] text-zinc-400">{t.events?.date ? new Date(t.events.date).toLocaleDateString("th-TH") : ""}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs font-semibold text-zinc-900">Priority Guest</p>
                    <p className="text-[10px] text-zinc-400">฿690</p>
                  </td>
                  <td className="px-5 py-3.5">
                    {t.profiles?.line_user_id ? (
                      <span className="text-[9px] bg-[#06C755] text-white px-2 py-0.5 rounded-full font-semibold">LINE ✓</span>
                    ) : (
                      <span className="text-[9px] text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">
                    {new Date(t.created_at).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setSelected(t)}
                      className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">
                      ดูสลิป
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div>
                <p className="text-sm font-semibold text-zinc-900">ตรวจสลิปการชำระเงิน</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {selected.profiles?.display_name ?? selected.profiles?.username} · {selected.events?.title}
                  {selected.profiles?.line_user_id && (
                    <span className="ml-2 bg-[#06C755] text-white text-[8px] px-1.5 py-0.5 rounded-full">LINE</span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-400 text-lg">✕</button>
            </div>

            <div className="p-5">
              {selected.slip_url ? (
                <div className="rounded-xl overflow-hidden border border-zinc-100 mb-4">
                  <Image src={selected.slip_url} alt="slip" width={400} height={500} className="w-full object-contain max-h-64" />
                </div>
              ) : (
                <div className="bg-zinc-50 rounded-xl h-40 flex items-center justify-center mb-4">
                  <p className="text-xs text-zinc-400">ไม่มีสลิป</p>
                </div>
              )}

              <div className="bg-zinc-50 rounded-xl p-3 mb-4 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[11px] text-zinc-400">บัตร</span>
                  <span className="text-[11px] font-semibold text-zinc-900">Priority Guest ฿690</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] text-zinc-400">สิทธิ์</span>
                  <span className="text-[11px] font-semibold text-green-700">M2 JP ฟรี + Booster Pack 5 ซอง + ลุ้น 2 รางวัล</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] text-zinc-400">QR Code</span>
                  <span className="text-[11px] font-mono text-zinc-600">{selected.qr_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] text-zinc-400">แจ้งเตือน LINE</span>
                  <span className="text-[11px] text-zinc-600">
                    {selected.profiles?.line_user_id ? "✅ จะส่งอัตโนมัติ" : "❌ ไม่มี LINE"}
                  </span>
                </div>
              </div>

              {selected.status === "pending" ? (
                <div className="flex gap-2">
                  <button onClick={() => reject(selected)} disabled={updating}
                    className="flex-1 py-2.5 border border-red-200 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50">
                    ปฏิเสธ
                  </button>
                  <button onClick={() => approve(selected)} disabled={updating}
                    className="flex-1 py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 disabled:opacity-50">
                    {updating ? "กำลังอนุมัติ..." : "อนุมัติ + แจ้ง LINE ✓"}
                  </button>
                </div>
              ) : (
                <div className={`text-center py-2.5 rounded-xl text-xs font-semibold ${STATUS_STYLE[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
