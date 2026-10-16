"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PassportQR from "@/components/passport/PassportQR";

type Data = { name: string; logo: string | null; track: string; active: boolean; isTest: boolean; token: string; qrMode: string; nextInMs: number | null; today: number };

// หน้าจอคนสอน / จอที่บูธ — เปิดจากลิงก์เฉพาะโต๊ะ (?k=) ไม่ต้องล็อกอิน · QR เปลี่ยนเองทุก 30 วินาที
export default function StationScreen() {
  const { code } = useParams<{ code: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    const k = new URLSearchParams(window.location.search).get("k") ?? "";
    const r = await fetch(`/api/passport/station-qr?code=${encodeURIComponent(code)}&k=${encodeURIComponent(k)}`, { cache: "no-store" });
    if (!r.ok) { setErr("ลิงก์หน้าจอนี้ไม่ถูกต้อง"); return; }
    const j: Data = await r.json();
    setD(j);
  }, [code]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!d) return;
    const t = setTimeout(load, d.nextInMs != null ? d.nextInMs + 300 : 5 * 60_000);
    return () => clearTimeout(t);
  }, [d, load]);

  if (err) return <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-400">{err}</div>;
  if (!d) return <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-500">กำลังโหลด…</div>;
  const url = `${window.location.origin}/passport/s/${d.token}`;
  const learn = d.track === "learn";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 py-8 text-center">
      <p className="text-xs text-zinc-500">{learn ? "หน้าจอคนสอน · LEARN TO PLAY" : "จอที่จุด · CARDLIST PASSPORT"}{d.isTest ? " · TEST" : ""}</p>
      <div className="my-4 flex h-24 w-full items-center justify-center rounded-2xl bg-white p-3">
        {d.logo ? <img src={d.logo} alt={d.name} className="max-h-full max-w-full object-contain" /> : <span className="text-lg font-semibold text-zinc-900">{d.name}</span>}
      </div>
      <h1 className="text-lg font-semibold text-white">{learn ? `โต๊ะสอนเล่น ${d.name}` : d.name}</h1>
      {!d.active && <p className="mt-2 rounded bg-red-900/40 px-3 py-1 text-xs text-red-300">จุดนี้ปิดอยู่ในระบบ</p>}
      {learn && !show ? (
        <>
          <p className="mb-6 mt-1 text-sm text-zinc-400">เปิด QR ให้ผู้เล่นสแกนเมื่อสอนจบ</p>
          <button onClick={() => setShow(true)} className="w-full rounded-2xl bg-[var(--gold)] py-5 text-lg font-semibold text-[var(--night)]">สอนจบแล้ว · เปิด QR</button>
        </>
      ) : (
        <>
          <p className="mb-4 mt-1 text-sm text-zinc-400">สแกนด้วยกล้องมือถือ ไม่ต้องโหลดแอป</p>
          <PassportQR value={url} size={240} />
          {d.nextInMs != null && <div className="mt-2 h-1 w-[256px] overflow-hidden rounded bg-zinc-800"><div key={d.token} className="pp-drain h-full bg-[var(--gold)]" style={{ animationDuration: `${d.nextInMs}ms` }} /></div>}
          <p className="mt-2 text-xs text-zinc-500">{d.qrMode === "rotating" ? "QR เปลี่ยนทุก 30 วินาที · ถ่ายรูปไปแชร์ใช้ไม่ได้" : "QR ของวันนี้"}</p>
          {learn && <button onClick={() => setShow(false)} className="mt-4 text-xs text-zinc-500">ซ่อน QR</button>}
        </>
      )}
      <div className="mt-8 w-full rounded-xl bg-zinc-900 p-3"><p className="font-cardlist text-3xl text-[var(--hi)]">{d.today}</p><p className="text-xs text-zinc-400">{learn ? "สอนวันนี้" : "สแกนวันนี้"}</p></div>
    </main>
  );
}
