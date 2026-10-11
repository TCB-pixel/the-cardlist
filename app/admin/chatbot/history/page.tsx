"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type ChatLog = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  message: string;
  reply: string | null;
  replied_by: "ai" | "admin" | "pending";
  escalation_reason: string | null;
  missing_info: string | null;
  created_at: string;
};

const BY_LABEL: Record<ChatLog["replied_by"], { label: string; cls: string }> = {
  ai: { label: "AI", cls: "bg-purple-50 text-purple-700" },
  admin: { label: "แอดมิน", cls: "bg-green-50 text-green-700" },
  pending: { label: "รอแอดมิน", cls: "bg-amber-50 text-amber-700" },
};

export default function AdminChatHistoryPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [by, setBy] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ page: String(page) });
      if (by) params.set("by", by);
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/chatbot/history?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 50);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, page, by, search]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const inputCls = "bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400";

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(q.trim()); }} className="flex gap-2">
          <input className={inputCls + " w-56"} placeholder="ค้นหาข้อความ / ชื่อลูกค้า" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="bg-zinc-900 text-white text-xs font-semibold px-4 rounded-xl">ค้นหา</button>
        </form>
        <select className={inputCls} value={by} onChange={(e) => { setPage(0); setBy(e.target.value); }}>
          <option value="">ตอบโดย: ทั้งหมด</option>
          <option value="ai">AI</option>
          <option value="admin">แอดมิน</option>
          <option value="pending">รอแอดมิน</option>
        </select>
        <span className="text-xs text-zinc-400 ml-auto">{loading ? "กำลังโหลด..." : `${total} ข้อความ`}</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-[11px] text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        {!loading && logs.length === 0 && <p className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีแชท</p>}
        {logs.map((l) => (
          <div key={l.id} className="px-5 py-4 border-b border-zinc-50 last:border-none">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-xs font-semibold text-zinc-900 truncate">{l.display_name ?? l.line_user_id}</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${BY_LABEL[l.replied_by].cls}`}>{BY_LABEL[l.replied_by].label}</span>
              </div>
              <span className="text-[10px] text-zinc-400 flex-shrink-0">
                {new Date(l.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm text-zinc-900 whitespace-pre-wrap">💬 {l.message}</p>
            {l.reply && <p className="text-sm text-zinc-600 whitespace-pre-wrap mt-1.5 pl-4 border-l-2 border-zinc-100">{l.reply}</p>}
            {(l.escalation_reason || l.missing_info) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {l.escalation_reason && <span className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-0.5">{l.escalation_reason}</span>}
                {l.missing_info && <span className="text-[10px] text-red-700 bg-red-50 rounded px-2 py-0.5">ไม่มีข้อมูล: {l.missing_info}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 disabled:opacity-40">ก่อนหน้า</button>
          <span className="text-xs text-zinc-500">หน้า {page + 1} / {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 disabled:opacity-40">ถัดไป</button>
        </div>
      )}
    </div>
  );
}
