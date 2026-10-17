// ส่งออกฐานข้อมูลการแข่งเป็น CSV (1 แถว = 1 decklist · รายการการ์ดรวมอยู่ในคอลัมน์ deck_list)
type Row = {
  event_title: string; event_date: string | null; player_name: string; game: string; format: string; deck_name: string;
  card_count: number; deck_code: string; placement: number | null; top_cut: boolean; status: string; submitted_at: string;
  cards: { card_name: string; card_number: string; quantity: number; section?: string | null }[];
};

const COLS = ["event_date", "event_title", "player_name", "game", "format", "deck_name", "card_count", "placement", "top_cut", "status", "deck_code", "submitted_at", "deck_list"];

function cell(v: unknown): string {
  const s = String(v ?? "");
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // กันสูตร Excel
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsvRows(rows: Row[]): string {
  const lines = rows.map((r) => {
    // การ์ดในส่วนย่อย (BoT side · Monsnatch Deck B) ขึ้นต้นด้วยชื่อส่วน เช่น "[side] 2 ..."
    const deck_list = r.cards.map((c) => `${c.section ? `[${c.section}] ` : ""}${c.quantity} ${c.card_name}${c.card_number ? ` (${c.card_number})` : ""}`).join("\n");
    const v: Record<string, unknown> = { ...r, top_cut: r.top_cut ? "yes" : "", deck_list };
    return COLS.map((c) => cell(v[c])).join(",");
  });
  return "﻿" + [COLS.join(","), ...lines].join("\r\n");
}
