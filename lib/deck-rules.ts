// ตรวจกติกาเด็คเบื้องต้นต่อเกม — เป็นคำเตือนช่วยผู้เล่น ไม่บล็อกการบันทึก
// ไม่ได้ตรวจ ban list / regulation mark / กติกาพิเศษของทัวร์ (ให้ผู้เล่นเช็กกับประกาศทางการเสมอ)

export type RuleCard = {
  name: string;
  number?: string;
  quantity: number;
  card_type?: string | null; // จากฐานข้อมูลการ์ด (ถ้ามี)
  color?: string | null;     // One Piece: "Red" หรือ "Red Green"
  tags?: string[] | null;    // ป้ายพิเศษจากฐานข้อมูลการ์ด เช่น Battle of Talingchan: "only1", "biased" (ลำเอียง)
  points?: number | null;    // Monsnatch: Deck Point (สัญลักษณ์ดาว) — null = ยังไม่มีข้อมูล
};

// แปลงการ์ดในเด็ค + ข้อมูลจากฐานข้อมูลการ์ด (ถ้ามี) เป็น RuleCard — ใช้ทั้งหน้า Deck Builder และ API ส่ง decklist
export function toRuleCard(
  c: { card_name: string; card_number?: string | null; quantity: number },
  d?: { card_type?: string | null; color?: string | null; attrs?: { tags?: unknown; deck_points?: unknown } | null } | null,
): RuleCard {
  const pts = Number(d?.attrs?.deck_points);
  return {
    name: c.card_name, number: c.card_number ?? undefined, quantity: c.quantity,
    card_type: d?.card_type ?? null, color: d?.color ?? null,
    tags: d && Array.isArray(d.attrs?.tags) ? (d.attrs!.tags as string[]) : d ? [] : null,
    points: d?.attrs?.deck_points != null && Number.isFinite(pts) ? pts : null,
  };
}

// error = ผิดกติกาแน่นอน · warn = ควรตรวจ · unknown = ตรวจไม่ได้เพราะการ์ดยังไม่มีข้อมูลในระบบ (ไม่ใช่ผิดกติกา)
export type RuleIssue = { level: "error" | "warn" | "unknown"; th: string; en: string };
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

  if (game === "Battle of Talingchan") return checkBot(cards, total);
  if (game === "Monsnatch") return checkMonsnatch(format, cards, total);

  return { total, main: total, target: "", issues, checked: false };
}

// ---------- Battle of Talingchan ----------
// ที่มา (อ่าน 18 ต.ค. 2026):
//   Rule Book Ver. 3.2 หน้า 1 "Deck Set" — https://cdn.bangbon.app/rules/rulebook-9PoUza3Yhi.pdf (ลิงก์จาก https://bottcg.com/rule)
//   กฎงานแข่งขัน (อัปเดต 14 ก.ค. 2026) ข้อ 1 การเตรียม Deck — https://cdn.bangbon.app/rules/tournament-D0yCoA2id8.pdf
//   · Main Deck 50 ใบพอดี และต้องมีการ์ด Only #1 1 ใบ
//   · ชื่อเดียวกันใส่ได้สูงสุด 4 ใบ ยกเว้น Only #1 ใส่ได้ใบเดียวและแบบเดียว
//   · การ์ดสัญลักษณ์ "ลำเอียง" ใส่ในเด็คแข่งขันไม่ได้
//   · LIFE Deck 5 ใบพอดี ชื่อไม่ซ้ำกัน
// ยังไม่ตรวจ: การ์ดบาป (ban list เป็นรูปภาพ เปลี่ยนตามประกาศ) · Side Deck 10 ใบของงาน Best of 3
// ข้อที่ไม่ชัด: rule book เขียน "50 ใบพอดี และต้องมี Only #1 1 ใบ" — ตีความว่า Only #1 นับรวมใน 50 ใบ
const isLife = (c: RuleCard) => (c.card_type ?? "").trim().toUpperCase() === "LIFE";
const nameKey = (c: RuleCard) => c.name.trim().toLowerCase();

function checkBot(cards: RuleCard[], total: number): RuleResult {
  const issues: RuleIssue[] = [];
  const typed = cards.filter((c) => c.card_type);
  const untyped = cards.filter((c) => !c.card_type);
  const life = typed.filter(isLife);
  const main = cards.filter((c) => !isLife(c));
  const lifeCount = life.reduce((s, c) => s + c.quantity, 0);
  const mainCount = main.reduce((s, c) => s + c.quantity, 0);

  // Main 50 + LIFE 5 = 55 ใบเสมอ ตรวจได้แม้ไม่รู้ประเภทการ์ด
  if (total !== 55) issues.push({ level: "error", th: `รวมทั้งเด็ค ${total} ใบ (Main 50 + LIFE 5 = 55)`, en: `${total} cards in total (Main 50 + LIFE 5 = 55)` });
  if (untyped.length) {
    issues.push({ level: "unknown", th: `แยก Main / LIFE ไม่ได้ ${untyped.length} รายการ — การ์ดยังไม่มีประเภทในระบบ`, en: `Can't tell Main from LIFE for ${untyped.length} entries — no card type in the database yet` });
  } else {
    issues.push(...countIssue(mainCount, 50, null, "Main Deck", "Main Deck"));
    issues.push(...countIssue(lifeCount, 5, null, "LIFE Deck", "LIFE Deck"));
  }
  issues.push(...overLimit(life, 1, nameKey).map((i) => ({ ...i, th: `LIFE ซ้ำชื่อ: ${i.th}`, en: `Duplicate LIFE name: ${i.en}` })));

  const only1 = main.filter((c) => c.tags?.includes("only1"));
  const only1Count = only1.reduce((s, c) => s + c.quantity, 0);
  const normal = main.filter((c) => !c.tags?.includes("only1"));
  issues.push(...overLimit(normal, 4, nameKey));
  if (only1Count > 1) issues.push({ level: "error", th: `มีการ์ด Only #1 ${only1Count} ใบ (ต้องมี 1 ใบ)`, en: `${only1Count} Only #1 cards (needs exactly 1)` });
  else if (only1Count === 0) {
    const noTags = main.filter((c) => !c.tags).length;
    issues.push(noTags
      ? { level: "unknown", th: `ตรวจการ์ด Only #1 ไม่ได้ — ${noTags} รายการยังไม่มีข้อมูลป้ายในระบบ (ต้องมี Only #1 1 ใบ)`, en: `Can't check Only #1 — ${noTags} entries have no tag data (deck needs exactly 1)` }
      : { level: "error", th: "ยังไม่มีการ์ด Only #1 (ต้องมี 1 ใบ)", en: "No Only #1 card (needs exactly 1)" });
  }

  const biased = cards.filter((c) => c.tags?.includes("biased"));
  if (biased.length) issues.push({ level: "error", th: `การ์ด "ลำเอียง" ใช้แข่งไม่ได้: ${biased.map((c) => c.name).join(", ")}`, en: `"Biased"-marked cards aren't tournament legal: ${biased.map((c) => c.name).join(", ")}` });
  issues.push({ level: "warn", th: "ยังไม่ตรวจการ์ดบาป (ban list) — ดูประกาศล่าสุดที่ bottcg.com/rule", en: "Ban list isn't checked — see bottcg.com/rule" });

  return { total, main: untyped.length ? total : mainCount, target: "Main 50 + LIFE 5", issues, checked: true };
}

// ---------- Monsnatch ----------
// ที่มา (อ่าน 18 ต.ค. 2026):
//   Comprehensive Rules 1.0.0 §15 — https://momon-wonder.gitbook.io/comprehensive-rules-1.0.0/formats-and-reference-data/15-formats-and-deck-construction
//   Tournament Rules Guide 1.0.0 §16 Standard Constructed — https://momon-wonder.gitbook.io/tournament-rules-guide-1.0.0/formats-and-limited-play/16-standard-constructed
//   (ลิงก์จาก https://monsnatch.com/rules)
//   · ทุกเด็คมีการ์ด 10 ใบพอดี (§15.1.1)
//   · Constructed: ชื่อการ์ด (ชื่อภาษาอังกฤษทางการ) ซ้ำไม่ได้ · Deck Point (ดาว) รวมไม่เกิน 25 (§15.2.1–15.2.3, TRG §16.2)
//   · Draft / Sealed: 10 ใบ ซ้ำได้ตามที่เปิดได้ ไม่จำกัดแต้ม (§15.3, §15.4)
// ยังไม่ตรวจ: Standard ต้องลงทะเบียน 2 เด็ค (Deck A + Deck B) และชื่อห้ามซ้ำข้ามทั้งสองเด็ค (TRG §16.1, §16.3)
//   — Deck Builder เก็บทีละเด็ค จึงตรวจข้ามเด็คไม่ได้ · การ์ดที่อนุญาตตามชุด (card pool) ของแต่ละงาน
// ข้อที่ไม่ชัด: ตัวตนของการ์ดใช้ "ชื่อภาษาอังกฤษทางการ" — ถ้าผู้เล่นพิมพ์ชื่อไทยเอง ระบบเทียบชื่อซ้ำได้เฉพาะชื่อที่พิมพ์
function checkMonsnatch(format: string, cards: RuleCard[], total: number): RuleResult {
  const issues: RuleIssue[] = [];
  const limited = /draft|sealed/i.test(format);
  issues.push(...countIssue(total, 10, null, "เด็ค", "Deck"));
  if (!limited) {
    issues.push(...overLimit(cards, 1, nameKey));
    const unknown = cards.filter((c) => typeof c.points !== "number");
    const points = cards.reduce((s, c) => s + (typeof c.points === "number" ? c.points * c.quantity : 0), 0);
    if (points > 25) issues.push({ level: "error", th: `Deck Point รวม ${points} (ไม่เกิน 25)`, en: `Deck Points total ${points} (max 25)` });
    else if (unknown.length) issues.push({ level: "unknown", th: `ตรวจ Deck Point ไม่ครบ — ${unknown.length} รายการยังไม่มีแต้มในระบบ (นับได้ ${points}/25)`, en: `Can't fully check Deck Points — ${unknown.length} entries have no points yet (${points}/25 counted)` });
    issues.push({ level: "warn", th: "งาน Standard ต้องส่ง Deck A + Deck B และชื่อการ์ดห้ามซ้ำข้ามสองเด็ค — ระบบยังตรวจข้ามเด็คไม่ได้", en: "Standard events need Deck A + Deck B with no name repeated across both — not checked across decks yet" });
  }
  return { total, main: total, target: "10", issues, checked: true };
}
