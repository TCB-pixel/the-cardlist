import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=line_cancelled", request.url));
  }

  try {
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

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("LINE token failed:", tokenData);
      return NextResponse.redirect(new URL("/login?error=line_token_failed", request.url));
    }

    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileRes.json();

    if (!profileRes.ok || !profile.userId) {
      console.error("LINE profile failed:", profile);
      return NextResponse.redirect(new URL("/login?error=line_profile_failed", request.url));
    }

    const lineUserId = profile.userId as string;
    const displayName = (profile.displayName as string) || "LINE User";
    const pictureUrl = (profile.pictureUrl as string | undefined) || null;

    const fakeEmail = `line_${lineUserId}@thecardlist.com`;
    const fakePassword = `line_${lineUserId}_${process.env.LINE_CLIENT_SECRET!.substring(0, 8)}`;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const lineProfilePayload = {
      line_user_id: lineUserId,
      display_name: displayName,
      avatar_url: pictureUrl,
    };

    // กรณีมี session อยู่แล้ว เช่น login ด้วย email อยู่ แล้วต้องการผูก LINE เพิ่ม
    const {
      data: { session: existingSession },
    } = await supabase.auth.getSession();

    if (existingSession?.user) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(lineProfilePayload)
        .eq("id", existingSession.user.id);

      if (updateError) {
        console.error("Update existing session profile error:", updateError);
        return NextResponse.redirect(new URL("/login?error=line_profile_update_failed", request.url));
      }

      return NextResponse.redirect(new URL("/profile?linked=line", request.url));
    }

    // ลอง login ก่อน กรณีเคยสมัครด้วย LINE ไว้แล้ว
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword,
    });

    if (!signInError && signInData.user) {
      // จุดสำคัญ: user เดิม login สำเร็จแล้ว ต้อง update line_user_id กลับเข้า profiles ทุกครั้ง
      const { error: updateError } = await supabase
        .from("profiles")
        .update(lineProfilePayload)
        .eq("id", signInData.user.id);

      if (updateError) {
        console.error("Update signed-in LINE profile error:", updateError);
        return NextResponse.redirect(new URL("/login?error=line_profile_update_failed", request.url));
      }

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", signInData.user.id)
        .single();

      const isComplete = Boolean(existingProfile?.first_name && existingProfile?.last_name);

      return NextResponse.redirect(
        new URL(isComplete ? "/profile" : "/profile/complete", request.url)
      );
    }

    // สร้าง account ใหม่ กรณียังไม่เคย login ด้วย LINE นี้
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password: fakePassword,
      options: {
        data: {
          full_name: displayName,
          display_name: displayName,
          avatar_url: pictureUrl,
          line_user_id: lineUserId,
        },
      },
    });

    if (signUpError || !signUpData.user) {
      console.error("SignUp error:", signUpError);
      return NextResponse.redirect(new URL("/login?error=signup_failed", request.url));
    }

    // Sign in ทันทีหลัง signUp เพื่อให้ browser ได้ session
    const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword,
    });

    if (signInAfterSignUpError) {
      console.error("SignIn after signUp error:", signInAfterSignUpError);
      return NextResponse.redirect(new URL("/login?error=signin_failed", request.url));
    }

    // trigger on_auth_user_created (security definer) สร้าง row ใน profiles ให้อัตโนมัติแล้วตอน signUp
    // ต้องใช้ update ไม่ใช่ upsert — ตาราง profiles ไม่มี insert policy จึงโดน RLS บล็อกเสมอถ้า insert ตรงนี้
    const { error: updateNewProfileError } = await supabase
      .from("profiles")
      .update({
        username: `line_${lineUserId.substring(0, 8)}`,
        ...lineProfilePayload,
      })
      .eq("id", signUpData.user.id);

    if (updateNewProfileError) {
      console.error("Update new LINE profile error:", updateNewProfileError);
      return NextResponse.redirect(new URL("/login?error=line_profile_upsert_failed", request.url));
    }

    return NextResponse.redirect(new URL("/profile/complete", request.url));
  } catch (err) {
    console.error("LINE callback error:", err);
    return NextResponse.redirect(new URL("/login?error=unknown", request.url));
  }
}
