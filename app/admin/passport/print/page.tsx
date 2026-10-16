"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import PassportQR from "@/components/passport/PassportQR";

type Print = {
  event: { name: string; venue: string; days: string[]; isTest: boolean };
  signs: { day: string; station: string; code: string; url: string }[];
  screens: { station: string; code: string; logo: string | null; url: string }[];
  entry: string;
};
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDay = (d: string) => { const [, m, dd] = d.split("-").map(Number); return `${dd} ${TH_MONTH[m - 1]}`; };

// หน้าพิมพ์: ป้าย QR ต่อจุดต่อวัน (A5) · ป้ายทางเข้า · ลิงก์หน้าจอคนสอน · การ์ด Passport (63×88 มม.)
export default function PassportPrintPage() {
  const [d, setD] = useState<Print | null>(null);
  const [cards, setCards] = useState<{ code: string; url: string }[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("cards")) { try { setCards(JSON.parse(sessionStorage.getItem("pp-cards") ?? "[]")); } catch { setCards([]); } return; }
    adminFetch(`/api/admin/passport/print?event=${encodeURIComponent(sp.get("event") ?? "")}`)
      .then(async (r) => { const j = await r.json(); if (r.ok) setD(j); else setErr(j.error ?? "โหลดไม่สำเร็จ"); });
  }, []);

  const style = (
    <style>{`
      @page { size: A5 portrait; margin: 8mm; }
      @media print { aside, header, nav, .no-print { display: none !important; } body, main { background: #fff !important; } .sheet { break-after: page; } .cardsheet { break-inside: avoid; } }
    `}</style>
  );

  if (cards) return (
    <div className="p-4">
      {style}
      <div className="no-print mb-4 flex items-center justify-between"><p className="text-sm">การ์ด {cards.length} ใบ · ขนาด 63×88 มม. · ด้านหลังการ์ด</p><button onClick={() => window.print()} className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white">พิมพ์</button></div>
      <div className="flex flex-wrap gap-[3mm]">
        {cards.map((c) => (
          <div key={c.code} className="cardsheet flex flex-col items-center justify-center rounded-[3mm] border border-zinc-300 bg-white" style={{ width: "63mm", height: "88mm" }}>
            <p className="font-cardlist text-[11px] tracking-[0.15em]">THE CARDLIST PASSPORT</p>
            <div className="my-2"><PassportQR value={c.url} size={150} /></div>
            <p className="font-mono text-sm tracking-[0.15em]">{c.code}</p>
            <p className="mt-1 px-3 text-center text-[8px] text-zinc-600">สแกนด้วยกล้องมือถือเพื่อเปิดใช้ · เก็บการ์ดไว้กู้คืนเมื่อเปลี่ยนมือถือ · thecardlistbkk.com</p>
          </div>
        ))}
      </div>
    </div>
  );

  if (err) return <div className="p-6 text-sm text-red-700">{err}</div>;
  if (!d) return <div className="p-6 text-sm text-zinc-500">กำลังโหลด…</div>;

  const Sign = ({ title, sub, day, url }: { title: string; sub: string; day?: string; url: string }) => (
    <div className="sheet mx-auto mb-6 flex flex-col items-center justify-between rounded-xl border border-zinc-300 bg-white p-6 text-center" style={{ width: "132mm", minHeight: "190mm" }}>
      <div className="flex w-full items-center justify-between"><img src="/images/passport/c-mark.png" alt="" className="h-10 w-10 object-contain" /><span className="font-cardlist text-sm tracking-[0.12em]">CARDLIST PASSPORT</span></div>
      <div>
        {day && <p className="text-4xl font-bold">{thDay(day)}</p>}
        <p className="mt-2 text-2xl font-semibold">{title}</p>
        <p className="text-sm text-zinc-600">{sub}</p>
      </div>
      <PassportQR value={url} size={260} />
      <div><p className="text-base font-semibold">สแกนด้วยกล้องมือถือ รับแสตมป์</p><p className="text-xs text-zinc-600">ไม่ต้องโหลดแอป · thecardlistbkk.com/passport{d.event.isTest ? " · TEST" : ""}</p></div>
    </div>
  );

  return (
    <div className="p-4">
      {style}
      <div className="no-print mx-auto mb-4 flex max-w-xl items-center justify-between">
        <div><p className="text-sm font-semibold">{d.event.name}{d.event.isTest ? " (TEST)" : ""}</p><p className="text-xs text-zinc-500">ป้ายจุดละ 1 แผ่นต่อวัน ({d.event.days.map(thDay).join(", ")}) — เปลี่ยนป้ายทุกเช้า · QR ใช้ได้เฉพาะวันที่บนป้าย</p></div>
        <button onClick={() => window.print()} className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white">พิมพ์ทั้งหมด</button>
      </div>
      <Sign title="CARDLIST PASSPORT" sub={`${d.event.name} · ป้ายทางเข้า / บูธ (เปิดพาสปอร์ต ไม่ได้แสตมป์)`} url={d.entry} />
      {d.signs.map((s) => <Sign key={s.code + s.day} title={s.station} sub={d.event.name} day={s.day} url={s.url} />)}
      {d.screens.length > 0 && (
        <div className="sheet mx-auto max-w-xl rounded-xl border border-zinc-300 bg-white p-4">
          <p className="mb-1 text-sm font-semibold">ลิงก์หน้าจอคนสอน (ส่งให้คนสอนแต่ละโต๊ะ — ห้ามติดประกาศ)</p>
          <p className="mb-3 text-xs text-zinc-500">คนสอนสแกน QR นี้ด้วยมือถือตัวเองเพื่อเปิดหน้าจอ QR ที่เปลี่ยนทุก 30 วินาที</p>
          <div className="grid grid-cols-2 gap-4">
            {d.screens.map((s) => (
              <div key={s.code} className="flex flex-col items-center text-center">
                {s.logo && <img src={s.logo} alt="" className="mb-1 h-8 object-contain" />}
                <PassportQR value={s.url} size={120} />
                <p className="mt-1 text-xs">{s.station}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
