"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth-next";
import { useLang } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";
import { authError, lineError } from "./auth-text";
import { goLineLogin, isNativeApp } from "@/lib/native";

const LINE_PATH =
  "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314";

export default function LoginPage() {
  const router = useRouter();
  const { L, lang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [needConfirm, setNeedConfirm] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  // อ่านพารามิเตอร์จาก URL: หน้าที่จะกลับไป, ข้อผิดพลาดจาก LINE, แจ้งรีเซ็ตรหัสผ่านสำเร็จ
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setNext(safeNext(q.get("next")));
    const e = q.get("error");
    // เก็บเป็นรหัสไว้ก่อน แล้วแปลตอนแสดงผล (ภาษาที่ลูกค้าเลือกโหลดหลัง effect นี้)
    if (e) setError(`@line:${e}`);
    if (q.get("reset") === "1") setNotice("@reset");
  }, []);

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice(""); setNeedConfirm(false);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(authError(err.message, lang));
        if (/not confirmed/i.test(err.message)) setNeedConfirm(true);
        return;
      }
      router.push(next ?? "/profile");
    } catch {
      setError(L("เกิดข้อผิดพลาด กรุณาลองใหม่", "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirm() {
    setError(""); setNotice("");
    const { error: err } = await createClient().auth.resend({ type: "signup", email: email.trim() });
    if (err) setError(authError(err.message, lang));
    else setNotice(L("ส่งอีเมลยืนยันให้อีกครั้งแล้ว กรุณาตรวจกล่องจดหมาย (รวมถึงจดหมายขยะ)", "Confirmation email sent again. Please check your inbox (and spam folder)."));
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    if (!email.trim()) { setError(L("กรอกอีเมลที่ใช้สมัครก่อน", "Enter the email you signed up with first.")); return; }
    setLoading(true);
    try {
      const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) { setError(authError(err.message, lang)); return; }
      // ตอบเหมือนกันไม่ว่าอีเมลมีในระบบหรือไม่ (กันคนเดาว่าใครเป็นสมาชิก)
      setNotice(L("ถ้าอีเมลนี้เป็นสมาชิก เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว ตรวจกล่องจดหมาย (รวมถึงจดหมายขยะ)", "If this email is registered, we've sent a password reset link. Check your inbox (and spam folder)."));
    } catch {
      setError(L("เกิดข้อผิดพลาด กรุณาลองใหม่", "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  function handleLineLogin() {
    setLineLoading(true);
    // ในแอปมือถือ เปิดเบราว์เซอร์ของเครื่อง — ผู้ใช้อาจปิดกลับมาเอง จึงคืนปุ่มให้กดใหม่ได้
    goLineLogin(next).finally(() => { if (isNativeApp()) setLineLoading(false); });
  }

  const shownError = error.startsWith("@line:") ? lineError(error.slice(6), lang) : error;
  const shownNotice = notice === "@reset"
    ? L("ตั้งรหัสผ่านใหม่แล้ว เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย", "Password updated. You can now log in with your new password.")
    : notice;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-4 pt-4 flex items-center justify-between">
        <Link href="/" className="text-zinc-500 inline-flex items-center" aria-label={L("กลับหน้าแรก", "Back to home")}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <LangToggle />
      </div>

      <div className="flex flex-col items-center text-center px-6 pt-8 pb-8">
        <Image src="/images/logo-square.jpg" alt="The Cardlist" width={96} height={96} className="mb-5 object-contain" />
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight leading-snug">
          {mode === "forgot" ? L("ลืมรหัสผ่าน", "Forgot password") : L("เข้าสู่ระบบ", "Log in")}
        </h1>
        <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
          {mode === "forgot" ? L("กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้", "Enter the email you signed up with and we'll send you a reset link") : <>{L("ยินดีต้อนรับทุกคนสู่", "Welcome to")}<br />The Cardlist Community</>}
        </p>
      </div>

      <div className="flex-1 px-6 pb-10">
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4" role="alert">
            <p className="text-[12px] text-red-600">{shownError}</p>
            {needConfirm && (
              <button type="button" onClick={resendConfirm} className="text-[12px] text-red-700 underline mt-1">{L("ส่งอีเมลยืนยันให้อีกครั้ง", "Resend confirmation email")}</button>
            )}
          </div>
        )}
        {notice && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4" role="status">
            <p className="text-[12px] text-green-700">{shownNotice}</p>
          </div>
        )}

        {mode === "login" && (
          <>
            <button
              onClick={handleLineLogin}
              disabled={lineLoading}
              className="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lineLoading ? (
                <span>{L("กำลังเชื่อมต่อ LINE...", "Connecting to LINE...")}</span>
              ) : (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d={LINE_PATH} /></svg>
                  {L("เข้าสู่ระบบด้วย LINE", "Continue with LINE")}
                </>
              )}
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-zinc-100"></div>
              <span className="text-[11px] text-zinc-500">{L("หรือเข้าสู่ระบบด้วยอีเมล", "or log in with email")}</span>
              <div className="flex-1 h-px bg-zinc-100"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">{L("อีเมล", "Email")}</label>
                <input id="email" type="email" className="input" placeholder="your@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>

              <div>
                <label htmlFor="pw" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">{L("รหัสผ่าน", "Password")}</label>
                <div className="relative">
                  <input id="pw" type={showPw ? "text" : "password"} className="input pr-14" placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700">
                    {showPw ? L("ซ่อน", "Hide") : L("แสดง", "Show")}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
                  className="text-[12px] text-zinc-500 hover:text-zinc-800 underline underline-offset-2">{L("ลืมรหัสผ่าน?", "Forgot password?")}</button>
              </div>

              <button type="submit" disabled={loading}
                className={`btn-primary w-full py-3.5 text-sm mt-2 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
                {loading ? L("กำลังเข้าสู่ระบบ...", "Logging in...") : L("เข้าสู่ระบบ", "Log in")}
              </button>
            </form>

            <p className="text-center text-[12px] text-zinc-500 mt-6">
              {L("ยังไม่มีบัญชี?", "Don't have an account?")}{" "}
              <Link href={registerHref} className="font-semibold text-zinc-900 underline underline-offset-2">{L("สมัครสมาชิก", "Sign up")}</Link>
            </p>
          </>
        )}

        {mode === "forgot" && (
          <>
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label htmlFor="femail" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">{L("อีเมลที่ใช้สมัคร", "Email you signed up with")}</label>
                <input id="femail" type="email" className="input" placeholder="your@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <button type="submit" disabled={loading}
                className={`btn-primary w-full py-3.5 text-sm ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
                {loading ? L("กำลังส่ง...", "Sending...") : L("ส่งลิงก์ตั้งรหัสผ่านใหม่", "Send reset link")}
              </button>
            </form>
            <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
              {L("สมัครด้วย LINE? ไม่ต้องใช้รหัสผ่าน กลับไปกด \"เข้าสู่ระบบด้วย LINE\" ได้เลย", "Signed up with LINE? No password needed. Just go back and tap \"Continue with LINE\".")}
            </p>
            <button onClick={() => { setMode("login"); setError(""); setNotice(""); }}
              className="block mx-auto mt-5 text-[12px] text-zinc-500 underline underline-offset-2">{L("← กลับไปเข้าสู่ระบบ", "← Back to log in")}</button>
          </>
        )}
      </div>
    </div>
  );
}
