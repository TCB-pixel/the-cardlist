import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { stationToken, type Station } from "@/lib/passport";

export const dynamic = "force-dynamic";

// QR สำหรับพิมพ์ป้าย: จุดในงาน (แยกรายวันของงาน) + ลิงก์หน้าจอคนสอนของโต๊ะ Learn To Play
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "passport:manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const slug = url.searchParams.get("event") ?? "";
  const origin = url.origin;

  const { data: ev } = await adminDb.from("passport_events").select("*").eq("slug", slug).maybeSingle();
  if (!ev) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

  const { data: stations } = await adminDb.from("passport_stations").select("*")
    .eq("is_test", ev.is_test).eq("active", true).order("sort");

  const days: string[] = [];
  for (let d = new Date(ev.starts_on + "T00:00:00Z"); d <= new Date(ev.ends_on + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  const signs = [] as { day: string; station: string; code: string; url: string }[];
  const screens = [] as { station: string; code: string; logo: string | null; url: string }[];
  for (const s of (stations ?? []) as Station[]) {
    if (s.track === "passport" && s.event_id === ev.id) {
      for (const day of days) {
        const token = s.qr_mode === "daily" ? stationToken(s, { ymd: day.replace(/-/g, "") }) : null;
        if (token) signs.push({ day, station: s.name, code: s.code, url: `${origin}/passport/s/${token}` });
      }
      if (s.qr_mode === "rotating") screens.push({ station: s.name, code: s.code, logo: s.logo_path, url: `${origin}/passport/station/${s.code}?k=${s.display_key}` });
    }
    if (s.track === "learn") screens.push({ station: s.name, code: s.code, logo: s.logo_path, url: `${origin}/passport/station/${s.code}?k=${s.display_key}` });
  }
  return NextResponse.json({ event: { name: ev.name, venue: ev.venue, days, isTest: ev.is_test }, signs, screens, entry: `${origin}/passport` });
}
