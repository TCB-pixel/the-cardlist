"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: สุ่มผู้โชคดี (Raffle / Lucky Draw)
// ดึงผู้เข้างานจาก /api/admin/tickets (เหมือนหน้า "บัตรเข้างาน") — ไม่ต้องเพิ่ม backend
// สุ่มฝั่ง client, กันสุ่มซ้ำในรอบเดียวกัน, Export CSV ได้
// วางไฟล์: app/admin/raffle/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  source: "priority" | "general";
  ticket_type: string;
  status: "pending" | "approved" | "rejected";
  display_name: string;
  email: string;
  event_title: string;
  pack_paid: boolean | null;
};

type Winner = { key: string; name: string; ticket_type: string; event_title: string; prize: string };

export default function AdminRafflePage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ── filters ──
  const [eventFilter, setEventFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "priority" | "general">("all");
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [packPaidOnly, setPackPaidOnly] = useState(false);

  // ── draw ──
  const [prize, setPrize] = useState("Booster Box");
  const [count, setCount] = useState(1);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (!res.ok) {
        const msg =
          data.error === "forbidden" ? "บัญชีนี้ไม่อยู่ในรายชื่อทีมงาน หรือถูกปิดใช้งาน"
          : data.error === "unauthorized" ? "เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่"
          : data.error || "โหลดข้อมูลไม่สำเร็จ";
        throw new Error(msg);
      }
      setRows(data.tickets ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const events = useMemo(
    () => Array.from(new Set(rows.map((r) => r.event_title).filter(Boolean))),
    [rows]
  );

  // คนที่เข้าเงื่อนไข filter (ก่อนหักผู้ที่ถูกสุ่มไปแล้ว)
  const pool = useMemo(() => {
    return rows.filter((r) => {
      if (approvedOnly && r.status !== "approved") return false;
      if (eventFilter !== "all" && r.event_title !== eventFilter) return false;
      if (typeFilter !== "all" && r.source !== typeFilter) return false;
      if (packPaidOnly && !r.pack_paid) return false;
      return true;
    });
  }, [rows, approvedOnly, eventFilter, typeFilter, packPaidOnly]);

  const wonKeys = useMemo(() => new Set(winners.map((w) => w.key)), [winners]);
  const remaining = useMemo(
    () => pool.filter((r) => !wonKeys.has(`${r.source}-${r.id}`)),
    [pool, wonKeys]
  );

  function draw() {
    if (rolling) return;
    const need = Math.min(count, remaining.length);
    if (need <= 0) return;

    setRolling(true);
    const newly: Winner[] = [];
    let slot = 0;

    const drawOne = () => {
      const avail = remaining.filter((r) => !newly.some((n) => n.key === `${r.source}-${r.id}`));
      if (avail.length === 0) { finish(); return; }

      const start = Date.now();
      const DURATION = 1500 + slot * 250;
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        const r = avail[Math.floor(Math.random() * avail.length)];
        setDisplay(r.display_name || "—");
        if (Date.now() - start >= DURATION) {
          if (tickRef.current) clearInterval(tickRef.current);
          const picked = avail[Math.floor(Math.random() * avail.length)];
          const w: Winner = {
            key: `${picked.source}-${picked.id}`,
            name: picked.display_name || "—",
            ticket_type: picked.ticket_type,
            event_title: picked.event_title,
            prize,
          };
          newly.push(w);
          setWinners((prev) => [...prev, w]);
          setDisplay(null);
          slot += 1;
          if (slot < need) setTimeout(drawOne, 450);
          else finish();
        }
      }, 55);
    };
    const finish = () => { setRolling(false); setDisplay(null); };
    drawOne();
  }

  function removeWinner(key: string) {
    setWinners((w) => w.filter((x) => x.key !== key));
  }
  function reset() {
    if (tickRef.current) clearInterval(tickRef.current);
    setWinners([]); setRolling(false); setDisplay(null);
  }
  function copyWinners() {
    const text = winners.map((w, i) => `${i + 1}. ${w.name} — ${w.prize}`).join("\n");
    navigator.clipboard?.writeText(text);
  }
  function exportCSV() {
    const head = ["ลำดับ", "ชื่อ", "ประเภทบัตร", "งาน", "ของรางวัล"];
    const body = winners.map((w, i) => [String(i + 1), w.name, w.ticket_type, w.event_title, w.prize]);
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [head, ...body].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raffle-winners-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6">
      <style>{HOLO_CSS}</style>

      {/* header + pool count */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">สุ่มผู้โชคดี</h2>
          <p className="text-xs text-zinc-400 mt-0.5">สุ่มจากผู้ลงทะเบียนเข้างาน · The Cardlist</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-zinc-900 leading-none">{remaining.length}</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            พร้อมสุ่ม · สุ่มไปแล้ว {winners.length} · ในกลุ่ม {pool.length}
          </p>
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{err}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      {/* filters */}
      <div className="border border-zinc-100 rounded-2xl p-4 mb-4 bg-white">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">กลุ่มที่จะสุ่ม</p>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700">
            <option value="all">ทุกงาน</option>
            {events.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
          <div className="flex gap-1.5">
            {(["all", "priority", "general"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${
                  typeFilter === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}>
                {t === "all" ? "ทุกบัตร" : t === "priority" ? "Priority" : "General"}
              </button>
            ))}
          </div>
          <Toggle on={approvedOnly} setOn={setApprovedOnly} label="เฉพาะที่อนุมัติแล้ว" />
          <Toggle on={packPaidOnly} setOn={setPackPaidOnly} label="เฉพาะคนที่จ่าย Pack" />
        </div>
      </div>

      {/* controls */}
      <div className="border border-zinc-100 rounded-2xl p-4 mb-4 bg-white flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-[11px] text-zinc-400 block mb-1.5">ของรางวัล</span>
          <input value={prize} onChange={(e) => setPrize(e.target.value)} disabled={rolling}
            placeholder="เช่น Booster Box"
            className="text-sm px-3 py-2.5 rounded-lg border border-zinc-200 w-52 outline-none focus:border-zinc-400" />
        </label>
        <label className="block">
          <span className="text-[11px] text-zinc-400 block mb-1.5">จำนวนที่จะสุ่ม</span>
          <div className="flex items-center gap-2">
            <Step onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={rolling}>−</Step>
            <span className="text-lg font-bold w-8 text-center text-zinc-900">{count}</span>
            <Step onClick={() => setCount((c) => Math.min(20, c + 1))} disabled={rolling}>+</Step>
          </div>
        </label>
        <button onClick={draw} disabled={rolling || remaining.length === 0}
          className="ml-auto text-sm font-bold px-7 py-3 rounded-xl text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                     bg-zinc-900 hover:bg-zinc-800">
          {rolling ? "กำลังสุ่ม…" : remaining.length === 0 ? "ไม่มีคนให้สุ่ม" : "เริ่มสุ่ม"}
        </button>
      </div>

      {/* stage (dark) */}
      <div className="rounded-2xl mb-4 min-h-[160px] flex items-center justify-center px-4 py-6"
        style={{ background: "radial-gradient(700px 360px at 78% -20%, rgba(59,130,246,.18), transparent 60%), #0e1726" }}>
        {loading ? (
          <p className="text-sm text-zinc-400">กำลังโหลดผู้ลงทะเบียน…</p>
        ) : display ? (
          <div className="raffle-rolling rounded-xl px-8 py-7 text-white text-xl font-bold tracking-wide"
            style={{ background: "linear-gradient(160deg,#1b2942,#0e1726)", border: "1px solid rgba(255,255,255,.08)" }}>
            {display}
          </div>
        ) : winners.length === 0 ? (
          <p className="text-sm text-zinc-400">กด <b className="text-amber-300">เริ่มสุ่ม</b> เพื่อจับรางวัลจากผู้ลงทะเบียน {remaining.length} คน</p>
        ) : (
          <p className="text-sm text-zinc-300">สุ่มเสร็จแล้ว — ดูผู้โชคดีด้านล่าง 🎉</p>
        )}
      </div>

      {/* winners */}
      {winners.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-zinc-900">ผู้โชคดี ({winners.length})</h3>
            <div className="flex gap-2">
              <button onClick={copyWinners} className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50">คัดลอกรายชื่อ</button>
              <button onClick={exportCSV} className="text-[11px] px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700">⬇ Export CSV</button>
              <button onClick={reset} className="text-[11px] px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">ล้างผลทั้งหมด</button>
            </div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
            {winners.map((w, i) => (
              <div key={w.key} className="raffle-holo relative rounded-xl p-4 overflow-hidden" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="raffle-sheen" />
                <button onClick={() => removeWinner(w.key)}
                  className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/30 text-white/80 text-xs hover:bg-black/50">×</button>
                <div className="relative">
                  <p className="text-[10px] font-bold tracking-widest text-amber-300 uppercase">★ Winner #{i + 1}</p>
                  <p className="text-lg font-bold text-white mt-1.5 leading-snug">{w.name}</p>
                  <p className="text-xs text-white/70 mt-1">🎁 {w.prize}</p>
                  <p className="text-[10px] text-white/45 mt-2">{w.ticket_type}{w.event_title ? ` · ${w.event_title}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── small UI bits ──
function Toggle({ on, setOn, label }: { on: boolean; setOn: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => setOn(!on)}
      className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${
        on ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
      }`}>
      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${on ? "border-white" : "border-zinc-300"}`}>
        {on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  );
}
function Step({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-9 h-9 rounded-lg border border-zinc-200 text-lg text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">
      {children}
    </button>
  );
}

const HOLO_CSS = `
@keyframes raffleLock { 0%{transform:rotateY(80deg) scale(.92);opacity:0} 60%{transform:rotateY(-6deg) scale(1.03);opacity:1} 100%{transform:rotateY(0) scale(1);opacity:1} }
@keyframes raffleHolo { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes raffleSweep { 0%{transform:translateX(-130%) skewX(-20deg)} 100%{transform:translateX(260%) skewX(-20deg)} }
@keyframes rafflePulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,209,71,0)} 50%{box-shadow:0 0 26px 2px rgba(255,209,71,.32)} }
.raffle-rolling { animation: rafflePulse 1s ease-in-out infinite; }
.raffle-holo {
  animation: raffleLock .5s cubic-bezier(.2,.8,.2,1) both;
  background: linear-gradient(125deg,#2a1f4d,#173a5e,#1f4d3a,#4d2a1f,#2a1f4d);
  background-size: 300% 300%;
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: 0 8px 22px rgba(0,0,0,.35);
}
.raffle-holo::after {
  content:""; position:absolute; inset:0; mix-blend-mode:screen; opacity:.45; pointer-events:none;
  background: linear-gradient(125deg,transparent,rgba(255,255,255,.5),transparent);
  background-size:300% 300%; animation: raffleHolo 4s ease infinite;
}
.raffle-sheen {
  position:absolute; top:0; left:0; width:40%; height:100%; pointer-events:none;
  background: linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);
  animation: raffleSweep 2.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce){ .raffle-rolling,.raffle-holo,.raffle-holo::after,.raffle-sheen{animation:none!important} }
`;
