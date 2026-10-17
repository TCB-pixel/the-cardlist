"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminFetch } from "@/lib/admin-fetch";
import { tcgLabel, deckSections, sectionOf } from "@/lib/tcg";
import type { Decklist } from "../page";

type EventInfo = { title: string; date: string | null; decklist_regulation: string | null };

const thDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "—");

// ใบลงทะเบียนเด็ค (Deck Registration Sheet) — 1 คน 1 หน้า · กด "พิมพ์" แล้วเลือก "บันทึกเป็น PDF" ได้
// จัดกลุ่มตามประเภทการ์ด (Leader ขึ้นก่อน การ์ดที่ไม่รู้ประเภทไว้ท้าย)
function byType(cards: Decklist["cards"]) {
  const groups = new Map<string, Decklist["cards"]>();
  for (const c of cards) {
    const k = c.card_type ?? "การ์ด";
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const order = (k: string) => (k === "Leader" ? 0 : k === "การ์ด" ? 9 : 1);
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]));
}

function Sheet({ d, event }: { d: Decklist; event: EventInfo }) {
  // แยกส่วนเด็คก่อน (BoT Main/Side · Monsnatch Deck A/B) แล้วค่อยแยกประเภท
  const secs = deckSections(d.game, d.format);
  const parts = (secs ?? [null]).map((sec) => ({
    sec,
    cards: d.cards.filter((c) => !sec || sectionOf(c, secs) === sec.key),
  })).filter((p) => !p.sec || p.cards.length);
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-8 mb-6 print:border-0 print:rounded-none print:p-0 print:mb-0 print:break-after-page text-zinc-900">
      <div className="flex items-start justify-between border-b border-zinc-900 pb-3 mb-4">
        <div>
          <p className="text-lg font-bold tracking-wide">DECK REGISTRATION SHEET</p>
          <p className="text-xs text-zinc-600">ใบลงทะเบียนเด็ค · <span className="font-cardlist font-normal tracking-wide">The Cardlist</span></p>
        </div>
        <p className="text-[11px] text-zinc-600 text-right">พิมพ์ {new Date().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-5">
        <p><span className="text-zinc-500 text-xs block">ทัวร์</span>{event.title}</p>
        <p><span className="text-zinc-500 text-xs block">วันที่</span>{thDate(event.date)}</p>
        <p><span className="text-zinc-500 text-xs block">ชื่อผู้เล่น</span><span className="font-semibold">{d.player_name}</span></p>
        <p><span className="text-zinc-500 text-xs block">เกม / ฟอร์แมต</span>{tcgLabel(d.game)}{d.format ? ` · ${d.format}` : ""}{event.decklist_regulation ? ` · Regulation ${event.decklist_regulation}` : ""}</p>
        <p><span className="text-zinc-500 text-xs block">ชื่อเด็ค</span>{d.deck_name || "—"}</p>
        <p><span className="text-zinc-500 text-xs block">รหัสเด็ค</span><span className="font-mono">{d.deck_code || "—"}</span></p>
      </div>

      {parts.map(({ sec, cards: partCards }) => (
        <div key={sec?.key ?? "all"} className={sec ? "mb-5" : ""}>
          {sec && (
            <p className="text-sm font-bold border-b-2 border-zinc-900 pb-1 mb-2">
              {sec.th} — {partCards.reduce((s, c) => s + c.quantity, 0)} ใบ
            </p>
          )}
          {byType(partCards).map(([type, cards]) => (
            <div key={type} className="mb-4 break-inside-avoid">
              <p className="text-xs font-semibold border-b border-zinc-300 pb-1 mb-1">{type} ({cards.reduce((s, c) => s + c.quantity, 0)})</p>
              <table className="w-full text-sm">
                <tbody>
                  {cards.map((c, i) => (
                    <tr key={i} className="border-b border-zinc-100">
                      <td className="w-10 py-0.5 font-semibold">{c.quantity}</td>
                      <td className="py-0.5">{c.card_name}</td>
                      <td className="py-0.5 text-right font-mono text-xs text-zinc-600">{c.card_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}

      <p className="text-sm font-semibold mt-2">รวม {d.card_count} ใบ</p>
      {d.rule_issues.length > 0 && (
        <ul className="mt-2 text-[11px] text-zinc-700 list-disc pl-5">
          {d.rule_issues.map((i, n) => <li key={n}>{i.level === "unknown" ? "ตรวจไม่ได้: " : ""}{i.th}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-8 mt-10 text-xs text-zinc-600">
        <p className="border-t border-zinc-400 pt-1">ลายเซ็นผู้เล่น</p>
        <p className="border-t border-zinc-400 pt-1">ตรวจโดย (ทีมงาน){d.checked_by ? ` · ${d.checked_by}` : ""}</p>
      </div>
    </section>
  );
}

function PrintInner() {
  const sp = useSearchParams();
  const eventId = sp.get("eventId") ?? "";
  const only = sp.get("id");
  const [data, setData] = useState<{ event: EventInfo; decklists: Decklist[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch(`/api/admin/decklists?eventId=${eventId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) setError(json.error ?? "โหลดไม่สำเร็จ");
        else setData(json);
      });
  }, [eventId]);

  if (error) return <p className="p-6 text-xs text-red-700">{error}</p>;
  if (!data) return <p className="p-6 text-xs text-zinc-500">กำลังโหลด...</p>;
  const list = data.decklists.filter((d) => !only || d.id === only);

  return (
    <div className="p-6 print:p-0 max-w-3xl">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <p className="text-xs text-zinc-600">{list.length} ใบ · {data.event.title}</p>
        <button onClick={() => window.print()} className="bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl">พิมพ์ / บันทึกเป็น PDF</button>
      </div>
      {list.length === 0 && <p className="text-xs text-zinc-500">ไม่มี decklist</p>}
      {list.map((d) => <Sheet key={d.id} d={d} event={data.event} />)}
    </div>
  );
}

export default function DecklistPrintPage() {
  return <Suspense fallback={<p className="p-6 text-xs text-zinc-500">กำลังโหลด...</p>}><PrintInner /></Suspense>;
}
