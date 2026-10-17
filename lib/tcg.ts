// เกมที่ใช้ใน Collection Tracker และ Deck Builder — ตรงกับเกมที่ร้านขายจริง (company-brain/company.md)
// ค่าที่เก็บในฐานข้อมูลคือข้อความนี้ตรง ๆ ("MTG" คงไว้ให้ตรงกับข้อมูลเดิม)
export const TCG_LIST = ["Pokémon", "One Piece", "MTG", "Gundam", "Union Arena", "Riftbound"];

// เกมที่มีฐานข้อมูลการ์ดในตาราง tcg_cards แล้ว (เฟส 1) — เกมอื่นยังพิมพ์ชื่อเอง หรือทีมร้านเพิ่มผ่านหลังบ้าน
export const CATALOG_GAMES = ["Pokémon", "One Piece"];

export const TCG_LABEL: Record<string, string> = { MTG: "Magic" };
export const tcgLabel = (t: string) => TCG_LABEL[t] ?? t;

export const FORMAT_MAP: Record<string, string[]> = {
  "Pokémon":     ["Standard", "Expanded"],
  "One Piece":   ["Standard"],
  "MTG":         ["Standard", "Pioneer", "Modern", "Commander", "Draft"],
  "Gundam":      ["Standard"],
  "Union Arena": ["Standard"],
  "Riftbound":   ["Standard"],
};

// แถวเก่าอาจมีเกมที่เลิกใช้แล้ว (เช่น Dragon Ball) — ให้เลือกค่าเดิมได้ต่อ ไม่เปลี่ยนเงียบ ๆ ตอนแก้ไข
export function tcgOptions(current?: string): string[] {
  return current && !TCG_LIST.includes(current) ? [...TCG_LIST, current] : TCG_LIST;
}

export function formatOptions(tcg: string, current?: string): string[] {
  const list = FORMAT_MAP[tcg] ?? ["Standard"];
  return current && !list.includes(current) ? [...list, current] : list;
}
