"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Stamp from "@/components/passport/Stamp";
import Confetti, { vibrate } from "@/components/passport/Confetti";

type Res = {
  ok: boolean; reason?: string; waitSec?: number; already?: boolean;
  station?: { name: string; track: string; logo: string | null }; event?: { name: string } | null;
  count?: number; total?: number; packEarned?: boolean; learnComplete?: boolean;
};

const REASON: Record<string, string> = {
  invalid: "QR นี้ใช้ไม่ได้",
  expired: "QR นี้หมดอายุแล้ว — สแกนป้าย/จอที่จุดอีกครั้ง",
  closed: "ตอนนี้ยังไม่ใช่เวลางาน — สแกนได้ช่วงที่งานเปิดเท่านั้น",
  need_card: "จุดนี้เป็นแสตมป์ CARDLIST PASSPORT — ซื้อการ์ดที่บูธ The Cardlist ก่อน",
  wrong_mode: "พาสปอร์ตนี้เป็นชุดทดสอบ ใช้กับจุดจริงไม่ได้ (หรือกลับกัน)",
  too_fast: "สแกนเร็วเกินไป",
  error: "ระบบขัดข้อง ลองอีกครั้ง",
};

export default function StampPage() {
  const { token } = useParams<{ token: string }>();
  const [r, setR] = useState<Res | null>(null);
  const [boom, setBoom] = useState(0);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch("/api/passport/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: decodeURIComponent(token) }) })
      .then((x) => x.json()).then((j: Res) => {
        setR(j);
        if (j.ok && !j.already) {
          const done = j.packEarned || j.learnComplete;
          vibrate(done ? [60, 40, 120] : 40);
          if (done) setTimeout(() => setBoom((b) => b + 1), 450);
        }
      }).catch(() => setR({ ok: false, reason: "error" }));
  }, [token]);

  if (!r) return <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-500">กำลังปั๊มแสตมป์…</div>;

  const learn = r.station?.track === "learn";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <Confetti fire={boom} count={180} />
      {r.ok ? (
        <>
          <p className="text-xs text-zinc-400">{learn ? "LEARN TO PLAY" : r.event?.name}</p>
          <div className="relative my-7 flex items-center justify-center">
            {learn ? (
              <>
                <div className="pp-burst absolute h-52 w-52 rounded-full border-[3px] border-[var(--hi)]" />
                <div className="pp-pop pp-sweep flex h-36 w-52 items-center justify-center rounded-2xl bg-white p-4">
                  {r.station?.logo ? <img src={r.station.logo} alt={r.station.name} className="max-h-full max-w-full object-contain" /> : <span className="text-lg font-semibold text-zinc-900">{r.station?.name}</span>}
                </div>
              </>
            ) : (
              <div className={r.already ? "" : "pp-slam"}><Stamp index={Math.max(0, (r.count ?? 1) - 1)} size={190} ring={`${(r.event?.name ?? "CARDLIST PASSPORT").toUpperCase()} · THE CARDLIST`} label={r.station?.name} /></div>
            )}
          </div>
          <h1 className="text-xl font-semibold text-white">{r.already ? (learn ? "เกมนี้เรียนแล้ว" : "จุดนี้ได้แสตมป์แล้ว") : learn ? `เรียน ${r.station?.name} แล้ว` : "ได้แสตมป์แล้ว"}</h1>
          {!learn && <p className="text-sm text-zinc-400">{r.station?.name}</p>}
          <p className="mt-4 font-cardlist text-4xl text-[var(--hi)]">{r.count}/{r.total}</p>
          <p className="mt-1 min-h-5 text-sm text-[var(--hi)]">
            {r.packEarned ? "ครบงานนี้แล้ว! ได้ซองลุ้น 1 ซอง" : r.learnComplete ? "ครบทุกเกม! ปลดล็อกของรางวัล Learn To Play" : (r.total ?? 0) - (r.count ?? 0) > 0 ? `อีก ${(r.total ?? 0) - (r.count ?? 0)} ${learn ? "เกม" : "จุด"}` : ""}
          </p>
        </>
      ) : (
        <>
          {r.station?.logo && <img src={r.station.logo} alt="" className="mb-4 h-16 rounded-lg bg-white p-2" />}
          <h1 className="text-lg font-semibold text-white">{REASON[r.reason ?? "error"] ?? REASON.error}</h1>
          {r.reason === "too_fast" && <p className="mt-2 text-sm text-zinc-400">ลองใหม่ในอีก {r.waitSec} วินาที{learn ? " — โต๊ะสอนเล่นแต่ละเกมใช้เวลาเรียนราว 15 นาที" : ""}</p>}
          {r.station && <p className="mt-2 text-sm text-zinc-500">{r.station.name}</p>}
        </>
      )}
      <Link href="/passport" className="mt-8 w-full max-w-xs rounded-xl border border-[var(--gold)] py-3 text-sm text-[var(--hi)]">
        {r.packEarned ? "ไปฉีกซอง" : "ดูพาสปอร์ต"}
      </Link>
    </main>
  );
}
