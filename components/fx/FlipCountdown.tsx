"use client";
import { useEffect, useState } from "react";
import BrandText from "@/components/BrandText";

// นับถอยหลังแบบป้ายพลิก (แรงบันดาลใจ: Flip Countdown บน 21st.dev) — วัน / ชม. / นาที / วินาที
function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function Unit({ value, label }: { value: number; label: string }) {
  const v = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {v.split("").map((c, i) => (
          // key เปลี่ยนตามตัวเลข → เล่นแอนิเมชันพลิกเฉพาะหลักที่เปลี่ยน
          <span key={`${i}-${c}`} className="fx-flip">{c}</span>
        ))}
      </div>
      <span className="text-[10px] tracking-widest text-zinc-500">{label}</span>
    </div>
  );
}

export default function FlipCountdown({ to, title, sub, href }: { to: string; title: string; sub?: string; href?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now !== null && target - now <= 0) return null;
  const p = parts(now === null ? 0 : target - now);
  const body = (
    <div className="card px-4 py-4">
      <p className="text-[10px] font-semibold tracking-widest text-zinc-500">นับถอยหลังสู่งาน</p>
      <p className="text-sm font-semibold text-zinc-900 mt-0.5 leading-snug"><BrandText text={title} /></p>
      {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
      <div className="flex items-start justify-between mt-3" aria-live="off">
        <Unit value={p.d} label="วัน" />
        <span className="fx-flip-colon">:</span>
        <Unit value={p.h} label="ชม." />
        <span className="fx-flip-colon">:</span>
        <Unit value={p.m} label="นาที" />
        <span className="fx-flip-colon">:</span>
        <Unit value={p.s} label="วินาที" />
      </div>
    </div>
  );
  return href ? <a href={href} className="block active:opacity-90">{body}</a> : body;
}
