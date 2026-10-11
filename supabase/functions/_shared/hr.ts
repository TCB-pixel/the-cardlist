// HR ของบอททีม: กะทำงาน, ลงเวลา, แจ้งขาด/สาย
import { db } from "./db.ts";
import type { Member } from "./team.ts";

// ── ค่าตั้งของร้าน (แก้ตรงนี้ได้) ──
export const DEFAULT_SHIFT = { start: "11:00", end: "22:00" }; // กะปกติทุกวัน
export const LATE_AFTER_MINUTES = 30; // เข้าช้ากว่าเวลาเริ่มกะเกินนี้ = สาย

// ลงเวลาเข้า-ออก (เข้างาน/เลิกงาน + เตือนคนยังไม่ลงเวลา) ปิดไว้ก่อน
// เปิดใช้: เพิ่ม Supabase secret TEAM_ATTENDANCE = on
export function attendanceEnabled(): boolean {
  return Deno.env.get("TEAM_ATTENDANCE") === "on";
}

const BKK = 7 * 3600_000;

// วันที่ตามเวลาไทย "YYYY-MM-DD"
export function bkkDate(ms = Date.now(), addDays = 0): string {
  return new Date(ms + BKK + addDays * 86_400_000).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" + "HH:MM" (เวลาไทย) → milliseconds
export function bkkTime(date: string, hhmm: string): number {
  return Date.parse(`${date}T${hhmm.slice(0, 5)}:00+07:00`);
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short",
  });
}

export type Shift = { start: string; end: string; off: boolean; note: string | null };

// กะของทุกคนในวันที่กำหนด: ถ้าไม่มีแถวใน shifts = กะปกติ
export async function shiftsOn(date: string, members: Pick<Member, "id">[]): Promise<Map<string, Shift>> {
  const { data } = await db
    .from("shifts").select("member_id, start_time, end_time, is_off, note")
    .eq("work_date", date).in("member_id", members.map((m) => m.id));
  const custom = new Map((data ?? []).map((s) => [s.member_id, s]));
  const out = new Map<string, Shift>();
  for (const m of members) {
    const s = custom.get(m.id);
    out.set(m.id, s
      ? { start: s.start_time?.slice(0, 5) ?? DEFAULT_SHIFT.start, end: s.end_time?.slice(0, 5) ?? DEFAULT_SHIFT.end, off: s.is_off, note: s.note }
      : { ...DEFAULT_SHIFT, off: false, note: null });
  }
  return out;
}

export function shiftLabel(s: Shift): string {
  return s.off ? "หยุด" : `${s.start}–${s.end}`;
}

// พนักงานที่ต้องลงเวลา (ไม่รวมคนที่ตั้ง tracks_attendance = false เช่น เจ้าของ)
export async function staff(): Promise<(Member & { tracks_attendance: boolean })[]> {
  const { data } = await db
    .from("team_members")
    .select("id, line_user_id, nickname, display_name, role, tracks_attendance")
    .eq("active", true).eq("tracks_attendance", true).order("created_at");
  return (data ?? []) as (Member & { tracks_attendance: boolean })[];
}

export async function noticesOn(date: string) {
  const { data } = await db
    .from("absence_notices").select("member_id, kind, minutes, reason").eq("work_date", date).order("created_at");
  return data ?? [];
}

export const NOTICE_LABEL: Record<string, string> = { late: "แจ้งสาย", absent: "แจ้งขาด", sick: "แจ้งป่วย" };
