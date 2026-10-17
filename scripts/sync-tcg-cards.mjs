// ดึงข้อมูลการ์ดจากแหล่งฟรีเข้าตาราง tcg_sets / tcg_cards (Collection Tracker + Deck Builder เฟส 1)
//
//   ทดลองดึงอย่างเดียว ไม่เขียนฐานข้อมูล:
//     node scripts/sync-tcg-cards.mjs --dry-run
//   เขียนจริง (ต้องได้รับอนุมัติจากเจ้าของก่อน · ใช้ service role key จาก .env.local ห้ามพิมพ์ออกมา):
//     node --env-file=.env.local scripts/sync-tcg-cards.mjs
//   เลือกเกม: --game=pokemon หรือ --game=onepiece (ไม่ใส่ = ทั้งสอง)
//
// แหล่งข้อมูล
//   Pokémon  — TCGdex https://tcgdex.dev (ฟรี โอเพนซอร์ส ไม่ต้องใช้ key) ภาษาไทย + อังกฤษ
//   One Piece — optcgapi https://optcgapi.com (ฟรี ขอให้ไม่เรียกถี่ — รันวันละครั้งพอ)
// ทั้งสองแหล่งมีราคาการ์ดปนมา — สคริปต์นี้ไม่เก็บราคาเด็ดขาด (กฎบริษัท)

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const GAME = (args.find((a) => a.startsWith("--game=")) ?? "--game=all").split("=")[1];
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

// ---------- main ----------
const now = new Date().toISOString();
const result = { sets: [], cards: [] };
for (const [key, fn] of [["pokemon", pokemon], ["onepiece", onePiece]]) {
  if (GAME !== "all" && GAME !== key) continue;
  const r = await fn();
  result.sets.push(...r.sets);
  result.cards.push(...r.cards);
}

const banned = result.cards.filter((c) => Object.keys(c.attrs).some((k) => /price|value/i.test(k)));
if (banned.length) throw new Error(`พบข้อมูลราคาใน ${banned.length} แถว — หยุดก่อนบันทึก`);

const byGame = {};
for (const c of result.cards) byGame[`${c.game} (${c.lang})`] = (byGame[`${c.game} (${c.lang})`] ?? 0) + 1;
console.log(`รวม ${result.sets.length} เซต · ${result.cards.length} ใบ`, byGame);

if (DRY) {
  console.log("ตัวอย่าง:", JSON.stringify(result.cards.slice(0, 2), null, 2));
  console.log("--dry-run: ไม่ได้เขียนฐานข้อมูล");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน env");
const db = createClient(url, key, { auth: { persistSession: false } });

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
