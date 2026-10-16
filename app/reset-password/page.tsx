"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";
import { authError } from "@/app/login/auth-text";

// หน้าตั้งรหัสผ่านใหม่ — ลูกค้ามาจากลิงก์ในอีเมล ระบบสมาชิกสร้าง session ชั่วคราวให้อัตโนมัติ
export default function ResetPasswordPage() {
  const router = useRouter();
  const { L, lang } = useLang();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let done = false;
    const ok = () => { if (!done) { done = true; setState("ready"); } };

    // ลิงก์แบบ token_hash (ตั้งในแม่แบบอีเมล): ยืนยันด้วย JavaScript ของหน้านี้ จึงเปิดบนเครื่อง/เบราว์เซอร์ไหนก็ได้
    // (ต่างจากลิงก์แบบ code ที่ต้องเปิดในเบราว์เซอร์เดียวกับที่กดขอรีเซ็ต และโปรแกรมสแกนลิงก์ของอีเมลมักทำให้ลิงก์ถูกใช้ไปก่อน)
    const q = new URLSearchParams(window.location.search);
    const tokenHash = q.get("token_hash");
    if (tokenHash && q.get("type") === "recovery") {
      supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash }).then(({ error }) => {
        if (error) setState("invalid"); else ok();
      });
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) ok();
    });
    // ลิงก์แบบ code จะถูกแลกเป็น session อัตโนมัติ — รอสักครู่แล้วเช็คอีกที
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) ok(); else if (!done) setState("invalid");
    }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) { setError(L("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "Password must be at least 8 characters.")); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password: pw });
      if (err) { setError(authError(err.message, lang)); return; }
      await supabase.auth.signOut();
      router.replace("/login?reset=1");
    } catch {
      setError(L("เกิดข้อผิดพลาด กรุณาลองใหม่", "Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-16">
      <div className="absolute top-3 right-4"><LangToggle /></div>
      <Image src="/images/logo-square.jpg" alt="The Cardlist" width={80} height={80} className="mb-5 object-contain" />
      <h1 className="text-xl font-bold text-zinc-900">{L("ตั้งรหัสผ่านใหม่", "Set a new password")}</h1>

      {state === "checking" && <p className="text-sm text-zinc-500 mt-6">{L("กำลังตรวจสอบลิงก์...", "Checking link...")}</p>}

      {state === "invalid" && (
        <div className="text-center mt-6 max-w-xs">
          <p className="text-sm text-zinc-600">{L("ลิงก์หมดอายุหรือถูกใช้ไปแล้ว", "This link has expired or was already used")}</p>
          <p className="text-xs text-zinc-500 mt-1">{L("กรุณากด \"ลืมรหัสผ่าน\" เพื่อขอลิงก์ใหม่", "Tap \"Forgot password?\" to get a new link")}</p>
          <Link href="/login" className="btn-primary inline-block py-3 px-8 mt-5 text-sm">{L("กลับไปหน้าเข้าสู่ระบบ", "Back to log in")}</Link>
        </div>
      )}

      {state === "ready" && (
        <form onSubmit={submit} className="w-full max-w-sm mt-6 space-y-4">
          <div>
            <label htmlFor="npw" className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">{L("รหัสผ่านใหม่", "New password")}</label>
            <div className="relative">
              <input id="npw" type={showPw ? "text" : "password"} className="input pr-14" placeholder={L("อย่างน้อย 8 ตัวอักษร", "At least 8 characters")}
                value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" />
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
          <button type="submit" disabled={saving} className={`btn-primary w-full py-3.5 text-sm ${saving ? "opacity-50 cursor-not-allowed" : ""}`}>
            {saving ? L("กำลังบันทึก...", "Saving...") : L("บันทึกรหัสผ่านใหม่", "Save new password")}
          </button>
        </form>
      )}
    </div>
  );
}
