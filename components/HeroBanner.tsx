"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Banner } from "@/lib/banners";

interface HeroBannerProps {
  banners: Banner[];
  intervalMs?: number;
}

export default function HeroBanner({ banners, intervalMs = 3000 }: HeroBannerProps) {
  const active = banners.filter((b) => b.active).sort((a, b) => a.order - b.order);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % active.length);
  }, [active.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + active.length) % active.length);
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
      style={{ background: banner.bgColor, minHeight: 200 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background image */}
      {banner.imageUrl && (
        <div className="absolute inset-0">
          <Image
            src={banner.imageUrl}
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Watermark logo */}
      <div className="absolute top-0 right-0 w-40 h-full flex items-center justify-center overflow-hidden pointer-events-none opacity-5">
        <Image src="/images/logo-square.jpg" alt="" width={160} height={160} className="invert" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 pt-8 pb-6">
        <p className="text-[9px] tracking-[0.2em] text-zinc-400 mb-2 font-semibold">{banner.badge}</p>
        <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">
          {titleLines.map((line, i) => <span key={i}>{line}{i < titleLines.length - 1 && <br />}</span>)}
        </h1>
        {banner.subtitle && (
          <p className="text-xs text-zinc-400 mt-2">{banner.subtitle}</p>
        )}
        <div className="flex gap-2 mt-4">
          <Link href={banner.ctaHref}
            className="text-[11px] bg-white text-zinc-900 font-semibold px-4 py-2 rounded-xl active:opacity-70">
            {banner.ctaLabel}
          </Link>
          {banner.ctaSecondaryLabel && banner.ctaSecondaryHref && (
            <Link href={banner.ctaSecondaryHref}
              className="text-[11px] border border-zinc-700 text-zinc-300 px-4 py-2 rounded-xl active:opacity-70">
              {banner.ctaSecondaryLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Dots + arrows */}
      {active.length > 1 && (
        <div className="relative z-10 flex items-center justify-between px-5 pb-4">
          {/* Prev */}
          <button onClick={prev} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {active.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`transition-all rounded-full ${i === current ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-400"}`}
              />
            ))}
          </div>

          {/* Next */}
          <button onClick={next} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l4 5-4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Progress bar */}
      {active.length > 1 && !paused && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800">
          <div
            key={`${current}-${banner.id}`}
            className="h-full bg-white"
            style={{
              animation: `progress ${intervalMs}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes progress {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </section>
  );
}
