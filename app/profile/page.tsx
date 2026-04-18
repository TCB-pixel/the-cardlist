"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

const TIER_CONFIG = {
  bronze:   { label: "Bronze",   color: "#CD7F32", next: "Silver",   nextSpend: 5000,  currentSpend: 2400 },
  silver:   { label: "Silver",   color: "#A8A9AD", next: "Gold",     nextSpend: 15000, currentSpend: 9800 },
  gold:     { label: "Gold",     color: "#EF9F27", next: "Platinum", nextSpend: 30000, currentSpend: 21500 },
  platinum: { label: "Platinum", color: "#7F77DD", next: null,       nextSpend: 30000, currentSpend: 30000 },
};

const MOCK_USER = {
  username: "thanakorn_c",
  displayName: "Thanakorn C.",
  tier: "gold" as keyof typeof TIER_CONFIG,
  points: 1240,
  totalSpend: 21500,
  ordersCount: 38,
  eventsCount: 12,
};

const MOCK_ORDERS = [
  { id: "ORD-2401", date: "15 เม.ย. 2026", items: "Charizard ex SAR × 1", total: 1850, status: "completed" },
  { id: "ORD-2389", date: "10 เม.ย. 2026", items: "Booster Box SV8a × 1", total: 2800, status: "shipped" },
  { id: "ORD-2345", date: "1 เม.ย. 2026", items: "Monkey D. Luffy SEC × 1", total: 4200, status: "completed" },
];

const MOCK_BOOKINGS = [
  { id: "BK-001", event: "OP Regional Bangkok", date: "26 เม.ย. 2026", status: "confirmed" },
  { id: "BK-002", event: "Pokémon League Cup", date: "3 พ.ค. 2026", status: "confirmed" },
];

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  shipped:   "bg-blue-50 text-blue-700",
  pending:   "bg-amber-50 text-amber-700",
  confirmed: "bg-zinc-900 text-white",
  cancelled: "bg-red-50 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  completed: "สำเร็จ", shipped: "จัดส่งแล้ว", pending: "รอชำระ", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิก",
};

type Tab = "overview" | "orders" | "bookings" | "qr";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShowInstallBanner(false);
    });
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setShowInstallBanner(false);
  }

  const loggedIn = true;
  const tier = TIER_CONFIG[MOCK_USER.tier];
  const ptsPct = Math.round((MOCK_USER.points / (tier.next ? 2000 : 2000)) * 100);
  const spendPct = Math.round((tier.currentSpend / tier.nextSpend) * 100);

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
        <Image src="/images/logo-square.jpg" alt="The Cardlist" width={52} height={52} className="mb-6" />
        <h2 className="text-lg font-bold text-zinc-900 mb-2">เข้าสู่ระบบก่อน</h2>
        <p className="text-sm text-zinc-400 mb-8">เพื่อดูโปรไฟล์ ประวัติสั่งซื้อ และการจองอีเวนต์</p>
        <Link href="/login" className="bg-zinc-900 text-white text-sm font-semibold px-8 py-3 rounded-xl mb-3 block">เข้าสู่ระบบ</Link>
        <Link href="/register" className="border border-zinc-200 text-zinc-700 text-sm font-semibold px-8 py-3 rounded-xl block">สมัครสมาชิก</Link>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="text-sm font-semibold text-zinc-900 tracking-wide">โปรไฟล์</span>
          <Link href="/login" className="text-[11px] text-zinc-400">ออกจากระบบ</Link>
        </div>
      </header>

      {/* PWA Install Banner */}
      {showInstallBanner && !installed && (
        <div className="bg-zinc-900 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="rounded-lg flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">ติดตั้งแอป The Cardlist</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">เพิ่มไปยังหน้าจอหลักได้เลย</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleInstall} className="text-[11px] bg-white text-zinc-900 font-semibold px-3 py-1.5 rounded-lg">ติดตั้ง</button>
            <button onClick={() => setShowInstallBanner(false)} className="text-zinc-500 text-lg leading-none">✕</button>
          </div>
        </div>
      )}

      {installed && (
        <div className="bg-green-900/20 border-b border-green-900/20 px-4 py-2 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#16a34a"/><path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <p className="text-[11px] text-green-700 font-medium">ติดตั้งแอปแล้ว — ใช้งานได้แบบออฟไลน์</p>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white px-5 py-5 border-b border-zinc-100">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {MOCK_USER.displayName[0]}
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900">{MOCK_USER.displayName}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">@{MOCK_USER.username}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: tier.color }}></span>
              <span className="text-[10px] font-semibold tracking-widest" style={{ color: tier.color }}>
                {tier.label.toUpperCase()} MEMBER
              </span>
            </div>
          </div>
        </div>

        {/* Stats — 4 boxes including total spend */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: "Points", value: MOCK_USER.points.toLocaleString() },
            { label: "ยอดสะสม", value: `฿${(MOCK_USER.totalSpend / 1000).toFixed(1)}K` },
            { label: "Orders", value: MOCK_USER.ordersCount },
            { label: "Events", value: MOCK_USER.eventsCount },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-50 rounded-xl py-2.5 text-center">
              <p className="text-sm font-bold text-zinc-900">{s.value}</p>
              <p className="text-[9px] text-zinc-400 mt-0.5 tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Points progress */}
        {tier.next && (
          <div className="mb-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-zinc-500 font-medium">Points: {tier.label} → {tier.next}</span>
              <span className="text-[11px] text-zinc-400">{MOCK_USER.points.toLocaleString()} / 2,000</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(ptsPct, 100)}%`, background: tier.color }}></div>
            </div>
          </div>
        )}

        {/* Spend progress */}
        {tier.next && (
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-zinc-500 font-medium">ยอดซื้อสะสม → {tier.next}</span>
              <span className="text-[11px] text-zinc-400">฿{tier.currentSpend.toLocaleString()} / ฿{tier.nextSpend.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(spendPct, 100)}%`, background: tier.color }}></div>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              อีก ฿{(tier.nextSpend - tier.currentSpend).toLocaleString()} จะขึ้น {tier.next}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-zinc-100 overflow-x-auto scrollbar-hide">
        {(["overview", "orders", "bookings", "qr"] as Tab[]).map((t) => {
          const labels = { overview: "ภาพรวม", orders: "สั่งซื้อ", bookings: "จอง", qr: "QR" };
          return (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-shrink-0 text-[11px] px-5 py-3 tracking-wide border-b-2 transition-colors ${activeTab === t ? "border-zinc-900 text-zinc-900 font-semibold" : "border-transparent text-zinc-400"}`}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-4">
        {activeTab === "overview" && (
          <div className="space-y-2">
            {/* Install App section */}
            {!installed && (
              <div className="card px-4 py-4 mb-4">
                <p className="text-xs font-semibold text-zinc-900 mb-1">ดาวน์โหลดแอป The Cardlist</p>
                <p className="text-[11px] text-zinc-400 mb-3">ติดตั้งเป็นแอปบนมือถือและคอมพิวเตอร์ได้เลย</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleInstall}
                    className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="2" width="14" height="20" rx="2" stroke="#0a0a0a" strokeWidth="1.3"/>
                      <circle cx="12" cy="18" r="1" fill="#0a0a0a"/>
                    </svg>
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-900">มือถือ</p>
                      <p className="text-[9px] text-zinc-400">Android / iOS</p>
                    </div>
                  </button>
                  <button onClick={handleInstall}
                    className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="4" width="20" height="14" rx="2" stroke="#0a0a0a" strokeWidth="1.3"/>
                      <line x1="8" y1="22" x2="16" y2="22" stroke="#0a0a0a" strokeWidth="1.3" strokeLinecap="round"/>
                      <line x1="12" y1="18" x2="12" y2="22" stroke="#0a0a0a" strokeWidth="1.3"/>
                    </svg>
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-900">Desktop</p>
                      <p className="text-[9px] text-zinc-400">Windows / Mac</p>
                    </div>
                  </button>
                </div>
                <p className="text-[9px] text-zinc-400 mt-2.5 text-center">
                  * iOS: กด Share → "Add to Home Screen" ใน Safari
                </p>
              </div>
            )}
            {[
              { label: "แก้ไขโปรไฟล์", href: "#" },
              { label: "ที่อยู่จัดส่ง", href: "#" },
              { label: "Collection Tracker", href: "#" },
              { label: "Deck Builder", href: "#" },
              { label: "สิทธิประโยชน์สมาชิก", href: "#" },
            ].map((item) => (
              <Link key={item.label} href={item.href}
                className="card px-4 py-3.5 flex items-center justify-between active:bg-zinc-50 block">
                <span className="text-sm text-zinc-900">{item.label}</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-300">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            ))}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-2">
            <div className="card px-4 py-3 mb-2 flex items-center justify-between bg-zinc-50">
              <span className="text-[11px] text-zinc-500">ยอดซื้อรวมทั้งหมด</span>
              <span className="text-sm font-bold text-zinc-900">฿{MOCK_USER.totalSpend.toLocaleString()}</span>
            </div>
            {MOCK_ORDERS.map((o) => (
              <div key={o.id} className="card px-4 py-3.5">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">{o.id}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <p className="text-xs font-medium text-zinc-900">{o.items}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-zinc-400">{o.date}</p>
                  <p className="text-xs font-bold text-zinc-900">฿{o.total.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "bookings" && (
          <div className="space-y-2">
            {MOCK_BOOKINGS.map((b) => (
              <div key={b.id} className="card px-4 py-3.5">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">{b.id}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                </div>
                <p className="text-xs font-medium text-zinc-900">{b.event}</p>
                <p className="text-[10px] text-zinc-400 mt-1">{b.date}</p>
                <button onClick={() => setActiveTab("qr")} className="mt-3 text-[10px] border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 w-full text-center active:bg-zinc-50">
                  ดู QR Code
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "qr" && (
          <div className="space-y-3">
            {MOCK_BOOKINGS.map((b) => (
              <div key={b.id} className="card px-5 py-5 text-center">
                <p className="text-xs font-semibold text-zinc-900 mb-0.5">{b.event}</p>
                <p className="text-[10px] text-zinc-400 mb-4">{b.date}</p>
                <div className="w-36 h-36 mx-auto bg-white border-2 border-zinc-100 rounded-2xl mb-3 flex items-center justify-center p-3">
                  <div className="grid grid-cols-6 gap-0.5 w-full h-full">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div key={i} className={`rounded-sm ${[0,1,6,7,8,13,14,15,21,22,23,28,29,34,35,3,4,10,25,31].includes(i) ? "bg-zinc-900" : "bg-white border border-zinc-100"}`}></div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 mb-1">{b.id}</p>
                <p className="text-[9px] text-zinc-400">แสดง QR Code นี้เพื่อ Check-in หน้างาน</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
