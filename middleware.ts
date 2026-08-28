import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// เช็คสิทธิ์แอดมินจากฐานข้อมูล (admin_users → admin_staff) แทนการ hardcode อีเมล
// ใช้ service role เพื่อ bypass RLS ตอนเช็ค (เหมือน pattern ใน app/api/admin/orders/route.ts)
async function isAdminEmail(email: string): Promise<boolean> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: au } = await admin
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (au) return true;

  const { data: st } = await admin
    .from("admin_staff")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return !!st;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const email = user.email?.toLowerCase() ?? "";
    if (!email || !(await isAdminEmail(email))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }

  } catch (e) {
    // fail-closed: ถ้าเช็คสิทธิ์ไม่สำเร็จ (env หาย / Supabase ล่ม) ห้ามปล่อยผ่านเข้า /admin
    console.error("admin middleware auth check failed:", e);
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("error", "auth_unavailable");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
