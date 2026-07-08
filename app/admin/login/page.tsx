"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Suspense } from "react";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/admin";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (errorParam === "unauthorized") {
      setError("บัญชีนี้ไม่มีสิทธิ์เข้าถึง Admin Panel");
    }
  }, [errorParam]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

      if (err) {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }

      // สิทธิ์แอดมินตรวจจากฐานข้อมูล (admin_users / admin_staff) ใน middleware
      // ถ้าไม่มีสิทธิ์ middleware จะเด้งกลับมาที่ /admin/login?error=unauthorized
      void data;
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* Logo + Title */}
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/images/logo-square.jpg"
            alt="The Cardlist"
            width={72}
            height={72}
            className="invert mb-5 rounded-xl"
          />
          <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 uppercase mb-1">Admin Panel</p>
          <h1 className="text-xl font-bold text-white">เข้าสู่ระบบ Admin</h1>
          <p className="text-xs text-zinc-500 mt-1.5">เฉพาะผู้ที่ได้รับสิทธิ์เท่านั้น</p>
        </div>

        {/* Form card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5 tracking-wide">อีเมล</label>
              <input
                type="email"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
                placeholder="admin@thecardlist.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5 tracking-wide">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-14 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300">
                  {showPw ? "ซ่อน" : "แสดง"}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-900 rounded-xl px-4 py-3">
                <p className="text-[11px] text-red-400 whitespace-pre-line">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-white text-zinc-900 text-sm font-bold py-3 rounded-xl transition-opacity ${loading ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 active:opacity-80"}`}>
              {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>

        {/* Warning */}
        <div className="mt-4 flex items-start gap-2 px-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5">
            <path d="M7 1L13 12H1L7 1Z" stroke="#52525b" strokeWidth="1" fill="none" strokeLinejoin="round"/>
            <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="#52525b" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="7" cy="10" r="0.6" fill="#52525b"/>
          </svg>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            หน้านี้สำหรับผู้ดูแลระบบเท่านั้น การพยายามเข้าถึงโดยไม่ได้รับอนุญาตจะถูกบันทึกไว้
          </p>
        </div>

        {/* Back to site */}
        <div className="text-center mt-5">
          <a href="/" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            ← กลับไปหน้าเว็บหลัก
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
