import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { passportForDevice, readDeviceToken } from "@/lib/passport";

export const dynamic = "force-dynamic";

// ฉีกซอง — สุ่มจากของที่เหลือจริง (ฟังก์ชัน passport_open_pack ล็อกสต็อกในฐานข้อมูล)
export async function POST(req: Request) {
  const p = await passportForDevice(readDeviceToken(req));
  if (!p) return NextResponse.json({ error: "no_passport" }, { status: 401 });

  const { data: pack } = await adminDb.from("passport_packs").select("id")
    .eq("passport_id", p.id).is("opened_at", null).order("created_at").limit(1).maybeSingle();
  if (!pack) return NextResponse.json({ error: "no_pack" }, { status: 409 });

  const { data, error } = await adminDb.rpc("passport_open_pack", { p_pack: pack.id });
  if (error) {
    const empty = error.message.includes("pool_empty");
    return NextResponse.json({ error: empty ? "pool_empty" : "error" }, { status: empty ? 409 : 500 });
  }
  const r = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, tier: r.tier, name: r.name, color: r.color });
}
