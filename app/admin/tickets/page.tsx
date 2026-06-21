"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: บัตรเข้างาน — รายชื่อผู้เข้างานทั้งหมด (General + Priority)
// ดึงผ่าน /api/admin/tickets (service role) + Export CSV
// วางไฟล์: app/admin/tickets/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  source: "priority" | "general";
  ticket_type: string;
  status: "pending" | "approved" | "rejected";
  display_name: string;
  username: string;
  email: string;
  avatar_url: string;
  line_user_id: string;
  line_linked: boolean;
  event_title: string;
  event_date: string | null;
  qr_code: string;
  pack_paid: boolean | null;
  created_at: string | null;
};

const STATUS_LABEL: Record<string, string> = { pending: "รอยืนยัน", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" };
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

export default function AdminTicketsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("all");
  const [updatingId, setUpdatingId] = useState("");

  async function authHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/tickets", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error === "forbidden" ? "บัญชีนี้ไม่มีสิทธิ์ (role ไม่ใช่ owner/admin/staff)" : data.error || "โหลดข้อมูลไม่สำเร็จ");
      setRows(data.tickets ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: "approved" | "rejected") {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setRows((rs) => rs.map((r) => (r.id === id && r.source === "priority" ? { ...r, status } : r)));
    } catch (e: any) {
      setErr(e?.message ?? "อัพเดทไม่สำเร็จ");
    } finally {
      setUpdatingId("");
    }
  }

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      all: rows.length,
    }),
    [rows]
  );

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter]
  );

  function exportCSV() {
    const head = ["ชื่อ", "Username", "Email", "LINE", "ประเภทบัตร", "งาน", "QR Code", "สถานะ", "ชำระ Pack", "วันที่"];
    const body = filtered.map((r) => [
      r.display_name,
      r.username,
      r.email,
      r.line_linked ? "เชื่อมแล้ว" : "ยังไม่เชื่อม",
      r.ticket_type,
      r.event_title,
      r.qr_code,
      STATUS_LABEL[r.status] ?? r.status,
      r.source === "general" ? (r.pack_paid ? "จ่ายแล้ว" : "ยังไม่จ่าย") : "-",
      r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : "",
    ]);
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [head, ...body].map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const TABS: { key: typeof filter; label: string; count: number }[] = [
    { key: "pending", label: "รอยืนยัน", count: counts.pending },
    { key: "approved", label: "อนุมัติแล้ว", count: counts.approved },
    { key: "rejected", label: "ปฏิเสธ", count: counts.rejected },
    { key: "all", label: "ทั้งหมด", count: counts.all },
  ];

  return (
    <div className="p-4 md:p-6">
      {/* Tabs + Export */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`text-xs px-4 py-2 rounded-full border font-semibold transition-colors ${
                filter === t.key ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white hover:bg-zinc-50"
              }`}
            >
              {t.label}
              <span className="ml-1.5 opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="text-xs px-4 py-2 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          ⬇ Export CSV ({filtered.length})
        </button>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{err}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      {/* Table */}
      <div className="border border-zinc-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">สมาชิก</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">บัตร</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">งาน</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">LINE</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">สถานะ</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">วันที่</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-zinc-400">ไม่มีรายการ</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={`${r.source}-${r.id}`} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(r.display_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 truncate">{r.display_name}</p>
                          {r.email && <p className="text-[10px] text-zinc-400 truncate">{r.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${r.source === "priority" ? "bg-purple-50 text-purple-700" : "bg-zinc-100 text-zinc-600"}`}>
                        {r.ticket_type}
                      </span>
                      {r.source === "general" && (
                        <p className="text-[10px] mt-1 text-zinc-400">{r.pack_paid ? "🛍️ จ่าย Pack แล้ว" : "ยังไม่ซื้อ Pack"}</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><p className="text-xs text-zinc-700 truncate max-w-[160px]">{r.event_title}</p></td>
                    <td className="px-4 py-3">
                      {r.line_linked
                        ? <span className="text-[10px] font-semibold text-green-600">● เชื่อมแล้ว</span>
                        : <span className="text-[10px] text-zinc-400">○ ยังไม่เชื่อม</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3"><p className="text-[10px] text-zinc-400 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "—"}</p></td>
                    <td className="px-4 py-3 text-right">
                      {r.source === "priority" && r.status === "pending" ? (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => setStatus(r.id, "rejected")} disabled={updatingId === r.id}
                            className="text-[10px] px-2.5 py-1.5 border border-red-200 text-red-600 font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50">ปฏิเสธ</button>
                          <button onClick={() => setStatus(r.id, "approved")} disabled={updatingId === r.id}
                            className="text-[10px] px-2.5 py-1.5 bg-zinc-900 text-white font-semibold rounded-lg hover:bg-zinc-800 disabled:opacity-50">
                            {updatingId === r.id ? "..." : "อนุมัติ ✓"}</button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
