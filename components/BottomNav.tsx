"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";

const NAV = [
  {
    href: "/",
    label: "หน้าแรก",
    labelEn: "Home",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth={active ? "1.6" : "1.3"} fill="none" strokeLinejoin="round"/>
        <rect x="7.5" y="12" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    href: "/shop",
    label: "Shop",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2.5 5h15l-1.5 9a1 1 0 01-1 .9H5a1 1 0 01-1-.9L2.5 5z" stroke="currentColor" strokeWidth={active ? "1.6" : "1.3"} fill="none"/>
        <circle cx="7.5" cy="17" r="1" fill="currentColor"/>
        <circle cx="13.5" cy="17" r="1" fill="currentColor"/>
        <path d="M5.5 5l1-3h7l1 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="4" width="15" height="14" rx="2" stroke="currentColor" strokeWidth={active ? "1.6" : "1.3"} fill="none"/>
        <line x1="2.5" y1="8.5" x2="17.5" y2="8.5" stroke="currentColor" strokeWidth="1.3"/>
        <line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="7" cy="13" r="1" fill="currentColor"/>
        <circle cx="10" cy="13" r="1" fill="currentColor"/>
        <circle cx="13" cy="13" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: "/thaiartistcards",
    label: "Artist Cards",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="6" y="3" width="10" height="13" rx="1.6" stroke="currentColor" strokeWidth={active ? "1.6" : "1.3"} fill="none"/>
        <path d="M4.2 5.8L2.6 6.4a1 1 0 00-.6 1.3l3.2 8.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
        <circle cx="11" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.3" fill="none"/>
        <path d="M8 13.5l2-2.2 1.6 1.7 1.2-1.1 1.2 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    href: "/news",
    label: "News",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="3" width="15" height="14" rx="2" stroke="currentColor" strokeWidth={active ? "1.6" : "1.3"} fill="none"/>
        <line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="6" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="6" y1="14" x2="10" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth={active ? "1.6" : "1.3"} fill="none"/>
        <path d="M3 18c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
];

// แถบเมนูล่างแบบลอย (แรงบันดาลใจ: Floating Dock บน 21st.dev) — เมนูที่อยู่ขยายไอคอนและมีพื้นทึบ
export default function BottomNav() {
  const pathname = usePathname();
  const { lang } = useLang();
  return (
    <nav className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-md rounded-2xl bg-white/90 backdrop-blur-md border border-zinc-200/80 shadow-[0_10px_30px_-12px_rgba(0,0,0,.35)] flex items-center justify-around h-16 px-1"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      {NAV.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={`group flex flex-1 min-w-0 flex-col items-center gap-0.5 px-0.5 py-1 transition-colors ${active ? "text-zinc-900" : "text-zinc-500"}`}>
            <span className={`flex items-center justify-center w-9 h-8 rounded-xl transition-all duration-200 ${active ? "bg-zinc-900 text-white scale-110 -translate-y-0.5" : "group-hover:bg-zinc-100 group-active:scale-90"}`}>
              {item.icon(active)}
            </span>
            <span className={`text-[10px] tracking-tight whitespace-nowrap ${active ? "font-semibold" : "font-normal"}`}>{lang === "en" && "labelEn" in item ? item.labelEn : item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
