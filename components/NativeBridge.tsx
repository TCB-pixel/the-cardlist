"use client";
import { useEffect } from "react";
import { goLineLogin, isNativeApp, listenAppLinks } from "@/lib/native";

// ทำงานเฉพาะเมื่อเปิดในแอปมือถือ: รับลิงก์ที่เด้งกลับเข้าแอป + ให้ลิงก์ "เข้าสู่ระบบด้วย LINE" ทุกที่ใช้ล็อกอินแบบแอป
export default function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("native-app");
    const stop = listenAppLinks();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const u = new URL(a.href, window.location.href);
      if (u.origin !== window.location.origin || u.pathname !== "/api/auth/line") return;
      e.preventDefault();
      goLineLogin(u.searchParams.get("next"));
    };
    document.addEventListener("click", onClick, true);
    return () => { stop(); document.removeEventListener("click", onClick, true); };
  }, []);
  return null;
}
