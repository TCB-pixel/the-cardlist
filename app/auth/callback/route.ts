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
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/login?error=line_token_failed", request.url));
    }

    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    const lineUserId = profile.userId;
    const displayName = profile.displayName || "LINE User";
    const pictureUrl = profile.pictureUrl || null;

    const fakeEmail = `line_${lineUserId}@thecardlist.com`;
    const fakePassword = `line_${lineUserId}_${process.env.LINE_CLIENT_SECRET!.substring(0, 8)}`;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // เช็คว่ามี session อยู่แล้วไหม (Email login ที่อยากผูก LINE)
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession?.user) {
      await supabase.from("profiles").update({
        line_user_id: lineUserId,
        avatar_url: pictureUrl ?? undefined,
      }).eq("id", existingSession.user.id);
      return NextResponse.redirect(new URL("/profile?linked=line", request.url));
    }

    // ลอง login ก่อน (มี account แล้ว)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword,
    });

    if (!signInError && signInData.user) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", signInData.user.id)
        .single();

      const isComplete = existingProfile?.first_name && existingProfile?.last_name;
      return NextResponse.redirect(new URL(isComplete ? "/profile" : "/profile/complete", request.url));
    }

    // สร้าง account ใหม่
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
      console.error("SignUp error:", signUpError);
      return NextResponse.redirect(new URL("/login?error=signup_failed", request.url));
    }

    // *** Sign in ทันทีหลัง signUp เพื่อให้ได้ session ***
    const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword,
    });

    if (signInAfterSignUpError) {
      console.error("SignIn after signUp error:", signInAfterSignUpError);
      return NextResponse.redirect(new URL("/login?error=signin_failed", request.url));
    }

    await supabase.from("profiles").upsert({
      id: signUpData.user.id,
      line_user_id: lineUserId,
      display_name: displayName,
      username: `line_${lineUserId.substring(0, 8)}`,
      avatar_url: pictureUrl,
      email: fakeEmail,
    });

    return NextResponse.redirect(new URL("/profile/complete", request.url));
  } catch (err) {
    console.error("LINE callback error:", err);
    return NextResponse.redirect(new URL("/login?error=unknown", request.url));
  }
}
