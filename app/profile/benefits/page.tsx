"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/i18n";

const TIERS = [
  {
    key: "bronze",
    label: "Bronze",
    color: "#CD7F32",
    bg: "bg-amber-50",
    spend: "฿0 – ฿4,999",
    benefits: [
      "สิทธิ์สั่งซื้อสินค้าทั้งหมด",
      "ติดตามสถานะออเดอร์",
      "จองอีเวนต์ในร้าน",
      "รับ Points ทุกการสั่งซื้อ",
    ],
    benefitsEn: [
      "Shop all products",
      "Track your orders",
      "Book in-store events",
      "Earn Points on every order",
    ],
  },
  {
    key: "silver",
    label: "Silver",
    color: "#A8A9AD",
    bg: "bg-zinc-50",
    spend: "฿5,000 – ฿14,999",
    benefits: [
      "ทุกสิทธิ์ Bronze",
      "ส่วนลด 3% ทุกออเดอร์",
      "Early Access สินค้า Pre-Order",
      "Priority Booking อีเวนต์",
    ],
    benefitsEn: [
      "All Bronze benefits",
      "3% off every order",
      "Early Access to Pre-Orders",
      "Priority event booking",
    ],
  },
  {
    key: "gold",
    label: "Gold",
    color: "#EF9F27",
    bg: "bg-yellow-50",
    spend: "฿150,000 – ฿299,999",
    benefits: [
      "ทุกสิทธิ์ Silver",
      "ส่วนลด 5% ทุกออเดอร์",
      "ฟรีค่าจัดส่งทุกออเดอร์",
      "Exclusive Gold Member Events",
      "ของแถมพิเศษทุกเดือน",
    ],
    benefitsEn: [
      "All Silver benefits",
      "5% off every order",
      "Free shipping on every order",
      "Exclusive Gold Member Events",
      "Special monthly gifts",
    ],
  },
  {
    key: "platinum",
    label: "Platinum",
    color: "#7F77DD",
    bg: "bg-purple-50",
    spend: "฿300,000 ขึ้นไป",
    spendEn: "฿300,000+",
    benefits: [
      "ทุกสิทธิ์ Gold",
      "ส่วนลด 8% ทุกออเดอร์",
      "Personal Shopper Service",
      "VIP Events & Private Sales",
      "Card Grading Service ฟรี 1 ใบ/เดือน",
      "ของแถม Limited Edition",
    ],
    benefitsEn: [
      "All Gold benefits",
      "8% off every order",
      "Personal Shopper Service",
      "VIP Events & Private Sales",
      "1 free Card Grading per month",
      "Limited Edition gifts",
    ],
  },
];

export default function BenefitsPage() {
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const { L, lang } = useLang();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", session.user.id)
        .single();
      if (data) setCurrentTier(data.tier);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center gap-3 px-4 h-12">
          <Link href="/profile" className="text-zinc-500 active:text-zinc-700">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <span className="text-sm font-semibold text-zinc-900">{L("สิทธิประโยชน์สมาชิก", "Member benefits")}</span>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
          </div>
        </div>
      </header>

      <div className="px-4 py-5 space-y-4">
        {/* Intro */}
        <div className="card px-5 py-4 text-center">
          <p className="text-xs font-semibold text-zinc-900 mb-1"><span className="font-cardlist font-normal tracking-wide">The Cardlist</span> Membership</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {L("ยิ่งซื้อมาก ยิ่งได้รับสิทธิ์มากขึ้น", "The more you shop, the more you get")}<br/>{L("ยอดสะสมรายปีจะถูกนับใหม่ทุกวันที่ 1 มกราคม", "Annual spend resets every 1 January")}
          </p>
        </div>

        {/* Tier Cards */}
        {TIERS.map((tier) => {
          const isActive = currentTier === tier.key;
          return (
            <div
              key={tier.key}
              className={`card overflow-hidden ${isActive ? "ring-2" : ""}`}
              style={isActive ? { boxShadow: `0 0 0 2px ${tier.color}` } : {}}
            >
              {/* Tier Header */}
              <div className={`px-5 py-3.5 flex items-center justify-between ${tier.bg}`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: tier.color }} />
                  <span className="text-sm font-bold" style={{ color: tier.color }}>
                    {tier.label.toUpperCase()}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: tier.color }}>
                      {L("ระดับปัจจุบัน", "Current tier")}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500">{lang === "en" && tier.spendEn ? tier.spendEn : tier.spend}</span>
              </div>

              {/* Benefits List */}
              <div className="px-5 py-4 space-y-2.5">
                {(lang === "en" ? tier.benefitsEn : tier.benefits).map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0">
                      <circle cx="7" cy="7" r="6" fill={tier.color} fillOpacity="0.15"/>
                      <path d="M4.5 7l2 2 3-3" stroke={tier.color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-xs text-zinc-700">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Points info */}
        <div className="card px-5 py-4">
          <p className="text-xs font-semibold text-zinc-900 mb-3">{L("การสะสม Points", "Earning Points")}</p>
          <div className="space-y-2">
            {[
              { label: L("ทุกการสั่งซื้อ", "Every order"),      value: "฿100 = 1 Point" },
              { label: L("รีวิวสินค้า", "Product review"),          value: "+5 Points" },
              { label: L("จองและเข้าร่วม Event", "Book & attend an event"), value: "+10 Points" },
              { label: L("แนะนำเพื่อน", "Refer a friend"),          value: "+50 Points" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0">
                <span className="text-[11px] text-zinc-500">{r.label}</span>
                <span className="text-[11px] font-semibold text-zinc-900">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
