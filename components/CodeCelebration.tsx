"use client";
import { useEffect } from "react";
import { useLang } from "@/lib/i18n";

// ฉากฉลองเต็มจอเมื่อใช้โค้ดพิเศษสำเร็จ — ข้อความมาจากเซิร์ฟเวอร์ (ชื่อโค้ดไม่ฝังอยู่ในหน้าเว็บ)
// แตะที่ไหนก็ได้เพื่อปิด · ปิดเองหลัง 4.2 วินาที · ผู้ที่ตั้งค่าลดการเคลื่อนไหวจะเห็นแบบนิ่ง
export default function CodeCelebration({ text, sub, onDone }: { text: string; sub?: string; onDone: () => void }) {
  const { L } = useLang();
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); window.removeEventListener("keydown", k); };
  }, [onDone]);

  const sparks = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const d = 140 + (i % 4) * 46;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, delay: (i % 7) * 0.04, c: ["#F5B301", "#E24B4A", "#F1DCA2", "#1F5AA6"][i % 4] };
  });

  return (
    <div role="alertdialog" aria-live="assertive" aria-label={text} onClick={onDone}
      className="cc-root fixed inset-0 z-[100] flex items-center justify-center overflow-hidden cursor-pointer select-none">
      <style>{`
        .cc-root { background: radial-gradient(circle at 50% 50%, rgba(40,20,8,.86), rgba(0,0,0,.94)); animation: cc-bg 4.2s ease forwards; }
        @keyframes cc-bg { 0% { opacity: 0 } 6% { opacity: 1 } 88% { opacity: 1 } 100% { opacity: 0 } }
        .cc-flash { position: absolute; inset: 0; background: #FFF4D6; animation: cc-flash .5s ease-out forwards; }
        @keyframes cc-flash { 0% { opacity: .9 } 100% { opacity: 0 } }
        .cc-ring { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px; border-radius: 9999px;
          border: 3px solid #F5B301; box-shadow: 0 0 40px #F5B301; animation: cc-ring 1.1s cubic-bezier(.2,.7,.2,1) forwards; }
        .cc-ring.r2 { border-color: #E24B4A; box-shadow: 0 0 40px #E24B4A; animation-delay: .18s; opacity: 0 }
        @keyframes cc-ring { 0% { transform: scale(.2); opacity: 1 } 100% { transform: scale(22); opacity: 0 } }
        .cc-rays { position: absolute; left: 50%; top: 50%; width: 1400px; height: 1400px; margin: -700px;
          background: repeating-conic-gradient(from 0deg, rgba(245,179,1,.16) 0 6deg, transparent 6deg 18deg);
          animation: cc-spin 9s linear infinite, cc-fadein .6s ease forwards; mask: radial-gradient(circle, #000 0 22%, transparent 60%); }
        @keyframes cc-spin { to { transform: rotate(360deg) } }
        @keyframes cc-fadein { from { opacity: 0 } to { opacity: 1 } }
        .cc-spark { position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; border-radius: 2px; opacity: 0;
          animation: cc-spark 1.2s cubic-bezier(.15,.8,.3,1) forwards; }
        @keyframes cc-spark { 0% { transform: translate(-50%,-50%) scale(.4) rotate(0); opacity: 1 }
          100% { transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(1) rotate(220deg); opacity: 0 } }
        .cc-text { position: relative; text-align: center; padding: 0 24px; }
        .cc-line { display: block; font-weight: 800; line-height: 1.15; letter-spacing: .01em;
          background: linear-gradient(100deg, #FFF4D6 0%, #F5B301 35%, #FFF8E6 50%, #E9A800 65%, #FFF4D6 100%);
          background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 0 18px rgba(245,179,1,.55));
          animation: cc-slam .7s cubic-bezier(.2,1.6,.4,1) both, cc-shine 2.2s linear .7s infinite; }
        .cc-line.l2 { animation-delay: .22s, .92s; }
        @keyframes cc-slam { 0% { transform: scale(2.6); opacity: 0; filter: blur(8px) } 60% { opacity: 1; filter: blur(0) }
          100% { transform: scale(1); opacity: 1 } }
        @keyframes cc-shine { from { background-position: 250% 0 } to { background-position: -250% 0 } }
        .cc-shake { animation: cc-shake .45s ease .55s both; }
        @keyframes cc-shake { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-6px,3px) } 40% { transform: translate(5px,-4px) }
          60% { transform: translate(-4px,-2px) } 80% { transform: translate(3px,2px) } }
        .cc-sub { margin-top: 18px; color: #F1DCA2; font-size: 14px; letter-spacing: .3em; text-transform: uppercase; animation: cc-fadein .6s ease 1s both; }
        .cc-hint { position: absolute; bottom: 28px; left: 0; right: 0; text-align: center; color: rgba(255,255,255,.45); font-size: 12px; animation: cc-fadein .6s ease 1.6s both; }
        @media (prefers-reduced-motion: reduce) {
          .cc-flash, .cc-ring, .cc-spark, .cc-rays { display: none }
          .cc-line, .cc-shake, .cc-sub, .cc-hint { animation: none !important; opacity: 1 }
          .cc-root { animation: none }
        }
      `}</style>
      <div className="cc-rays" />
      <div className="cc-flash" />
      <div className="cc-ring" />
      <div className="cc-ring r2" />
      {sparks.map((s, i) => (
        <span key={i} className="cc-spark" style={{ background: s.c, animationDelay: `${0.1 + s.delay}s`, ["--x" as any]: `${s.x}px`, ["--y" as any]: `${s.y}px` }} />
      ))}
      <div className="cc-text cc-shake">
        {text.split(/\s+และ\s+/).length === 2 ? (
          <>
            <span className="cc-line text-[40px] sm:text-6xl">{text.split(/\s+และ\s+/)[0]}</span>
            <span className="cc-line l2 text-[40px] sm:text-6xl">และ {text.split(/\s+และ\s+/)[1]}</span>
          </>
        ) : (
          <span className="cc-line text-[40px] sm:text-6xl">{text}</span>
        )}
        {sub && <p className="cc-sub">{sub}</p>}
      </div>
      <p className="cc-hint">{L("แตะเพื่อปิด", "Tap to close")}</p>
    </div>
  );
}
