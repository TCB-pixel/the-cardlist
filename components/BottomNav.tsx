"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/",
    label: "หน้าแรก",
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

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-100 flex items-center justify-around h-16">
      {NAV.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${active ? "text-zinc-900" : "text-zinc-400"}`}>
            {item.icon(active)}
            <span className={`text-[9px] tracking-wide ${active ? "font-semibold" : "font-normal"}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
