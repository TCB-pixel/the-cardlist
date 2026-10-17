// ส่ง Decklist ลงทัวร์ — ข้อความยินยอม (PDPA) และการตรวจ regulation ที่ใช้ทั้งหน้าลูกค้าและ API
import type { RuleIssue } from "@/lib/deck-rules";

// เปลี่ยนเวอร์ชันทุกครั้งที่แก้ข้อความยินยอม เพื่อรู้ว่าผู้เล่นยอมรับข้อความชุดไหน
export const DECKLIST_CONSENT_VERSION = "decklist-2026-10-17";
export const DECKLIST_CONSENT = {
  th: "ฉันยินยอมให้ร้าน The Cardlist (CL Studio Creative Lab) เก็บ decklist ชื่อเล่นที่ใช้แข่ง และผลการแข่งของฉันไว้เป็นข้อมูลการแข่งขันของร้าน เห็นได้เฉพาะทีมงาน และใช้สรุปสถิติแบบไม่ระบุตัวตน — เด็คจะเผยแพร่ก็ต่อเมื่อติดอันดับและฉันยินยอมอีกครั้ง",
  en: "I agree that The Cardlist (CL Studio Creative Lab) may keep my decklist, the nickname I play under and my results as the store's tournament records, visible only to staff and used for anonymous statistics. My deck will only be published if it places and I agree again.",
};

// เกมที่ต้องผ่านกติกาก่อนส่ง (เกมอื่นส่งได้ แต่ขึ้นเป็นคำเตือนให้ staff ตรวจ)
export const STRICT_GAMES = ["Pokémon", "One Piece", "Battle of Talingchan", "Monsnatch"];

export function parseRegulation(text: string | null | undefined): string[] {
  return (text ?? "").toUpperCase().split(/[^A-Z]+/).filter(Boolean);
}

// ตรวจ regulation mark (Pokémon) เทียบกับที่ทัวร์อนุญาต — การ์ดที่ไม่รู้ mark จะเป็นคำเตือนให้ staff ตรวจ
export function checkRegulation(
  allowedText: string | null | undefined,
  cards: { card_name: string; quantity: number; regulation?: string | null }[],
): RuleIssue[] {
  const allowed = parseRegulation(allowedText);
  if (!allowed.length) return [];
  const bad = cards.filter((c) => c.regulation && !allowed.includes(c.regulation.toUpperCase()));
  const unknown = cards.filter((c) => !c.regulation).length;
  const issues: RuleIssue[] = [];
  if (bad.length) issues.push({
    level: "error",
    th: `regulation ไม่อยู่ในรอบนี้ (${allowed.join(", ")}): ${bad.map((c) => `${c.card_name} [${c.regulation}]`).join(", ")}`,
    en: `Not in this event's regulation (${allowed.join(", ")}): ${bad.map((c) => `${c.card_name} [${c.regulation}]`).join(", ")}`,
  });
  if (unknown) issues.push({
    level: "warn",
    th: `ระบบยังไม่รู้ regulation ของการ์ด ${unknown} รายการ — ทีมงานจะตรวจให้`,
    en: `Regulation unknown for ${unknown} entries — staff will check`,
  });
  return issues;
}

export const DECKLIST_STATUS_LABEL: Record<string, { th: string; en: string; cls: string }> = {
  submitted: { th: "ส่งแล้ว รอตรวจ", en: "Submitted", cls: "bg-amber-50 text-amber-800" },
  checked: { th: "ตรวจแล้ว", en: "Checked", cls: "bg-green-50 text-green-700" },
  rejected: { th: "ต้องแก้ไข", en: "Needs changes", cls: "bg-red-50 text-red-700" },
};
