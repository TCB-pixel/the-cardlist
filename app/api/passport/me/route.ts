import { NextResponse } from "next/server";
import { passportForDevice, passportState, readDeviceToken } from "@/lib/passport";

export const dynamic = "force-dynamic";

// ข้อมูลพาสปอร์ตของเครื่องนี้ (ระบุจากคุกกี้ clp_dev — ไม่ต้องสมัครสมาชิก)
export async function GET(req: Request) {
  const p = await passportForDevice(readDeviceToken(req));
  const test = new URL(req.url).searchParams.get("test") === "1";
  return NextResponse.json(await passportState(p, test), { headers: { "Cache-Control": "no-store" } });
}
