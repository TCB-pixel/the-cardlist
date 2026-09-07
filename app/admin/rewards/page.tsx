"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

type Member = {
  user_id: string; member_code: string; name: string;
  visits: number; totalVisits: number;
  games: Record<string, number>; lastPlayed: string;
};
type Report = {
  month: string; totalSessions: number; uniqueMembers: number;
  byGame: Record<string, number>; byDay: Record<string, number>; members: Member[];
};
type Grant = {
  id: string; member_code: string; name: string; phone: string | null;
  reward_name: string; reward_price: number | null;
  granted_at: string; visits_at_grant: number; status: string;
  used_at: string | null; used_by_email: string | null;
};
type Reward = {
  id: string; name: string; required_visits: number;
  price: number | null; quota: number | null; granted_count: number; active: boolean;
};

function monthOptions(count = 12) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function AdminRewardsPage() {
  const { can: canDo } = useAdmin();
  const [tab, setTab] = useState<"report" | "grants">("report");
  const [month, setMonth] = useState(monthOptions()[0]);
  const [report, setReport] = useState<Report | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rRes, gRes] = await Promise.all([
        authedFetch(`/api/admin/play-report?month=${month}`),
        authedFetch("/api/admin/reward-grants"),
      ]);
      const [r, g] = await Promise.all([rRes.json(), gRes.json()]);
      if (!rRes.ok) throw new Error(r.error || "โหลดรายงานไม่สำเร็จ");
      if (!gRes.ok) throw new Error(g.error || "โหลดสิทธิ์ไม่สำเร็จ");
      setReport(r);
      setRewards(g.rewards ?? []);
      setGrants(g.grants ?? []);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, month]);

  useEffect(() => { load(); }, [load]);

  async function toggleUsed(g: Grant) {
    try {
      const res = await authedFetch("/api/admin/reward-grants", {
        method: "PATCH",
        body: JSON.stringify({ id: g.id, status: g.status === "used" ? "granted" : "used" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "อัปเดตไม่สำเร็จ");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "อัปเดตไม่สำเร็จ");
    }
  }

  function exportCsv() {
    if (!report) return;
    const head = ["รหัสสมาชิก", "ชื่อ", "มาเดือนนี้", "สะสมทั้งหมด", "เกมที่เล่น", "มาล่าสุด"];
    const rows = report.members.map((m) => [
      m.member_code, m.name, m.visits, m.totalVisits,
      Object.entries(m.games).map(([g, n]) => `${g} x${n}`).join(" / "),
      fmtDate(m.lastPlayed),
    ]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `play-report-${report.month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!canDo("play:view")) {
    return <div className="p-6"><p className="text-xs text-zinc-400">ไม่มีสิทธิ์เข้าถึงหน้านี้</p></div>;
  }

  const gamesSorted = report ? Object.entries(report.byGame).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
          <button onClick={() => setTab("report")}
            className={`text-xs px-3.5 py-1.5 rounded-lg ${tab === "report" ? "bg-white text-zinc-900 font-semibold shadow-sm" : "text-zinc-500"}`}>
            สรุปรายเดือน
          </button>
          <button onClick={() => setTab("grants")}
            className={`text-xs px-3.5 py-1.5 rounded-lg ${tab === "grants" ? "bg-white text-zinc-900 font-semibold shadow-sm" : "text-zinc-500"}`}>
            สิทธิ์ที่แจกแล้ว ({grants.length})
          </button>
        </div>
        {tab === "report" && (
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 outline-none">
              {monthOptions().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <button onClick={exportCsv} disabled={!report || report.members.length === 0}
              className="border border-zinc-200 text-zinc-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-zinc-50 disabled:opacity-40">
              ⬇ CSV
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-red-600">{error}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      {/* ─── สรุปรายเดือน ─── */}
      {tab === "report" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white border border-zinc-100 rounded-2xl px-4 py-3">
              <p className="text-[10px] text-zinc-400 tracking-widest">รอบเล่นทั้งหมด</p>
              <p className="text-xl font-bold text-zinc-900 mt-1">{report?.totalSessions ?? 0}</p>
            </div>
            <div className="bg-white border border-zinc-100 rounded-2xl px-4 py-3">
              <p className="text-[10px] text-zinc-400 tracking-widest">สมาชิกที่มา</p>
              <p className="text-xl font-bold text-zinc-900 mt-1">{report?.uniqueMembers ?? 0}</p>
            </div>
            {rewards.map((r) => (
              <div key={r.id} className="bg-white border border-zinc-100 rounded-2xl px-4 py-3">
                <p className="text-[10px] text-zinc-400 tracking-widest">แจกแล้ว ({r.required_visits} ครั้ง)</p>
                <p className="text-xl font-bold text-zinc-900 mt-1">
                  {r.granted_count}
                  {r.quota != null && <span className="text-xs font-normal text-zinc-400"> / {r.quota}</span>}
                </p>
              </div>
            ))}
          </div>

          {gamesSorted.length > 0 && (
            <div className="bg-white border border-zinc-100 rounded-2xl p-5 mb-5">
              <p className="text-[10px] font-semibold text-zinc-400 tracking-widest mb-3">เกมที่เล่นเดือนนี้</p>
              <div className="space-y-2">
                {gamesSorted.map(([g, n]) => {
                  const pct = report!.totalSessions ? (n / report!.totalSessions) * 100 : 0;
                  return (
                    <div key={g} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600 w-24 flex-shrink-0">{g}</span>
                      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-zinc-500 w-16 text-right flex-shrink-0">{n} รอบ</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {["สมาชิก", "มาเดือนนี้", "สะสมทั้งหมด", "เกมที่เล่น", "มาล่าสุด"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
                ) : !report || report.members.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีการบันทึกรอบเล่นในเดือนนี้</td></tr>
                ) : report.members.map((m) => (
                  <tr key={m.user_id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-semibold text-zinc-900">{m.name}</p>
                      <p className="text-[10px] font-mono text-zinc-400">{m.member_code}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-zinc-900">{m.visits}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] ${m.totalVisits >= 10 ? "text-green-700 font-semibold" : m.totalVisits >= 5 ? "text-amber-700 font-semibold" : "text-zinc-500"}`}>
                        {m.totalVisits}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(m.games).map(([g, n]) => (
                          <span key={g} className="text-[9px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{g} ×{n}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-zinc-500">{fmtDate(m.lastPlayed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── สิทธิ์ที่แจกแล้ว ─── */}
      {tab === "grants" && (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["สมาชิก", "สิทธิ์ที่ได้", "ได้เมื่อ", "สถานะ", ""].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
              ) : grants.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีใครได้รับสิทธิ์</td></tr>
              ) : grants.map((g) => (
                <tr key={g.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                  <td className="px-5 py-3.5">
                    <p className="text-xs font-semibold text-zinc-900">{g.name}</p>
                    <p className="text-[10px] font-mono text-zinc-400">{g.member_code}{g.phone ? ` · ${g.phone}` : ""}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs text-zinc-700">{g.reward_name}</p>
                    {g.reward_price != null && (
                      <p className="text-[10px] text-zinc-400">฿{Number(g.reward_price).toLocaleString()}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[11px] text-zinc-500">
                    {fmtDate(g.granted_at)}
                    <span className="text-zinc-300"> · ครั้งที่ {g.visits_at_grant}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${
                      g.status === "used" ? "bg-zinc-100 text-zinc-500" : "bg-green-50 text-green-700"}`}>
                      {g.status === "used" ? "ใช้แล้ว" : "ยังไม่ใช้"}
                    </span>
                    {g.used_at && <p className="text-[9px] text-zinc-400 mt-1">{fmtDate(g.used_at)}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {canDo("play:scan") && (
                      <button onClick={() => toggleUsed(g)}
                        className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">
                        {g.status === "used" ? "ยกเลิกการใช้" : "ตัดสิทธิ์ (ซื้อแล้ว)"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
