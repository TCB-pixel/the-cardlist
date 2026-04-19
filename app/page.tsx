"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import HeroBanner from "@/components/HeroBanner";
import { Banner, DEFAULT_HOME_BANNERS } from "@/lib/banners";
import { createClient } from "@/lib/supabase";

const TCG_GAMES = [
  { key: "onepiece",    label: "One Piece",   color: "#E24B4A" },
  { key: "pokemon",     label: "Pokémon",     color: "#EF9F27" },
  { key: "mtg",         label: "MTG",         color: "#7F77DD" },
  { key: "dragonball",  label: "Dragon Ball", color: "#1D9E75" },
];

const QUICK_LINKS = [
  { href: "/shop?category=preorder", label: "Pre-order", icon: "📦" },
  { href: "/shop?category=single",   label: "Singles",   icon: "🃏" },
  { href: "/events",                 label: "อีเวนต์",   icon: "🏆" },
  { href: "/news",                   label: "ข่าวสาร",   icon: "📰" },
];

const NEWS_PREVIEW = [
  { tag: "TOURNAMENT", title: "Decklist แชมป์ OP Regional Bangkok 2026", date: "16 เม.ย. 2026", slug: "decklist-op-regional-bkk-2026" },
  { tag: "RELEASE",    title: "กำหนดการวางจำหน่าย Q2 2026 ทุกเกม",       date: "10 เม.ย. 2026", slug: "release-schedule-q2-2026" },
];

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_HOME_BANNERS);

  useEffect(() => {
    async function loadBanners() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("banners")
          .select("*")
          .eq("type", "home")
          .eq("active", true)
          .order("order", { ascending: true });

        if (!error && data && data.length > 0) {
          setBanners(data.map((r: any) => ({
            id:                 r.id,
            type:               r.type,
            title:              r.title,
            subtitle:           r.subtitle,
            badge:              r.badge,
            ctaLabel:           r.cta_label,
            ctaHref:            r.cta_href,
            ctaSecondaryLabel:  r.cta_secondary_label ?? "",
            ctaSecondaryHref:   r.cta_secondary_href  ?? "",
            bgColor:            r.bg_color,
            imageUrl:           r.image_url,
            productImageUrl:    r.product_image_url,
            active:             r.active,
            order:              r.order,
          })));
        }
        // ถ้า DB ว่าง → ใช้ DEFAULT_HOME_BANNERS ต่อไป
      } catch {
        // network error → ใช้ default
      }
    }
    loadBanners();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between px-4 h-12">
          <Image src="/images/logo-long.jpg" alt="The Cardlist" width={130} height={42} className="h-7 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <Link href="/login"    className="text-[11px] border border-zinc-200 rounded-xl px-3 py-1.5 text-zinc-700">Log in</Link>
            <Link href="/register" className="btn-primary py-1.5">สมัคร</Link>
          </div>
        </div>
      </header>

      {/* Hero Banner — ดึงจาก Supabase */}
      <HeroBanner banners={banners} intervalMs={4000} />

      {/* Quick links */}
      <section className="px-4 py-4">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href} className="card flex flex-col items-center gap-1 py-3 px-1 active:bg-zinc-50">
              <span className="text-lg">{q.icon}</span>
              <span className="text-[10px] text-zinc-600 font-medium text-center">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* TCG Games */}
      <section className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-900 tracking-wide">เกมที่มีจำหน่าย</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TCG_GAMES.map((g) => (
            <Link key={g.key} href={`/shop?tcg=${g.key}`} className="card px-4 py-3 flex items-center gap-3 active:bg-zinc-50">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
              <span className="text-xs font-medium text-zinc-800">{g.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-900 tracking-wide">อีเวนต์ที่กำลังมา</h2>
          <Link href="/events" className="text-[10px] text-zinc-400">ดูทั้งหมด →</Link>
        </div>
        <div className="space-y-2">
          {[
            { day: "26", month: "APR", title: "OP Regional Bangkok",  loc: "สยามพารากอน Hall A",  slots: 18, max: 128 },
            { day: "03", month: "MAY", title: "Pokémon League Cup",   loc: "The Cardlist Store",   slots: 20, max: 32  },
          ].map((ev, i) => (
            <Link key={i} href="/events" className="card px-4 py-3 flex gap-3 items-start active:bg-zinc-50 block">
              <div className="bg-zinc-900 text-white rounded-xl px-2.5 py-2 text-center min-w-[40px] flex-shrink-0">
                <div className="text-base font-bold leading-none">{ev.day}</div>
                <div className="text-[8px] text-zinc-400 tracking-wider mt-0.5">{ev.month}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-900 truncate">{ev.title}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{ev.loc}</p>
                <div className="mt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-zinc-400">ที่นั่งคงเหลือ {ev.slots} / {ev.max}</span>
                  </div>
                  <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${((ev.max - ev.slots) / ev.max) * 100}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* News */}
      <section className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-900 tracking-wide">ข่าวสารล่าสุด</h2>
          <Link href="/news" className="text-[10px] text-zinc-400">ดูทั้งหมด →</Link>
        </div>
        <div className="space-y-2">
          {NEWS_PREVIEW.map((n) => (
            <Link key={n.slug} href={`/news/${n.slug}`} className="card px-4 py-3 flex gap-3 items-center active:bg-zinc-50 block">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex-shrink-0 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="2" width="14" height="12" rx="2" stroke="#888" strokeWidth="1"/>
                  <line x1="4" y1="6" x2="12" y2="6" stroke="#888" strokeWidth="1" strokeLinecap="round"/>
                  <line x1="4" y1="9" x2="9"  y2="9" stroke="#888" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-semibold tracking-widest text-zinc-400 mb-0.5">{n.tag}</p>
                <p className="text-xs font-medium text-zinc-900 leading-snug line-clamp-2">{n.title}</p>
                <p className="text-[10px] text-zinc-400 mt-1">{n.date}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-300 flex-shrink-0">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
