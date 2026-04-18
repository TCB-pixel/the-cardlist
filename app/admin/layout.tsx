"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { AdminProvider, useAdmin } from "@/lib/admin-context";
import { Permission, ROLE_LABEL, ROLE_COLOR } from "@/lib/rbac";

type NavItem = { href: string; label: string; permission: Permission; icon: React.ReactNode };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: "ภาพรวม",
    items: [
      { href: "/admin", label: "Dashboard", permission: "dashboard:view",
        icon: <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/> },
    ],
  },
  {
    group: "จัดการสินค้า",
    items: [
      { href: "/admin/products", label: "สินค้าทั้งหมด", permission: "products:view",
        icon: <><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.3"/></> },
      { href: "/admin/orders", label: "คำสั่งซื้อ", permission: "orders:view",
        icon: <><path d="M3 5h2l1.5 9h9l1.5-9H17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/><circle cx="8" cy="17" r="1" fill="currentColor"/><circle cx="14" cy="17" r="1" fill="currentColor"/></> },
    ],
  },
  {
    group: "อีเวนต์",
    items: [
      { href: "/admin/events", label: "จัดการอีเวนต์", permission: "events:view",
        icon: <><rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><line x1="2.5" y1="8" x2="17.5" y2="8" stroke="currentColor" strokeWidth="1.3"/><line x1="7" y1="2" x2="7" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="13" y1="2" x2="13" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
    ],
  },
  {
    group: "เนื้อหา",
    items: [
      { href: "/admin/news", label: "ข่าวสาร & บทความ", permission: "news:view",
        icon: <><rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="6" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
      { href: "/admin/banners", label: "จัดการ Banner", permission: "news:edit" as Permission,
        icon: <><rect x="1.5" y="4" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><line x1="1.5" y1="9" x2="18.5" y2="9" stroke="currentColor" strokeWidth="1.3"/><circle cx="5" cy="13" r="1" fill="currentColor"/><circle cx="10" cy="13" r="1" fill="currentColor"/></> },
    ],
  },
  {
    group: "สมาชิก",
    items: [
      { href: "/admin/members", label: "จัดการสมาชิก", permission: "members:view",
        icon: <><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M3 18c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></> },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { href: "/admin/staff", label: "จัดการ Admin & Staff", permission: "staff:view",
        icon: <><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/><circle cx="13" cy="7" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M1 18c0-3 2.7-5 6-5M10 18c0-3 2.7-5 6-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></> },
    ],
  },
];

function AdminSidebar() {
  const { currentUser, can, logout } = useAdmin();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${collapsed ? "w-14" : "w-56"} flex-shrink-0 bg-zinc-900 flex flex-col transition-all duration-200 min-h-screen`}>
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-zinc-800 ${collapsed ? "justify-center" : ""}`}>
        <Image src="/images/logo-square.jpg" alt="The Cardlist" width={28} height={28} className="invert flex-shrink-0" />
        {!collapsed && (
          <div>
            <p className="text-[11px] font-bold text-white tracking-widest leading-none">THE CARDLIST</p>
            <p className="text-[9px] text-zinc-500 tracking-wider mt-0.5">ADMIN PANEL</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV.map((group) => {
          const visible = group.items.filter((item) => can(item.permission));
          if (visible.length === 0) return null;
          return (
            <div key={group.group} className="mb-4">
              {!collapsed && (
                <p className="text-[9px] font-semibold text-zinc-500 tracking-widest px-4 mb-1.5 uppercase">{group.group}</p>
              )}
              {visible.map((item) => {
                const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${active ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"} ${collapsed ? "justify-center" : ""}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" className="flex-shrink-0">{item.icon}</svg>
                    {!collapsed && <span className="font-medium">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Current user */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-zinc-700 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {currentUser.avatar}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{currentUser.name}</p>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider ${ROLE_COLOR[currentUser.role]}`}>
                {ROLE_LABEL[currentUser.role].toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 py-2">
        <Link href="/" target="_blank"
          className={`flex items-center gap-3 px-4 py-2 text-xs text-zinc-500 hover:text-white transition-colors ${collapsed ? "justify-center" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
            <path d="M10 3a7 7 0 100 14A7 7 0 0010 3z" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 3c-1.5 2-2 4-2 7s.5 5 2 7M10 3c1.5 2 2 4 2 7s-.5 5-2 7M3 10h14" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          {!collapsed && <span>หน้าเว็บหลัก</span>}
        </Link>
        <button onClick={() => logout()}
          className={`flex items-center gap-3 w-full px-4 py-2 text-xs text-red-400 hover:text-red-300 transition-colors ${collapsed ? "justify-center" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
            <path d="M13 5l4 5-4 5M17 10H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 3H4a1 1 0 00-1 1v12a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center gap-3 w-full px-4 py-2 text-xs text-zinc-500 hover:text-white transition-colors ${collapsed ? "justify-center" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
            {collapsed
              ? <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M13 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>}
          </svg>
          {!collapsed && <span>ย่อเมนู</span>}
        </button>
      </div>
    </aside>
  );
}

function AdminTopBar() {
  const { currentUser, logout } = useAdmin();
  const pathname = usePathname();
  const allItems = NAV.flatMap((g) => g.items);
  const pageLabel = allItems.find((i) => i.href === pathname)?.label ?? "Admin";

  return (
    <div className="bg-white border-b border-zinc-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="text-sm font-semibold text-zinc-900">{pageLabel}</h1>
        <p className="text-[10px] text-zinc-400 mt-0.5">
          {new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-semibold text-zinc-900">{currentUser.name}</p>
          <p className="text-[10px] text-zinc-400">{currentUser.email}</p>
        </div>
        <div className="relative">
          <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center text-white text-sm font-bold">
            {currentUser.avatar}
          </div>
          <span className={`absolute -bottom-1 -right-1 text-[7px] font-bold px-1 py-0.5 rounded-full leading-none ${
            currentUser.role === "owner" ? "bg-purple-600 text-white" : currentUser.role === "head_staff" ? "bg-blue-600 text-white" : "bg-zinc-600 text-white"
          }`}>
            {currentUser.role === "owner" ? "OW" : currentUser.role === "head_staff" ? "HS" : "ST"}
          </span>
        </div>
        <button onClick={logout}
          title="ออกจากระบบ"
          className="w-9 h-9 flex items-center justify-center border border-red-100 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M13 5l4 5-4 5M17 10H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 3H4a1 1 0 00-1 1v12a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function AdminInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return (
    <div className="flex min-h-screen bg-zinc-50">
      <AdminSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <AdminTopBar />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminInner>{children}</AdminInner>
    </AdminProvider>
  );
}
