"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

/**
 * ชวนสมาชิกติดตามเพจ Facebook
 * - ซ่อนตัวเองถ้าแอดมินยังไม่ได้ตั้งค่า URL เพจใน /admin/settings
 * - บันทึกว่า "กดลิงก์แล้ว" เท่านั้น — Facebook ไม่เปิดให้ตรวจสอบว่าไลค์จริงไหม
 */
export default function FacebookFollowCard({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [clicked, setClicked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: setting }, { data: { session } }] = await Promise.all([
        supabase.from("site_settings").select("value").eq("key", "facebook_page_url").maybeSingle(),
        supabase.auth.getSession(),
      ]);

      const pageUrl = setting?.value?.trim();
      if (pageUrl) setUrl(pageUrl);

      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles").select("fb_clicked_at").eq("id", session.user.id).maybeSingle();
        if (profile?.fb_clicked_at) setClicked(true);
      }
      setReady(true);
    }
    load();
  }, []);

  async function handleClick() {
    setClicked(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/social/fb-click", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch {
      // บันทึกไม่สำเร็จไม่ควรขวางไม่ให้ลูกค้าไปที่เพจ
    }
  }

  // ยังไม่ตั้งค่า URL เพจ = ไม่ต้องแสดงอะไรเลย
  if (!ready || !url) return null;

  if (compact) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={handleClick}
        className="flex items-center gap-2 text-[11px] text-[#1877F2] font-semibold">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>
        </svg>
        ติดตามเพจ The Cardlist
      </a>
    );
  }

  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center flex-shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-zinc-900">ติดตามเพจ The Cardlist</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            {clicked ? "ขอบคุณที่ติดตามนะครับ 🙌" : "อัปเดตอีเวนต์ การ์ดใหม่ และโปรโมชั่นก่อนใคร"}
          </p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={handleClick}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 ${
            clicked ? "border border-zinc-200 text-zinc-500" : "bg-[#1877F2] text-white"
          }`}>
          {clicked ? "เปิดเพจ" : "กดไลค์เพจ"}
        </a>
      </div>
    </div>
  );
}
