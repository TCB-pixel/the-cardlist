"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { safeNext } from "@/lib/auth-next";
import { useLang } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";
import { authError } from "@/app/login/auth-text";
import { goLineLogin } from "@/lib/native";

const LINE_PATH =
  "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314";

// ชื่อผู้ใช้ภายในระบบ: สร้างให้เองจากอีเมล + เลขสุ่ม ไม่ต้องให้ลูกค้าคิดเอง
function autoUsername(email: string) {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) || "member";
  return `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const { L, lang } = useLang();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => { setNext(safeNext(new URLSearchParams(window.location.search).get("next"))); }, []);

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError(L("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "Password must be at least 8 characters.")); return; }
    // เก็บเป็นตัวเลขล้วน ให้พนักงานค้นด้วยเบอร์หน้าร้านเจอแน่นอน
    const phoneDigits = phone.replace(/\D/g, "");
    if (!/^0\d{8,9}$/.test(phoneDigits)) {
      setError(L("กรอกเบอร์โทรเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0", "Enter a 9-10 digit phone number starting with 0."));
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username: autoUsername(email), display_name: displayName.trim(), phone: phoneDigits },
          // กดลิงก์ยืนยันในอีเมลแล้วกลับมาหน้าที่ทำค้างไว้ได้เลย
          emailRedirectTo: `${window.location.origin}${next ?? "/profile"}`,
        },
      });
      if (err) { setError(authError(err.message, lang)); return; }
      // ระบบสมาชิกไม่แจ้ง error ถ้าอีเมลซ้ำ (กันเดาสมาชิก) แต่จะไม่มี identities กลับมา
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError(L("อีเมลนี้สมัครสมาชิกไว้แล้ว ลองเข้าสู่ระบบ หรือกด \"ลืมรหัสผ่าน\"", "This email is already registered. Try logging in, or tap \"Forgot password?\""));
        return;
      }
      // ปิดการยืนยันอีเมลไว้ → สมัครเสร็จได้ session ทันที พาไปใช้งานต่อได้เลย
      // (ถ้าเปิดยืนยันอีเมลอีกครั้ง จะไม่มี session และแสดงหน้าแจ้งให้ไปกดลิงก์ในอีเมล)
      if (data.session) {
        router.replace(next ?? "/profile");
        return;
      }
      setDone(true);
    } catch {
      setError(L("เกิดข้อผิดพลาด กรุณาลองใหม่", "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setNotice(""); setError("");
    const { error: err } = await createClient().auth.resend({ type: "signup", email: email.trim() });
    if (err) setError(authError(err.message, lang));
    else setNotice(L("ส่งอีเมลยืนยันให้อีกครั้งแล้ว", "Confirmation email sent again."));
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="absolute top-3 right-4"><LangToggle /></div>
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 14l6 6L22 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">{L("สมัครสมาชิกสำเร็จ!", "You're signed up!")}</h2>
        <p className="text-sm text-zinc-500 mb-1">{L("เราส่งลิงก์ยืนยันไปที่", "We sent a confirmation link to")}</p>
        <p className="text-sm font-semibold text-zinc-900 mb-6">{email}</p>
        <p className="text-xs text-zinc-500 mb-4 max-w-xs">{L("กดลิงก์ในอีเมลเพื่อยืนยัน (ถ้าไม่เจอ ลองดูในจดหมายขยะ) จากนั้นเข้าสู่ระบบได้เลย", "Tap the link in the email to confirm (check your spam folder if you can't find it), then log in.")}</p>
        {notice && <p className="text-xs text-green-600 mb-3">{notice}</p>}
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <Link href={loginHref} className="btn-primary py-3 px-8">{L("ไปหน้าเข้าสู่ระบบ", "Go to log in")}</Link>
        <button onClick={resend} className="text-xs text-zinc-500 underline underline-offset-2 mt-4">{L("ยังไม่ได้รับอีเมล? ส่งอีกครั้ง", "Didn't get the email? Resend")}</button>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight leading-snug">{L("สมัครสมาชิก", "Sign up")}</h1>
        <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{L("ยินดีต้อนรับทุกคนสู่", "Welcome to")}<br />The Cardlist Community</p>
      </div>

      <div className="px-6 pb-10">
        <button
          onClick={() => goLineLogin(next)}
          className="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all mb-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d={LINE_PATH} /></svg>
          {L("สมัครสมาชิกด้วย LINE", "Sign up with LINE")}
        </button>
        <p className="text-[11px] text-zinc-500 text-center mb-6">{L("เร็วที่สุด ไม่ต้องจำรหัสผ่าน ไม่ต้องยืนยันอีเมล", "Fastest way. No password to remember, no email to confirm.")}</p>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-zinc-100"></div>
          <span className="text-[11px] text-zinc-500">{L("หรือสมัครด้วยอีเมล", "or sign up with email")}</span>
          <div className="flex-1 h-px bg-zinc-100"></div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("อีเมล", "Email")} <span className="text-red-400">*</span>
            </label>
            <input id="email" type="email" className="input" placeholder="your@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div>
            <label htmlFor="name" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("ชื่อของคุณ", "Your name")} <span className="text-red-400">*</span>
            </label>
            <input id="name" type="text" className="input" placeholder={L("ชื่อ หรือชื่อเล่น", "Name or nickname")}
              value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="name" />
          </div>

          <div>
            <label htmlFor="phone" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("เบอร์โทรศัพท์", "Phone number")} <span className="text-red-400">*</span>
            </label>
            <input id="phone" type="tel" inputMode="numeric" className="input" placeholder="08x-xxx-xxxx"
              value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} required autoComplete="tel" />
            <p className="text-[11px] text-zinc-500 mt-1">{L("ใช้ยืนยันตัวตนตอนรับสิทธิ์และสะสมรอบเล่นหน้าร้าน", "Used to verify you when claiming rewards and tracking in-store play")}</p>
          </div>

          <div>
            <label htmlFor="pw" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("รหัสผ่าน", "Password")} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input id="pw" type={showPw ? "text" : "password"} className="input pr-14"
                placeholder={L("อย่างน้อย 8 ตัวอักษร", "At least 8 characters")}
                value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700">
                {showPw ? L("ซ่อน", "Hide") : L("แสดง", "Show")}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3" role="alert">
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className={`btn-primary w-full py-3.5 text-sm mt-2 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {loading ? L("กำลังสมัคร...", "Signing up...") : L("สมัครสมาชิก", "Sign up")}
          </button>

          <p className="text-center text-[11px] text-zinc-500">
            {L("มีบัญชีแล้ว?", "Already have an account?")}{" "}
            <Link href={loginHref} className="font-semibold text-zinc-900 underline underline-offset-2">{L("เข้าสู่ระบบ", "Log in")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
