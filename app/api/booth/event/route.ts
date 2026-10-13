import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { getBooked, isPartialOpen, loadEvent, releaseExpired } from "@/lib/booth";

// ข้อมูลสาธารณะของงานที่เปิดจองโต๊ะ: ผัง ราคา และโต๊ะ/วันที่ถูกจองแล้ว (ไม่มีข้อมูลส่วนตัวของใคร)
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");

  if (!id) {
    const { data } = await adminDb
      .from("booth_events")
      .select("id, title, location, days")
      .eq("active", true)
      .order("created_at", { ascending: false });
    return NextResponse.json({
      events: (data ?? []).map((e: any) => ({ ...e, days: (e.days as string[]).map((d) => String(d).slice(0, 10)) })),
    });
  }

  await releaseExpired();
  const ev = await loadEvent(id);
  if (!ev || !ev.active) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  return NextResponse.json({
    event: {
      id: ev.id, title: ev.title, location: ev.location, days: ev.days,
      partial_open_at: ev.partial_open_at, hold_minutes: ev.hold_minutes, max_tables: ev.max_tables,
      pricing: ev.pricing, layout: ev.layout,
      rules: ev.rules, rules_version: ev.rules_version,
    },
    booked: await getBooked(ev.id),
    partialOpen: isPartialOpen(ev),
  });
}
