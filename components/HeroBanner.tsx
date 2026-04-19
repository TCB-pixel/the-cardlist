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
      style={{
        background: banner.bgColor || "#0a0a0a",
        minHeight: 220,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Full background image (artwork) ── */}
      {banner.imageUrl && (
        <div className="absolute inset-0">
          <Image
            src={banner.imageUrl}
            alt=""
            fill
            className="object-cover object-right"
            priority
          />
          {/* Left-to-right dark gradient — ข้อความซ้ายอ่านง่าย, artwork ขวาโชว์ */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 40%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0) 100%)",
            }}
          />
          {/* Bottom fade */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
            }}
          />
        </div>
      )}

      {/* ── Diagonal accent line ── */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: "52%",
          width: 2,
          background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)",
          transform: "skewX(-8deg)",
        }}
      />

      {/* ── Noise texture overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── Content ── */}
      <div
        key={animKey}
        className="relative z-10 px-5 pt-7 pb-5"
        style={{ animation: "fadeSlideIn 0.4s ease forwards" }}
      >
        {/* Badge */}
        {banner.badge && (
          <div className="inline-flex items-center gap-1.5 mb-3">
            <span className="w-1 h-1 rounded-full bg-white opacity-60" />
            <p className="text-[9px] tracking-[0.25em] text-zinc-400 font-bold uppercase">{banner.badge}</p>
          </div>
        )}

        {/* Title */}
        <h1
          className="font-bold text-white leading-tight tracking-tight mb-2"
          style={{ fontSize: "clamp(1.25rem, 5vw, 1.75rem)", textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
        >
          {titleLines.map((line, i) => (
            <span key={i}>
              {line}
              {i < titleLines.length - 1 && <br />}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        {banner.subtitle && (
          <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed max-w-[60%]">
            {banner.subtitle}
          </p>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-2">
          <Link
            href={banner.ctaHref}
            className="inline-flex items-center gap-1.5 text-[11px] bg-white text-zinc-900 font-bold px-4 py-2 rounded-xl active:opacity-70 transition-opacity"
          >
            {banner.ctaLabel}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          {banner.ctaSecondaryLabel && banner.ctaSecondaryHref && (
            <Link
              href={banner.ctaSecondaryHref}
              className="text-[11px] border border-zinc-600 text-zinc-300 px-4 py-2 rounded-xl active:opacity-70 transition-opacity backdrop-blur-sm"
            >
              {banner.ctaSecondaryLabel}
            </Link>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      {active.length > 1 && (
        <div className="relative z-10 flex items-center justify-between px-5 pb-4 mt-1">
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
                className={`transition-all rounded-full ${
                  i === current ? "w-6 h-1 bg-white" : "w-1 h-1 bg-zinc-600 hover:bg-zinc-400"
                }`}
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
            className="h-full bg-white/60"
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
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </section>
  );
}
