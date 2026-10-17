"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/lib/admin-context";
import { adminFetch } from "@/lib/admin-fetch";
import { TCG_LIST, tcgLabel, deckSections, sectionOf } from "@/lib/tcg";
import { DECKLIST_STATUS_LABEL } from "@/lib/decklist";
import { toCsvRows } from "./csv";

type Card = { card_name: string; card_number: string; quantity: number; card_type: string | null; section?: string | null };
type Issue = { level: string; th: string };
export type Decklist = {
  id: string; event_id: string | null; user_id: string | null; booking_id: string | null;
  event_title: string; event_date: string | null; player_name: string; game: string; format: string; deck_name: string;
  cards: Card[]; card_count: number; deck_code: string; rule_issues: Issue[];
  status: string; staff_note: string; checked_by: string | null; checked_at: string | null;
  placement: number | null; top_cut: boolean; submitted_at: string; updated_at: string;
};
type EventRow = {
  id: string; title: string; date: string | null; event_type: string | null; tcg: string | null;
  decklist_enabled: boolean; decklist_deadline: string | null; decklist_game: string | null; decklist_regulation: string | null;
};

const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";
const thDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "—");
// ISO → ค่าในช่อง datetime-local (เวลาเครื่อง)
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function StatusChip({ status }: { status: string }) {
  const s = DECKLIST_STATUS_LABEL[status] ?? DECKLIST_STATUS_LABEL.submitted;
  return <span className={`text-[11px] rounded-full px-2 py-0.5 ${s.cls}`}>{s.th}</span>;
}

function CardList({ d }: { d: Decklist }) {
  return (
    <div className="bg-zinc-50 rounded-xl px-4 py-3 mt-2">
      {d.deck_code && <p className="text-[11px] text-zinc-600 mb-2">รหัสเด็ค: <span className="font-mono">{d.deck_code}</span></p>}
      {(deckSections(d.game, d.format) ?? [null]).map((sec) => {
        const secs = deckSections(d.game, d.format);
        const list = d.cards.filter((c) => !sec || sectionOf(c, secs) === sec.key);
        if (sec && !list.length) return null;
        return (
          <div key={sec?.key ?? "all"} className="mb-2 last:mb-0">
            {sec && <p className="text-[11px] font-semibold text-zinc-700 mb-0.5">{sec.th} ({list.reduce((t, c) => t + c.quantity, 0)})</p>}
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
              {list.map((c, i) => (
                <li key={i} className="text-xs text-zinc-700 flex justify-between gap-2">
                  <span className="truncate">{c.card_type === "Leader" ? "★ " : ""}{c.card_name}{c.card_number ? ` · ${c.card_number}` : ""}</span>
                  <span className="text-zinc-500">×{c.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {d.rule_issues.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {d.rule_issues.map((i, n) => <li key={n} className={`text-[11px] ${i.level === "error" ? "text-red-700" : i.level === "unknown" ? "text-zinc-600" : "text-amber-800"}`}>{i.level === "unknown" ? "ตรวจไม่ได้: " : ""}{i.th}</li>)}
        </ul>
      )}
    </div>
  );
}

// ---------- แท็บ: ทัวร์ ----------
function EventTab() {
  const { can } = useAdmin();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [eventId, setEventId] = useState("");
  const [data, setData] = useState<{ event: EventRow; decklists: Decklist[]; missing: { booking_id: string; name: string; member_code: string }[] } | null>(null);
  const [settings, setSettings] = useState({ decklist_enabled: false, decklist_deadline: "", decklist_game: "", decklist_regulation: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    const res = await adminFetch("/api/admin/decklists?mode=events");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "โหลดอีเวนต์ไม่สำเร็จ"); return; }
    setEvents(json.events);
    setCounts(json.counts);
    setEventId((cur) => cur || json.events.find((e: EventRow) => e.decklist_enabled)?.id || json.events[0]?.id || "");
  }, []);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    const res = await adminFetch(`/api/admin/decklists?eventId=${eventId}`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "โหลดไม่สำเร็จ"); return; }
    setData(json);
    setSettings({
      decklist_enabled: !!json.event.decklist_enabled,
      decklist_deadline: toLocalInput(json.event.decklist_deadline),
      decklist_game: json.event.decklist_game ?? "",
      decklist_regulation: json.event.decklist_regulation ?? "",
    });
  }, [eventId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadEvent(); }, [loadEvent]);

  async function saveSettings() {
    setMsg("");
    const res = await adminFetch("/api/admin/decklists", {
      method: "PUT",
      body: JSON.stringify({ eventId, ...settings, decklist_deadline: settings.decklist_deadline ? new Date(settings.decklist_deadline).toISOString() : null }),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? "บันทึกตั้งค่าแล้ว" : json.error ?? "บันทึกไม่สำเร็จ");
    if (res.ok) { loadEvents(); loadEvent(); }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await adminFetch("/api/admin/decklists", { method: "PATCH", body: JSON.stringify({ id, ...body }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) window.alert(json.error ?? "บันทึกไม่สำเร็จ");
    else loadEvent();
  }

  function reject(d: Decklist) {
    const note = window.prompt(`ให้ ${d.player_name} แก้อะไร? (ผู้เล่นจะเห็นข้อความนี้)`, d.staff_note);
    if (note === null) return;
    patch(d.id, { status: "rejected", staff_note: note });
  }

  const list = data?.decklists ?? [];
  const n = (s: string) => list.filter((d) => d.status === s).length;
  const editable = can("events:edit");

  return (
    <div>
      <div className="flex gap-3 flex-wrap items-end mb-4">
        <div className="min-w-[260px] flex-1 max-w-md">
          <label className={labelCls}>อีเวนต์</label>
          <select className={inputCls} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {thDate(e.date)} · {e.title}{e.decklist_enabled ? " · เปิดรับ decklist" : ""}{counts[e.id] ? ` (${counts[e.id]})` : ""}
              </option>
            ))}
          </select>
        </div>
        {list.length > 0 && (
          <a href={`/admin/decklists/print?eventId=${eventId}`} target="_blank" className="bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
            พิมพ์ใบลงทะเบียนเด็คทั้งทัวร์
          </a>
        )}
      </div>

      {error && <p className="text-xs text-red-700 bg-red-50 rounded-xl px-4 py-2.5 mb-4">{error}</p>}

      {data && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-zinc-900 mb-3">ตั้งค่าการรับ decklist</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input type="checkbox" checked={settings.decklist_enabled} disabled={!editable}
                onChange={(e) => setSettings({ ...settings, decklist_enabled: e.target.checked })} className="w-4 h-4" />
              เปิดรับ decklist
            </label>
            <div><label className={labelCls}>ปิดรับเมื่อ</label>
              <input type="datetime-local" className={inputCls} value={settings.decklist_deadline} disabled={!editable}
                onChange={(e) => setSettings({ ...settings, decklist_deadline: e.target.value })} /></div>
            <div><label className={labelCls}>เกมที่ใช้ตรวจกติกา</label>
              <select className={inputCls} value={settings.decklist_game} disabled={!editable} onChange={(e) => setSettings({ ...settings, decklist_game: e.target.value })}>
                <option value="">ตามเด็คที่ส่ง</option>{TCG_LIST.map((g) => <option key={g} value={g}>{tcgLabel(g)}</option>)}
              </select></div>
            <div><label className={labelCls}>Regulation ที่อนุญาต (Pokémon)</label>
              <input className={inputCls} value={settings.decklist_regulation} placeholder="เช่น H, I, J" disabled={!editable}
                onChange={(e) => setSettings({ ...settings, decklist_regulation: e.target.value })} /></div>
          </div>
          {editable && <button onClick={saveSettings} className="mt-3 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl">บันทึกตั้งค่า</button>}
          {msg && <p className="text-[11px] text-zinc-600 mt-2" role="status">{msg}</p>}
        </div>
      )}

      {data && (
        <div className="flex gap-2 flex-wrap mb-3">
          {[["ส่งแล้ว", list.length], ["รอตรวจ", n("submitted")], ["ตรวจแล้ว", n("checked")], ["ต้องแก้", n("rejected")], ["จองในเว็บแต่ยังไม่ส่ง", data.missing.length]].map(([label, v]) => (
            <div key={label as string} className="bg-white border border-zinc-100 rounded-xl px-3 py-2">
              <p className="text-sm font-bold text-zinc-900">{v}</p><p className="text-[11px] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-xs text-zinc-500 py-6">กำลังโหลด...</p>}

      {data && !loading && (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["ผู้เล่น", "เด็ค", "สถานะ", "ผลการแข่ง", ""].map((h) => <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-zinc-500">ยังไม่มีผู้เล่นส่ง decklist</td></tr>}
              {list.map((d) => (
                <tr key={d.id} className="border-b border-zinc-50 last:border-none align-top">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-zinc-900">{d.player_name}</p>
                    <p className="text-[11px] text-zinc-500">ส่ง {new Date(d.updated_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</p>
                    {!d.booking_id && <p className="text-[11px] text-amber-800">ไม่พบการจองในเว็บ — ตรวจหน้างาน</p>}
                    {!d.user_id && <p className="text-[11px] text-zinc-500">บัญชีถูกลบแล้ว</p>}
                  </td>
                  <td className="px-4 py-3 min-w-[220px]">
                    <button onClick={() => setOpen(open === d.id ? null : d.id)} className="text-xs text-zinc-900 underline text-left">
                      {d.deck_name || "(ไม่มีชื่อ)"} · {d.card_count} ใบ
                    </button>
                    <p className="text-[11px] text-zinc-500">{tcgLabel(d.game)}{d.format ? ` · ${d.format}` : ""}</p>
                    {d.rule_issues.some((i) => i.level === "error") && <p className="text-[11px] text-red-700">มีข้อผิดกติกา</p>}
                    {open === d.id && <CardList d={d} />}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={d.status} />
                    {d.staff_note && <p className="text-[11px] text-zinc-600 mt-1 max-w-[180px]">{d.staff_note}</p>}
                    {d.checked_by && <p className="text-[11px] text-zinc-500 mt-1">โดย {d.checked_by}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} defaultValue={d.placement ?? ""} disabled={!editable} aria-label={`อันดับของ ${d.player_name}`}
                        className="w-16 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs"
                        onBlur={(e) => { if (e.target.value !== String(d.placement ?? "")) patch(d.id, { placement: e.target.value || null }); }} />
                      <label className="flex items-center gap-1 text-[11px] text-zinc-600">
                        <input type="checkbox" checked={d.top_cut} disabled={!editable} onChange={(e) => patch(d.id, { top_cut: e.target.checked })} /> Top cut
                      </label>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editable && d.status !== "checked" && <button onClick={() => patch(d.id, { status: "checked" })} className="text-[11px] text-green-700 underline mr-3">ตรวจแล้ว</button>}
                    {editable && <button onClick={() => reject(d)} className="text-[11px] text-red-700 underline mr-3">ต้องแก้</button>}
                    <a href={`/admin/decklists/print?eventId=${eventId}&id=${d.id}`} target="_blank" className="text-[11px] text-zinc-700 underline">พิมพ์</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.missing.length > 0 && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 mt-4">
          <p className="text-xs font-semibold text-zinc-900 mb-2">จองในเว็บแต่ยังไม่ส่ง decklist</p>
          <ul className="text-xs text-zinc-700 space-y-0.5">
            {data.missing.map((m) => <li key={m.booking_id}>{m.name || "(ไม่มีชื่อ)"}{m.member_code ? ` · ${m.member_code}` : ""}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- แท็บ: ฐานข้อมูลการแข่ง ----------
function ArchiveTab() {
  const [rows, setRows] = useState<Decklist[]>([]);
  const [q, setQ] = useState("");
  const [game, setGame] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await adminFetch(`/api/admin/decklists?mode=archive&${new URLSearchParams({ q, game })}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "โหลดไม่สำเร็จ");
    else setRows(json.decklists);
    setLoading(false);
  }, [q, game]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  // ภาพรวม meta แบบนับรวม ไม่ระบุตัวบุคคล: One Piece นับตาม Leader · เกมอื่นนับการ์ดที่ใส่บ่อย (จำนวนเด็คที่ใช้)
  const meta = useMemo(() => {
    const leaders = new Map<string, { decks: number; top: number }>();
    const cards = new Map<string, number>();
    for (const d of rows) {
      const leader = d.cards.find((c) => c.card_type === "Leader");
      if (d.game === "One Piece" && leader) {
        const k = `${leader.card_name} (${leader.card_number})`;
        const cur = leaders.get(k) ?? { decks: 0, top: 0 };
        leaders.set(k, { decks: cur.decks + 1, top: cur.top + (d.top_cut ? 1 : 0) });
      }
      for (const name of new Set(d.cards.filter((c) => c.card_type !== "Leader").map((c) => c.card_name))) {
        cards.set(name, (cards.get(name) ?? 0) + 1);
      }
    }
    return {
      leaders: [...leaders.entries()].sort((a, b) => b[1].decks - a[1].decks).slice(0, 10),
      cards: [...cards.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    };
  }, [rows]);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsvRows(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cardlist-decklists-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        <input className={`${inputCls} max-w-xs`} placeholder="ค้นผู้เล่น ชื่อเด็ค หรือชื่อทัวร์" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputCls} w-auto`} value={game} onChange={(e) => setGame(e.target.value)}>
          <option value="">ทุกเกม</option>{TCG_LIST.map((g) => <option key={g} value={g}>{tcgLabel(g)}</option>)}
        </select>
        <button onClick={exportCsv} disabled={!rows.length} className="border border-zinc-200 text-zinc-700 text-xs font-medium px-4 py-2 rounded-xl disabled:opacity-40">ส่งออก CSV</button>
      </div>

      {error && <p className="text-xs text-red-700 bg-red-50 rounded-xl px-4 py-2.5 mb-4">{error}</p>}

      {rows.length > 0 && (meta.leaders.length > 0 || meta.cards.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {meta.leaders.length > 0 && (
            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              <p className="text-xs font-semibold text-zinc-900 mb-2">Leader ที่ใช้ (One Piece)</p>
              <ul className="space-y-1">{meta.leaders.map(([k, v]) => (
                <li key={k} className="flex justify-between text-xs text-zinc-700"><span className="truncate">{k}</span><span className="text-zinc-500 flex-shrink-0 ml-2">{v.decks} เด็ค · top cut {v.top}</span></li>
              ))}</ul>
            </div>
          )}
          <div className="bg-white border border-zinc-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-zinc-900 mb-2">การ์ดที่ใส่บ่อย (จำนวนเด็ค)</p>
            <ul className="space-y-1">{meta.cards.map(([k, v]) => (
              <li key={k} className="flex justify-between text-xs text-zinc-700"><span className="truncate">{k}</span><span className="text-zinc-500 flex-shrink-0 ml-2">{v}</span></li>
            ))}</ul>
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-100 rounded-2xl overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {["วันที่", "ทัวร์", "ผู้เล่น", "เด็ค", "ผล", "สถานะ"].map((h) => <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-zinc-500">กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-zinc-500">ยังไม่มีข้อมูลการแข่ง</td></tr>}
            {!loading && rows.map((d) => (
              <tr key={d.id} className="border-b border-zinc-50 last:border-none align-top">
                <td className="px-4 py-2.5 text-xs text-zinc-700 whitespace-nowrap">{thDate(d.event_date)}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-700">{d.event_title}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-900">{d.player_name}</td>
                <td className="px-4 py-2.5 min-w-[200px]">
                  <button onClick={() => setOpen(open === d.id ? null : d.id)} className="text-xs text-zinc-900 underline text-left">{d.deck_name || "(ไม่มีชื่อ)"}</button>
                  <p className="text-[11px] text-zinc-500">{tcgLabel(d.game)} · {d.card_count} ใบ</p>
                  {open === d.id && <CardList d={d} />}
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-700 whitespace-nowrap">{d.placement ? `#${d.placement}` : "—"}{d.top_cut ? " · Top cut" : ""}</td>
                <td className="px-4 py-2.5"><StatusChip status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500 mt-3">เก็บถาวรเป็นข้อมูลการแข่งของร้าน · เห็นได้เฉพาะทีมงาน · แสดงสูงสุด 500 รายการล่าสุด</p>
    </div>
  );
}

export default function AdminDecklistsPage() {
  const [tab, setTab] = useState<"event" | "archive">("event");
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900">Decklist & ฐานข้อมูลการแข่ง</h1>
          <p className="text-[11px] text-zinc-500 mt-1">ผู้เล่นส่ง decklist จากหน้า Deck Builder · ทุกรายการเก็บถาวร แม้ผู้เล่นแก้/ลบเด็คหรือลบบัญชีภายหลัง</p>
        </div>
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
          {([["event", "ทัวร์"], ["archive", "ฐานข้อมูลการแข่ง"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`text-xs px-3.5 py-1.5 rounded-lg transition-colors ${tab === k ? "bg-white text-zinc-900 font-semibold" : "text-zinc-600"}`}>{label}</button>
          ))}
        </div>
      </div>
      {tab === "event" ? <EventTab /> : <ArchiveTab />}
    </div>
  );
}
