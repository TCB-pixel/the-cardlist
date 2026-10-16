"use client";
import { useEffect, useState } from "react";

// แถบโลโก้ร้านค้าที่มาออกบูธ เลื่อนวน ขอบจาง (แรงบันดาลใจ: Logo Marquee / Progressive Blur บน 21st.dev)
// ดึงจาก /api/booth/event (ร้านที่ชำระแล้ว/ทีมงานจองให้ — ชื่อร้าน + โลโก้ ข้อมูลสาธารณะอยู่แล้วบนผัง)
type Logo = { name: string; url: string };

export default function LogoMarquee() {
  const [logos, setLogos] = useState<Logo[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const list = await (await fetch("/api/booth/event")).json();
        const seen = new Map<string, Logo>();
        for (const e of list.events ?? []) {
          const j = await (await fetch(`/api/booth/event?id=${e.id}`)).json();
          for (const days of Object.values<any>(j.vendors ?? {})) {
            for (const v of Object.values<any>(days)) {
              if (v?.logo && v?.shop && !seen.has(v.logo)) seen.set(v.logo, { name: v.shop, url: v.logo });
            }
          }
        }
        setLogos(Array.from(seen.values()));
      } catch { /* ไม่มีโลโก้ก็ไม่แสดง */ }
    })();
  }, []);
  if (logos.length < 3) return null;
  const row = [...logos, ...logos];
  return (
    <section className="mb-4">
      <h2 className="text-xs font-semibold text-zinc-900 tracking-wide px-4 mb-2">ร้านค้าที่มาออกบูธ</h2>
      <div className="fx-marquee" role="list" aria-label="ร้านค้าที่มาออกบูธ">
        <div className="fx-marquee-track" style={{ animationDuration: `${Math.max(18, logos.length * 3.5)}s` }}>
          {row.map((l, i) => (
            <div key={i} role="listitem" aria-hidden={i >= logos.length} className="fx-marquee-item" title={l.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.url} alt={i < logos.length ? l.name : ""} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
