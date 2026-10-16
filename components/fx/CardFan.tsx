"use client";
import { useState } from "react";
import Link from "next/link";

// การ์ดกางเป็นพัด แตะ/ปัดเพื่อเลื่อนใบเด่น (แรงบันดาลใจ: Card Fan Carousel บน 21st.dev)
type Item = { id: string; name: string; price: number; image_url: string | null };

export default function CardFan({ items, href = "/shop" }: { items: Item[]; href?: string }) {
  const [i, setI] = useState(0);
  const [x0, setX0] = useState<number | null>(null);
  const n = items.length;
  if (n === 0) return null;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  return (
    <div className="relative h-60 select-none overflow-hidden"
      onPointerDown={(e) => setX0(e.clientX)}
      onPointerUp={(e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 30) go(e.clientX < x0 ? 1 : -1); setX0(null); }}>
      {items.map((p, k) => {
        let off = k - i;
        if (off > n / 2) off -= n;
        if (off < -n / 2) off += n;
        const hidden = Math.abs(off) > 2;
        return (
          <div key={p.id} className="fx-fan-card"
            style={{
              transform: `translateX(calc(-50% + ${off * 62}px)) rotate(${off * 9}deg) translateY(${Math.abs(off) * 14}px) scale(${off === 0 ? 1 : 0.9})`,
              zIndex: 10 - Math.abs(off), opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : "auto",
            }}
            onClick={() => off !== 0 && setI(k)}>
            {off === 0 ? (
              <Link href={href} className="block h-full" draggable={false}>
                <FanFace p={p} />
              </Link>
            ) : <FanFace p={p} />}
          </div>
        );
      })}
      <button type="button" aria-label="ใบก่อนหน้า" onClick={() => go(-1)} className="fx-fan-btn left-1">‹</button>
      <button type="button" aria-label="ใบถัดไป" onClick={() => go(1)} className="fx-fan-btn right-1">›</button>
    </div>
  );
}

function FanFace({ p }: { p: Item }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 bg-zinc-50 rounded-t-xl overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-2" draggable={false} /> : <span className="text-2xl">🃏</span>}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[10px] text-zinc-700 line-clamp-1">{p.name}</p>
        <p className="text-xs font-bold text-zinc-900">฿{Number(p.price).toLocaleString()}</p>
      </div>
    </div>
  );
}
