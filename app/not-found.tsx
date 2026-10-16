"use client";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { useLang } from "@/lib/i18n";

// หน้าไม่พบเพจ — เลข 404 ตัวใหญ่สีแบรนด์ (แรงบันดาลใจ: Oversized 404 Numeral บน 21st.dev)
export default function NotFound() {
  const { L } = useLang();
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 text-center pb-28 overflow-hidden">
      <p className="font-black leading-none tracking-tighter select-none text-[38vw] sm:text-[220px] bg-clip-text text-transparent"
        style={{ backgroundImage: "linear-gradient(135deg, #E24B4A 0%, #F5B301 50%, #1F5AA6 100%)" }} aria-hidden="true">
        404
      </p>
      <h1 className="text-lg font-bold text-zinc-900 -mt-2">{L("การ์ดใบนี้ไม่อยู่ในเด็ค", "This card isn't in the deck")}</h1>
      <p className="text-sm text-zinc-500 mt-1 max-w-xs">{L("ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายไปแล้ว", "The link may be broken, or this page has moved.")}</p>
      <div className="flex gap-2 mt-6">
        <Link href="/" className="btn-primary">{L("กลับหน้าแรก", "Back to home")}</Link>
        <Link href="/shop" className="btn-outline">{L("ไปที่ร้านค้า", "Go to shop")}</Link>
      </div>
      <BottomNav />
    </div>
  );
}
