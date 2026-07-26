// ─────────────────────────────────────────────────────────────────────────
// ระบบจองโต๊ะเทรด (Trading Table) — ใช้ร่วมกันทั้งฝั่งลูกค้าและแอดมิน
// กติกา: รอบละ 45 นาที เริ่ม 10:00 จนถึงก่อน 23:00, cooldown 60 นาทีต่อ
// account หลังจบแต่ละรอบ (นับต่อวันของ event), โต๊ะแยกตามประเภทเกม
// ─────────────────────────────────────────────────────────────────────────

export type TableType = "pokemon" | "onepiece" | "lorcana";

export const TABLE_TYPES: TableType[] = ["pokemon", "onepiece", "lorcana"];

// จำนวนโต๊ะที่เปิดพร้อมกันต่อประเภท ต่อ 1 รอบเวลา
export const TABLE_CAPACITY: Record<TableType, number> = {
  pokemon: 2,
  onepiece: 1,
  lorcana: 1,
};

export const TABLE_TYPE_LABEL: Record<TableType, string> = {
  pokemon: "Pokemon",
  onepiece: "One Piece",
  lorcana: "Disney Lorcana",
};

export const SLOT_MINUTES = 45;
export const COOLDOWN_MINUTES = 60;
export const TRADING_OPEN_TIME = "10:00";
export const TRADING_CLOSE_TIME = "23:00";

// แปลง "HH:MM" หรือ "HH:MM:SS" → นาทีตั้งแต่เที่ยงคืน
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export type Slot = { start: string; end: string };

// สร้างรายการ slot 45 นาที ตั้งแต่ TRADING_OPEN_TIME จนกว่า slot_end จะเกิน TRADING_CLOSE_TIME
export function generateSlots(
  openTime: string = TRADING_OPEN_TIME,
  closeTime: string = TRADING_CLOSE_TIME
): Slot[] {
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const slots: Slot[] = [];
  let cur = openMin;
  while (cur + SLOT_MINUTES <= closeMin) {
    slots.push({ start: minutesToTime(cur), end: minutesToTime(cur + SLOT_MINUTES) });
    cur += SLOT_MINUTES;
  }
  return slots;
}

// ตรวจว่า slot ที่ขอ (start/end เป็นนาที) ชนกับ cooldown ของรอบที่ user มีอยู่แล้วหรือไม่
// กติกา: ต้องเว้นช่วงอย่างน้อย COOLDOWN_MINUTES ระหว่างรอบ (ไม่ทับซ้อนและไม่ติดกันเกินไป)
export function violatesCooldown(
  newSlot: { start: string; end: string },
  existing: { slot_start: string; slot_end: string }[]
): boolean {
  const newStart = timeToMinutes(newSlot.start);
  const newEnd = timeToMinutes(newSlot.end);
  for (const ex of existing) {
    const exStart = timeToMinutes(ex.slot_start);
    const exEnd = timeToMinutes(ex.slot_end);
    // ไม่ผิดกติกาก็ต่อเมื่อ: รอบใหม่จบแล้วเว้น >= 60 นาทีก่อนรอบเก่าเริ่ม
    // หรือ รอบเก่าจบแล้วเว้น >= 60 นาทีก่อนรอบใหม่เริ่ม
    const ok = newEnd + COOLDOWN_MINUTES <= exStart || exEnd + COOLDOWN_MINUTES <= newStart;
    if (!ok) return true;
  }
  return false;
}
