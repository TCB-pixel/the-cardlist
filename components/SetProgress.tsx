"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import { tcgLabel } from "@/lib/tcg";

// การ์ดในคอลเลกชันที่ผูกกับฐานข้อมูลแล้ว (มี card_id) — ใช้คิดว่าครบเซตแค่ไหน
export type OwnedRef = { status: string; card: { game: string; lang: string; set_code: string; card_number: string } | null };

type SetRow = { game: string; lang: string; set_code: string; name: string; card_count: number | null; release_date: string | null };
type MissingCard = { id: string; name: string; card_number: string; set_name: string; rarity: string | null; image_url: string | null; lang: string; game: string };

const key = (g: string, l: string, s: string) => `${g}|${l}|${s}`;
const LANG_LABEL: Record<string, string> = { th: "TH", en: "EN", ja: "JP" };

// % ครบเซต + รายการการ์ดที่ยังขาด · นับเฉพาะ "มี" และ "พร้อมแลก" · นับเลขการ์ดไม่ซ้ำ (parallel ไม่นับเพิ่ม)
export default function SetProgress({ owned, onWant }: { owned: OwnedRef[]; onWant: (c: MissingCard) => Promise<void> }) {
  const { L } = useLang();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [missing, setMissing] = useState<MissingCard[]>([]);
  const [missingLoading, setMissingLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // เลขการ์ดที่มีแล้ว แยกตามเซต
  const ownedBySet = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const o of owned) {
      if (!o.card || o.status === "want") continue;
      const k = key(o.card.game, o.card.lang, o.card.set_code);
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(o.card.card_number);
    }
    return m;
  }, [owned]);

  const codes = useMemo(() => [...new Set([...ownedBySet.keys()].map((k) => k.split("|")[2]))], [ownedBySet]);

  async function loadSets() {
    if (!codes.length) { setSets([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    const { data, error } = await createClient()
      .from("tcg_sets")
      .select("game, lang, set_code, name, card_count, release_date")
      .in("set_code", codes);
    if (error) setError(L("โหลดข้อมูลเซตไม่สำเร็จ", "Couldn't load sets"));
    else setSets(((data as SetRow[]) ?? []).filter((s) => ownedBySet.has(key(s.game, s.lang, s.set_code))));
    setLoading(false);
  }

  useEffect(() => { loadSets(); }, [codes.join(",")]);

  async function toggle(s: SetRow) {
    const k = key(s.game, s.lang, s.set_code);
    if (open === k) { setOpen(null); return; }
    setOpen(k);
    setMissing([]);
    setMissingLoading(true);
    const { data } = await createClient()
      .from("tcg_cards")
      .select("id, name, card_number, set_name, rarity, image_url, lang, game, variant")
      .eq("game", s.game).eq("lang", s.lang).eq("set_code", s.set_code)
      .order("card_number")
      .limit(1000);
    const have = ownedBySet.get(k) ?? new Set();
    const seen = new Set<string>();
    // การ์ดละ 1 แถว (ใช้แบบ normal ถ้ามี)
    const rows = ((data as (MissingCard & { variant: string })[]) ?? [])
      .sort((a, b) => (a.variant === "normal" ? -1 : 0) - (b.variant === "normal" ? -1 : 0))
      .filter((c) => !have.has(c.card_number) && !seen.has(c.card_number) && seen.add(c.card_number))
      .sort((a, b) => a.card_number.localeCompare(b.card_number, undefined, { numeric: true }));
    setMissing(rows);
    setMissingLoading(false);
  }

  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-16 bg-zinc-100 animate-pulse rounded-2xl" />)}</div>;
  if (error) return (
    <div className="bg-red-50 rounded-2xl px-4 py-4">
      <p className="text-xs text-red-700 mb-3">{error}</p>
      <button type="button" onClick={loadSets} className="btn-outline bg-white">{L("ลองใหม่", "Try again")}</button>
    </div>
  );
  if (!sets.length) return (
    <div className="card px-5 py-10 text-center">
      <p className="text-sm text-zinc-500">{L("ยังไม่มีการ์ดที่เลือกจากฐานข้อมูล", "No cards picked from the database yet")}</p>
      <p className="text-[11px] text-zinc-500 mt-1">{L("เพิ่มการ์ดด้วยช่องค้นหา แล้วจะเห็นว่าแต่ละเซตครบแค่ไหน", "Add cards with the search box to see set completion")}</p>
    </div>
  );

  const rows = sets
    .map((s) => {
      const have = ownedBySet.get(key(s.game, s.lang, s.set_code))?.size ?? 0;
      const total = Math.max(s.card_count ?? 0, have);
      return { s, have, total, pct: total ? Math.round((have / total) * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="space-y-2">
      {rows.map(({ s, have, total, pct }) => {
        const k = key(s.game, s.lang, s.set_code);
        return (
          <div key={k} className="card overflow-hidden">
            <button type="button" onClick={() => toggle(s)} aria-expanded={open === k} className="w-full text-left px-4 py-3.5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{s.name}</p>
                  <p className="text-[11px] text-zinc-500">{tcgLabel(s.game)} · {LANG_LABEL[s.lang] ?? s.lang} · {s.set_code}</p>
                </div>
                <p className="text-xs font-semibold text-zinc-900 flex-shrink-0">{have}/{total} <span className="text-zinc-500 font-normal">({pct}%)</span></p>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </button>
            {open === k && (
              <div className="border-t border-zinc-100 px-4 py-3">
                {missingLoading && <p className="text-[11px] text-zinc-500" role="status">{L("กำลังโหลด...", "Loading...")}</p>}
                {!missingLoading && missing.length === 0 && <p className="text-xs text-green-700">{L("ครบเซตแล้ว", "Set complete")}</p>}
                {!missingLoading && missing.length > 0 && (
                  <>
                    <p className="text-[11px] text-zinc-500 mb-2">{L(`ยังขาด ${missing.length} ใบ`, `${missing.length} cards missing`)}</p>
                    <ul className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
                      {missing.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 py-2">
                          {c.image_url
                            ? <img src={c.image_url} alt={c.name} loading="lazy" className="w-9 h-12 object-cover rounded bg-zinc-100 flex-shrink-0" />
                            : <div className="w-9 h-12 rounded bg-zinc-100 flex-shrink-0" aria-hidden="true" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-900 truncate">{c.name}</p>
                            <p className="text-[11px] text-zinc-500">{[c.card_number, c.rarity].filter(Boolean).join(" · ")}</p>
                          </div>
                          <button type="button" disabled={added.has(c.id)}
                            onClick={async () => { await onWant(c); setAdded(new Set(added).add(c.id)); }}
                            className="text-[11px] text-zinc-700 border border-zinc-200 rounded-full px-3 py-2 flex-shrink-0 disabled:opacity-40">
                            {added.has(c.id) ? L("เพิ่มแล้ว", "Added") : L("+ อยากได้", "+ Want")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
