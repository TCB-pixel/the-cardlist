import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth-next";

export async function GET(req: Request) {
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const clientId = process.env.LINE_CLIENT_ID!;
  const redirectUri = process.env.LINE_REDIRECT_URI!;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "profile openid email",
    bot_prompt: "aggressive",
  });

  const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;

  const res = NextResponse.redirect(lineAuthUrl);
  // จำ state ไว้เทียบตอน LINE พากลับมา (กันคนอื่นหลอกให้ล็อกอินเข้าบัญชีของเขา)
  res.cookies.set("line_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" });
  // จำหน้าที่จะกลับไปหลัง LINE พากลับมา (อายุสั้น ใช้ครั้งเดียว)
  if (next) res.cookies.set("login_next", next, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" });
  return res;
}
