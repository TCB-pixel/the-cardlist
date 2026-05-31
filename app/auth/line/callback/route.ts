import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=line_cancelled", request.url));
  }

  try {
    // 1. แลก code เป็น access token
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINE_REDIRECT_URI!,
        client_id: process.env.LINE_CLIENT_ID!,
        client_secret: process.env.LINE_CLIENT_SECRET!,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/login?error=line_token_failed", request.url));
    }

    // 2. ดึงข้อมูล profile จาก LINE
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    const lineUserId = profile.userId;
    const displayName = profile.displayName || "LINE User";
    const pictureUrl = profile.pictureUrl || null;

    // 3. สร้าง email จำลองจาก LINE user ID (Supabase ต้องการ email)
    const fakeEmail = `line_${lineUserId}@thecardlist.line`;
    const fakePassword = `line_${lineUserId}_${process.env.LINE_CLIENT_SECRET!.substring(0, 8)}`;

    const supabase = createClient();

    // 4. ลอง login ด้วย email จำลองก่อน (ถ้ามี account แล้ว)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword,
    });

    if (!signInError && signInData.user) {
      // มี account แล้ว → update ข้อมูล LINE ล่าสุด
      await supabase
        .from("profiles")
        .update({
          line_user_id: lineUserId,
          display_name: displayName,
          avatar_url: pictureUrl,
        })
        .eq("id", signInData.user.id);

      return NextResponse.redirect(new URL("/profile", request.url));
    }

    // 5. ยังไม่มี account → สร้างใหม่
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password: fakePassword,
      options: {
        data: {
          full_name: displayName,
          avatar_url: pictureUrl,
          line_user_id: lineUserId,
        },
      },
    });

    if (signUpError || !signUpData.user) {
      return NextResponse.redirect(new URL("/login?error=signup_failed", request.url));
    }

    // 6. บันทึกข้อมูล profile เพิ่มเติม
    await supabase.from("profiles").upsert({
      id: signUpData.user.id,
      line_user_id: lineUserId,
      display_name: displayName,
      avatar_url: pictureUrl,
      email: fakeEmail,
    });

    return NextResponse.redirect(new URL("/profile", request.url));
  } catch (err) {
    console.error("LINE callback error:", err);
    return NextResponse.redirect(new URL("/login?error=unknown", request.url));
  }
}
