// ตรวจกติกาเด็คเบื้องต้นต่อเกม — เป็นคำเตือนช่วยผู้เล่น ไม่บล็อกการบันทึก
// ไม่ได้ตรวจ ban list / regulation mark / กติกาพิเศษของทัวร์ (ให้ผู้เล่นเช็กกับประกาศทางการเสมอ)

export type RuleCard = {
  name: string;
  number?: string;
  quantity: number;
  card_type?: string | null; // จากฐานข้อมูลการ์ด (ถ้ามี)
  color?: string | null;     // One Piece: "Red" หรือ "Red Green"
};

export type RuleIssue = { level: "error" | "warn"; th: string; en: string };
export type RuleResult = { total: number; main: number; target: string; issues: RuleIssue[]; checked: boolean };

const POKEMON_BASIC_ENERGY = /^(basic\s+)?(grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy|dragon)\s+energy$|^พลังงานพื้นฐาน/i;
const MTG_BASIC_LAND = /^(snow-covered\s+)?(plains|island|swamp|mountain|forest|wastes)$/i;

const keyOf = (c: RuleCard) => (c.number?.trim() ? c.number.trim().toUpperCase() : c.name.trim().toLowerCase());

// รวมจำนวนตาม key (เลขการ์ดเดียวกันแต่คนละ variant/รายการ = ใบเดียวกันตามกติกา)
function copies(cards: RuleCard[], key: (c: RuleCard) => string, skip?: (c: RuleCard) => boolean) {
  const m = new Map<string, { label: string; qty: number }>();
  for (const c of cards) {
    if (skip?.(c)) continue;
    const k = key(c);
    const cur = m.get(k);
    m.set(k, { label: cur?.label ?? c.name, qty: (cur?.qty ?? 0) + c.quantity });
  }
  return [...m.values()];
}

function overLimit(cards: RuleCard[], limit: number, key: (c: RuleCard) => string, skip?: (c: RuleCard) => boolean): RuleIssue[] {
  return copies(cards, key, skip)
    .filter((x) => x.qty > limit)
    .map((x) => ({ level: "error", th: `${x.label} มี ${x.qty} ใบ (ใส่ได้ไม่เกิน ${limit})`, en: `${x.label}: ${x.qty} copies (max ${limit})` }));
}

function countIssue(n: number, exact: number | null, min: number | null, labelTh: string, labelEn: string): RuleIssue[] {
  if (exact !== null && n !== exact) return [{ level: "error", th: `${labelTh} ${n} ใบ (ต้อง ${exact})`, en: `${labelEn}: ${n} cards (needs ${exact})` }];
  if (min !== null && n < min) return [{ level: "error", th: `${labelTh} ${n} ใบ (อย่างน้อย ${min})`, en: `${labelEn}: ${n} cards (at least ${min})` }];
  return [];
}

export function checkDeck(game: string, format: string, cards: RuleCard[]): RuleResult {
  const total = cards.reduce((s, c) => s + c.quantity, 0);
  const issues: RuleIssue[] = [];

  if (game === "One Piece") {
    const leaders = cards.filter((c) => c.card_type === "Leader");
    const main = cards.filter((c) => c.card_type !== "Leader");
    const mainCount = main.reduce((s, c) => s + c.quantity, 0);
    const leaderCount = leaders.reduce((s, c) => s + c.quantity, 0);
    if (leaderCount !== 1) issues.push({ level: "error", th: leaderCount ? `มี Leader ${leaderCount} ใบ (ต้องมี 1)` : "ยังไม่มี Leader (เลือกจากช่องค้นหา)", en: leaderCount ? `${leaderCount} Leaders (needs exactly 1)` : "No Leader yet (pick one from search)" });
    issues.push(...countIssue(mainCount, 50, null, "เด็คหลัก", "Main deck"));
    issues.push(...overLimit(main, 4, keyOf));
    if (leaderCount === 1 && leaders[0].color) {
      const allowed = new Set(leaders[0].color.split(/\s+/));
      const wrong = main.filter((c) => c.color && !c.color.split(/\s+/).some((x) => allowed.has(x)));
      if (wrong.length) issues.push({ level: "error", th: `สีไม่ตรงกับ Leader: ${wrong.map((c) => c.name).join(", ")}`, en: `Colour doesn't match Leader: ${wrong.map((c) => c.name).join(", ")}` });
      const unknown = main.filter((c) => !c.color).length;
      if (unknown) issues.push({ level: "warn", th: `ตรวจสีไม่ได้ ${unknown} รายการ (พิมพ์ชื่อเอง ไม่ได้เลือกจากฐานข้อมูล)`, en: `Couldn't check colour for ${unknown} entries (typed manually)` });
    }
    return { total, main: mainCount, target: "1 Leader + 50", issues, checked: true };
  }

  if (game === "Pokémon") {
    issues.push(...countIssue(total, 60, null, "เด็ค", "Deck"));
    issues.push(...overLimit(cards, 4, (c) => c.name.trim().toLowerCase(), (c) => POKEMON_BASIC_ENERGY.test(c.name.trim())));
    return { total, main: total, target: "60", issues, checked: true };
  }

  if (game === "MTG") {
    const isBasic = (c: RuleCard) => MTG_BASIC_LAND.test(c.name.trim());
    const byName = (c: RuleCard) => c.name.trim().toLowerCase();
    if (format === "Commander") {
      issues.push(...countIssue(total, 100, null, "เด็ค", "Deck"));
      issues.push(...overLimit(cards, 1, byName, isBasic));
      return { total, main: total, target: "100", issues, checked: true };
    }
    if (format === "Draft") {
      issues.push(...countIssue(total, null, 40, "เด็ค", "Deck"));
      return { total, main: total, target: "40+", issues, checked: true };
    }
    issues.push(...countIssue(total, null, 60, "เด็ค", "Deck"));
    issues.push(...overLimit(cards, 4, byName, isBasic));
    return { total, main: total, target: "60+", issues, checked: true };
  }

  if (game === "Gundam" || game === "Union Arena") {
    issues.push(...countIssue(total, 50, null, "เด็คหลัก", "Main deck"));
    issues.push(...overLimit(cards, 4, keyOf));
    if (game === "Gundam") issues.push({ level: "warn", th: "ยังไม่ได้นับ Resource Deck 10 ใบ", en: "Resource deck (10) isn't tracked yet" });
    return { total, main: total, target: "50", issues, checked: true };
  }

  return { total, main: total, target: "", issues, checked: false };
}
