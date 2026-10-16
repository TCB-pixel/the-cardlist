"use client";
import { useEffect, useRef } from "react";

// คอนเฟตติ 3 สีจากโลโก้ C + ทอง — เล่นครั้งเดียวเมื่อ fire เปลี่ยนค่า
export default function Confetti({ fire, count = 140 }: { fire: number; count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire || !ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current, x = c.getContext("2d");
    if (!x) return;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const cols = ["#dc3228", "#f5c520", "#2f7fd6", "#e9d29a"];
    const P = Array.from({ length: count }, () => ({
      x: c.width / 2, y: c.height * 0.4, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 10 - 3,
      s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[(Math.random() * 4) | 0],
    }));
    let f = 0, raf = 0;
    const loop = () => {
      x.clearRect(0, 0, c.width, c.height);
      for (const p of P) {
        p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
      }
      if (++f < 170) raf = requestAnimationFrame(loop); else x.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fire, count]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden="true" />;
}

export function vibrate(p: number | number[]) {
  try { navigator.vibrate?.(p); } catch {}
}
