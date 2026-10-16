"use client";
import { useRef, type ReactNode } from "react";

// การ์ดเอียงตามเมาส์ + แสงโฮโลวิ่ง (แรงบันดาลใจ: 3D Card / Glare Card บน 21st.dev — เขียนใหม่ด้วย CSS ล้วน ไม่มี lib เพิ่ม)
// มือถือ/จอสัมผัส: ไม่เอียง มีแค่แสงวิ่งตอนแตะ · ผู้ที่ตั้งลดการเคลื่อนไหว: นิ่ง
export default function GlareCard({ children, className = "", max = 10 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - py) * max}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * max}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.style.setProperty("--go", "1");
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--go", "0");
  }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`fx-glare ${className}`}>
      {children}
      <span className="fx-glare-shine" aria-hidden="true" />
    </div>
  );
}
