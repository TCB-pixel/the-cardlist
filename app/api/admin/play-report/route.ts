import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

type Row = {
  user_id: string;
  tcg: string;
  played_at: string;
};

// ---------- GET : สรุปรายเดือน — ใครมาเล่นกี่รอบ เล่นเกมอะไรบ้าง ----------
// ?month=YYYY-MM (ไม่ใส่ = เดือนปัจจุบัน)
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "play:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const monthParam = new URL(req.url).searchParams.get("month");
  const now = new Date();
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? monthParam!
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));

  const { data, error } = await adminDb
    .from("play_sessions")
    .select("user_id, tcg, played_at")
    .gte("played_at", start.toISOString())
    .lt("played_at", end.toISOString())
    .order("played_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as Row[];

  // นับรายคน + แยกตามเกม
  const byUser = new Map<string, { visits: number; games: Record<string, number>; last: string }>();
  const byGame: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  for (const r of rows) {
    const u = byUser.get(r.user_id) ?? { visits: 0, games: {}, last: r.played_at };
    u.visits += 1;
    u.games[r.tcg] = (u.games[r.tcg] ?? 0) + 1;
    if (r.played_at > u.last) u.last = r.played_at;
    byUser.set(r.user_id, u);

    byGame[r.tcg] = (byGame[r.tcg] ?? 0) + 1;
    const day = r.played_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  // ดึงชื่อสมาชิกทีเดียว
  const ids = Array.from(byUser.keys());
  const { data: profiles } = ids.length
    ? await adminDb.from("profiles").select("id, member_code, display_name, username").in("id", ids)
    : { data: [] as any[] };
  const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // ยอดสะสมตลอดกาลของคนที่มาเดือนนี้ ใช้ดูว่าใกล้ครบเกณฑ์รับสิทธิ์แล้วหรือยัง
  const { data: allTime } = ids.length
    ? await adminDb.from("play_sessions").select("user_id").in("user_id", ids)
    : { data: [] as any[] };
  const totalById = new Map<string, number>();
  for (const r of allTime ?? []) {
    totalById.set(r.user_id, (totalById.get(r.user_id) ?? 0) + 1);
  }

  const members = ids.map((id) => {
    const u = byUser.get(id)!;
    const p = profileById.get(id);
    return {
      user_id: id,
      member_code: p?.member_code ?? "—",
      name: p?.display_name ?? p?.username ?? "(ไม่ทราบชื่อ)",
      visits: u.visits,
      totalVisits: totalById.get(id) ?? u.visits,
      games: u.games,
      lastPlayed: u.last,
    };
  }).sort((a, b) => b.visits - a.visits);

  return NextResponse.json({
    month,
    totalSessions: rows.length,
    uniqueMembers: members.length,
    byGame,
    byDay,
    members,
  });
}
