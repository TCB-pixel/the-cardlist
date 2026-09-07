"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

const GAMES = ["One Piece", "Pokémon", "MTG", "Dragon Ball", "Lorcana", "Gundam", "อื่นๆ"];

type Lookup = {
  profile: { id: string; member_code: string; display_name: string | null; username: string; tier: string; phone: string | null };
  totalVisits: number;
  recent: { tcg: string; played_at: string }[];
  grants: { id: string; status: string; stamp_rewards: { name: string; required_visits: number; price: number | null } | null }[];
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPlayPage() {
  const { can: canDo } = useAdmin();
  const scannerRef = useRef<any>(null);

  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [game, setGame] = useState(GAMES[0]);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [choices, setChoices] = useState<{ id: string; member_code: string; display_name: string | null; username: string; phone: string | null }[] | null>(null);
  const [saved, setSaved] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => { return () => { stopScanner(); }; }, [stopScanner]);

  // รับได้ทั้งรหัสสมาชิก (MB-XXXXXXXX) และเบอร์โทร — ฝั่ง API แยกให้เอง
  const lookupMember = useCallback(async (input: string) => {
    const q = input.trim();
    if (!q) return;
    setLoading(true); setError(""); setSaved(null); setLookup(null); setChoices(null);
    try {
      const res = await authedFetch(`/api/admin/play?code=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ไม่พบสมาชิก");
      // เบอร์เดียวผูกหลายบัญชี — ให้เลือกก่อน
      if (json.multiple) {
        setChoices(json.multiple);
        return;
      }
      setCode(json.profile.member_code);
      setLookup(json);
    } catch (e: any) {
      setError(e?.message ?? "ไม่พบสมาชิก");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  async function startScanner() {
    setError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("member-qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (text: string) => {
          await scanner.stop();
          scannerRef.current = null;
          setScanning(false);
          await lookupMember(text.trim());
        },
        undefined
      );
    } catch {
      setScanning(false);
      setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง");
    }
  }

  async function recordVisit() {
    if (!lookup) return;
    setSaving(true); setError("");
    try {
      const res = await authedFetch("/api/admin/play", {
        method: "POST",
        body: JSON.stringify({ member_code: code, tcg: game }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      setSaved(json);
      setLookup(null);
    } catch (e: any) {
      setError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setLookup(null); setSaved(null); setCode(""); setError(""); setChoices(null);
  }

  if (!canDo("play:scan")) {
    return <div className="p-6"><p className="text-xs text-zinc-400">ไม่มีสิทธิ์เข้าถึงหน้านี้</p></div>;
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-sm font-semibold text-zinc-900">บันทึกการมาเล่น</h1>
        <p className="text-[11px] text-zinc-400 mt-0.5">สแกน QR ประจำตัว หรือค้นด้วยรหัสสมาชิก/เบอร์โทร แล้วเลือกเกมที่เล่นรอบนี้</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-[11px] text-red-600">{error}</p>
        </div>
      )}

      {/* ── ผลลัพธ์หลังบันทึก ── */}
      {saved && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 mb-4 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm font-semibold text-zinc-900">บันทึกแล้ว</p>
          <p className="text-xs text-zinc-500 mt-1">{saved.user?.display_name}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-3">{saved.total_visits} <span className="text-xs font-normal text-zinc-400">ครั้ง</span></p>
          {saved.visits_today > 1 && (
            <p className="text-[11px] text-amber-600 mt-2">⚠️ วันนี้สแกนไปแล้ว {saved.visits_today} ครั้ง — ตรวจสอบว่าไม่ได้สแกนซ้ำ</p>
          )}
          {Array.isArray(saved.new_rewards) && saved.new_rewards.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2">
              <p className="text-[10px] font-semibold text-zinc-400 tracking-widest">🎁 ได้รับสิทธิ์ใหม่</p>
              {saved.new_rewards.map((r: any) => (
                <div key={r.id} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800">{r.name}</p>
                  {r.price && <p className="text-[11px] text-amber-700">฿{Number(r.price).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          )}
          <button onClick={reset} className="mt-5 w-full bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700">
            สแกนคนต่อไป
          </button>
        </div>
      )}

      {/* ── ค้นหา / สแกน ── */}
      {!saved && !lookup && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 space-y-3">
          <div id="member-qr-reader" className={scanning ? "rounded-xl overflow-hidden" : "hidden"} />
          {!scanning && (
            <>
              <button onClick={startScanner}
                className="w-full bg-zinc-900 text-white text-xs font-semibold py-3 rounded-xl hover:bg-zinc-700">
                📷 เปิดกล้องสแกน QR
              </button>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-zinc-100" />
                <span className="text-[10px] text-zinc-300">หรือค้นหาเอง</span>
                <div className="flex-1 h-px bg-zinc-100" />
              </div>
              <div className="flex gap-2">
                <input value={code}
                  onChange={(e) => {
                    // ตัวเลขล้วน = เบอร์โทร ไม่ต้องแปลงเป็นตัวใหญ่
                    const v = e.target.value;
                    setCode(/[A-Za-z]/.test(v) ? v.toUpperCase() : v);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") lookupMember(code); }}
                  placeholder="MB-XXXXXXXX หรือเบอร์โทร 08X-XXX-XXXX" className={inputCls} />
                <button onClick={() => lookupMember(code)} disabled={loading || !code.trim()}
                  className="bg-zinc-900 text-white text-xs font-semibold px-5 rounded-xl hover:bg-zinc-700 disabled:opacity-40 flex-shrink-0">
                  {loading ? "..." : "ค้นหา"}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400">
                ค้นด้วยเบอร์ได้เฉพาะสมาชิกที่กรอกเบอร์ไว้ในโปรไฟล์แล้ว — ถ้าหาไม่เจอให้ใช้ QR หรือรหัส MB- แทน
              </p>

              {/* เบอร์เดียวเจอหลายบัญชี */}
              {choices && (
                <div className="border-t border-zinc-100 pt-3">
                  <p className="text-[11px] font-semibold text-zinc-500 mb-2">เจอ {choices.length} บัญชีที่ใช้เบอร์นี้ — เลือกคนที่ถูกต้อง</p>
                  <div className="space-y-2">
                    {choices.map((c) => (
                      <button key={c.id} onClick={() => lookupMember(c.member_code)}
                        className="w-full text-left border border-zinc-200 rounded-xl px-3 py-2 hover:bg-zinc-50">
                        <p className="text-xs font-semibold text-zinc-900">{c.display_name ?? c.username}</p>
                        <p className="text-[10px] font-mono text-zinc-400">{c.member_code}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {scanning && (
            <button onClick={stopScanner} className="w-full border border-zinc-200 text-zinc-600 text-xs font-semibold py-2.5 rounded-xl">
              ยกเลิก
            </button>
          )}
        </div>
      )}

      {/* ── เจอสมาชิกแล้ว เลือกเกมและยืนยัน ── */}
      {lookup && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-100">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {lookup.profile.display_name ?? lookup.profile.username}
              </p>
              <p className="text-[10px] font-mono text-zinc-400">{lookup.profile.member_code}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-bold text-zinc-900">{lookup.totalVisits}</p>
              <p className="text-[9px] text-zinc-400 tracking-wider">ครั้งสะสม</p>
            </div>
          </div>

          {lookup.grants.length > 0 && (
            <div className="py-3 border-b border-zinc-100 space-y-1">
              {lookup.grants.map((g) => (
                <p key={g.id} className="text-[10px] text-zinc-500">
                  {g.status === "used" ? "✔️ ใช้แล้ว" : "🎁 มีสิทธิ์"} — {g.stamp_rewards?.name ?? "—"}
                </p>
              ))}
            </div>
          )}

          {lookup.recent.length > 0 && (
            <div className="py-3 border-b border-zinc-100">
              <p className="text-[10px] font-semibold text-zinc-400 tracking-widest mb-1.5">มาล่าสุด</p>
              {lookup.recent.map((r, i) => (
                <p key={i} className="text-[10px] text-zinc-500">{fmtDateTime(r.played_at)} · {r.tcg}</p>
              ))}
            </div>
          )}

          <div className="pt-4">
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-2">เล่นเกมอะไรรอบนี้</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {GAMES.map((g) => (
                <button key={g} onClick={() => setGame(g)}
                  className={`text-[11px] px-3 py-1.5 rounded-xl border transition-colors ${
                    game === g ? "bg-zinc-900 text-white border-zinc-900 font-semibold" : "bg-white text-zinc-500 border-zinc-200"
                  }`}>
                  {g}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="border border-zinc-200 text-zinc-500 text-xs font-semibold px-4 py-2.5 rounded-xl">
                ยกเลิก
              </button>
              <button onClick={recordVisit} disabled={saving}
                className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
                {saving ? "กำลังบันทึก..." : `บันทึกเป็นครั้งที่ ${lookup.totalVisits + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
