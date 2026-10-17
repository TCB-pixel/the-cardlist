import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { TCG_LIST } from "@/lib/tcg";

// หลังบ้าน: Decklist ต่อทัวร์ + ฐานข้อมูลการแข่งของร้าน (เก็บถาวร ไม่ลบหลังจบงาน)
// อ่าน = events:view · แก้สถานะ/ผล/ตั้งค่าทัวร์ = events:edit

const DECKLIST_COLS = "id, event_id, user_id, booking_id, event_title, event_date, player_name, game, format, deck_name, cards, card_count, deck_code, rule_issues, status, staff_note, checked_by, checked_at, placement, top_cut, consent_version, consent_at, submitted_at, updated_at";
const clean = (q: string) => q.replace(/[,()%*\\]/g, " ").trim();

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "events:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "";

  // รายชื่ออีเวนต์ + ตั้งค่ารับ decklist + จำนวนที่ส่งแล้ว
  if (mode === "events") {
    const { data: events, error } = await adminDb
      .from("events")
      .select("id, title, date, event_type, tcg, decklist_enabled, decklist_deadline, decklist_game, decklist_regulation")
      .order("date", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: "โหลดอีเวนต์ไม่สำเร็จ" }, { status: 400 });
    const { data: rows } = await adminDb.from("event_decklists").select("event_id").not("event_id", "is", null);
    const counts: Record<string, number> = {};
    for (const r of rows ?? []) counts[r.event_id as string] = (counts[r.event_id as string] ?? 0) + 1;
    return NextResponse.json({ events: events ?? [], counts });
  }

  // ฐานข้อมูลการแข่ง: ค้นย้อนหลังทุกทัวร์ (ผู้เล่น / ชื่อเด็ค / ชื่อทัวร์) กรองเกม
  if (mode === "archive") {
    const q = clean(url.searchParams.get("q") ?? "");
    const game = url.searchParams.get("game") ?? "";
    let query = adminDb.from("event_decklists").select(DECKLIST_COLS).order("submitted_at", { ascending: false }).limit(500);
    if (game) query = query.eq("game", game);
    if (q) query = query.or(`player_name.ilike.%${q}%,deck_name.ilike.%${q}%,event_title.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "โหลดฐานข้อมูลการแข่งไม่สำเร็จ" }, { status: 400 });
    return NextResponse.json({ decklists: data ?? [] });
  }

  // ทัวร์เดียว: decklist ทั้งหมด + ผู้ที่จองในเว็บแต่ยังไม่ส่ง
  const eventId = url.searchParams.get("eventId") ?? "";
  if (!eventId) return NextResponse.json({ error: "เลือกอีเวนต์" }, { status: 400 });
  const [{ data: event }, { data: decklists, error }, { data: bookings }] = await Promise.all([
    adminDb.from("events").select("id, title, date, tcg, decklist_enabled, decklist_deadline, decklist_game, decklist_regulation").eq("id", eventId).maybeSingle(),
    adminDb.from("event_decklists").select(DECKLIST_COLS).eq("event_id", eventId).order("player_name"),
    adminDb.from("bookings").select("id, user_id, status, profiles(display_name, member_code)").eq("event_id", eventId).eq("status", "confirmed"),
  ]);
  if (!event) return NextResponse.json({ error: "ไม่พบอีเวนต์" }, { status: 404 });
  if (error) return NextResponse.json({ error: "โหลด decklist ไม่สำเร็จ" }, { status: 400 });
  const sent = new Set((decklists ?? []).map((d) => d.user_id));
  const missing = (bookings ?? [])
    .filter((b) => !sent.has(b.user_id))
    .map((b) => {
      const p = (Array.isArray(b.profiles) ? b.profiles[0] : b.profiles) as { display_name?: string; member_code?: string } | null;
      return { booking_id: b.id, name: p?.display_name ?? "", member_code: p?.member_code ?? "" };
    });
  return NextResponse.json({ event, decklists: decklists ?? [], missing });
}

// แก้สถานะตรวจ / หมายเหตุ / ผลการแข่ง ของ decklist หนึ่งรายการ
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, "events:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const id = String(b.id ?? "");
  if (!id) return NextResponse.json({ error: "ไม่พบ decklist" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.status !== undefined) {
    if (!["submitted", "checked", "rejected"].includes(String(b.status))) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    patch.status = b.status;
    patch.checked_by = b.status === "submitted" ? null : auth.caller.email;
    patch.checked_at = b.status === "submitted" ? null : new Date().toISOString();
  }
  if (b.staff_note !== undefined) patch.staff_note = String(b.staff_note).slice(0, 500);
  if (b.placement !== undefined) {
    const p = b.placement === null || b.placement === "" ? null : parseInt(String(b.placement), 10);
    if (p !== null && (!Number.isFinite(p) || p < 1 || p > 9999)) return NextResponse.json({ error: "อันดับต้องเป็นเลข 1 ขึ้นไป" }, { status: 400 });
    patch.placement = p;
  }
  if (b.top_cut !== undefined) patch.top_cut = !!b.top_cut;

  const { error } = await adminDb.from("event_decklists").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// ตั้งค่าการรับ decklist ของทัวร์
export async function PUT(req: Request) {
  const auth = await requireAdmin(req, "events:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const eventId = String(b.eventId ?? "");
  const game = String(b.decklist_game ?? "");
  if (game && !TCG_LIST.includes(game)) return NextResponse.json({ error: "เกมไม่ถูกต้อง" }, { status: 400 });
  const deadline = b.decklist_deadline ? new Date(String(b.decklist_deadline)) : null;
  if (deadline && isNaN(deadline.getTime())) return NextResponse.json({ error: "เวลาปิดรับไม่ถูกต้อง" }, { status: 400 });

  const { error } = await adminDb.from("events").update({
    decklist_enabled: !!b.decklist_enabled,
    decklist_deadline: deadline ? deadline.toISOString() : null,
    decklist_game: game || null,
    decklist_regulation: String(b.decklist_regulation ?? "").toUpperCase().replace(/[^A-Z, ]/g, "").slice(0, 40) || null,
  }).eq("id", eventId);
  if (error) return NextResponse.json({ error: "บันทึกตั้งค่าไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
