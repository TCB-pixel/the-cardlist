"use client";
import { useLang } from "@/lib/i18n";

// หน้ารอโหลด: โลโก้ C เด้งเข้ามา (pop) แล้วหายใจเบา ๆ มีวงแหวน 3 สีแบรนด์หมุนรอบ
// แสดงหลังรอเกิน 0.15 วินาที (หน้าที่โหลดเร็วจะไม่กะพริบ) · ผู้ใช้ที่ตั้งลดการเคลื่อนไหวจะเห็นโลโก้นิ่ง
export default function LogoLoader({ label }: { label?: string }) {
  const { L } = useLang();
  return (
    <div className="cl-loader" role="status" aria-live="polite">
      <div className="cl-loader-mark">
        <svg className="cl-loader-ring" width="112" height="112" viewBox="0 0 168 168" aria-hidden="true">
          <circle cx="84" cy="84" r="76" fill="none" stroke="#F4F4F5" strokeWidth="7" />
          <circle cx="84" cy="84" r="76" fill="none" stroke="#E24B4A" strokeWidth="7" strokeLinecap="round" strokeDasharray="130 348" />
          <circle cx="84" cy="84" r="76" fill="none" stroke="#F5B301" strokeWidth="7" strokeLinecap="round" strokeDasharray="130 348" strokeDashoffset="-159" />
          <circle cx="84" cy="84" r="76" fill="none" stroke="#1F5AA6" strokeWidth="7" strokeLinecap="round" strokeDasharray="130 348" strokeDashoffset="-318" />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cl-loader-logo" src="/images/cardlist-logo.png" alt="" width={46} height={61} />
      </div>
      <p className="cl-loader-text">{label ?? L("กำลังโหลด", "Loading")}<span>.</span><span>.</span><span>.</span></p>
    </div>
  );
}
