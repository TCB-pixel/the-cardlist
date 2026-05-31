"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); return; }
      router.push("/profile");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  function handleLineLogin() {
    setLineLoading(true);
    window.location.href = "/api/auth/line";
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back button */}
      <div className="px-4 pt-4">
        <Link href="/" className="text-zinc-400 inline-flex items-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>

      {/* Logo + Header */}
      <div className="flex flex-col items-center text-center px-6 pt-8 pb-8">
        <Image
          src="/images/logo-square.jpg"
          alt="The Cardlist"
          width={96}
          height={96}
          className="mb-5 object-contain"
        />
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight leading-snug">เข้าสู่ระบบ</h1>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          ยินดีต้อนรับทุกคนสู่<br/>The Cardlist Community
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-10">

        {/* LINE Login Button */}
        <button
          onClick={handleLineLogin}
          disabled={lineLoading}
          className="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {lineLoading ? (
            <span>กำลังเชื่อมต่อ LINE...</span>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              เข้าสู่ระบบด้วย LINE
            </>
          )}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-zinc-100"></div>
          <span className="text-[10px] text-zinc-400">หรือเข้าสู่ระบบด้วยอีเมล</span>
          <div className="flex-1 h-px bg-zinc-100"></div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">อีเมล</label>
            <input
              type="email"
              className="input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">รหัสผ่าน</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="input pr-14"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700">
                {showPw ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="text-[11px] text-zinc-400 hover:text-zinc-600">ลืมรหัสผ่าน?</button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`btn-primary w-full py-3.5 text-sm mt-2 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="text-center text-[12px] text-zinc-500 mt-6">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="font-semibold text-zinc-900 underline underline-offset-2">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}
