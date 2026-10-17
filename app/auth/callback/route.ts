import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Session } from "@supabase/supabase-js";
import { safeNext } from "@/lib/auth-next";
import { APP_CHALLENGE_COOKIE, isChallenge, sealAppCode } from "@/lib/app-login";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=line_cancelled", request.url));
  }

  // state ต้องตรงกับที่เราตั้งไว้ตอนเริ่มล็อกอิน ไม่งั้นปฏิเสธ
  const expectedState = request.cookies.get("line_oauth_state")?.value;
  if (!expectedState || searchParams.get("state") !== expectedState) {
    const r = NextResponse.redirect(new URL("/login?error=line_state", request.url));
    r.cookies.set("line_oauth_state", "", { path: "/", maxAge: 0 });
    return r;
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
    const dest = safeNext(cookieStore.get("login_next")?.value);
    // ล็อกอินที่เริ่มจากแอปมือถือ → ส่งรหัสใช้ครั้งเดียวกลับเข้าแอปแทนการพาไปหน้าเว็บ
    const appChallenge = cookieStore.get(APP_CHALLENGE_COOKIE)?.value;
    const fromApp = isChallenge(appChallenge);
    // ปลายทางหลังเข้าสู่ระบบ + ล้างคุกกี้ที่จำไว้
    const goto = (path: string, session?: Session | null) => {
      const target = fromApp && session
        ? `/auth/app-return?code=${sealAppCode(session.refresh_token, appChallenge, path)}`
        : path;
      const r = NextResponse.redirect(new URL(target, request.url));
      r.cookies.set("login_next", "", { path: "/", maxAge: 0 });
      r.cookies.set("line_oauth_state", "", { path: "/", maxAge: 0 });
      r.cookies.set(APP_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
      return r;
    };
    // Passport มีหน้าสมัครของตัวเอง (ชื่อเล่น ช่วงอายุ ยินยอม PDPA) — ไม่บังคับกรอกชื่อ-นามสกุลก่อน
    const completeUrl = dest?.startsWith("/passport") ? dest
      : dest ? `/profile/complete?next=${encodeURIComponent(dest)}` : "/profile/complete";
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

    // จากแอป: ไม่ผูกกับบัญชีที่ค้างอยู่ในเบราว์เซอร์ของเครื่อง (ผู้ใช้ตั้งใจล็อกอินด้วย LINE นี้)
    if (existingSession?.user && !fromApp) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(lineProfilePayload)
        .eq("id", existingSession.user.id);

      if (updateError) {
        console.error("Update existing session profile error:", updateError);
        return NextResponse.redirect(new URL("/login?error=line_profile_update_failed", request.url));
      }

      return goto(dest ?? "/profile?linked=line");
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

      return goto(isComplete ? dest ?? "/profile" : completeUrl, signInData.session);
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
    const { data: signInAfterSignUpData, error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
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

    return goto(completeUrl, signInAfterSignUpData.session);
  } catch (err) {
    console.error("LINE callback error:", err);
    return NextResponse.redirect(new URL("/login?error=unknown", request.url));
  }
}
