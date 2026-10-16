"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PassportQR from "@/components/passport/PassportQR";
import Stamp from "@/components/passport/Stamp";
import Scanner from "@/components/passport/Scanner";
import Confetti, { vibrate } from "@/components/passport/Confetti";

type State = {
  passport: { code: string; kind: "card" | "free"; isTest: boolean } | null;
  price: number;
  events: { id: string; slug: string; name: string; venue: string | null; startsOn: string; endsOn: string; today: boolean;
    stations: { id: string; name: string; stampedAt: string | null }[] }[];
  learn: { id: string; name: string; logo: string | null; stampedAt: string | null }[];
  packsUnopened: number;
  rewards: { track: string; tier: string; name: string; color: string; left: number; total: number }[];
  wallet: { id: string; kind: string; status: string; tier: string; name: string; color: string; needsPayment: boolean; redeemedAt: string | null }[];
  redeemToken: string | null;
};
type Reveal = { tier: string; name: string; color: string };

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function dateRange(a: string, b: string) {
  const [, am, ad] = a.split("-").map(Number), [, bm, bd] = b.split("-").map(Number);
  return am === bm ? `${ad}–${bd} ${TH_MONTH[bm - 1]}` : `${ad} ${TH_MONTH[am - 1]}–${bd} ${TH_MONTH[bm - 1]}`;
}
const HIGH = ["SUPER RARE", "EPIC", "LEGENDARY"];

export default function PassportPage() {
  const [s, setS] = useState<State | null>(null);
  const [tab, setTab] = useState<"P" | "L">("P");
  const [view, setView] = useState<"home" | "wallet">("home");
  const [scan, setScan] = useState(false);
  const [msg, setMsg] = useState("");
  const [pack, setPack] = useState<{ phase: "idle" | "tear" | "suspense" | "reveal"; reveal?: Reveal } | null>(null);
  const [boom, setBoom] = useState(0);

  const load = useCallback(async () => {
    const test = new URLSearchParams(window.location.search).get("test") === "1" ? "?test=1" : "";
    const r = await fetch("/api/passport/me" + test, { cache: "no-store" });
    if (r.ok) setS(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  // หน้า "รางวัลของฉัน": QR เปลี่ยนทุก 60 วินาที + เห็นสถานะ "แลกแล้ว" ทันทีที่พนักงานยืนยัน
  useEffect(() => {
    if (view !== "wallet") return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [view, load]);

  function onScan(text: string) {
    setScan(false);
    try {
      const u = new URL(text);
      if (u.origin === window.location.origin && u.pathname.startsWith("/passport/")) { window.location.href = u.pathname + u.search; return; }
    } catch {}
    setMsg("QR นี้ไม่ใช่ของ CARDLIST PASSPORT");
  }

  async function openPack() {
    setPack({ phase: "tear" });
  }
  async function tear() {
    setPack({ phase: "suspense" });
    vibrate(30);
    const r = await fetch("/api/passport/pack", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setPack(null);
      setMsg(j.error === "pool_empty" ? "ของรางวัลหมดแล้ว — ติดต่อพนักงานที่บูธ The Cardlist" : "ฉีกซองไม่สำเร็จ ลองอีกครั้ง");
      return;
    }
    const high = HIGH.includes(j.tier);
    if (high) vibrate([40, 60, 40]);
    setTimeout(() => {
      setPack({ phase: "reveal", reveal: j });
      if (j.tier === "EPIC" || j.tier === "LEGENDARY") { setBoom((b) => b + 1); vibrate([60, 40, 140]); }
      load();
    }, high ? 2200 : 700);
  }

  if (!s) return <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-500">กำลังโหลด…</div>;

  const p = s.passport;
  const totalP = s.events.reduce((a, e) => a + e.stations.length, 0);
  const gotP = s.events.reduce((a, e) => a + e.stations.filter((x) => x.stampedAt).length, 0);
  const gotL = s.learn.filter((x) => x.stampedAt).length;
  const pending = s.wallet.filter((w) => w.status === "pending");
  const packRewards = s.rewards.filter((r) => r.track === "passport");

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-5">
      <Confetti fire={boom} />
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2"><img src="/images/passport/c-mark.png" alt="The Cardlist" className="h-8 w-8 object-contain" /></Link>
        {p && <span className="font-mono text-[11px] tracking-[0.15em] text-[var(--hi)]">{p.code}{p.isTest ? " · TEST" : ""}</span>}
      </header>

      {msg && <div className="pp-fade mb-3 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-200" onClick={() => setMsg("")}>{msg}</div>}
      {scan && <div className="mb-4"><Scanner onResult={onScan} onClose={() => setScan(false)} /></div>}

      {view === "wallet" && p ? (
        <section className="pp-fade">
          <h1 className="text-center text-lg font-semibold text-white">รางวัลของฉัน</h1>
          <p className="mb-3 text-center text-xs text-zinc-400">ยื่นหน้าจอนี้ให้พนักงานบูธ The Cardlist</p>
          {s.redeemToken && (
            <div className="flex flex-col items-center">
              <PassportQR value={s.redeemToken} size={190} />
              <div className="mt-2 h-[3px] w-[206px] overflow-hidden rounded bg-zinc-800"><div key={s.redeemToken} className="pp-drain h-full bg-[var(--gold)]" style={{ animationDuration: "60s" }} /></div>
              <p className="mt-1 text-[11px] text-zinc-500">QR เปลี่ยนทุก 60 วินาที · แคปหน้าจอไปใช้ไม่ได้</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {s.wallet.length === 0 && <p className="text-center text-sm text-zinc-500">ยังไม่มีรางวัล — สะสมแสตมป์ให้ครบก่อน</p>}
            {s.wallet.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900 px-3 py-3">
                <div className="min-w-0">
                  <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: w.color + "33", color: w.color }}>{w.tier}</span>
                  <p className="mt-1 text-sm text-white">{w.name}</p>
                  {w.needsPayment && w.status === "pending" && <p className="text-[11px] text-amber-300">สิทธิ์ซื้อราคาป้าย — ชำระที่บูธตอนรับของ</p>}
                </div>
                <span className={`shrink-0 text-xs ${w.status === "redeemed" ? "text-green-400" : "text-[var(--hi)]"}`}>{w.status === "redeemed" ? "แลกแล้ว ✓" : "รอแลก"}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setView("home")} className="mt-5 w-full rounded-xl border border-[var(--gold)] py-3 text-sm text-[var(--hi)]">กลับ Passport</button>
        </section>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1">
            {(["P", "L"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-lg py-2 font-cardlist text-[11px] tracking-[0.08em] ${tab === t ? "bg-[var(--gold)] text-[var(--night)]" : "text-zinc-400"}`}>
                {t === "P" ? "PASSPORT" : "LEARN TO PLAY"}
                <span className="block font-sans text-[10px] tracking-normal">{t === "P" ? (p?.kind === "card" ? `${gotP}/${totalP}` : `${s.price} บาท`) : `${gotL}/${s.learn.length} · ฟรี`}</span>
              </button>
            ))}
          </div>

          {tab === "P" ? (
            <section className="pp-fade">
              <div className="pp-foil mb-4 rounded-2xl border border-[#3a3020] bg-[#1b1712] p-4">
                <div className="relative">
                  <p className="font-cardlist text-xs tracking-[0.1em] text-white">THE CARDLIST</p>
                  <p className="font-cardlist text-4xl leading-none tracking-[0.06em] text-[var(--hi)]">PASSPORT</p>
                  <p className="mt-1 text-[11px] text-zinc-400">สะสมแสตมป์ 3 งาน · ครบทุกจุดในงาน = ฉีกซองลุ้น 1 ซอง</p>
                </div>
              </div>

              {p?.kind !== "card" ? (
                <div className="rounded-2xl bg-zinc-900 p-4 text-center">
                  <p className="text-sm text-white">ซื้อการ์ด CARDLIST PASSPORT</p>
                  <p className="my-1 font-cardlist text-3xl text-white">{s.price} <span className="font-sans text-sm text-zinc-400">บาท</span></p>
                  <p className="mb-3 text-xs text-zinc-400">ที่บูธ The Cardlist ในงาน แล้วสแกน QR บนการ์ดเพื่อเปิดใช้</p>
                  <button onClick={() => setScan(true)} className="w-full rounded-xl bg-[var(--gold)] py-3 text-sm font-semibold text-[var(--night)]">สแกนการ์ด Passport</button>
                  {p?.kind === "free" && <p className="mt-2 text-[11px] text-zinc-500">แสตมป์ Learn To Play ที่มีอยู่จะย้ายเข้าการ์ดให้อัตโนมัติ</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {s.events.map((ev) => {
                    const n = ev.stations.filter((x) => x.stampedAt).length;
                    return (
                      <div key={ev.id} className={!ev.today && n === 0 ? "opacity-50" : ""}>
                        <div className="mb-1.5 flex items-baseline justify-between text-sm">
                          <span className="text-white">{ev.name}{ev.today && <span className="ml-2 rounded bg-[var(--gold)]/20 px-1.5 text-[10px] text-[var(--hi)]">วันนี้</span>}</span>
                          <span className={n === ev.stations.length && n > 0 ? "text-[var(--hi)]" : "text-zinc-500"}>{n}/{ev.stations.length}</span>
                        </div>
                        <p className="mb-2 text-[11px] text-zinc-500">{dateRange(ev.startsOn, ev.endsOn)} · {ev.venue}</p>
                        <div className="grid grid-cols-4 gap-2">
                          {ev.stations.map((st, i) => st.stampedAt ? (
                            <div key={st.id} className="flex aspect-square items-center justify-center"><Stamp index={i} label={st.name} size={70} /></div>
                          ) : (
                            <div key={st.id} className="flex aspect-square items-center justify-center rounded-full border-[1.5px] border-dashed border-zinc-700 p-1 text-center text-[9px] leading-tight text-zinc-500">{st.name}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 rounded-xl border border-[#3a3020] bg-[#1c1a16] p-3">
                    <div className="flex h-12 w-8 items-center justify-center rounded border border-[var(--gold)] bg-[#2a2318] font-cardlist text-[8px] text-[var(--hi)]">PACK</div>
                    <div className="flex-1"><p className="text-sm text-white">ซองลุ้น {s.packsUnopened} ซอง</p><p className="text-[11px] text-zinc-500">ครบทุกจุดในงาน = ได้ 1 ซอง</p></div>
                    <button disabled={!s.packsUnopened} onClick={openPack} className="rounded-lg bg-[var(--gold)] px-3 py-2 text-xs font-semibold text-[var(--night)] disabled:opacity-40">ฉีกซอง</button>
                  </div>
                  <details className="rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                    <summary className="cursor-pointer text-zinc-300">ของในซองและจำนวนที่เหลือ</summary>
                    <div className="mt-2 space-y-1">
                      {packRewards.map((r) => (
                        <div key={r.tier} className="flex justify-between gap-2"><span style={{ color: r.color }}>{r.tier}</span><span className="flex-1 truncate text-zinc-400">{r.name}</span><span>{r.total ? `${r.left}/${r.total}` : "รอประกาศ"}</span></div>
                      ))}
                      <p className="pt-1 text-[10px] text-zinc-500">ทุกซองได้ของ 1 ชิ้น สุ่มตามจำนวนที่เหลือจริง</p>
                    </div>
                  </details>
                </div>
              )}
            </section>
          ) : (
            <section className="pp-fade">
              <p className="font-cardlist text-[10px] tracking-[0.1em] text-[var(--gold)]">START YOUR GAME JOURNEY</p>
              <p className="font-cardlist text-2xl tracking-[0.06em] text-white">LEARN TO PLAY</p>
              <p className="mb-4 mt-1 text-xs text-zinc-400">ฟรี · เรียนเล่นจบที่โต๊ะ แล้วสแกน QR ของคนสอน · ครบ {s.learn.length} เกม รับ{s.rewards.find((r) => r.track === "learn")?.name ?? "ของรางวัล"} · สะสมข้ามงานได้</p>
              <div className="grid grid-cols-5 gap-1.5">
                {s.learn.map((g) => g.stampedAt ? (
                  <div key={g.id} className="flex aspect-square items-center justify-center rounded-lg border-2 border-[var(--gold)] bg-white p-1">
                    {g.logo ? <img src={g.logo} alt={g.name} className="h-full w-full object-contain" /> : <span className="text-[9px] text-zinc-800">{g.name}</span>}
                  </div>
                ) : (
                  <div key={g.id} className="flex aspect-square items-center justify-center rounded-lg border-[1.5px] border-dashed border-zinc-700 p-1 text-center text-[8px] leading-tight text-zinc-500">{g.name}</div>
                ))}
              </div>
              <div className="mt-2 flex justify-center gap-1.5">{s.learn.map((g) => <span key={g.id} className={`h-1.5 w-6 rounded ${g.stampedAt ? "bg-[var(--gold)]" : "bg-zinc-700"}`} />)}</div>
              <div className={`relative mt-4 rounded-xl bg-[#1c1a16] p-3 ${gotL >= s.learn.length && s.learn.length ? "" : "opacity-50"}`}>
                {gotL >= s.learn.length && s.learn.length > 0 && <div className="pp-shine" />}
                <p className="font-cardlist text-[10px] tracking-[0.1em] text-[var(--gold)]">COMPLETE REWARD</p>
                <p className="text-sm text-white">{s.rewards.find((r) => r.track === "learn")?.name ?? "ของรางวัล"}</p>
                <p className="text-[11px] text-zinc-400">{gotL >= s.learn.length && s.learn.length ? "ปลดล็อกแล้ว — รับที่บูธ The Cardlist" : `เรียนอีก ${s.learn.length - gotL} เกม`}</p>
              </div>
            </section>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={() => setScan(true)} className="rounded-xl border border-zinc-700 py-3 text-sm text-zinc-200">สแกน QR</button>
            <button onClick={() => p ? setView("wallet") : setMsg("ยังไม่มีรางวัล")} className="rounded-xl border border-[var(--gold)] py-3 text-sm text-[var(--hi)]">รางวัลของฉัน{pending.length ? ` (${pending.length})` : ""}</button>
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-zinc-500">
            ไม่ต้องสมัครสมาชิก · เราเก็บแค่รหัสพาสปอร์ตและเวลาที่สแกน ไว้ในเครื่องนี้ (คุกกี้) และในระบบของ The Cardlist ·
            เปลี่ยนมือถือ? สแกน QR บนการ์ดใบเดิมได้เลย
          </p>
        </>
      )}

      {pack && <PackOverlay phase={pack.phase} reveal={pack.reveal} onTear={tear} onClose={() => setPack(null)} left={s.packsUnopened} onAgain={() => setPack({ phase: "tear" })} />}
    </main>
  );
}

function PackOverlay({ phase, reveal, onTear, onClose, left, onAgain }: {
  phase: "idle" | "tear" | "suspense" | "reveal"; reveal?: Reveal; onTear: () => void; onClose: () => void; left: number; onAgain: () => void;
}) {
  const [w, setW] = useState(0);
  const x0 = useRef<number | null>(null);
  useEffect(() => { if (phase === "tear") setW(0); }, [phase]);
  const tc = reveal?.color ?? "#e9d29a";
  const high = reveal && HIGH.includes(reveal.tier);
  const opened = phase !== "tear";

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/95 px-6" style={{ ["--tc" as any]: tc }}>
      <p className="font-cardlist text-lg tracking-[0.08em] text-white">PASSPORT PACK</p>
      <div className="relative my-6 flex h-[340px] w-full items-center justify-center">
        {phase === "reveal" && reveal?.tier === "LEGENDARY" && <div className="pp-rays absolute h-[420px] w-[420px] rounded-full opacity-40" />}
        {phase !== "reveal" && (
          <div className={`pp-foil relative h-[290px] w-[190px] touch-none select-none rounded-xl border border-[#4a3d22] bg-[#1b1712] ${opened ? "pp-open" : ""}`}
            onPointerDown={(e) => { if (phase !== "tear") return; x0.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => { if (x0.current === null) return; const d = Math.max(0, Math.min(190, e.clientX - x0.current)); setW(d); if (d > 140) { x0.current = null; onTear(); } }}
            onPointerUp={() => { if (x0.current !== null) { x0.current = null; setW(0); } }}>
            <div className="pp-lid absolute inset-x-0 top-0 h-11 border-b-2 border-dashed border-[var(--gold)] bg-[#2a2318]" />
            <div className="absolute left-0 top-[42px] h-1 bg-[var(--hi)]" style={{ width: w }} />
            <div className="absolute inset-x-3 bottom-3 top-16 flex flex-col items-center justify-center">
              <img src="/images/passport/c-mark.png" alt="" className="h-14 w-14 object-contain" />
              <p className="mt-3 font-cardlist text-2xl tracking-[0.06em] text-[var(--hi)]">PASSPORT</p>
              <p className="font-cardlist text-sm text-[var(--gold)]">PACK</p>
            </div>
            {phase === "suspense" && <div className="pp-glow absolute inset-0 rounded-xl" />}
          </div>
        )}
        {phase === "reveal" && reveal && (
          <div className={`pp-flipin relative flex h-[265px] w-[190px] flex-col items-center justify-center rounded-xl border-2 bg-zinc-900 p-4 text-center ${high ? "pp-foil" : ""}`} style={{ borderColor: tc }}>
            <p className="relative font-cardlist tracking-[0.06em]" style={{ color: tc, fontSize: reveal.tier.length > 6 ? 18 : 24 }}>{reveal.tier}</p>
            <div className="relative my-3 h-0.5 w-12" style={{ background: tc }} />
            <p className="relative text-sm text-white">{reveal.name}</p>
            <p className="relative mt-3 text-[11px] text-zinc-400">เก็บใน &quot;รางวัลของฉัน&quot; แล้ว</p>
          </div>
        )}
      </div>
      <p className="h-5 text-xs text-[var(--hi)]">{phase === "tear" ? "ลากนิ้วผ่านรอยปรุบนซอง →" : phase === "suspense" ? "…" : ""}</p>
      {phase === "reveal" && (
        <div className="mt-4 grid w-full max-w-xs gap-2">
          {left > 0 && <button onClick={onAgain} className="rounded-xl bg-[var(--gold)] py-3 text-sm font-semibold text-[var(--night)]">ฉีกอีกซอง ({left})</button>}
          <button onClick={onClose} className="rounded-xl border border-[var(--gold)] py-3 text-sm text-[var(--hi)]">กลับ Passport</button>
        </div>
      )}
      {phase === "tear" && <button onClick={onClose} className="mt-6 text-xs text-zinc-500">ไว้ทีหลัง</button>}
    </div>
  );
}
