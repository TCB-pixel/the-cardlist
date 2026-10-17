"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import { CATALOG_GAMES } from "@/lib/tcg";

export type TcgCard = {
  id: string;
  game: string;
  lang: string;
  set_code: string;
  set_name: string;
  card_number: string;
  variant: string;
  name: string;
  rarity: string | null;
  card_type: string | null;
  image_url: string | null;
};

const LANG_LABEL: Record<string, string> = { th: "TH", en: "EN", ja: "JP" };

// ตัดอักขระที่ทำให้ตัวกรอง PostgREST เพี้ยน
const clean = (q: string) => q.replace(/[,()%*\\]/g, " ").trim();

// ช่องค้นการ์ดจากฐานข้อมูล tcg_cards — ใช้ร่วมกันใน Collection และ Deck Builder
// ถ้าเกมนั้นยังไม่มีฐานข้อมูล หรือโหลดไม่ได้ (เช่น ตารางยังไม่ถูกสร้าง) จะซ่อนตัวเอง ให้ลูกค้าพิมพ์ชื่อเองได้ตามเดิม
export default function CardSearch({ game, onSelect }: { game: string; onSelect: (card: TcgCard) => void }) {
  const { L } = useLang();
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("all");
  const [results, setResults] = useState<TcgCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const seq = useRef(0);

  // เกมที่ยังไม่มีแหล่งข้อมูล ค้นได้เฉพาะการ์ดที่ทีมร้านเพิ่มเอง
  const synced = CATALOG_GAMES.includes(game);

  useEffect(() => {
    const term = clean(q);
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    const mine = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      let query = createClient()
        .from("tcg_cards")
        .select("id, game, lang, set_code, set_name, card_number, variant, name, rarity, card_type, image_url")
        .eq("game", game)
        .or(`name.ilike.%${term}%,card_number.ilike.%${term}%`)
        // แหล่งข้อมูลก่อน (manual → optcgapi → pokemon-th → tcgdex = การ์ดไทยทางการขึ้นก่อน TCGdex)
        // แล้วเซตใหม่ก่อน (ไม่มีวันออก → เรียงรหัสเซต แล้วรหัสการ์ดของแหล่งจากใหม่ไปเก่า)
        .order("source")
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("set_code", { ascending: false })
        .order("card_number")
        .order("source_id", { ascending: false })
        .limit(20);
      if (lang !== "all") query = query.eq("lang", lang);
      const { data, error } = await query;
      if (mine !== seq.current) return;
      if (error) { setUnavailable(true); setResults([]); }
      else setResults((data as TcgCard[]) ?? []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, lang, game]);

  if (unavailable) return null;

  const langs = game === "Pokémon" ? ["all", "th", "en"] : [];

  return (
    <div className="space-y-2">
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={L("ค้นหาการ์ดจากชื่อหรือเลขการ์ด", "Search by card name or number")}
        aria-label={L("ค้นหาการ์ด", "Search cards")} />
      {langs.length > 0 && (
        <div className="flex gap-2">
          {langs.map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${lang === l ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>
              {l === "all" ? L("ทุกภาษา", "All languages") : l === "th" ? L("ภาษาไทย", "Thai") : L("อังกฤษ", "English")}
            </button>
          ))}
        </div>
      )}
      {searching && <p className="text-[11px] text-zinc-500" role="status">{L("กำลังค้นหา...", "Searching...")}</p>}
      {!searching && clean(q).length >= 2 && results.length === 0 && (
        <p className="text-[11px] text-zinc-500">{L("ไม่พบการ์ด — พิมพ์ชื่อเองด้านล่างได้", "No match — you can type it below.")}</p>
      )}
      {results.length > 0 && (
        <ul className="border border-zinc-100 rounded-xl divide-y divide-zinc-100 max-h-80 overflow-y-auto bg-white">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { onSelect(c); setQ(""); setResults([]); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left active:bg-zinc-50">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} loading="lazy" className="w-10 h-14 object-cover rounded bg-zinc-100 flex-shrink-0" />
                  : <div className="w-10 h-14 rounded bg-zinc-100 flex-shrink-0" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{c.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {[c.card_number, c.set_name, c.variant !== "normal" ? c.variant : "", c.rarity].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="badge-pre flex-shrink-0">{LANG_LABEL[c.lang] ?? c.lang}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-zinc-500">
        {!synced
          ? L("เกมนี้ยังมีข้อมูลการ์ดไม่ครบ — ไม่เจอให้พิมพ์ชื่อเองด้านล่าง", "Card data for this game is limited — type the name below if it's missing.")
          : game === "Eidolon"
            ? L("ข้อมูลและภาพการ์ดจาก Eidolon TCG (eidolontcg.com)", "Card data and images from Eidolon TCG (eidolontcg.com)")
            : game === "Pokémon"
            ? L("ข้อมูลการ์ดจาก Pokémon Thailand ©Pokémon/Nintendo/Creatures/GAME FREAK และ TCGdex", "Card data from Pokémon Thailand ©Pokémon/Nintendo/Creatures/GAME FREAK and TCGdex")
            : L("ข้อมูลการ์ดจาก optcgapi.com", "Card data from optcgapi.com")}
      </p>
    </div>
  );
}
