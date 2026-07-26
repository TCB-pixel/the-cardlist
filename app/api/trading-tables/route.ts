import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  TableType,
  TABLE_TYPES,
  TABLE_CAPACITY,
  generateSlots,
  violatesCooldown,
} from "@/lib/tradingTables";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type BookingRow = {
  id: string;
  event_id: string;
  user_id: string;
  table_type: TableType;
  table_number: number;
  booking_date: string;
  slot_start: string;
  slot_end: string;
  status: "confirmed" | "cancelled";
};

// ดึง user จาก Bearer token (ถ้ามี) — ไม่บังคับสำหรับ GET
async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user;
}

// ---------- GET : ดึง availability ทั้งหมดของ event + การจองของ user ปัจจุบัน (ถ้า login) ----------
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
  if (!eventId) return NextResponse.json({ error: "ไม่พบ event_id" }, { status: 400 });

  const { data: event, error: evErr } = await admin
    .from("events")
    .select("id, title, date, date_end, trading_tables_enabled")
    .eq("id", eventId)
    .single();
  if (evErr || !event) return NextResponse.json({ error: "ไม่พบอีเวนต์" }, { status: 404 });
  if (!event.trading_tables_enabled) {
    return NextResponse.json({ error: "อีเวนต์นี้ไม่เปิดให้จองโต๊ะเทรด" }, { status: 400 });
  }

  // สร้างรายการวันที่ของ event (date ถึง date_end)
  const days: string[] = [];
  const start = new Date(event.date);
  const end = new Date(event.date_end ?? event.date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  const slots = generateSlots();

  const { data: bookings, error: bkErr } = await admin
    .from("trading_table_bookings")
    .select("id, event_id, user_id, table_type, table_number, booking_date, slot_start, slot_end, status")
    .eq("event_id", eventId)
    .eq("status", "confirmed");
  if (bkErr) return NextResponse.json({ error: bkErr.message }, { status: 500 });

  const rows = (bookings ?? []) as BookingRow[];

  // availability[date][type][slotStart] = จำนวนโต๊ะที่ถูกจองแล้ว
  const availability: Record<string, Record<TableType, Record<string, number>>> = {};
  for (const day of days) {
    availability[day] = { pokemon: {}, onepiece: {}, lorcana: {} };
    for (const type of TABLE_TYPES) {
      for (const s of slots) availability[day][type][s.start] = 0;
    }
  }
  for (const b of rows) {
    const dateKey = b.booking_date;
    if (availability[dateKey]?.[b.table_type] !== undefined) {
      const slotKey = b.slot_start.slice(0, 5);
      if (availability[dateKey][b.table_type][slotKey] !== undefined) {
        availability[dateKey][b.table_type][slotKey] += 1;
      }
    }
  }

  // การจองของ user ปัจจุบัน (ถ้า login)
  const user = await getUserFromToken(req);
  const myBookings = user ? rows.filter((b) => b.user_id === user.id) : [];

  return NextResponse.json({
    event: { id: event.id, title: event.title, days },
    slots,
    capacity: TABLE_CAPACITY,
    availability,
    myBookings,
  });
}

// ---------- POST : จองโต๊ะเทรด (ต้อง login) ----------
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนจอง" }, { status: 401 });

    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return NextResponse.json({ error: "token ไม่ถูกต้อง" }, { status: 401 });

    const body = await req.json();
    const { event_id, table_type, date, slot_start } = body;

    if (!event_id || !table_type || !date || !slot_start) {
      return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
    }
    if (!TABLE_TYPES.includes(table_type)) {
      return NextResponse.json({ error: "ประเภทโต๊ะไม่ถูกต้อง" }, { status: 400 });
    }

    const { data: event, error: evErr } = await admin
      .from("events")
      .select("id, date, date_end, trading_tables_enabled")
      .eq("id", event_id)
      .single();
    if (evErr || !event) return NextResponse.json({ error: "ไม่พบอีเวนต์" }, { status: 404 });
    if (!event.trading_tables_enabled) {
      return NextResponse.json({ error: "อีเวนต์นี้ไม่เปิดให้จองโต๊ะเทรด" }, { status: 400 });
    }

    // ตรวจว่าวันที่ที่ขอจองอยู่ในช่วงงานจริง
    const minDate = event.date;
    const maxDate = event.date_end ?? event.date;
    if (date < minDate || date > maxDate) {
      return NextResponse.json({ error: "วันที่นอกช่วงงาน" }, { status: 400 });
    }

    // ตรวจว่า slot ที่ขอ ตรงกับ slot ที่ระบบอนุญาตจริง (กันการยิง request มั่ว)
    const validSlots = generateSlots();
    const slot = validSlots.find((s) => s.start === slot_start);
    if (!slot) return NextResponse.json({ error: "ช่วงเวลาไม่ถูกต้อง" }, { status: 400 });

    // ── ตรวจ cooldown: เทียบกับรอบอื่นของ user คนเดียวกัน ในวันเดียวกัน ──
    const { data: userBookings, error: ubErr } = await admin
      .from("trading_table_bookings")
      .select("slot_start, slot_end")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .eq("booking_date", date)
      .eq("status", "confirmed");
    if (ubErr) return NextResponse.json({ error: ubErr.message }, { status: 500 });

    if (violatesCooldown(slot, (userBookings ?? []).map((b) => ({ slot_start: b.slot_start.slice(0, 5), slot_end: b.slot_end.slice(0, 5) })))) {
      return NextResponse.json(
        { error: "ต้องเว้นระยะอย่างน้อย 60 นาทีระหว่างรอบเทรดของคุณ" },
        { status: 400 }
      );
    }

    // ── หาโต๊ะที่ว่าง (table_number) สำหรับ type/date/slot นี้ ──
    const capacity = TABLE_CAPACITY[table_type as TableType];
    const { data: takenRows, error: takenErr } = await admin
      .from("trading_table_bookings")
      .select("table_number")
      .eq("event_id", event_id)
      .eq("table_type", table_type)
      .eq("booking_date", date)
      .eq("slot_start", slot.start)
      .eq("status", "confirmed");
    if (takenErr) return NextResponse.json({ error: takenErr.message }, { status: 500 });

    const takenNumbers = new Set((takenRows ?? []).map((r) => r.table_number));
    let tableNumber = 0;
    for (let n = 1; n <= capacity; n++) {
      if (!takenNumbers.has(n)) { tableNumber = n; break; }
    }
    if (tableNumber === 0) {
      return NextResponse.json({ error: "โต๊ะรอบนี้เต็มแล้ว กรุณาเลือกรอบอื่น" }, { status: 409 });
    }

    const { data: inserted, error: insErr } = await admin
      .from("trading_table_bookings")
      .insert({
        event_id,
        user_id: user.id,
        table_type,
        table_number: tableNumber,
        booking_date: date,
        slot_start: slot.start,
        slot_end: slot.end,
        status: "confirmed",
      })
      .select("*")
      .single();

    if (insErr) {
      // unique constraint ชน (race condition) — แจ้งให้ลองใหม่
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "มีคนจองรอบนี้ไปพอดี กรุณาลองใหม่" }, { status: 409 });
      }
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ booking: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ยกเลิกการจองของตัวเอง (เฉพาะรอบที่ยังไม่เริ่ม) ----------
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return NextResponse.json({ error: "token ไม่ถูกต้อง" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const { data: booking, error: bErr } = await admin
      .from("trading_table_bookings")
      .select("id, user_id, booking_date, slot_start, status")
      .eq("id", id)
      .single();
    if (bErr || !booking) return NextResponse.json({ error: "ไม่พบการจอง" }, { status: 404 });
    if (booking.user_id !== user.id) return NextResponse.json({ error: "ไม่มีสิทธิ์ยกเลิกการจองนี้" }, { status: 403 });
    if (booking.status === "cancelled") return NextResponse.json({ error: "ยกเลิกไปแล้ว" }, { status: 400 });

    const slotStartDt = new Date(`${booking.booking_date}T${booking.slot_start}`);
    if (slotStartDt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "รอบนี้เริ่มไปแล้ว ยกเลิกไม่ได้" }, { status: 400 });
    }

    const { error: updErr } = await admin
      .from("trading_table_bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
