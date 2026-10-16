import { NextResponse } from "next/server";
import { DEVICE_COOKIE, DEVICE_COOKIE_OPTS, readDeviceToken, stampWithToken } from "@/lib/passport";

export const dynamic = "force-dynamic";

// สแกน QR ของจุด/โต๊ะสอนเล่น → ปั๊มแสตมป์
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (typeof token !== "string" || !token) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  try {
    const { result, newDevice } = await stampWithToken(token, readDeviceToken(req));
    const res = NextResponse.json(result, { status: result.ok ? 200 : 409 });
    if (newDevice) res.cookies.set(DEVICE_COOKIE, newDevice, DEVICE_COOKIE_OPTS);
    return res;
  } catch (e) {
    console.error("passport stamp failed:", e);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
