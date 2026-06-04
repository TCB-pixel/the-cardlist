"use client";
import { useState, useEffect, useRef } from "react";

type ScanResult = {
  type: "general" | "priority";
  user: { name: string; avatar: string; qr_code: string };
  event: { title: string; date: string };
  pack_used?: number;
  free_pack_redeemed?: boolean;
  free_pack_quota?: number;
  free_pack_used?: number;
  ma5_slot?: boolean | null;
  status?: string;
  ticketId: string;
};

type Phase = "scan" | "result" | "ma5";

export default function StaffScannerPage() {
  const scannerRef = useRef<any>(null);
  const [phase, setPhase] = useState<Phase>("scan");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [ma5Flipped, setMa5Flipped] = useState(false);
  const [ma5Result, setMa5Result] = useState<boolean | null>(null);
  const [ma5Animating, setMa5Animating] = useState(false);

  useEffect(() => { return () => { stopScanner(); }; }, []);

  async function startScanner() {
    setError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (text: string) => {
          await scanner.stop();
          scannerRef.current = null;
          setScanning(false);
          await lookupQR(text.trim());
        },
        undefined
      );
    } catch {
      setScanning(false);
      setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง");
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
    if (!qrCode) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/scan?qr=${encodeURIComponent(qrCode)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เกิดข้อผิดพลาด");

      const d = json.data;
      if (json.type === "general") {
        setResult({
          type: "general",
          ticketId: d.id,
          user: {
            name: d.profiles?.display_name ?? d.profiles?.username ?? "Unknown",
            avatar: (d.profiles?.display_name ?? "?")[0]?.toUpperCase() ?? "?",
            qr_code: qrCode,
          },
          event: { title: d.events?.title ?? "—", date: d.events?.date ?? "" },
          pack_used: d.pack_used ?? 0,
        });
      } else {
        setResult({
          type: "priority",
          ticketId: d.id,
          user: {
            name: d.profiles?.display_name ?? d.profiles?.username ?? "Unknown",
            avatar: (d.profiles?.display_name ?? "?")[0]?.toUpperCase() ?? "?",
            qr_code: qrCode,
          },
          event: { title: d.events?.title ?? "—", date: d.events?.date ?? "" },
          status: d.status,
          free_pack_redeemed: d.free_pack_redeemed,
          free_pack_quota: d.free_pack_quota ?? 5,
          free_pack_used: d.free_pack_used ?? 0,
          ma5_slot: d.ma5_slot,
        });
      }
      setPhase("result");
    } catch (err: any) {
      setError(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function redeem(field: string, value: any) {
    if (!result) return;
    setRedeeming(field);
    const res = await fetch("/api/admin/scan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: result.ticketId, type: result.type, field, value }),
    });
    if (res.ok) {
      setResult({ ...result, [field]: value } as ScanResult);
      const msgs: Record<string, string> = {
        pack_used: "✅ ใช้สิทธิ์ซื้อ Pack แล้ว!",
        free_pack_redeemed: "✅ รับ Booster Pack M1-M5 ฟรี 5 ซองแล้ว!",
        free_pack_used: `✅ บันทึกแล้ว`,
      };
      setRedeemSuccess(msgs[field] ?? "✅ บันทึกแล้ว");
      setTimeout(() => setRedeemSuccess(null), 3000);
    }
    setRedeeming(null);
  }

  async function flipCard() {
    if (ma5Animating || ma5Flipped) return;
    setMa5Animating(true);

    const res = await fetch(`/api/admin/scan?qr=${encodeURIComponent(result!.user.qr_code)}`);
    const json = await res.json();
    const usedSlots = 0;
    const won = Math.random() < 24 / 100;

    await fetch("/api/admin/scan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: result!.ticketId, type: "priority", field: "ma5_slot", value: won }),
    });

    setTimeout(() => {
      setMa5Flipped(true);
      setTimeout(() => {
        setMa5Result(won);
        setMa5Animating(false);
        if (result) setResult({ ...result, ma5_slot: won });
      }, 700);
    }, 1800);
  }

  function reset() {
    setPhase("scan"); setResult(null); setError(""); setManualCode("");
    setMa5Flipped(false); setMa5Result(null); setMa5Animating(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <style>{`
        #qr-reader { border-radius:16px; overflow:hidden; }
        #qr-reader video { border-radius:16px; }
        .card-container{perspective:1000px;width:200px;height:280px;}
        .card-inner{position:relative;width:100%;height:100%;transition:transform 1s cubic-bezier(.4,0,.2,1);transform-style:preserve-3d;}
        .card-inner.flipped{transform:rotateY(180deg);}
        .card-face{position:absolute;width:100%;height:100%;border-radius:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;}
        .card-back{background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);border:2px solid rgba(255,215,0,.3);cursor:pointer;}
        .card-front{transform:rotateY(180deg);}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px) rotateY(-5deg)}40%{transform:translateX(8px) rotateY(5deg)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
        .shaking{animation:shake .4s ease-in-out 3;}
        @keyframes win-glow{0%,100%{box-shadow:0 0 30px rgba(255,215,0,.4)}50%{box-shadow:0 0 80px rgba(255,215,0,.9)}}
        .win-card{animation:win-glow 1.5s ease-in-out infinite;}
      `}</style>

      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <span className="text-lg">📷</span>
        <div className="flex-1">
          <p className="text-sm font-bold">Staff Scanner</p>
          <p className="text-[10px] text-zinc-400">The Cardlist Event Check-in</p>
        </div>
        {phase !== "scan" && (
          <button onClick={reset} className="text-xs text-zinc-400 border border-zinc-700 rounded-lg px-3 py-1.5">← สแกนใหม่</button>
        )}
      </div>

      {/* SCAN */}
      {phase === "scan" && (
        <div className="flex-1 flex flex-col items-center px-5 py-6">
          <div id="qr-reader" className="w-full max-w-xs mb-4" />
          {!scanning && !loading && (
            <>
              <div className="text-center mb-5">
                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">📷</div>
                <p className="text-sm font-semibold">สแกน QR Code บัตรเข้างาน</p>
                <p className="text-[11px] text-zinc-400 mt-1">รองรับ General (GEN-) และ Priority (PG-)</p>
              </div>
              <button onClick={startScanner} className="w-full max-w-xs py-3.5 bg-white text-zinc-900 font-bold text-sm rounded-2xl mb-3">
                📷 เปิดกล้องสแกน
              </button>
              <div className="w-full max-w-xs">
                <p className="text-[10px] text-zinc-500 text-center mb-2">หรือพิมพ์รหัสด้วยตนเอง</p>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none"
                    placeholder="GEN-... หรือ PG-..." value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && lookupQR(manualCode.trim())} />
                  <button onClick={() => lookupQR(manualCode.trim())} className="bg-zinc-700 text-white px-4 rounded-xl text-sm font-semibold">ค้นหา</button>
                </div>
              </div>
            </>
          )}
          {scanning && <button onClick={stopScanner} className="w-full max-w-xs py-3 border border-zinc-700 text-zinc-300 text-sm rounded-2xl mt-3">ยกเลิก</button>}
          {loading && <div className="text-center py-6"><div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-zinc-400">กำลังค้นหา...</p></div>}
          {error && <div className="w-full max-w-xs bg-red-950 border border-red-800 rounded-xl px-4 py-3 mt-3 text-center"><p className="text-xs text-red-300">{error}</p></div>}
        </div>
      )}

      {/* RESULT */}
      {phase === "result" && result && (
        <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto pb-10">
          {redeemSuccess && <div className="bg-green-900/60 border border-green-700 rounded-xl px-4 py-3 text-center"><p className="text-sm font-semibold text-green-300">{redeemSuccess}</p></div>}
          <div className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0 ${result.type === "priority" ? "bg-amber-500 text-zinc-900" : "bg-zinc-700"}`}>
              {result.user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{result.user.name}</p>
              <p className="text-[11px] text-zinc-400 truncate">{result.event.title}</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${result.type === "general" ? "bg-zinc-700 text-zinc-300" : "bg-amber-500/20 text-amber-400"}`}>
                {result.type === "general" ? "GENERAL" : "🥇 PRIORITY GUEST"}
              </span>
            </div>
          </div>

          {result.type === "general" && (
            <div className="bg-zinc-900 rounded-2xl p-4">
              <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mb-3">สิทธิ์</p>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl mb-3">
                <div className="flex items-center gap-3"><span>🏷️</span><div><p className="text-xs font-semibold">ซื้อ Pokemon ราคาป้าย</p><p className="text-[10px] text-zinc-400">M1–M5 · 1 ซอง</p></div></div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${(result.pack_used ?? 0) >= 1 ? "bg-red-900 text-red-400" : "bg-green-900 text-green-400"}`}>
                  {(result.pack_used ?? 0) >= 1 ? "ใช้แล้ว" : "ยังไม่ใช้"}
                </span>
              </div>
              <button onClick={() => redeem("pack_used", 1)} disabled={redeeming === "pack_used" || (result.pack_used ?? 0) >= 1}
                className={`w-full py-3 rounded-xl text-sm font-bold ${(result.pack_used ?? 0) >= 1 ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-white text-zinc-900"} disabled:opacity-50`}>
                {(result.pack_used ?? 0) >= 1 ? "ใช้สิทธิ์ไปแล้ว ✓" : redeeming === "pack_used" ? "กำลังบันทึก..." : "✓ Redeem สิทธิ์"}
              </button>
            </div>
          )}

          {result.type === "priority" && (
            <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase">สิทธิ์ทั้งหมด</p>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-2"><span>🎁</span><p className="text-xs font-semibold">M2 (JP) ฟรี 1 ซอง</p></div>
                {result.free_pack_redeemed ? (
                  <span className="text-[10px] bg-red-900 text-red-400 px-2 py-1 rounded-full font-semibold">รับแล้ว ✓</span>
                ) : (
                  <button onClick={() => redeem("free_pack_redeemed", true)} disabled={redeeming === "free_pack_redeemed"}
                    className="text-[10px] bg-green-600 text-white px-3 py-1.5 rounded-full font-bold disabled:opacity-50">
                    {redeeming === "free_pack_redeemed" ? "..." : "Redeem"}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-2"><span>🏷️</span><div><p className="text-xs font-semibold">ซื้อ M1/M3/M4 ราคาป้าย</p><p className="text-[10px] text-zinc-400">{result.free_pack_used}/{result.free_pack_quota} ซอง</p></div></div>
                {(result.free_pack_used ?? 0) >= (result.free_pack_quota ?? 5) ? (
                  <span className="text-[10px] bg-red-900 text-red-400 px-2 py-1 rounded-full font-semibold">ครบแล้ว</span>
                ) : (
                  <button onClick={() => redeem("free_pack_used", (result.free_pack_used ?? 0) + 1)} disabled={redeeming === "free_pack_used"}
                    className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-full font-bold disabled:opacity-50">
                    {redeeming === "free_pack_used" ? "..." : "+1 ซอง"}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-2"><span>🎲</span><p className="text-xs font-semibold">ลุ้น MA5 Box</p></div>
                {result.ma5_slot === true && <span className="text-[10px] bg-yellow-900 text-yellow-400 px-2 py-1 rounded-full font-semibold">✅ ได้สิทธิ์!</span>}
                {result.ma5_slot === false && <span className="text-[10px] bg-zinc-700 text-zinc-400 px-2 py-1 rounded-full font-semibold">❌ ไม่ได้</span>}
                {(result.ma5_slot === null || result.ma5_slot === undefined) && (
                  <button onClick={() => { setPhase("ma5"); setMa5Flipped(false); setMa5Result(null); }}
                    className="text-[10px] bg-yellow-500 text-zinc-900 px-3 py-1.5 rounded-full font-bold">ลุ้นเลย! 🎲</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MA5 */}
      {phase === "ma5" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center" style={{background:"linear-gradient(135deg,#0a0a0f,#0f0f1a)"}}>
          <p className="text-[10px] text-yellow-400 tracking-widest uppercase font-semibold mb-1">ลุ้นสิทธิ์ MA5 Box</p>
          <p className="text-xl font-black mb-1">{result?.user.name}</p>
          <p className="text-xs text-zinc-500 mb-8">กดการ์ดหรือปุ่มด้านล่างเพื่อลุ้น</p>
          <div className="card-container mx-auto mb-8" onClick={!ma5Flipped && !ma5Animating ? flipCard : undefined}>
            <div className={`card-inner ${ma5Flipped ? "flipped" : ""} ${ma5Animating && !ma5Flipped ? "shaking" : ""}`}>
              <div className="card-face card-back">
                <div style={{fontSize:60,marginBottom:12}}>🃏</div>
                <p style={{fontSize:10,color:"rgba(255,215,0,.7)",letterSpacing:3}}>{ma5Animating ? "กำลังสุ่ม..." : "TAP TO FLIP"}</p>
              </div>
              <div className={`card-face card-front ${ma5Result === true ? "win-card" : ""}`}
                style={{background:ma5Result===true?"linear-gradient(135deg,#1a1200,#2d2200)":"linear-gradient(135deg,#111,#1a1a1a)",border:ma5Result===true?"2px solid #FFD700":"2px solid rgba(255,255,255,.1)"}}>
                {ma5Result===true?(<><div style={{fontSize:52,marginBottom:8}}>🏆</div><p style={{fontSize:22,fontWeight:900,color:"#FFD700",marginBottom:4}}>ได้สิทธิ์!</p><p style={{fontSize:10,color:"rgba(255,215,0,.6)",letterSpacing:2}}>MA5 BOX · ราคาป้าย</p></>)
                :ma5Result===false?(<><div style={{fontSize:44,marginBottom:8,filter:"grayscale(1)"}}>🎴</div><p style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,.4)"}}>เสียใจด้วย</p><p style={{fontSize:9,color:"rgba(255,255,255,.2)",letterSpacing:2}}>BETTER LUCK NEXT TIME</p></>):null}
              </div>
            </div>
          </div>
          {!ma5Flipped && !ma5Animating && (
            <button onClick={flipCard} className="px-10 py-3.5 rounded-2xl font-black text-sm mb-4" style={{background:"linear-gradient(135deg,#FFD700,#FFA500)",color:"#1a1a1a"}}>
              🎲 เปิดการ์ดเลย!
            </button>
          )}
          {ma5Result !== null && <button onClick={() => setPhase("result")} className="mt-2 px-8 py-3 border border-zinc-700 text-zinc-300 text-sm rounded-2xl">กลับหน้าสิทธิ์ →</button>}
          <button onClick={reset} className="mt-3 text-xs text-zinc-600 underline">สแกนคนใหม่</button>
        </div>
      )}
    </div>
  );
}
