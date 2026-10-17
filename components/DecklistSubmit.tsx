"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import { useModal } from "@/lib/use-modal";
import { tcgLabel } from "@/lib/tcg";
import type { RuleIssue } from "@/lib/deck-rules";
import { DECKLIST_CONSENT } from "@/lib/decklist";

type OpenEvent = {
  id: string; title: string; date: string | null; tcg: string | null;
  decklist_deadline: string | null; decklist_game: string | null; decklist_regulation: string | null;
};

const fmt = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// หน้าต่างส่ง decklist ลงทัวร์ (drawer จากล่างบนมือถือ) — ตรวจกติกาและบันทึกจริงที่ API ฝั่ง server
export default function DecklistSubmit({ deck, userId, onClose, onDone }: {
  deck: { id: string; name: string; tcg: string };
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { L, lang } = useLang();
  const close = useCallback(() => onClose(), [onClose]);
  useModal(true, close);
  const [events, setEvents] = useState<OpenEvent[] | null>(null);
  const [eventId, setEventId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [deckCode, setDeckCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<RuleIssue[]>([]);
  const [done, setDone] = useState<{ updated: boolean; warnings: RuleIssue[] } | null>(null);
  const [already, setAlready] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("events")
      .select("id, title, date, tcg, decklist_deadline, decklist_game, decklist_regulation")
      .eq("decklist_enabled", true)
      .order("date", { ascending: true })
      .then(({ data }) => {
        const open = ((data as OpenEvent[]) ?? []).filter((e) => !e.decklist_deadline || Date.parse(e.decklist_deadline) > Date.now());
        setEvents(open);
        // ทัวร์ที่ตรงกับเกมของเด็คขึ้นก่อน และเลือกให้อัตโนมัติถ้ามีทัวร์เดียว
        const fit = open.filter((e) => !(e.decklist_game || (e.tcg !== "Mixed" ? e.tcg : "")) || (e.decklist_game || e.tcg) === deck.tcg);
        if (fit.length === 1) setEventId(fit[0].id);
      });
    supabase.from("profiles").select("display_name, username").eq("id", userId).maybeSingle()
      .then(({ data }) => setPlayerName((p) => p || data?.display_name || data?.username || ""));
    supabase.from("event_decklists").select("event_id").eq("user_id", userId)
      .then(({ data }) => setAlready(new Set((data ?? []).map((d) => d.event_id as string))));
  }, [deck.tcg, userId]);

  async function submit() {
    setSending(true);
    setError("");
    setIssues([]);
    try {
      const res = await fetch("/api/decklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, deckId: deck.id, playerName, deckCode, consent }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? L("ส่งไม่สำเร็จ กรุณาลองใหม่", "Couldn't submit. Please try again."));
        setIssues(json.issues ?? []);
      } else {
        setDone({ updated: json.updated, warnings: json.warnings ?? [] });
        onDone();
      }
    } catch {
      setError(L("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", "Connection failed. Please try again."));
    }
    setSending(false);
  }

  const ev = events?.find((e) => e.id === eventId);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="decklist-title"
        className="relative bg-white w-full rounded-t-2xl sm:rounded-2xl sm:max-w-md max-h-[90vh] overflow-y-auto px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 id="decklist-title" className="text-sm font-semibold text-zinc-900">{L("ส่ง Decklist", "Submit decklist")}</h2>
          <button type="button" onClick={close} aria-label={L("ปิด", "Close")} className="w-10 h-10 -mr-2 flex items-center justify-center text-zinc-500">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>

        {done ? (
          <div className="space-y-3">
            <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-3">
              {done.updated ? L("อัปเดต decklist แล้ว — ทีมงานจะตรวจอีกครั้ง", "Decklist updated — staff will check it again") : L("ส่ง decklist แล้ว — ทีมงานจะตรวจก่อนวันแข่ง", "Decklist submitted — staff will check it before the event")}
            </p>
            {done.warnings.length > 0 && (
              <ul className="bg-amber-50 rounded-xl px-3 py-2 space-y-1">
                {done.warnings.map((i, n) => <li key={n} className="text-xs text-amber-800">{L(i.th, i.en)}</li>)}
              </ul>
            )}
            {ev?.decklist_deadline && <p className="text-[11px] text-zinc-500">{L("แก้ไขได้ถึง", "You can edit until")} {fmt(ev.decklist_deadline, lang)}</p>}
            <button type="button" onClick={close} className="btn-primary w-full">{L("เสร็จแล้ว", "Done")}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500">{L("เด็ค", "Deck")}: <span className="text-zinc-900 font-medium">{deck.name}</span> · {tcgLabel(deck.tcg)}</p>

            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">{L("เลือกทัวร์", "Choose a tournament")}</p>
              {events === null && <div className="h-12 bg-zinc-100 animate-pulse rounded-xl" />}
              {events?.length === 0 && <p className="text-xs text-zinc-600 bg-zinc-50 rounded-xl px-3 py-3">{L("ตอนนี้ยังไม่มีทัวร์ที่เปิดรับ decklist", "No tournaments are taking decklists right now")}</p>}
              <div className="space-y-2">
                {events?.map((e) => (
                  <button key={e.id} type="button" onClick={() => setEventId(e.id)} aria-pressed={eventId === e.id}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 ${eventId === e.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                    <p className="text-xs font-semibold text-zinc-900">{e.title}</p>
                    <p className="text-[11px] text-zinc-500">
                      {[e.date && new Date(e.date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }),
                        (e.decklist_game || (e.tcg !== "Mixed" ? e.tcg : "")) && tcgLabel((e.decklist_game || e.tcg)!),
                        e.decklist_regulation && `Regulation ${e.decklist_regulation}`].filter(Boolean).join(" · ")}
                    </p>
                    {e.decklist_deadline && <p className="text-[11px] text-zinc-500">{L("ปิดรับ", "Closes")} {fmt(e.decklist_deadline, lang)}</p>}
                    {already.has(e.id) && <p className="text-[11px] text-amber-800 mt-1">{L("ส่งไว้แล้ว — ส่งใหม่จะแทนที่ของเดิม", "Already submitted — sending again replaces it")}</p>}
                  </button>
                ))}
              </div>
            </div>

            <input className="input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={60}
              placeholder={L("ชื่อเล่นที่ใช้แข่ง *", "Nickname you play under *")} aria-label={L("ชื่อเล่นที่ใช้แข่ง", "Player nickname")} />
            {deck.tcg === "Pokémon" && (
              <input className="input" value={deckCode} onChange={(e) => setDeckCode(e.target.value)} maxLength={120}
                placeholder={L("รหัสเด็คจากเว็บ Pokémon (ไม่บังคับ)", "Deck code from the Pokémon site (optional)")} aria-label={L("รหัสเด็ค", "Deck code")} />
            )}

            <label className="flex items-start gap-2 bg-zinc-50 rounded-xl px-3 py-3 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 flex-shrink-0" />
              <span className="text-[11px] text-zinc-700 leading-relaxed">
                {L(DECKLIST_CONSENT.th, DECKLIST_CONSENT.en)} <a href="/privacy#decklist" target="_blank" className="underline">{L("อ่านนโยบาย", "Read the policy")}</a>
              </span>
            </label>

            {error && <p className="text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            {issues.length > 0 && (
              <ul className="bg-red-50 rounded-xl px-3 py-2 space-y-1">
                {issues.map((i, n) => <li key={n} className={`text-xs ${i.level === "error" ? "text-red-700" : "text-amber-800"}`}>{L(i.th, i.en)}</li>)}
              </ul>
            )}

            <button type="button" onClick={submit} disabled={sending || !eventId || !consent || !playerName.trim()} className="btn-primary w-full disabled:opacity-40">
              {sending ? L("กำลังส่ง...", "Submitting...") : L("ส่ง Decklist", "Submit decklist")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
