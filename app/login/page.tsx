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

      {/* Logo + Header — centered */}
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

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-zinc-100"></div>
          <span className="text-[10px] text-zinc-400">หรือ</span>
          <div className="flex-1 h-px bg-zinc-100"></div>
        </div>

        <p className="text-center text-[12px] text-zinc-500">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="font-semibold text-zinc-900 underline underline-offset-2">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}
