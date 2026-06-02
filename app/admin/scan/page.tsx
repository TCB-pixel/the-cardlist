"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Html5Qrcode } from "html5-qrcode";

type ScanResult = {
  type: "general" | "priority";
  user: {
    name: string;
    avatar: string;
    qr_code: string;
  };
  event: { title: string; date: string };
  // General
  pack_used?: number;
  // Priority
  free_pack_redeemed?: boolean;
  price_pack_quota?: number;
  price_pack_used?: number;
  ma5_slot?: boolean | null;
  status?: string;
  ticketId: string;
};

type Phase = "scan" | "result" | "ma5";

export default function StaffScannerPage() {
  const supabase = createClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [phase, setPhase] = useState<Phase>("scan");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  // MA5 flip
  const [ma5Flipped, setMa5Flipped] = useState(false);
  const [ma5Result, setMa5Result] = useState<boolean | null>(null);
  const [ma5Animating, setMa5Animating] = useState(false);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  async function startScanner() {
    setError("");
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scanner.stop();
          setScanning(false);
          await lookupQR(decodedText);
        },
        undefined
      );
    } catch (err: any) {
      setError("ไม่สามารถเปิดกล้องได้: " + err.message);
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function lookupQR(qrCode: string) {
    setLoading(true);
    setError("");
    try {
      // เช็ค General
      if (qrCode.startsWith("GEN-")) {
        const { data: gen } = await supabase
          .from("general_registrations")
          .select("*, profiles(display_name, username, avatar_url), events(title, date)")
          .eq("qr_code", qrCode)
          .single();

        if (!gen) throw new Error("ไม่พบ QR Code นี้ในระบบ");

        setResult({
          type: "general",
          ticketId: gen.id,
          user: {
            name: (gen.profiles as any)?.display_name ?? (gen.profiles as any)?.username ?? "Unknown",
            avatar: ((gen.profiles as any)?.display_name ?? "?")[0].toUpperCase(),
            qr_code: qrCode,
          },
          event: {
            title: (gen.events as any)?.title ?? "—",
            date: (gen.events as any)?.date ?? "",
          },
          pack_used: gen.pack_used ?? 0,
        });
        setPhase("result");
        return;
      }

      // เช็ค Priority
      if (qrCode.startsWith("PG-") || qrCode.startsWith("TCK-")) {
        const { data: priority } = await supabase
          .from("priority_tickets")
          .select("*, profiles(display_name, username, avatar_url), events(title, date)")
          .eq("qr_code", qrCode)
          .single();

        if (!priority) throw new Error("ไม่พบ QR Code นี้ในระบบ");
        if (priority.status !== "approved") throw new Error("บัตรยังไม่ได้รับการอนุมัติ");

        setResult({
          type: "priority",
          ticketId: priority.id,
          user: {
            name: (priority.profiles as any)?.display_name ?? (priority.profiles as any)?.username ?? "Unknown",
            avatar: ((priority.profiles as any)?.display_name ?? "?")[0].toUpperCase(),
            qr_code: qrCode,
          },
          event: {
            title: (priority.events as any)?.title ?? "—",
            date: (priority.events as any)?.date ?? "",
          },
          status: priority.status,
          free_pack_redeemed: priority.free_pack_redeemed,
          price_pack_quota: priority.price_pack_quota,
          price_pack_used: priority.price_pack_used,
          ma5_slot: priority.ma5_slot,
        });
        setPhase("result");
        return;
      }

      throw new Error("QR Code ไม่ถูกต้อง");
    } catch (err: any) {
      setError(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function redeemFreePack() {
    if (!result || result.type !== "priority") return;
    setRedeeming("free");
    const { error: err } = await supabase
      .from("priority_tickets")
      .update({ free_pack_redeemed: true })
      .eq("id", result.ticketId);
    if (!err) {
      setResult({ ...result, free_pack_redeemed: true });
      setRedeemSuccess("✅ รับ M2 ฟรีแล้ว!");
      setTimeout(() => setRedeemSuccess(null), 2000);
    }
    setRedeeming(null);
  }

  async function redeemPricePack() {
    if (!result || result.type !== "priority") return;
    if ((result.price_pack_used ?? 0) >= (result.price_pack_quota ?? 5)) return;
    setRedeeming("price");
    const newUsed = (result.price_pack_used ?? 0) + 1;
    const { error: err } = await supabase
      .from("priority_tickets")
      .update({ price_pack_used: newUsed })
      .eq("id", result.ticketId);
    if (!err) {
      setResult({ ...result, price_pack_used: newUsed });
      setRedeemSuccess(`✅ ใช้สิทธิ์ซื้อ Pack ${newUsed}/${result.price_pack_quota} แล้ว`);
      setTimeout(() => setRedeemSuccess(null), 2000);
    }
    setRedeeming(null);
  }

  async function redeemGeneralPack() {
    if (!result || result.type !== "general") return;
    setRedeeming("general");
    const { error: err } = await supabase
      .from("general_registrations")
      .update({ pack_used: 1 })
      .eq("id", result.ticketId);
    if (!err) {
      setResult({ ...result, pack_used: 1 });
      setRedeemSuccess("✅ ใช้สิทธิ์ซื้อ Pack แล้ว!");
      setTimeout(() => setRedeemSuccess(null), 2000);
    }
    setRedeeming(null);
  }

  async function startMa5() {
    if (!result || result.type !== "priority") return;
    setPhase("ma5");
    setMa5Flipped(false);
    setMa5Result(null);
    setMa5Animating(false);
  }

  async function flipCard() {
    if (ma5Animating) return;
    setMa5Animating(true);

    // สุ่มผล
    const { data: slotsData } = await supabase
      .from("priority_tickets")
      .select("id", { count: "exact", head: true })
      .eq("ma5_slot", true)
      .eq("event_id", result?.event.title);

    // นับ slots ที่ใช้ไปแล้ว
    const { count: usedSlots } = await supabase
      .from("priority_tickets")
      .select("*", { count: "exact", head: true })
      .eq("ma5_slot", true);

    const { count: totalChecked } = await supabase
      .from("priority_tickets")
      .select("*", { count: "exact", head: true })
      .not("ma5_slot", "is", null);

    const remaining = 24 - (usedSlots ?? 0);
    const remainingPeople = 100 - (totalChecked ?? 0);
    const won = remaining > 0 && Math.random() < remaining / Math.max(remainingPeople, 1);

    // บันทึกผล
    await supabase
      .from("priority_tickets")
      .update({ ma5_slot: won })
      .eq("id", result!.ticketId);

    setTimeout(() => {
      setMa5Flipped(true);
      setTimeout(() => {
        setMa5Result(won);
        setMa5Animating(false);
        if (result) setResult({ ...result, ma5_slot: won });
      }, 600);
    }, 1500);
  }

  function reset() {
    setPhase("scan");
    setResult(null);
    setError("");
    setMa5Flipped(false);
    setMa5Result(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <style>{`
        .card-container { perspective: 1000px; }
        .card-inner {
          position: relative; width: 200px; height: 280px;
          transition: transform 1s cubic-bezier(0.4,0,0.2,1);
          transform-style: preserve-3d;
        }
        .card-inner.flipped { transform: rotateY(180deg); }
        .card-face {
          position: absolute; width: 100%; height: 100%;
          border-radius: 16px; backface-visibility: hidden;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        .card-back {
          background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
          border: 2px solid rgba(255,215,0,0.3);
          cursor: pointer;
        }
        .card-front { transform: rotateY(180deg); }
        @keyframes shake {
          0%,100%{transform:translateX(0) rotateY(0)}
          20%{transform:translateX(-6px) rotateY(-4deg)}
          40%{transform:translateX(6px) rotateY(4deg)}
          60%{transform:translateX(-3px) rotateY(-2deg)}
          80%{transform:translateX(3px) rotateY(2deg)}
        }
        .shaking { animation: shake 0.4s ease-in-out 3; }
        @keyframes win-pulse {
          0%,100%{box-shadow:0 0 30px rgba(255,215,0,0.4)}
          50%{box-shadow:0 0 80px rgba(255,215,0,0.9),0 0 120px rgba(255,215,0,0.4)}
        }
        .win-glow { animation: win-pulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-sm">📷</div>
        <div>
          <p className="text-sm font-bold">Staff Scanner</p>
          <p className="text-[10px] text-zinc-400">The Cardlist Event</p>
        </div>
        {phase !== "scan" && (
          <button onClick={reset} className="ml-auto text-xs text-zinc-400 border border-zinc-700 rounded-lg px-3 py-1.5">
            สแกนใหม่
          </button>
        )}
      </div>

      {/* ── PHASE: SCAN ── */}
      {phase === "scan" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          {/* QR Reader */}
          <div id="qr-reader" className="w-full max-w-xs rounded-2xl overflow-hidden mb-6" style={{ minHeight: scanning ? 300 : 0 }} />

          {!scanning && !loading && (
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">📷</div>
              <p className="text-sm font-semibold mb-1">สแกน QR Code บัตรเข้างาน</p>
              <p className="text-[11px] text-zinc-400">รองรับ General และ Priority Guest</p>
            </div>
          )}

          {loading && (
            <div className="text-center mb-6">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-400">กำลังค้นหาข้อมูล...</p>
            </div>
          )}

          {error && (
            <div className="w-full max-w-xs bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4 text-center">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {!scanning && !loading && (
            <button onClick={startScanner}
              className="w-full max-w-xs py-3.5 bg-white text-zinc-900 font-bold text-sm rounded-2xl">
              เปิดกล้องสแกน QR
            </button>
          )}

          {scanning && (
            <button onClick={stopScanner}
              className="w-full max-w-xs py-3 border border-zinc-700 text-zinc-300 text-sm rounded-2xl mt-4">
              ยกเลิก
            </button>
          )}
        </div>
      )}

      {/* ── PHASE: RESULT ── */}
      {phase === "result" && result && (
        <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
          {redeemSuccess && (
            <div className="bg-green-900 border border-green-700 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-semibold text-green-300">{redeemSuccess}</p>
            </div>
          )}

          {/* User card */}
          <div className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0 ${result.type === "priority" ? "bg-amber-500 text-zinc-900" : "bg-zinc-700 text-white"}`}>
              {result.user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate">{result.user.name}</p>
              <p className="text-[11px] text-zinc-400 truncate">{result.event.title}</p>
              <div className="flex items-center gap-2 mt-1">
                {result.type === "general" ? (
                  <span className="text-[9px] bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full font-semibold">GENERAL</span>
                ) : (
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">🥇 PRIORITY GUEST</span>
                )}
              </div>
            </div>
          </div>

          {/* ── General สิทธิ์ ── */}
          {result.type === "general" && (
            <div className="bg-zinc-900 rounded-2xl p-4">
              <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-3">สิทธิ์</p>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏷️</span>
                  <div>
                    <p className="text-sm font-semibold">ซื้อ Pokemon ราคาป้าย</p>
                    <p className="text-[10px] text-zinc-400">M1 / M2 / M3 / M4 / M5 · 1 ซอง</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${(result.pack_used ?? 0) >= 1 ? "bg-red-900 text-red-400" : "bg-green-900 text-green-400"}`}>
                  {(result.pack_used ?? 0) >= 1 ? "ใช้แล้ว" : "ยังไม่ใช้"}
                </span>
              </div>
              <button
                onClick={redeemGeneralPack}
                disabled={redeeming === "general" || (result.pack_used ?? 0) >= 1}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-opacity ${(result.pack_used ?? 0) >= 1 ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-white text-zinc-900 hover:bg-zinc-100"} ${redeeming === "general" ? "opacity-50" : ""}`}>
                {(result.pack_used ?? 0) >= 1 ? "ใช้สิทธิ์ไปแล้ว" : redeeming === "general" ? "กำลังบันทึก..." : "✓ Redeem สิทธิ์ซื้อ Pack"}
              </button>
            </div>
          )}

          {/* ── Priority สิทธิ์ ── */}
          {result.type === "priority" && (
            <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase">สิทธิ์ทั้งหมด</p>

              {/* Free pack */}
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎁</span>
                  <div>
                    <p className="text-xs font-semibold">Pokemon M2 (JP) ฟรี</p>
                    <p className="text-[10px] text-zinc-400">1 ซอง</p>
                  </div>
                </div>
                {result.free_pack_redeemed ? (
                  <span className="text-[10px] bg-red-900 text-red-400 px-2 py-1 rounded-full font-semibold">รับแล้ว</span>
                ) : (
                  <button onClick={redeemFreePack} disabled={redeeming === "free"}
                    className="text-[10px] bg-green-600 text-white px-3 py-1.5 rounded-full font-bold disabled:opacity-50">
                    {redeeming === "free" ? "..." : "Redeem"}
                  </button>
                )}
              </div>

              {/* Price pack */}
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏷️</span>
                  <div>
                    <p className="text-xs font-semibold">ซื้อ M1/M3/M4 ราคาป้าย</p>
                    <p className="text-[10px] text-zinc-400">{result.price_pack_used}/{result.price_pack_quota} ซอง</p>
                  </div>
                </div>
                {(result.price_pack_used ?? 0) >= (result.price_pack_quota ?? 5) ? (
                  <span className="text-[10px] bg-red-900 text-red-400 px-2 py-1 rounded-full font-semibold">ครบแล้ว</span>
                ) : (
                  <button onClick={redeemPricePack} disabled={redeeming === "price"}
                    className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-full font-bold disabled:opacity-50">
                    {redeeming === "price" ? "..." : `+1 ซอง`}
                  </button>
                )}
              </div>

              {/* MA5 */}
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎲</span>
                  <div>
                    <p className="text-xs font-semibold">ลุ้น MA5 Box</p>
                    <p className="text-[10px] text-zinc-400">สุ่มหน้าจอใหญ่</p>
                  </div>
                </div>
                {result.ma5_slot === true && (
                  <span className="text-[10px] bg-yellow-900 text-yellow-400 px-2 py-1 rounded-full font-semibold">✅ ได้สิทธิ์!</span>
                )}
                {result.ma5_slot === false && (
                  <span className="text-[10px] bg-red-900 text-red-400 px-2 py-1 rounded-full font-semibold">❌ ไม่ได้</span>
                )}
                {result.ma5_slot === null && (
                  <button onClick={startMa5}
                    className="text-[10px] bg-yellow-500 text-zinc-900 px-3 py-1.5 rounded-full font-bold">
                    ลุ้นเลย!
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE: MA5 FLIP CARD ── */}
      {phase === "ma5" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center"
          style={{ background: "linear-gradient(135deg, #0a0a0f, #0f0f1a)" }}>
          <p className="text-[10px] text-yellow-400 tracking-widest uppercase mb-2 font-semibold">ลุ้นสิทธิ์</p>
          <p className="text-xl font-black mb-2">{result?.user.name}</p>
          <p className="text-xs text-zinc-400 mb-8">กดการ์ดเพื่อลุ้น MA5 Box</p>

          <div className="card-container mb-8">
            <div className={`card-inner ${ma5Flipped ? "flipped" : ""} ${ma5Animating && !ma5Flipped ? "shaking" : ""}`}
              onClick={!ma5Flipped && !ma5Animating ? flipCard : undefined}
              style={{ cursor: !ma5Flipped && !ma5Animating ? "pointer" : "default" }}>

              {/* Back */}
              <div className="card-face card-back">
                <div style={{ fontSize: 64, marginBottom: 12 }}>🃏</div>
                <p style={{ fontSize: 11, color: "rgba(255,215,0,0.7)", letterSpacing: 3, textTransform: "uppercase" }}>
                  {ma5Animating ? "กำลังสุ่ม..." : "กดเพื่อเปิด"}
                </p>
              </div>

              {/* Front */}
              <div className={`card-face card-front ${ma5Result === true ? "win-glow" : ""}`}
                style={{
                  background: ma5Result === true
                    ? "linear-gradient(135deg, #1a1200, #2d2200)"
                    : "linear-gradient(135deg, #0d0d0d, #1a1a1a)",
                  border: ma5Result === true
                    ? "2px solid #FFD700"
                    : "2px solid rgba(255,255,255,0.1)",
                }}>
                {ma5Result === true ? (
                  <>
                    <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
                    <p style={{ fontSize: 20, fontWeight: 900, color: "#FFD700", marginBottom: 4 }}>ได้สิทธิ์!</p>
                    <p style={{ fontSize: 10, color: "rgba(255,215,0,0.6)", letterSpacing: 2 }}>MA5 BOX · ราคาป้าย</p>
                  </>
                ) : ma5Result === false ? (
                  <>
                    <div style={{ fontSize: 48, marginBottom: 8, filter: "grayscale(1)" }}>🎴</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>เสียใจด้วย</p>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 2 }}>BETTER LUCK NEXT TIME</p>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {!ma5Flipped && !ma5Animating && (
            <button onClick={flipCard}
              className="px-10 py-3.5 rounded-2xl font-black text-sm"
              style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#1a1a1a" }}>
              🎲 เปิดการ์ดเลย!
            </button>
          )}

          {ma5Result !== null && (
            <button onClick={() => { setPhase("result"); }}
              className="mt-6 px-8 py-3 border border-zinc-700 text-zinc-300 text-sm rounded-2xl">
              กลับหน้าสิทธิ์
            </button>
          )}
        </div>
      )}
    </div>
  );
}
