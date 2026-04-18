"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPw) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: displayName } },
      });
      if (err) { setError(err.message); return; }
      setDone(true);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 14l6 6L22 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">สมัครสมาชิกสำเร็จ!</h2>
        <p className="text-sm text-zinc-400 mb-1">เราส่งลิงก์ยืนยันไปที่</p>
        <p className="text-sm font-semibold text-zinc-900 mb-6">{email}</p>
        <p className="text-xs text-zinc-400 mb-8">กรุณาตรวจสอบอีเมลและกดยืนยัน จากนั้นกลับมาเข้าสู่ระบบได้เลย</p>
        <Link href="/login" className="btn-primary py-3 px-8">ไปหน้าเข้าสู่ระบบ</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back */}
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
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight leading-snug">สมัครสมาชิก</h1>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          ยินดีต้อนรับทุกคนสู่<br/>The Cardlist Community
        </p>
      </div>

      {/* Form */}
      <div className="px-6 pb-10">
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              อีเมล <span className="text-red-400">*</span>
            </label>
            <input type="email" className="input" placeholder="your@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              ชื่อผู้ใช้ (username) <span className="text-red-400">*</span>
            </label>
            <input type="text" className="input" placeholder="@username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_]/g, ""))}
              required />
            <p className="text-[10px] text-zinc-400 mt-1">ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ เท่านั้น</p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">ชื่อที่แสดง</label>
            <input type="text" className="input" placeholder="ชื่อของคุณ"
              value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              รหัสผ่าน <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} className="input pr-14"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700">
                {showPw ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              ยืนยันรหัสผ่าน <span className="text-red-400">*</span>
            </label>
            <input type="password" className="input" placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
            {confirmPw && password !== confirmPw && (
              <p className="text-[10px] text-red-500 mt-1">รหัสผ่านไม่ตรงกัน</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className={`btn-primary w-full py-3.5 text-sm mt-2 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>

          <p className="text-center text-[11px] text-zinc-400">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="font-semibold text-zinc-900 underline underline-offset-2">
              เข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
