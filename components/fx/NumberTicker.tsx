"use client";
import { useEffect, useRef, useState } from "react";

// ตัวเลขวิ่งขึ้นเมื่อเลื่อนมาเห็น (แรงบันดาลใจ: Number Ticker บน 21st.dev)
export function NumberTicker({ value, suffix = "", duration = 1400 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(value); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / duration);
        setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);
  return <span ref={ref} className="tabular-nums">{n.toLocaleString("en-US")}{suffix}</span>;
}

export default function StatsStrip({ items }: { items: { value: number; suffix?: string; label: string }[] }) {
  return (
    <section className="px-4 mt-3 mb-1">
      <div className="card grid grid-cols-3 divide-x divide-zinc-100 py-3">
        {items.map((it) => (
          <div key={it.label} className="text-center px-1">
            <p className="text-lg font-bold text-zinc-900 leading-none"><NumberTicker value={it.value} suffix={it.suffix} /></p>
            <p className="text-[10px] text-zinc-500 mt-1">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
