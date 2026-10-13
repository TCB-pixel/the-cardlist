import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { getUserFromRequest, releaseExpired } from "@/lib/booth";

// รายการจองของฉัน (หน้า success ใช้ดึงสถานะซ้ำจนกว่า webhook จะยืนยัน)
export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  await releaseExpired();

  const { data: bookings } = await adminDb
    .from("booth_bookings")
    .select("id, event_id, status, days, subtotal, discount_code, discount_amount, card_fee, total, hold_expires_at, created_at, paid_at, booth_events(title, location)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const ids = (bookings ?? []).map((b: any) => b.id);
  const { data: rows } = ids.length
    ? await adminDb.from("booth_booking_tables").select("booking_id, table_id").in("booking_id", ids)
    : { data: [] as any[] };
  const tablesBy: Record<string, string[]> = {};
  for (const r of rows ?? []) (tablesBy[(r as any).booking_id] ??= []).push((r as any).table_id);

  return NextResponse.json({
    bookings: (bookings ?? []).map((b: any) => ({
      ...b,
      days: (b.days as string[]).map((d) => String(d).slice(0, 10)),
      tables: Array.from(new Set(tablesBy[b.id] ?? [])).sort((a, c) => a.localeCompare(c, "en", { numeric: true })),
    })),
  });
}
