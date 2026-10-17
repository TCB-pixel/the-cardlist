import { NextResponse } from "next/server";
import { stampWithToken } from "@/lib/passport";
import { currentUserId, memberStatus } from "@/lib/passport-auth";

export const dynamic = "force-dynamic";

// สแกน QR ของจุด/โต๊ะสอนเล่น → ปั๊มแสตมป์ (ต้องล็อกอิน LINE + สมัคร Passport แล้ว)
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (typeof token !== "string" || !token) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  try {
    const userId = await currentUserId();
    const joined = userId ? (await memberStatus(userId)).joined : false;
    const { result } = await stampWithToken(token, userId, joined);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    console.error("passport stamp failed:", e);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
