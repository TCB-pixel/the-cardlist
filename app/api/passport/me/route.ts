import { NextResponse } from "next/server";
import { passportForUser, passportState } from "@/lib/passport";
import { currentUserId, memberStatus } from "@/lib/passport-auth";

export const dynamic = "force-dynamic";

// ข้อมูลพาสปอร์ตของสมาชิกที่ล็อกอินอยู่ · ยังไม่ล็อกอิน / ยังไม่สมัคร Passport → บอกให้หน้าเว็บพาไปสมัคร
export async function GET(req: Request) {
  const test = new URL(req.url).searchParams.get("test") === "1";
  const userId = await currentUserId();
  const member = userId ? await memberStatus(userId) : null;
  const p = member?.joined ? await passportForUser(userId, test ? true : undefined) : null;
  const state = await passportState(p, test, member ? { nickname: member.nickname } : null);
  return NextResponse.json(
    { ...state, auth: !userId ? "login" : !member?.joined ? "join" : "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
