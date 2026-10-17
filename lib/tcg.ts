// เกมที่ใช้ใน Collection Tracker และ Deck Builder — ตรงกับเกมที่ร้านขายจริง (company-brain/company.md)
// ค่าที่เก็บในฐานข้อมูลคือข้อความนี้ตรง ๆ ("MTG" คงไว้ให้ตรงกับข้อมูลเดิม)
// Battle of Talingchan และ Monsnatch: เจ้าของสั่งเพิ่ม 17 ต.ค. 2026 (มีแข่งในร้านทุกพฤ./ศ.) — ยังไม่มีกติกาเด็คและฐานข้อมูลการ์ดในระบบ
// Eidolon: เจ้าของสั่งเพิ่ม 18 ต.ค. 2026 (ร้านเป็นหุ้นส่วน Eidolon — ใช้ข้อมูล/ภาพการ์ดได้ ดู company-brain/eidolon-assets.md)
export const TCG_LIST = ["Pokémon", "One Piece", "MTG", "Gundam", "Union Arena", "Riftbound", "Battle of Talingchan", "Monsnatch", "Eidolon"];

// เกมที่มีฐานข้อมูลการ์ดในตาราง tcg_cards แล้ว (เฟส 1) — เกมอื่นยังพิมพ์ชื่อเอง หรือทีมร้านเพิ่มผ่านหลังบ้าน
export const CATALOG_GAMES = ["Pokémon", "One Piece", "Eidolon"];

export const TCG_LABEL: Record<string, string> = { MTG: "Magic" };
export const tcgLabel = (t: string) => TCG_LABEL[t] ?? t;

export const FORMAT_MAP: Record<string, string[]> = {
  "Pokémon":     ["Standard", "Expanded"],
  "One Piece":   ["Standard"],
  "MTG":         ["Standard", "Pioneer", "Modern", "Commander", "Draft"],
  "Gundam":      ["Standard"],
  "Union Arena": ["Standard"],
  "Riftbound":   ["Standard"],
  "Battle of Talingchan": ["Standard"],
  "Monsnatch":   ["Standard", "Draft", "Sealed"],
  "Eidolon":     ["Standard"],
};

// แถวเก่าอาจมีเกมที่เลิกใช้แล้ว (เช่น Dragon Ball) — ให้เลือกค่าเดิมได้ต่อ ไม่เปลี่ยนเงียบ ๆ ตอนแก้ไข
export function tcgOptions(current?: string): string[] {
  return current && !TCG_LIST.includes(current) ? [...TCG_LIST, current] : TCG_LIST;
}

export function formatOptions(tcg: string, current?: string): string[] {
  const list = FORMAT_MAP[tcg] ?? ["Standard"];
  return current && !list.includes(current) ? [...list, current] : list;
}

// ส่วนของเด็ค (เก็บใน decks.cards[].section) — เกมที่ไม่มีส่วนย่อยคืน null
// BoT: Main + LIFE (ไม่ระบุ section) / Side Deck สำหรับงาน Best of 3 · Monsnatch Standard: Deck A / Deck B
export type DeckSection = { key: string; th: string; en: string };
export function deckSections(tcg: string, format: string): DeckSection[] | null {
  if (tcg === "Battle of Talingchan") return [
    { key: "main", th: "Main + LIFE", en: "Main + LIFE" },
    { key: "side", th: "Side Deck (Bo3)", en: "Side Deck (Bo3)" },
  ];
  if (tcg === "Monsnatch" && !/draft|sealed/i.test(format)) return [
    { key: "A", th: "Deck A", en: "Deck A" },
    { key: "B", th: "Deck B", en: "Deck B" },
  ];
  return null;
}

// ส่วนของการ์ดหนึ่งใบ — การ์ดที่ไม่มี section อยู่ส่วนแรกเสมอ (เด็คเดิมก่อนมีส่วนยังใช้ได้)
export function sectionOf(c: { section?: string | null }, sections: DeckSection[] | null): string {
  if (!sections) return "";
  return sections.some((s) => s.key === c.section) ? (c.section as string) : sections[0].key;
}
