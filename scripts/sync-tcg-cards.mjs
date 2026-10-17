// ดึงข้อมูลการ์ดจากแหล่งฟรีเข้าตาราง tcg_sets / tcg_cards (Collection Tracker + Deck Builder เฟส 1)
//
//   ทดลองดึงอย่างเดียว ไม่เขียนฐานข้อมูล:
//     node scripts/sync-tcg-cards.mjs --dry-run
//   เขียนจริง (ต้องได้รับอนุมัติจากเจ้าของก่อน · ใช้ service role key จาก .env.local ห้ามพิมพ์ออกมา):
//     node --env-file=.env.local scripts/sync-tcg-cards.mjs
//   เลือกเกม: --game=pokemon / --game=onepiece / --game=pokemon-th / --game=eidolon (ไม่ใส่ = ทั้งหมด)
//   Eidolon: --eidolon-csv=<ไฟล์> ใช้ CSV ที่บันทึกไว้แทนการดึงใหม่ (ใช้ตอนทดสอบ)
//   OnPlay (6 เกม): --game=onplay · ทดสอบ --onplay-game=haikyu --onplay-max-pages=1
//   Pokémon Thailand:
//     --th-html=<ไฟล์>   ใช้หน้า /th/deck-build/ ที่บันทึกไว้แทนการดึงใหม่ (ใช้ตอนทดสอบ)
//     --th-details=<N>   ดึงหน้ารายละเอียดการ์ดที่ยังไม่มีเซต/เลขการ์ด ทีละใบ ห่างกัน 1.5 วินาที สูงสุด N ใบต่อรอบ
//                        (ปิดไว้เป็นค่าเริ่มต้น — เปิดเมื่อเจ้าของอนุมัติ)
//     --force            ดึงซ้ำได้แม้ดึงไปแล้วภายใน 20 ชั่วโมง
//
// แหล่งข้อมูล
//   Pokémon  — TCGdex https://tcgdex.dev (ฟรี โอเพนซอร์ส ไม่ต้องใช้ key) ภาษาไทย + อังกฤษ
//   Pokémon ภาษาไทยทางการ — asia.pokemon-card.com/th (ได้รับอนุญาต 17 ต.ค. 2026 · ดึงวันละไม่เกิน 1 ครั้ง ·
//     ใช้รูปผ่านลิงก์ของเว็บ · ดู company-brain/permissions/2026-10-17_pokemon-th-card-data.md)
//   One Piece — optcgapi https://optcgapi.com (ฟรี ขอให้ไม่เรียกถี่ — รันวันละครั้งพอ)
// แหล่งข้อมูลบางแห่งมีราคาการ์ดปนมา — สคริปต์นี้ไม่เก็บราคาเด็ดขาด (กฎบริษัท)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const GAME = arg("game") ?? "all";
const TH_HTML = arg("th-html");
const TH_DETAILS = Math.max(0, parseInt(arg("th-details") ?? "0", 10) || 0);
const PTH_BASE = "https://asia.pokemon-card.com";
const POKEMON_LANGS = ["th", "en"];
const UA = { "User-Agent": "thecardlistbkk.com card catalog sync (contact: thecardlistbkk.com)" };

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

// ทำงานทีละ n ชิ้นพร้อมกัน — ไม่ยิงแหล่งข้อมูลรัว ๆ
async function mapLimit(items, n, fn) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// ---------- Pokémon (TCGdex) ----------
async function pokemon() {
  const sets = [];
  const cards = [];
  for (const lang of POKEMON_LANGS) {
    const list = await getJson(`https://api.tcgdex.net/v2/${lang}/sets`);
    const details = await mapLimit(list, 4, (s) => getJson(`https://api.tcgdex.net/v2/${lang}/sets/${encodeURIComponent(s.id)}`).catch((e) => {
      console.warn(`ข้ามเซต ${lang}/${s.id}: ${e.message}`);
      return null;
    }));
    for (const d of details) {
      if (!d) continue;
      sets.push({
        game: "Pokémon", lang, set_code: d.id, name: d.name,
        release_date: d.releaseDate ?? null,
        card_count: d.cardCount?.total ?? null,
        logo_url: d.logo ? `${d.logo}.webp` : null,
        source: "tcgdex",
      });
      for (const c of d.cards ?? []) {
        cards.push({
          game: "Pokémon", lang, set_code: d.id, set_name: d.name,
          card_number: c.localId, variant: "normal", name: c.name,
          release_date: d.releaseDate ?? null,
          rarity: null, card_type: null, color: null,
          image_url: c.image ? `${c.image}/low.webp` : null,
          attrs: {},
          source: "tcgdex", source_id: c.id,
        });
      }
    }
    console.log(`Pokémon ${lang}: ${details.filter(Boolean).length} เซต`);
  }
  return { sets, cards };
}

// ---------- One Piece (optcgapi) ----------
function opVariant(imageId) {
  const suffix = imageId.split("_")[1]?.replace(/\.jpg$/i, "").toLowerCase();
  if (!suffix) return "normal";
  const m = suffix.match(/^([pr])(\d+)$/);
  if (m) return `${m[1] === "p" ? "parallel" : "reprint"}-${m[2]}`;
  return suffix;
}

function opName(raw) {
  return raw.replace(/\s*\(\d{3}\)/, "").replace(/\s*\(Parallel\)/i, "").trim();
}

async function onePiece() {
  const rows = [
    ...(await getJson("https://optcgapi.com/api/allSetCards/")),
    ...(await getJson("https://optcgapi.com/api/allSTCards/")),
  ];
  const sets = new Map();
  const cards = new Map(); // ซ้ำ card_image_id ได้ในข้อมูลต้นทาง → เก็บตัวล่าสุด
  for (const r of rows) {
    if (!r.card_image_id || !r.card_set_id) continue;
    sets.set(r.set_id, { game: "One Piece", lang: "en", set_code: r.set_id, name: r.set_name, release_date: null, card_count: null, logo_url: null, source: "optcgapi" });
    cards.set(r.card_image_id, {
      game: "One Piece", lang: "en", set_code: r.set_id, set_name: r.set_name,
      card_number: r.card_set_id, variant: opVariant(r.card_image_id), name: opName(r.card_name),
      release_date: null,
      rarity: r.rarity ?? null, card_type: r.card_type ?? null, color: r.card_color ?? null,
      image_url: r.card_image ?? null,
      // ข้อมูลเกมเท่านั้น — ไม่มี inventory_price / market_price
      attrs: {
        cost: r.card_cost, power: r.card_power, life: r.life, counter: r.counter_amount,
        attribute: r.attribute, types: r.sub_types, text: r.card_text,
      },
      source: "optcgapi", source_id: r.card_image_id,
    });
  }
  // จำนวนการ์ดในเซต = เลขการ์ดไม่ซ้ำ (ไม่นับ parallel/reprint) ใช้คิด % ครบเซต
  for (const s of sets.values()) s.card_count = new Set([...cards.values()].filter((c) => c.set_code === s.set_code).map((c) => c.card_number)).size;
  console.log(`One Piece: ${sets.size} เซต`);
  return { sets: [...sets.values()], cards: [...cards.values()] };
}

// ---------- Pokémon ภาษาไทยทางการ (asia.pokemon-card.com/th) ----------
const unescapeHtml = (x) => x
  .replace(/\\'/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&amp;/g, "&").trim();
const nameKey = (n) => n.replace(/\s+/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text(); // เว็บส่ง charset=UTF-8 — fetch ถอดเป็น UTF-8 ให้ถูกต้อง
}

// หน้ารายละเอียดการ์ด: รหัสเซต · ชื่อเซต · เลขการ์ด (001/130) · regulation mark
async function pthDetail(cardId) {
  const h = await getText(`${PTH_BASE}/th/card-search/detail/${cardId}/`);
  const pick = (re) => unescapeHtml(h.match(re)?.[1] ?? "");
  const collector = pick(/class="collectorNumber">\s*([^<]*)</);
  const [num, of] = collector.split("/");
  return {
    set_code: pick(/expansionCodes=([A-Za-z0-9-]+)/),
    set_name: pick(/class="expansionLinkColumn">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/).replace(/^การ์ดชุด(เสริม|หลัก)?\s*/, "").replace(/^"|"$/g, ""),
    card_number: (num ?? "").trim(),
    set_total: parseInt(of ?? "", 10) || null,
    regulation: pick(/class="alpha">\s*([^<]*)</),
  };
}

// existing = แถว pokemon-th ที่มีในฐานข้อมูลแล้ว (เก็บเซต/เลขที่เคยดึงไว้ ไม่ให้ทับเป็นค่าว่าง)
async function pokemonTh(tcgdexTh, existing) {
  const html = TH_HTML ? readFileSync(TH_HTML, "utf8") : await getText(`${PTH_BASE}/th/deck-build/`);
  const re = /cardList\.push\(\{\s*imgFileSrc:\s*'([^']*)',\s*cardId:\s*'([^']*)',\s*cardName:\s*'((?:[^'\\]|\\.)*)',\s*legendaryFlg:\s*'([^']*)'/g;
  const list = [...html.matchAll(re)].map((m) => ({ img: m[1], id: m[2], name: unescapeHtml(m[3]), legendary: m[4] === "1" }));
  if (list.length < 1000) throw new Error(`Pokémon Thailand: อ่านการ์ดได้แค่ ${list.length} ใบ — หน้าเว็บอาจเปลี่ยนรูปแบบ หยุดก่อนบันทึก`);

  // จับคู่ชื่อกับ TCGdex ภาษาไทย เฉพาะชื่อที่ไม่ซ้ำทั้งสองฝั่ง (ชื่อซ้ำหลายเซต = ไม่เดา)
  const count = (arr, f) => arr.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map());
  const tdCount = count(tcgdexTh, (c) => nameKey(c.name));
  const pthCount = count(list, (c) => nameKey(c.name));
  const tdByName = new Map(tcgdexTh.map((c) => [nameKey(c.name), c]));

  // ดึงหน้ารายละเอียดเฉพาะใบที่ยังไม่มีเลขการ์ด — ใหม่สุดก่อน
  const fetched = new Map();
  if (TH_DETAILS) {
    const todo = list.filter((c) => !existing.get(c.id)?.card_number).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, TH_DETAILS);
    for (const [i, c] of todo.entries()) {
      try { fetched.set(c.id, await pthDetail(c.id)); }
      catch (e) { console.warn(`ข้ามรายละเอียด ${c.id}: ${e.message}`); }
      if (i < todo.length - 1) await sleep(1500);
    }
    console.log(`Pokémon Thailand: ดึงรายละเอียดเพิ่ม ${fetched.size} ใบ`);
  }

  const sets = new Map();
  const cards = list.map((c) => {
    // ค่าเดิมเก็บต่อเฉพาะที่มาจากหน้ารายละเอียดของเว็บทางการ — ค่าที่จับคู่จาก TCGdex คำนวณใหม่ทุกรอบ (กันจับคู่ผิดค้าง)
    const oldDet = existing.get(c.id)?.attrs?.from_detail ? existing.get(c.id) : null;
    const det = fetched.get(c.id) ?? (oldDet ? { set_code: oldDet.set_code, set_name: oldDet.set_name, card_number: oldDet.card_number, regulation: oldDet.attrs.regulation } : null);
    const td = tdCount.get(nameKey(c.name)) === 1 && pthCount.get(nameKey(c.name)) === 1 ? tdByName.get(nameKey(c.name)) : null;
    if (fetched.get(c.id)?.set_code) {
      const d = fetched.get(c.id);
      sets.set(d.set_code, { game: "Pokémon", lang: "th", set_code: d.set_code, name: d.set_name || d.set_code, release_date: null, card_count: d.set_total, logo_url: null, source: "pokemon-th" });
    }
    return {
      game: "Pokémon", lang: "th",
      set_code: det?.set_code || td?.set_code || "",
      set_name: det?.set_name || td?.set_name || "",
      card_number: det?.card_number || td?.card_number || "",
      variant: "normal", name: c.name,
      release_date: td?.release_date ?? null,
      rarity: null, card_type: null, color: null,
      image_url: c.img.startsWith("http") ? c.img : `${PTH_BASE}${c.img}`,
      attrs: {
        legendary: c.legendary,
        ...(det ? { from_detail: true, ...(det.regulation ? { regulation: det.regulation } : {}) } : {}),
        ...(td ? { tcgdex_id: td.source_id, tcgdex_set: td.set_code, tcgdex_number: td.card_number } : {}),
      },
      source: "pokemon-th", source_id: c.id.padStart(8, "0"),
    };
  });
  const matched = cards.filter((c) => c.attrs.tcgdex_id).length;
  console.log(`Pokémon Thailand: ${cards.length} ใบ · จับคู่ชื่อกับ TCGdex ได้ ${matched} · มีเลขการ์ด ${cards.filter((c) => c.card_number).length}`);
  return { sets: [...sets.values()], cards };
}

// ---------- Eidolon TCG (Google Sheet ที่เผยแพร่ ซึ่งหน้า eidolontcg.com/card-list ใช้แสดงการ์ด) ----------
// สิทธิ์: ร้านเป็นหุ้นส่วน Eidolon (company-brain/eidolon-assets.md) · ดึงวันละไม่เกิน 1 ครั้ง · รูปใช้ลิงก์ Drive thumbnail แบบเดียวกับเว็บทางการ
// ชีตเก็บแบบแนวนอน: แต่ละแถว = 1 ช่องข้อมูล (ชื่อ, รหัส, ชุด, สี ...) · แต่ละคอลัมน์ = การ์ด 1 ใบ
const EIDOLON_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQ_80H95HoS2nHSkBaOSmrFoG4O-X7mEUXBc_IFVBKCYBwik1o0oDaVWmZh8fq1-J6FVTly_x6ssQM/pub?gid=424622576&single=true&output=csv";
const EIDOLON_FILE = arg("eidolon-csv");

function parseCsvRows(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function eidolon() {
  const text = EIDOLON_FILE ? readFileSync(EIDOLON_FILE, "utf8") : await getText(EIDOLON_CSV);
  const fields = {};
  for (const r of parseCsvRows(text.replace(/^﻿/, ""))) if (r.length > 1) fields[r[0].trim()] = r.slice(1);
  const names = fields["ชื่อ"] ?? [];
  if (names.filter((n) => n.trim()).length < 100) throw new Error(`Eidolon: อ่านการ์ดได้แค่ ${names.length} ใบ — ชีตอาจเปลี่ยนรูปแบบ หยุดก่อนบันทึก`);
  const get = (k, i) => (fields[k]?.[i] ?? "").trim();
  const num = (v) => (/^-?\d+$/.test(v) ? parseInt(v, 10) : null);
  const thumb = (url) => {
    const id = url.match(/[-\w]{25,}/)?.[0];
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w500` : null;
  };

  const sets = new Map();
  const seen = new Map();
  const cards = [];
  names.forEach((raw, i) => {
    const name = raw.trim();
    const code = get("รหัส", i);
    if (!name || !code) return;
    // รหัสซ้ำในชีตต้นทาง (เช่น EP01/032) → ต่อท้าย #2 ให้ไม่ชนกัน
    const n = (seen.get(code) ?? 0) + 1;
    seen.set(code, n);
    const set_code = get("ชุด", i) || code.split("/")[0];
    sets.set(set_code, { game: "Eidolon", lang: "th", set_code, name: set_code, release_date: null, card_count: null, logo_url: null, source: "eidolon" });
    cards.push({
      game: "Eidolon", lang: "th", set_code, set_name: set_code,
      card_number: code, variant: "normal", name,
      release_date: null,
      rarity: get("ความหายาก", i) || null,
      card_type: get("ชนิด", i) || null,
      color: get("สี", i) || null,
      image_url: thumb(get("รูปการ์ด", i)),
      attrs: {
        sub: get("Type/Sub", i) || null,
        cost: num(get("COST", i)), atk: num(get("ATK", i)), def: num(get("DEF", i)), hp: num(get("HP", i)),
        text: get("ความสามารถ", i) || null,
        artist: get("นักวาด", i) || null,
      },
      source: "eidolon", source_id: n > 1 ? `${code}#${n}` : code,
    });
  });
  for (const s of sets.values()) s.card_count = new Set(cards.filter((c) => c.set_code === s.set_code).map((c) => c.card_number)).size;
  console.log(`Eidolon: ${sets.size} ชุด · ${cards.length} ใบ · มีรูป ${cards.filter((c) => c.image_url).length}`);
  return { sets: [...sets.values()], cards };
}

// ---------- OnPlay Arena (https://arena.onplay.in.th/cards/) ----------
// เจ้าของสั่งดึง 18 ต.ค. 2026 ("ทั้ง 6 เกม ตามที่ robots.txt อนุญาต") · robots.txt: Allow: / · ไม่พบหน้าเงื่อนไขการใช้งาน
// ใช้ JSON API ที่หน้าเว็บของ OnPlay ใช้เอง · ทีละหน้า 200 ใบ ห่างกัน 1.5 วินาที · ดึงไม่เกินวันละครั้ง
// รูป: ลิงก์ตามที่ OnPlay ให้มา (Duel Masters ชี้ไปเว็บ Takara Tomy, เกมอื่นอยู่บนเซิร์ฟเวอร์ OnPlay) ไม่โหลดมาเก็บเอง
const ONPLAY = "https://arena.onplay.in.th/api/v1";
const ONPLAY_GAMES = {
  dm: "Duel Masters", haikyu: "Haikyu!!", conan: "Detective Conan",
  wixoss: "WIXOSS", horobeat: "Horo-Beat", nijisanji: "Nijinana",
};
const ONPLAY_ONLY = arg("onplay-game"); // ทดสอบทีละเกม เช่น --onplay-game=haikyu
const ONPLAY_MAX_PAGES = parseInt(arg("onplay-max-pages") ?? "0", 10) || Infinity; // ทดสอบแบบจำกัดหน้า

async function onPlay() {
  const sets = [];
  const cards = [];
  for (const [code, game] of Object.entries(ONPLAY_GAMES)) {
    if (ONPLAY_ONLY && ONPLAY_ONLY !== code) continue;
    const filters = await getJson(`${ONPLAY}/cards/filters/?game=${code}`);
    await sleep(1500);
    const setName = new Map((filters.sets ?? []).map((s) => [s.code, s.name_th || s.name_en || s.name || s.code]));
    for (const [set_code, name] of setName) {
      sets.push({ game, lang: "th", set_code, name, release_date: null, card_count: null, logo_url: null, source: "onplay" });
    }
    let url = `${ONPLAY}/cards/?game=${code}&page_size=200`;
    let pages = 0;
    let n = 0;
    while (url && pages < ONPLAY_MAX_PAGES) {
      const page = await getJson(url);
      pages++;
      for (const c of page.results ?? []) {
        const facet = (k) => c.facets?.[k]?.[0];
        const name = (c.name_th || c.name_en || c.name_jp || "").trim();
        const number = (c.card_no || c.card_key || "").trim(); // บางเกม (Haikyu) ไม่มี card_no ใช้ card_key แทน
        if (!name || !number) continue;
        cards.push({
          game, lang: c.attributes?.text_lang === "jp" ? "ja" : "th",
          set_code: c.set_code || "", set_name: setName.get(c.set_code) ?? c.set_code ?? "",
          card_number: number, variant: c.is_parallel ? "parallel" : "normal", name,
          release_date: null,
          rarity: c.rarity || null,
          card_type: facet("type")?.name_en || facet("type")?.name_th || null,
          color: facet("color")?.name_th || facet("color")?.name_en || null,
          image_url: c.image || null,
          // ข้อมูลเกม + ชื่อภาษาอื่น + สถานะแบน (ไม่มีราคา)
          attrs: {
            ...(c.attributes ?? {}),
            name_en: c.name_en || null, name_jp: c.name_jp || null,
            text: c.text || null,
            banlist: Array.isArray(c.banlist) && c.banlist.length ? c.banlist : undefined,
          },
          source: "onplay", source_id: String(c.id),
        });
        n++;
      }
      url = page.next ? page.next.replace(/^http:/, "https:") : null;
      if (url) await sleep(1500);
    }
    console.log(`OnPlay ${game}: ${setName.size} ชุด · ${n} ใบ (${pages} หน้า)`);
    await sleep(1500);
  }
  return { sets, cards };
}

// ---------- main ----------
const now = new Date().toISOString();
// --save=<ไฟล์> (ใช้กับ --dry-run) เก็บผลที่ดึงได้ · --load=<ไฟล์> เขียนผลที่เก็บไว้เข้าฐานข้อมูลโดยไม่ดึงจากแหล่งซ้ำ
const SAVE = arg("save");
const LOAD = arg("load");
const result = LOAD ? JSON.parse(readFileSync(LOAD, "utf8")) : { sets: [], cards: [] };

let db = null;
if (!DRY) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน env");
  db = createClient(url, key, { auth: { persistSession: false } });
}

for (const [key, fn] of LOAD ? [] : [["pokemon", pokemon], ["onepiece", onePiece]]) {
  if (GAME !== "all" && GAME !== key) continue;
  const r = await fn();
  result.sets.push(...r.sets);
  result.cards.push(...r.cards);
}

if (!LOAD && (GAME === "all" || GAME === "pokemon-th")) {
  // แถวเดิมของ pokemon-th + กันดึงเกินวันละครั้ง
  const existing = new Map();
  let skip = false;
  if (db) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("tcg_cards")
        .select("source_id, set_code, set_name, card_number, release_date, attrs, updated_at")
        .eq("source", "pokemon-th").range(from, from + 999);
      if (error) throw new Error(`อ่านแถว pokemon-th เดิมไม่ได้: ${error.message}`);
      for (const r of data) existing.set(String(Number(r.source_id)), r);
      if (data.length < 1000) break;
    }
    const last = Math.max(0, ...[...existing.values()].map((r) => Date.parse(r.updated_at)));
    if (!FORCE && Date.now() - last < 20 * 3600 * 1000) {
      console.log("Pokémon Thailand: ดึงไปแล้วภายใน 20 ชั่วโมง — ข้าม (ใช้ --force ถ้าจำเป็น)");
      skip = true;
    }
  }
  if (!skip) {
    // ใช้ข้อมูล TCGdex ไทยจากรอบนี้ ถ้าไม่ได้ดึงมาในรอบนี้ อ่านจากฐานข้อมูล
    let tcgdexTh = result.cards.filter((c) => c.source === "tcgdex" && c.lang === "th");
    if (!tcgdexTh.length && db) {
      // Supabase ส่งกลับครั้งละไม่เกิน 1,000 แถว — อ่านทีละหน้า
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from("tcg_cards").select("name, source_id, set_code, set_name, card_number, release_date")
          .eq("source", "tcgdex").eq("lang", "th").order("source_id").range(from, from + 999);
        if (error) throw new Error(`อ่าน TCGdex ไทยไม่ได้: ${error.message}`);
        tcgdexTh.push(...data);
        if (data.length < 1000) break;
      }
    }
    if (!tcgdexTh.length) tcgdexTh = (await getJson("https://api.tcgdex.net/v2/th/cards")).map((c) => ({ name: c.name, source_id: c.id, set_code: c.id.split("-")[0], set_name: "", card_number: c.localId, release_date: null }));
    const r = await pokemonTh(tcgdexTh, existing);
    result.sets.push(...r.sets);
    result.cards.push(...r.cards);
  }
}

if (!LOAD && (GAME === "all" || GAME === "eidolon")) {
  let skip = false;
  if (db && !FORCE) {
    const { data } = await db.from("tcg_cards").select("updated_at").eq("source", "eidolon").order("updated_at", { ascending: false }).limit(1);
    if (data?.[0] && Date.now() - Date.parse(data[0].updated_at) < 20 * 3600 * 1000) {
      console.log("Eidolon: ดึงไปแล้วภายใน 20 ชั่วโมง — ข้าม (ใช้ --force ถ้าจำเป็น)");
      skip = true;
    }
  }
  if (!skip) {
    const r = await eidolon();
    result.sets.push(...r.sets);
    result.cards.push(...r.cards);
  }
}

if (!LOAD && (GAME === "all" || GAME === "onplay")) {
  let skip = false;
  if (db && !FORCE) {
    const { data } = await db.from("tcg_cards").select("updated_at").eq("source", "onplay").order("updated_at", { ascending: false }).limit(1);
    if (data?.[0] && Date.now() - Date.parse(data[0].updated_at) < 20 * 3600 * 1000) {
      console.log("OnPlay: ดึงไปแล้วภายใน 20 ชั่วโมง — ข้าม (ใช้ --force ถ้าจำเป็น)");
      skip = true;
    }
  }
  if (!skip) {
    const r = await onPlay();
    result.sets.push(...r.sets);
    result.cards.push(...r.cards);
  }
}

const banned = result.cards.filter((c) => Object.keys(c.attrs).some((k) => /price|value/i.test(k)));
if (banned.length) throw new Error(`พบข้อมูลราคาใน ${banned.length} แถว — หยุดก่อนบันทึก`);

const byGame = {};
for (const c of result.cards) byGame[`${c.game} (${c.lang})`] = (byGame[`${c.game} (${c.lang})`] ?? 0) + 1;
console.log(`รวม ${result.sets.length} เซต · ${result.cards.length} ใบ`, byGame);

if (DRY) {
  if (SAVE) { writeFileSync(SAVE, JSON.stringify(result)); console.log(`บันทึกผลไว้ที่ ${SAVE}`); }
  const sample = [...result.cards.filter((c) => c.source === "pokemon-th" && c.card_number).slice(0, 2), ...result.cards.slice(0, 2)].slice(0, 3);
  console.log("ตัวอย่าง:", JSON.stringify(sample, null, 2));
  console.log("--dry-run: ไม่ได้เขียนฐานข้อมูล");
  process.exit(0);
}

async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map((r) => ({ ...r, updated_at: now }));
    const { error } = await db.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} แถว ${i}: ${error.message}`);
  }
  console.log(`${table}: บันทึก ${rows.length} แถว`);
}

await upsert("tcg_sets", result.sets, "game,lang,set_code");
await upsert("tcg_cards", result.cards, "source,lang,source_id");
