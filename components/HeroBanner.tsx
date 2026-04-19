"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Banner } from "@/lib/banners";

interface HeroBannerProps {
  banners: Banner[];
  intervalMs?: number;
}

export default function HeroBanner({ banners, intervalMs = 4000 }: HeroBannerProps) {
  const active = banners.filter((b) => b.active).sort((a, b) => a.order - b.order);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % active.length);
    setAnimKey((k) => k + 1);
  }, [active.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + active.length) % active.length);
    setAnimKey((k) => k + 1);
  }, [active.length]);

  useEffect(() => {
    if (active.length <= 1 || paused) return;
    const timer = setInterval(next, intervalMs);
    return () => clearInterval(timer);
  }, [active.length, paused, next, intervalMs]);

  if (active.length === 0) return null;

  const banner = active[current];
  const titleLines = banner.title.split("\n");

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: banner.bgColor || "#0a0a0a", minHeight: 220 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Layer 1: Background image (opacity 25% = transparent 75%) ── */}
      {banner.imageUrl && (
        <div className="absolute inset-0">
          <Image
            src={banner.imageUrl}
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)" }} />
        </div>
      )}

      {/* ── Layer 2: Gradient เพิ่มให้อ่านง่าย ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)" }}
      />

      {/* ── Main layout ── */}
      <div className="relative z-10 flex items-center min-h-[220px]">

        {/* LEFT — Text */}
        <div
          key={animKey}
          className="flex-1 px-5 py-7"
          style={{ animation: "fadeSlideIn 0.35s ease forwards" }}
        >
          {banner.badge && (
            <div className="inline-flex items-center gap-1.5 mb-2.5">
              <span className="w-1 h-1 rounded-full bg-white/50" />
              <p className="text-[9px] tracking-[0.25em] text-zinc-400 font-bold uppercase">{banner.badge}</p>
            </div>
          )}

          <h1
            className="font-bold text-white leading-tight tracking-tight mb-2"
            style={{ fontSize: "clamp(1.15rem, 4.5vw, 1.6rem)", textShadow: "0 2px 16px rgba(0,0,0,0.9)" }}
          >
            {titleLines.map((line, i) => (
              <span key={i}>{line}{i < titleLines.length - 1 && <br />}</span>
            ))}
          </h1>

          {banner.subtitle && (
            <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed">{banner.subtitle}</p>
          )}

          <div className="flex gap-2 flex-wrap">
            <Link
              href={banner.ctaHref}
              className="inline-flex items-center gap-1.5 text-[11px] bg-white text-zinc-900 font-bold px-4 py-2 rounded-xl active:opacity-70 transition-opacity"
            >
              {banner.ctaLabel}
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            {banner.ctaSecondaryLabel && banner.ctaSecondaryHref && (
              <Link
                href={banner.ctaSecondaryHref}
                className="text-[11px] border border-zinc-600 text-zinc-300 px-4 py-2 rounded-xl active:opacity-70 transition-opacity"
              >
                {banner.ctaSecondaryLabel}
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT — Product image */}
        {banner.productImageUrl && (
          <div
            key={`img-${animKey}`}
            className="flex-shrink-0 flex items-end justify-center pr-4 pb-2"
            style={{ width: "42%", maxWidth: 180, animation: "fadeSlideUp 0.4s ease forwards" }}
          >
            <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
              <Image
                src={banner.productImageUrl}
                alt={banner.title}
                fill
                className="object-contain object-bottom"
                style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.8))" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      {active.length > 1 && (
        <div className="relative z-10 flex items-center justify-between px-5 pb-3.5">
          <button onClick={prev} className="text-zinc-600 hover:text-white transition-colors p-1">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            {active.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); setAnimKey((k) => k + 1); }}
                className={`transition-all rounded-full ${i === current ? "w-6 h-1 bg-white" : "w-1 h-1 bg-zinc-600 hover:bg-zinc-400"}`}
              />
            ))}
          </div>
          <button onClick={next} className="text-zinc-600 hover:text-white transition-colors p-1">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Progress bar ── */}
      {active.length > 1 && !paused && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-800/60">
          <div
            key={`${current}-${animKey}`}
            className="h-full bg-white/50"
            style={{ animation: `progressBar ${intervalMs}ms linear forwards` }}
          />
        </div>
      )}

      <style>{`
        @keyframes progressBar {
          from { width: 0% }
          to   { width: 100% }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
