"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Confetti, { vibrate } from "@/components/passport/Confetti";

// ปลายทางของ QR บนการ์ด Passport: /passport/claim/<code>.<secret>
export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<{ ok: boolean; code?: string; firstTime?: boolean; error?: string } | null>(null);
  const [boom, setBoom] = useState(0);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const [code, secret] = decodeURIComponent(token).split(".");
    fetch("/api/passport/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, secret }) })
      .then(async (r) => ({ r, j: await r.json() }))
      .then(({ r, j }) => {
        if (r.ok) { setState({ ok: true, code: j.code, firstTime: j.firstTime }); vibrate([60, 40, 120]); setTimeout(() => setBoom(1), 300); }
        else setState({ ok: false, error: j.error });
      }).catch(() => setState({ ok: false, error: "error" }));
  }, [token]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Confetti fire={boom} />
      {!state ? <p className="text-sm text-zinc-500">กำลังเปิดใช้ Passport…</p> : state.ok ? (
        <>
          <div className="pp-pop pp-foil flex aspect-[63/88] w-44 flex-col items-center justify-center gap-2 rounded-xl border border-[#3a3020] bg-[#1b1712]">
            <img src="/images/passport/c-mark.png" alt="" className="relative h-10 w-10 object-contain" />
            <p className="relative font-cardlist text-xl tracking-[0.06em] text-[var(--hi)]">PASSPORT</p>
            <p className="relative font-mono text-xs tracking-[0.15em] text-white">{state.code}</p>
          </div>
          <h1 className="mt-6 text-xl font-semibold text-white">{state.firstTime ? "เปิดใช้ Passport แล้ว" : "ย้าย Passport มาเครื่องนี้แล้ว"}</h1>
          <p className="mt-1 text-sm text-zinc-400">สแกน QR ตามจุดในงานเพื่อสะสมแสตมป์ · เก็บการ์ดไว้ใช้กู้คืนเมื่อเปลี่ยนมือถือ</p>
        </>
      ) : (
        <h1 className="text-lg font-semibold text-white">
          {state.error === "not_sold" ? "การ์ดใบนี้ยังไม่ได้ลงทะเบียนการขาย — ให้พนักงานบูธกดขายก่อน" : "QR บนการ์ดไม่ถูกต้อง — ติดต่อพนักงานบูธ The Cardlist"}
        </h1>
      )}
      {state && <Link href="/passport" className="mt-8 w-full max-w-xs rounded-xl bg-[var(--gold)] py-3 text-sm font-semibold text-[var(--night)]">ไปที่ Passport</Link>}
    </main>
  );
}
