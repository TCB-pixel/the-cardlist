"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-fetch";

type Stats = {
  isTest: boolean; manage: boolean; price: number;
  kpi: Record<string, number>;
  members: { total: number; marketing: number; ages: Record<string, number>; games: Record<string, number> };
  events: { id: string; slug: string; name: string; venue: string; starts_on: string; ends_on: string; open_time: string; close_time: string }[];
  stations: { id: string; code: string; event_id: string | null; track: string; name: string; logo_path: string | null; qr_mode: string; display_key?: string; active: boolean; total: number; today: number }[];
  rewards: { id: string; track: string; tier: string; name: string; color: string; stock: number; initial_stock: number; given: number; active: boolean }[];
};

function Bar({ v, max, color = "#a88c4a" }: { v: number; max: number; color?: string }) {
  return <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-100"><div className="h-full rounded" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: color }} /></div>;
}

export default function AdminPassportPage() {
  const [test, setTest] = useState(false);
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [cards, setCards] = useState(100);

  const load = useCallback(async () => {
    const r = await adminFetch(`/api/admin/passport${test ? "?test=1" : ""}`);
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "โหลดไม่สำเร็จ"); return; }
    setErr(""); setS(j);
  }, [test]);
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, [load]);

  async function post(body: object) {
    const r = await adminFetch("/api/admin/passport", { method: "POST", body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "บันทึกไม่สำเร็จ"); return null; }
    load(); return j;
  }
  async function makeCards() {
    if (!confirm(`สร้างการ์ดเปล่า ${cards} ใบ${test ? " (ชุดทดสอบ)" : ""} สำหรับพิมพ์?`)) return;
    const j = await post({ action: "cards", count: cards, test });
    if (j?.cards) { sessionStorage.setItem("pp-cards", JSON.stringify(j.cards)); window.open("/admin/passport/print?cards=1", "_blank"); }
  }

  if (!s) return <div className="p-6 text-sm text-zinc-500">{err || "กำลังโหลด…"}</div>;
  const k = s.kpi;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const learnStations = s.stations.filter((x) => x.track === "learn");
  const maxSt = Math.max(1, ...s.stations.map((x) => x.total));

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-lg font-semibold text-zinc-900">CARDLIST PASSPORT</h1><p className="text-xs text-zinc-500">อัปเดตทุก 20 วินาที · ไม่มีข้อมูลส่วนบุคคล</p></div>
        <div className="flex items-center gap-2">
          <Link href="/admin/passport/redeem" className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white">หน้าบูธ: ขาย / แลกของ</Link>
          <button onClick={() => setTest(!test)} className={`rounded-lg border px-3 py-2 text-xs ${test ? "border-amber-400 bg-amber-50 text-amber-800" : "border-zinc-200 bg-white text-zinc-600"}`}>{test ? "กำลังดู: ชุดทดสอบ" : "ดูชุดทดสอบ"}</button>
        </div>
      </div>
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Passport ขายแล้ว", k.sold], ["รายได้ (บาท)", k.revenue.toLocaleString()], ["เปิดใช้แล้ว", k.activated], ["แสตมป์ทั้งหมด", k.stamps],
          ["มา 2 งานขึ้นไป", k.repeat2], ["มาครบ 3 งาน", k.repeat3], ["ซองที่ได้ / ฉีกแล้ว", `${k.packsEarned} / ${k.packsOpened}`], ["รอแลก / แลกแล้ว", `${k.pending} / ${k.redeemed}`],
          ["Learn To Play (ไม่ซื้อการ์ด)", k.freeLearners], ["เรียนครบทุกเกม", k.learnComplete], ["การ์ดเปล่ายังไม่ขาย", k.unsoldCards]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl bg-zinc-100 p-3"><p className="text-xl font-semibold text-zinc-900">{v}</p><p className="text-[11px] text-zinc-600">{l}</p></div>
        ))}
      </div>

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold">สมาชิก Passport</h2>
        <p className="mb-3 text-[11px] text-zinc-500">ตัวเลขรวมเท่านั้น · รายชื่อดูได้ที่ &quot;จัดการสมาชิก&quot; ตามสิทธิ์เดิม</p>
        <div className="flex flex-wrap gap-4 text-xs text-zinc-700">
          <span>สมัครแล้ว <b>{s.members.total}</b></span>
          <span>ยินยอมรับข่าวสาร <b>{s.members.marketing}</b></span>
          <span>อายุ: {Object.entries(s.members.ages).map(([a, n]) => `${a} ${n}`).join(" · ") || "—"}</span>
          <span>เกม: {Object.entries(s.members.games).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(" · ") || "—"}</span>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">กองรางวัล</h2>
        <div className="space-y-2">
          {s.rewards.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-24 font-semibold" style={{ color: r.color === "#e9d29a" ? "#a16207" : r.color === "#a1a1aa" ? "#52525b" : r.color }}>{r.track === "learn" ? "LEARN" : r.tier}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-700">{r.name}</span>
              <Bar v={r.stock} max={r.initial_stock} color={r.color === "#e9d29a" ? "#ca8a04" : r.color} />
              <span className="w-24 text-right text-zinc-600">เหลือ {r.stock} · แจก {r.given}</span>
              {s.manage && <button onClick={() => { const v = prompt(`จำนวนที่เหลือของ ${r.tier} — ${r.name}`, String(r.stock)); if (v !== null) post({ action: "reward", id: r.id, stock: Number(v) }); }} className="rounded border border-zinc-200 px-2 py-1">แก้จำนวน</button>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">ซองสุ่มตามจำนวนที่เหลือจริง · จำนวน 0 = ไม่ถูกสุ่ม · แก้ชื่อของรางวัลได้ที่ฐานข้อมูล (ทีม AI)</p>
      </section>

      {s.events.map((ev) => {
        const st = s.stations.filter((x) => x.event_id === ev.id);
        return (
          <section key={ev.id} className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-sm font-semibold">{ev.name}</h2><p className="text-[11px] text-zinc-500">{ev.starts_on} ถึง {ev.ends_on} · {ev.venue} · สแกนได้ {ev.open_time.slice(0, 5)}–{ev.close_time.slice(0, 5)}</p></div>
              {s.manage && (
                <div className="flex gap-2">
                  <button onClick={() => { const o = prompt("เวลาเปิด (HH:MM)", ev.open_time.slice(0, 5)); const c = o && prompt("เวลาปิด (HH:MM)", ev.close_time.slice(0, 5)); if (o && c) post({ action: "event", id: ev.id, open_time: o, close_time: c }); }} className="rounded border border-zinc-200 px-2 py-1 text-xs">แก้เวลา</button>
                  <Link href={`/admin/passport/print?event=${ev.slug}`} target="_blank" className="rounded bg-zinc-900 px-2 py-1 text-xs text-white">พิมพ์ป้าย QR</Link>
                </div>
              )}
            </div>
            {st.map((x) => (
              <div key={x.id} className="flex items-center gap-2 py-1 text-xs">
                <span className={`w-36 truncate ${x.active ? "" : "text-zinc-400 line-through"}`}>{x.name}</span>
                <Bar v={x.total} max={maxSt} />
                <span className="w-28 text-right text-zinc-600">รวม {x.total} · วันนี้ {x.today}</span>
                {s.manage && <button onClick={() => post({ action: "station", id: x.id, active: !x.active })} className="rounded border border-zinc-200 px-2 py-0.5">{x.active ? "ปิด" : "เปิด"}</button>}
              </div>
            ))}
          </section>
        );
      })}

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Learn To Play · โต๊ะสอนเล่น</h2>
        {learnStations.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center gap-2 py-1 text-xs">
            {x.logo_path && <img src={x.logo_path} alt="" className="h-6 w-12 rounded bg-white object-contain" />}
            <span className={`w-36 truncate ${x.active ? "" : "text-zinc-400 line-through"}`}>{x.name}</span>
            <Bar v={x.total} max={maxSt} color="#18181b" />
            <span className="w-28 text-right text-zinc-600">รวม {x.total} · วันนี้ {x.today}</span>
            {s.manage && x.display_key && (
              <>
                <button onClick={() => { navigator.clipboard?.writeText(`${origin}/passport/station/${x.code}?k=${x.display_key}`); alert("คัดลอกลิงก์หน้าจอคนสอนแล้ว — ส่งให้คนสอนโต๊ะนี้เท่านั้น"); }} className="rounded border border-zinc-200 px-2 py-0.5">คัดลอกลิงก์คนสอน</button>
                <button onClick={() => post({ action: "station", id: x.id, active: !x.active })} className="rounded border border-zinc-200 px-2 py-0.5">{x.active ? "ปิด" : "เปิด"}</button>
              </>
            )}
          </div>
        ))}
        <p className="mt-2 text-[11px] text-zinc-500">ลิงก์คนสอนเปิด QR ของโต๊ะนั้นได้อย่างเดียว ไม่ต้องมีบัญชีหลังบ้าน</p>
      </section>

      {s.manage && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">การ์ด Passport สำหรับพิมพ์</h2>
          <p className="mb-3 text-xs text-zinc-500">สร้างรหัสการ์ดเปล่า (QR หลังการ์ด) — การ์ดยังเปิดใช้ไม่ได้จนกว่าพนักงานกด &quot;ขาย&quot; ที่หน้าบูธ</p>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={500} value={cards} onChange={(e) => setCards(Number(e.target.value))} className="w-24 rounded border border-zinc-200 px-2 py-1.5 text-sm" />
            <button onClick={makeCards} className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white">สร้างและเปิดหน้าพิมพ์</button>
          </div>
        </section>
      )}
    </div>
  );
}
