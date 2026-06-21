"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: ประกาศผ่าน LINE
// ดึงผู้เข้างานจาก /api/admin/tickets → เลือกกลุ่ม (หรือ "ผู้โชคดีล่าสุด" จากหน้า Raffle)
// → ยิง multicast ผ่าน /api/admin/announce  (เฉพาะคนที่เชื่อม LINE แล้ว)
// วางไฟล์: app/admin/announce/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  source: "priority" | "general";
  ticket_type: string;
  status: "pending" | "approved" | "rejected";
  display_name: string;
  event_title: string;
  pack_paid: boolean | null;
  line_user_id: string;
  line_linked: boolean;
};

type SavedWinner = { key: string; name: string; prize: string };

const LS_WINNERS = "cardlist:lastWinners";

const TEMPLATES = [
  { label: "ใกล้เริ่มกิจกรรม", text: "📢 The Cardlist 2nd Meetup\nอีก 15 นาทีจะเริ่มกิจกรรมบนเวทีแล้ว มารวมตัวกันที่หน้าเวทีได้เลยครับ!" },
  { label: "ประกาศผู้โชคดี", text: "🎉 ยินดีด้วยครับ! คุณเป็นผู้โชคดีจากการสุ่มรางวัลใน The Cardlist 2nd Meetup\nรับรางวัลได้ที่จุดลงทะเบียน แสดงข้อความนี้กับทีมงานได้เลย" },
  { label: "ขอบคุณหลังจบงาน", text: "ขอบคุณที่มาร่วมงาน The Cardlist 2nd Meetup นะครับ 🙏\nแล้วพบกันใหม่ครั้งหน้า ติดตามข่าวสารได้ที่เพจของเราเลย!" },
];

export default function AdminAnnouncePage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [mode, setMode] = useState<"group" | "winners">("group");
  const [eventFilter, setEventFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "priority" | "general">("all");
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [packPaidOnly, setPackPaidOnly] = useState(false);

  const [savedWinners, setSavedWinners] = useState<SavedWinner[]>([]);
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number; failedBatches: number } | null>(null);

  async function authHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async function load() {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/admin/tickets", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setRows(data.tickets ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_WINNERS);
      if (raw) setSavedWinners(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const events = useMemo(
    () => Array.from(new Set(rows.map((r) => r.event_title).filter(Boolean))),
    [rows]
  );

  // กลุ่มที่เลือก (ยังไม่กรอง LINE)
  const selected = useMemo(() => {
    if (mode === "winners") {
      const keys = new Set(savedWinners.map((w) => w.key));
      return rows.filter((r) => keys.has(`${r.source}-${r.id}`));
    }
    return rows.filter((r) => {
      if (approvedOnly && r.status !== "approved") return false;
      if (eventFilter !== "all" && r.event_title !== eventFilter) return false;
      if (typeFilter !== "all" && r.source !== typeFilter) return false;
      if (packPaidOnly && !r.pack_paid) return false;
      return true;
    });
  }, [rows, mode, savedWinners, approvedOnly, eventFilter, typeFilter, packPaidOnly]);

  // ผู้รับจริง = ต้องเชื่อม LINE แล้วเท่านั้น
  const recipients = useMemo(
    () => selected.filter((r) => r.line_linked && r.line_user_id),
    [selected]
  );
  const skipped = selected.length - recipients.length;

  async function send() {
    setSending(true); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipients.map((r) => r.line_user_id), text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งไม่สำเร็จ");
      setResult({ sent: data.sent, total: data.total, failedBatches: data.failedBatches });
    } catch (e: any) {
      setErr(e?.message ?? "ส่งไม่สำเร็จ");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  const canSend = text.trim().length > 0 && recipients.length > 0 && !sending;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-900">ประกาศผ่าน LINE</h2>
        <p className="text-xs text-zinc-400 mt-0.5">ส่งข้อความถึงผู้ลงทะเบียนที่เชื่อม LINE แล้ว</p>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{err}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-green-700 font-semibold">
            ส่งสำเร็จ {result.sent}/{result.total} คน
            {result.failedBatches > 0 && <span className="text-amber-600"> · มี {result.failedBatches} batch ที่ล้มเหลว</span>}
          </p>
        </div>
      )}

      {/* source */}
      <div className="border border-zinc-100 rounded-2xl p-4 mb-4 bg-white">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">ส่งถึงใคร</p>
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => setMode("group")}
            className={`text-xs px-4 py-2 rounded-lg border font-medium transition-colors ${mode === "group" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
            เลือกกลุ่ม
          </button>
          <button onClick={() => setMode("winners")} disabled={savedWinners.length === 0}
            className={`text-xs px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-40 ${mode === "winners" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
            ผู้โชคดีล่าสุด {savedWinners.length > 0 && `(${savedWinners.length})`}
          </button>
        </div>

        {mode === "group" ? (
          <div className="flex flex-wrap gap-2 items-center">
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700">
              <option value="all">ทุกงาน</option>
              {events.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </select>
            {(["all", "priority", "general"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${typeFilter === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                {t === "all" ? "ทุกบัตร" : t === "priority" ? "Priority" : "General"}
              </button>
            ))}
            <Toggle on={approvedOnly} setOn={setApprovedOnly} label="เฉพาะที่อนุมัติแล้ว" />
            <Toggle on={packPaidOnly} setOn={setPackPaidOnly} label="เฉพาะคนที่จ่าย Pack" />
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            ผู้โชคดี {savedWinners.length} คนจากการสุ่มล่าสุด: {savedWinners.map((w) => w.name).join(", ")}
          </p>
        )}
      </div>

      {/* message */}
      <div className="border border-zinc-100 rounded-2xl p-4 mb-4 bg-white">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">ข้อความ</p>
          <span className={`text-[11px] ${text.length > 5000 ? "text-red-500" : "text-zinc-400"}`}>{text.length}/5000</span>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
          placeholder="พิมพ์ข้อความที่จะส่ง…"
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-400 resize-y" />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {TEMPLATES.map((t) => (
            <button key={t.label} onClick={() => setText(t.text)}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* recipient summary + send */}
      <div className="border border-zinc-100 rounded-2xl p-4 bg-white flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-zinc-500">
          {loading ? "กำลังโหลด…" : (
            <>
              จะส่งถึง <b className="text-zinc-900 text-sm">{recipients.length}</b> คน
              {skipped > 0 && <span className="text-amber-600"> · ข้าม {skipped} คน (ยังไม่เชื่อม LINE)</span>}
            </>
          )}
        </div>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} disabled={!canSend}
            className="text-sm font-bold px-6 py-2.5 rounded-xl text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">
            ส่งประกาศ
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">ยืนยันส่งหา {recipients.length} คน?</span>
            <button onClick={() => setConfirming(false)} className="text-xs px-3 py-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50">ยกเลิก</button>
            <button onClick={send} disabled={sending}
              className="text-sm font-bold px-5 py-2.5 rounded-xl text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
              {sending ? "กำลังส่ง…" : "ยืนยันส่ง"}
            </button>
          </div>
        )}
      </div>
      <p className="text-[11px] text-zinc-400 mt-3">
        หมายเหตุ: ส่งได้เฉพาะคนที่แอด LINE OA และเชื่อมบัญชีแล้ว · การส่งนับรวมในโควต้าข้อความรายเดือนของ OA
      </p>
    </div>
  );
}

function Toggle({ on, setOn, label }: { on: boolean; setOn: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => setOn(!on)}
      className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${on ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${on ? "border-white" : "border-zinc-300"}`}>
        {on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  );
}
