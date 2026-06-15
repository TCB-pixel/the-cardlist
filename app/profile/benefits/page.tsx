"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

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
  },
  {
    key: "platinum",
    label: "Platinum",
    color: "#7F77DD",
    bg: "bg-purple-50",
    spend: "฿300,000 ขึ้นไป",
    benefits: [
      "ทุกสิทธิ์ Gold",
      "ส่วนลด 8% ทุกออเดอร์",
      "Personal Shopper Service",
      "VIP Events & Private Sales",
      "Card Grading Service ฟรี 1 ใบ/เดือน",
      "ของแถม Limited Edition",
    ],
  },
];

export default function BenefitsPage() {
  const [currentTier, setCurrentTier] = useState<string | null>(null);

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
          <Link href="/profile" className="text-zinc-400 active:text-zinc-700">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <span className="text-sm font-semibold text-zinc-900">สิทธิประโยชน์สมาชิก</span>
        </div>
      </header>

      <div className="px-4 py-5 space-y-4">
        {/* Intro */}
        <div className="card px-5 py-4 text-center">
          <p className="text-xs font-semibold text-zinc-900 mb-1">The Cardlist Membership</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            ยิ่งซื้อมาก ยิ่งได้รับสิทธิ์มากขึ้น<br/>ยอดสะสมรายปีจะถูกนับใหม่ทุกวันที่ 1 มกราคม
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
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: tier.color }}>
                      ระดับปัจจุบัน
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500">{tier.spend}</span>
              </div>

              {/* Benefits List */}
              <div className="px-5 py-4 space-y-2.5">
                {tier.benefits.map((b, i) => (
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
          <p className="text-xs font-semibold text-zinc-900 mb-3">การสะสม Points</p>
          <div className="space-y-2">
            {[
              { label: "ทุกการสั่งซื้อ",      value: "฿100 = 1 Point" },
              { label: "รีวิวสินค้า",          value: "+5 Points" },
              { label: "จองและเข้าร่วม Event", value: "+10 Points" },
              { label: "แนะนำเพื่อน",          value: "+50 Points" },
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
