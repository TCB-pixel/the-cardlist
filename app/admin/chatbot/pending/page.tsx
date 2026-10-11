"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

type Pending = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  question: string;
  draft_answer: string;
  reason: string | null;
  status: "pending" | "awaiting_owner_reply" | "sent" | "dismissed";
  final_answer: string | null;
  handled_by: string | null;
  created_at: string;
  handled_at: string | null;
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminChatbotPendingPage() {
  const supabase = createClient();
  const { can } = useAdmin();
  const canEdit = can("chatbot:edit");
  const [open, setOpen] = useState<Pending[]>([]);
  const [done, setDone] = useState<Pending[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
      const res = await authedFetch("/api/admin/chatbot/pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setOpen(data.open ?? []);
      setDone(data.done ?? []);
      setDrafts(Object.fromEntries((data.open ?? []).map((p: Pending) => [p.id, p.draft_answer])));
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  async function send(p: Pending) {
    setBusyId(p.id);
    setError("");
    try {
      const res = await authedFetch("/api/admin/chatbot/pending", { method: "POST", body: JSON.stringify({ id: p.id, answer: drafts[p.id] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งไม่สำเร็จ");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "ส่งไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(p: Pending) {
    setBusyId(p.id);
    try {
      const res = await authedFetch("/api/admin/chatbot/pending", { method: "PATCH", body: JSON.stringify({ id: p.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-zinc-400">{loading ? "กำลังโหลด..." : `รออนุมัติ ${open.length} รายการ`}</span>
        <button onClick={load} className="text-xs border border-zinc-200 rounded-xl px-3 py-2 text-zinc-600 hover:bg-zinc-50">รีเฟรช</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-[11px] text-red-600">{error}</p>
        </div>
      )}

      {!loading && open.length === 0 && (
        <div className="bg-white border border-zinc-100 rounded-2xl px-5 py-10 text-center text-xs text-zinc-400 mb-8">ไม่มีคำถามรออนุมัติ 🎉</div>
      )}

      <div className="space-y-3 mb-10">
        {open.map((p) => (
          <div key={p.id} className="bg-white border border-zinc-100 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-zinc-900">{p.display_name ?? "ลูกค้า"}</p>
              <div className="flex items-center gap-2">
                {p.status === "awaiting_owner_reply" && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">รอพิมพ์ตอบใน LINE</span>
                )}
                <span className="text-[10px] text-zinc-400">{fmt(p.created_at)}</span>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-zinc-400 mb-1">ลูกค้าถาม</p>
            <p className="text-sm text-zinc-900 whitespace-pre-wrap mb-3">{p.question}</p>
            {p.reason && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mb-3">เหตุผล: {p.reason}</p>}
            <p className="text-[10px] font-semibold text-zinc-400 mb-1">คำตอบที่จะส่ง (แก้ไขได้)</p>
            <textarea rows={4} className={inputCls} disabled={!canEdit}
              value={drafts[p.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })} />
            {canEdit && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => dismiss(p)} disabled={busyId === p.id}
                  className="border border-zinc-200 text-xs font-semibold text-zinc-600 px-4 py-2.5 rounded-xl hover:bg-zinc-50 disabled:opacity-50">
                  ไม่ต้องตอบ
                </button>
                <button onClick={() => send(p)} disabled={busyId === p.id || !drafts[p.id]?.trim()}
                  className="flex-1 bg-green-600 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50">
                  {busyId === p.id ? "กำลังส่ง..." : "อนุมัติและส่งให้ลูกค้า"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <h3 className="text-xs font-bold text-zinc-500 tracking-wide mb-3">จัดการแล้วล่าสุด</h3>
      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        {done.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-zinc-400">ยังไม่มี</p>
        ) : done.map((p) => (
          <div key={p.id} className="px-5 py-3.5 border-b border-zinc-50 last:border-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-900">{p.display_name ?? "ลูกค้า"}</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${p.status === "sent" ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                {p.status === "sent" ? "ส่งแล้ว" : "ไม่ต้องตอบ"}
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-1">ถาม: {p.question}</p>
            {p.final_answer && <p className="text-xs text-blue-700 mt-0.5">ตอบ: {p.final_answer}</p>}
            <p className="text-[10px] text-zinc-400 mt-1">{p.handled_at && fmt(p.handled_at)} · {p.handled_by}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
