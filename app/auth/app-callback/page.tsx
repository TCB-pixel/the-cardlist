"use client";
import { useEffect, useRef } from "react";
import { takeLoginVerifier } from "@/lib/native";

// แอปมือถือเปิดหน้านี้หลังเด้งกลับจากล็อกอิน LINE — แลกรหัสเป็น session แล้วไปหน้าปลายทาง
export default function AppCallbackPage() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(window.location.search).get("code") ?? "";
    const verifier = takeLoginVerifier();
    (async () => {
      try {
        const res = await fetch("/api/auth/app-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, verifier }),
        });
        const j = await res.json();
        window.location.replace(res.ok && j.ok ? j.dest : "/login?error=signin_failed");
      } catch {
        window.location.replace("/login?error=signin_failed");
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-zinc-600">
      กำลังเข้าสู่ระบบ…
    </main>
  );
}
