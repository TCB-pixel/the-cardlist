// นำเข้า/ส่งออกเด็คเป็นข้อความ — วางจากแอป/เว็บอื่นได้ เช่น
//   One Piece (OPTCGSim / Limitless):  4xOP01-016
//   Pokémon TCG Live:                  4 Pikachu ex SVI 57   (หัวข้อ "Pokémon: 12" ถูกข้าม)
//   ทั่วไป:                            4 Sol Ring  หรือ  4 Nami (OP01-016)  หรือ  2 Coatl (EP01/001)
//   แยกส่วนเด็คด้วยบรรทัดหัวข้อ:       "Side Deck:" (BoT) · "Deck A:" / "Deck B:" (Monsnatch) · "Main:" กลับส่วนหลัก

// section: "" = ส่วนหลัก · "side" · "A" · "B" · undefined = ไม่มีหัวข้อก่อนหน้า (ใช้ส่วนที่เลือกอยู่)
export type ParsedLine = { quantity: number; name: string; number: string; section?: string };

const CARD_NO = /^[A-Z]{1,4}\d{0,3}[-/]\d{3}[A-Z]?$/i;
const HEADER = /^(pok[ée]mon|trainer|energy|total cards|leader|character|event|stage|deck|main|side ?board|commander)\s*[:(]/i;

// บรรทัดหัวข้อที่บอกส่วนของเด็ค (ไม่มีตัวเลขนำหน้า)
function sectionHeader(s: string): string | null {
  const h = s.replace(/[:：].*$/, "").replace(/\(.*\)/, "").trim().toLowerCase();
  if (/^side(\s*deck|\s*board)?$/.test(h)) return "side";
  if (/^deck\s*a$/.test(h)) return "A";
  if (/^deck\s*b$/.test(h)) return "B";
  if (/^(main(\s*deck)?(\s*\+\s*life)?|life(\s*deck)?)$/.test(h)) return "";
  return null;
}

export function parseDeckText(text: string, maxLines = 200): { lines: ParsedLine[]; skipped: number } {
  const lines: ParsedLine[] = [];
  let skipped = 0;
  let section: string | undefined;
  for (const raw of text.split(/\r?\n/).slice(0, maxLines)) {
    const s = raw.trim();
    if (!s || s.startsWith("#") || s.startsWith("//")) continue;
    if (!/^\d/.test(s)) {
      const sec = sectionHeader(s);
      if (sec !== null) { section = sec; continue; }
    }
    if (HEADER.test(s)) continue;
    const m = s.match(/^(\d{1,3})\s*x?\s*(.+)$/i);
    if (!m) { skipped++; continue; }
    const quantity = Math.min(parseInt(m[1], 10), 99);
    let rest = m[2].trim();
    let number = "";
    if (CARD_NO.test(rest)) { number = rest.toUpperCase(); rest = ""; }
    else {
      const paren = rest.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (paren && CARD_NO.test(paren[2].trim())) { rest = paren[1]; number = paren[2].trim().toUpperCase(); }
      else {
        // รูปแบบ Pokémon TCG Live: "ชื่อ SET 123" — เก็บแค่ชื่อ (รหัสเซตไม่ตรงกับฐานข้อมูลของเรา)
        const ptcgl = rest.match(/^(.*\S)\s+[A-Z0-9]{2,5}\s+\d{1,3}[a-z]?$/);
        if (ptcgl) rest = ptcgl[1];
      }
    }
    if (quantity < 1 || (!rest && !number)) { skipped++; continue; }
    lines.push({ quantity, name: rest.slice(0, 200), number, ...(section !== undefined ? { section } : {}) });
  }
  return { lines, skipped };
}

type TextCard = { card_name: string; card_number?: string; quantity: number; section?: string };

function cardLine(game: string, c: TextCard): string {
  const no = c.card_number?.trim();
  if (game === "One Piece" && no && CARD_NO.test(no)) return `${c.quantity}x${no}`;
  return no ? `${c.quantity} ${c.card_name} (${no})` : `${c.quantity} ${c.card_name}`;
}

// sections: ส่วนของเด็คจาก lib/tcg.ts deckSections — มีหลายส่วนจะใส่บรรทัดหัวข้อคั่น
export function deckToText(game: string, cards: TextCard[], sections?: { key: string; en: string }[] | null): string {
  if (!sections) return cards.map((c) => cardLine(game, c)).join("\n");
  const first = sections[0].key;
  return sections
    .map((s) => {
      const list = cards.filter((c) => (sections.some((x) => x.key === c.section) ? c.section : first) === s.key);
      return list.length ? `${s.en.replace(/\s*\(.*\)$/, "")}:\n${list.map((c) => cardLine(game, c)).join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
