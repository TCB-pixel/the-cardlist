// นำเข้า/ส่งออกคอลเลกชันเป็น CSV (เปิดใน Excel / Google Sheets ได้) — ไม่มีคอลัมน์ราคา
import { TCG_LIST } from "@/lib/tcg";

export const CSV_COLUMNS = [
  "card_name", "set_name", "card_number", "tcg", "language", "variant",
  "rarity", "condition", "quantity", "status", "note",
] as const;

export type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

const STATUSES = ["own", "want", "trade"];
const LANGS = ["", "th", "en", "ja"];
const CONDITIONS = ["NM", "LP", "MP", "HP", "D"];

function cell(v: unknown): string {
  const s = String(v ?? "");
  // กันสูตร Excel (=, +, -, @) ที่อาจรันเองตอนเปิดไฟล์
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Partial<CsvRow>[]): string {
  const lines = [CSV_COLUMNS.join(","), ...rows.map((r) => CSV_COLUMNS.map((c) => cell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n"); // BOM ให้ Excel อ่านภาษาไทยถูก
}

// แยก CSV ตามมาตรฐาน RFC 4180 (รองรับเครื่องหมายคำพูดและขึ้นบรรทัดใหม่ในช่อง)
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export type ParsedImport = {
  rows: {
    card_name: string; set_name: string; card_number: string; tcg: string; language: string; variant: string;
    rarity: string; condition: string; quantity: number; status: string; note: string;
  }[];
  skipped: number;
};

// อ่านไฟล์ที่ส่งออกจากหน้านี้ (หรือทำเองตามหัวคอลัมน์เดียวกัน) — แถวที่ไม่มีชื่อการ์ดจะถูกข้าม ค่าที่ไม่รู้จักใช้ค่าเริ่มต้น
export function parseCsv(text: string, maxRows = 1000): ParsedImport {
  const [header, ...body] = parseRows(text);
  if (!header) return { rows: [], skipped: 0 };
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const get = (r: string[], name: string) => {
    const i = idx(name);
    return i >= 0 ? (r[i] ?? "").trim().replace(/^'(?=[=+\-@])/, "") : "";
  };
  let skipped = 0;
  const rows: ParsedImport["rows"] = [];
  for (const r of body) {
    const card_name = get(r, "card_name").slice(0, 200);
    if (!card_name || rows.length >= maxRows) { skipped++; continue; }
    const tcg = get(r, "tcg");
    const language = get(r, "language").toLowerCase();
    const condition = get(r, "condition").toUpperCase();
    const status = get(r, "status").toLowerCase();
    const qty = parseInt(get(r, "quantity"), 10);
    rows.push({
      card_name,
      set_name: get(r, "set_name").slice(0, 200),
      card_number: get(r, "card_number").slice(0, 40),
      tcg: tcg.slice(0, 40) || TCG_LIST[0],
      language: LANGS.includes(language) ? language : "",
      variant: get(r, "variant").slice(0, 40) || "normal",
      rarity: get(r, "rarity").slice(0, 40) || "Rare",
      condition: CONDITIONS.includes(condition) ? condition : "NM",
      quantity: Number.isFinite(qty) && qty >= 1 ? Math.min(qty, 9999) : 1,
      status: STATUSES.includes(status) ? status : "own",
      note: get(r, "note").slice(0, 500),
    });
  }
  return { rows, skipped };
}
