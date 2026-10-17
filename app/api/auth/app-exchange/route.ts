import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { openAppCode } from "@/lib/app-login";
import { safeNext } from "@/lib/auth-next";

// แอปมือถือส่งรหัสใช้ครั้งเดียว + verifier มาแลกเป็น session (ตั้งคุกกี้ Supabase ใน WebView ของแอป)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const verifier = typeof body?.verifier === "string" ? body.verifier : "";
  const opened = code && verifier ? openAppCode(code, verifier) : null;
  if (!opened) return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });

  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return store.getAll(); }, setAll(list) { list.forEach(({ name, value, options }) => store.set(name, value, options)); } } },
  );
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: opened.refreshToken });
  if (error || !data.session) return NextResponse.json({ ok: false, error: "session_failed" }, { status: 400 });

  // ปลายทางเป็นได้ทั้งหน้าปกติ และหน้ากรอกข้อมูลโปรไฟล์ (/profile/complete?next=…) — รับเฉพาะเส้นทางภายในเว็บ
  return NextResponse.json({ ok: true, dest: safeNext(opened.dest) ?? "/profile" });
}
