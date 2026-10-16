import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { bangkokNow, stationToken, type Station } from "@/lib/passport";

export const dynamic = "force-dynamic";

// หน้าจอคนสอน (ลิงก์เฉพาะโต๊ะ ?k=display_key) — ขอ QR ปัจจุบันของโต๊ะ ไม่ต้องมีบัญชีหลังบ้าน
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const code = sp.get("code") ?? "", k = sp.get("k") ?? "";
  const { data } = await adminDb.from("passport_stations").select("*").eq("code", code).maybeSingle();
  const st = data as Station | null;
  if (!st || !k || st.display_key !== k) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const today = bangkokNow().date;
  const { count } = await adminDb.from("passport_stamps").select("id", { count: "exact", head: true })
    .eq("station_id", st.id).gte("stamped_at", `${today}T00:00:00+07:00`);

  const now = Date.now();
  const period = st.qr_mode === "rotating" ? 30_000 : 0;
  return NextResponse.json({
    name: st.name, logo: st.logo_path, track: st.track, active: st.active, isTest: st.is_test,
    token: stationToken(st, { now }), qrMode: st.qr_mode,
    nextInMs: period ? period - (now % period) : null,
    today: count ?? 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
