"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile, Booking, Event } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  created_at: string;
  total: number;
  status: "pending" | "paid" | "shipped" | "completed" | "cancelled";
  order_items: {
    quantity: number;
    products: { name: string } | null;
  }[];
};

type BookingWithEvent = Booking & {
  events: Pick<Event, "title" | "date" | "time" | "location"> | null;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  bronze:   { label: "Bronze",   color: "#CD7F32", next: "Silver",   nextSpend: 5000  },
  silver:   { label: "Silver",   color: "#A8A9AD", next: "Gold",     nextSpend: 15000 },
  gold:     { label: "Gold",     color: "#EF9F27", next: "Platinum", nextSpend: 30000 },
  platinum: { label: "Platinum", color: "#7F77DD", next: null,       nextSpend: 30000 },
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  shipped:   "bg-blue-50 text-blue-700",
  pending:   "bg-amber-50 text-amber-700",
  paid:      "bg-sky-50 text-sky-700",
  confirmed: "bg-zinc-900 text-white",
  cancelled: "bg-red-50 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  completed: "สำเร็จ",
  shipped:   "จัดส่งแล้ว",
  pending:   "รอชำระ",
  paid:      "ชำระแล้ว",
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิก",
};

type Tab = "overview" | "orders" | "bookings" | "qr";

type GenReg = {
  id: string;
  qr_code: string;
  pack_used: number;
  pack_paid: boolean;
  event_id: string;
  events: { title: string; date: string; location: string } | null;
};

type PriorityTicket = {
  id: string;
  qr_code: string;
  status: string;
  free_pack_redeemed: boolean;
  free_pack_quota: number;
  free_pack_used: number;
  ma5_slot: boolean | null;
  events: { title: string; date: string; location: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatOrderItems(items: Order["order_items"]) {
  if (!items?.length) return "—";
  const first = items[0];
  const name = first.products?.name ?? "สินค้า";
  const qty = first.quantity;
  const extra = items.length > 1 ? ` +${items.length - 1} รายการ` : "";
  return `${name} × ${qty}${extra}`;
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 pb-20 animate-pulse">
      <div className="h-12 bg-white border-b border-zinc-100" />
      <div className="bg-white px-5 py-5 border-b border-zinc-100">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-100 rounded w-1/2" />
            <div className="h-3 bg-zinc-100 rounded w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-100 rounded-xl h-14" />
          ))}
        </div>
        <div className="h-2 bg-zinc-100 rounded-full mb-3" />
        <div className="h-2 bg-zinc-100 rounded-full" />
      </div>
    </div>
  );
}

// ─── QR Code (SVG-based, deterministic from string) ────────────────────────────

function QRCode({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    async function generate() {
      try {
        const QRCodeLib = await import("qrcode");
        const url = await QRCodeLib.toDataURL(value, {
          width: 200,
          margin: 2,
          color: { dark: "#09090b", light: "#ffffff" },
        });
        setDataUrl(url);
      } catch {}
    }
    if (value) generate();
  }, [value]);

  if (!dataUrl) {
    return (
      <div className="w-40 h-40 mx-auto bg-zinc-100 rounded-2xl animate-pulse" />
    );
  }

  return (
    <div className="w-40 h-40 mx-auto bg-white border-2 border-zinc-100 rounded-2xl flex items-center justify-center p-2">
      <img src={dataUrl} alt="QR Code" className="w-full h-full object-contain" />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function Barcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    async function generate() {
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        if (svgRef.current) {
          JsBarcode(svgRef.current, value, {
            format: "CODE128",
            width: 1.8,
            height: 50,
            displayValue: true,
            fontSize: 10,
            margin: 6,
            background: "#ffffff",
            lineColor: "#09090b",
          });
        }
      } catch {}
    }
    if (value) generate();
  }, [value]);

  return (
    <div className="w-full bg-white border border-zinc-100 rounded-xl flex items-center justify-center py-2 px-2 mt-2">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & data state
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<BookingWithEvent[]>([]);
  const [genRegs, setGenRegs] = useState<GenReg[]>([]);
  const [priorityTickets, setPriorityTickets] = useState<PriorityTicket[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [fetchError, setFetchError] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loggingOut, setLoggingOut] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showLineBanner, setShowLineBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  // ── PWA ──
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

  // ── Fetch data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      // 1) Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const userId = session.user.id;

      // 2) Profile
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (profileErr) throw profileErr;
      setProfile(profileData);
      // แสดง banner ผูก LINE ถ้ายังไม่มี line_user_id
      if (!profileData?.line_user_id) setShowLineBanner(true);

      // 3) Orders (with items + product name for summary)
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select(`
          id, created_at, total, status,
          order_items (
            quantity,
            products ( name )
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (ordersErr) throw ordersErr;
      setOrders((ordersData as unknown as Order[]) ?? []);

      // 4) Total spend (sum of completed + shipped + paid orders)
      const { data: spendData } = await supabase
        .from("orders")
        .select("total")
        .eq("user_id", userId)
        .in("status", ["completed", "shipped", "paid"]);
      const spend = (spendData ?? []).reduce((sum, o) => sum + Number(o.total), 0);
      setTotalSpend(spend);

      // 5) Bookings with event info
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from("bookings")
        .select(`
          id, status, qr_code, created_at, event_id, user_id,
          events ( title, date, time, location )
        `)
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });
      if (bookingsErr) throw bookingsErr;
      setBookings((bookingsData as unknown as BookingWithEvent[]) ?? []);

      // 6) General registrations
      const { data: genRawData } = await supabase
        .from("general_registrations")
        .select("id, qr_code, pack_used, pack_paid, event_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const genWithEvents = await Promise.all((genRawData ?? []).map(async (g: any) => {
        const { data: ev } = await supabase.from("events").select("title, date, location").eq("id", g.event_id).single();
        return { ...g, events: ev };
      }));
      setGenRegs((genWithEvents as unknown as GenReg[]) ?? []);

      // 7) Priority tickets
      const { data: priorityRawData } = await supabase
        .from("event_tickets")
        .select("id, qr_code, status, free_pack_redeemed, free_pack_quota, free_pack_used, ma5_slot, event_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const priorityWithEvents = await Promise.all((priorityRawData ?? []).map(async (p: any) => {
        const { data: ev } = await supabase.from("events").select("title, date, location").eq("id", p.event_id).single();
        return { ...p, events: ev };
      }));
      setPriorityTickets((priorityWithEvents as unknown as PriorityTicket[]) ?? []);

    } catch (err: any) {
      setFetchError(err?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Logout ──
  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ── Loading ──
  if (loading) return <ProfileSkeleton />;

  // ── Not logged in (fallback — middleware should catch this first) ──
  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
        <Image src="/images/logo-square.jpg" alt="The Cardlist" width={52} height={52} className="mb-6" />
        <h2 className="text-lg font-bold text-zinc-900 mb-2">เข้าสู่ระบบก่อน</h2>
        <p className="text-sm text-zinc-400 mb-8">เพื่อดูโปรไฟล์ ประวัติสั่งซื้อ และการจองอีเวนต์</p>
        <Link href="/login" className="bg-zinc-900 text-white text-sm font-semibold px-8 py-3 rounded-xl mb-3 block">
          เข้าสู่ระบบ
        </Link>
        <Link href="/register" className="border border-zinc-200 text-zinc-700 text-sm font-semibold px-8 py-3 rounded-xl block">
          สมัครสมาชิก
        </Link>
        <BottomNav />
      </div>
    );
  }

  const tier = TIER_CONFIG[profile.tier];
  const ptsPct = Math.min(Math.round((profile.points / 2000) * 100), 100);
  const spendPct = tier.next ? Math.min(Math.round((totalSpend / tier.nextSpend) * 100), 100) : 100;
  const spendRemaining = tier.next ? Math.max(tier.nextSpend - totalSpend, 0) : 0;

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="text-sm font-semibold text-zinc-900 tracking-wide">โปรไฟล์</span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-[11px] text-zinc-400 active:text-zinc-700 disabled:opacity-40"
          >
            {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
          </button>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {fetchError && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-red-600">{fetchError}</p>
          <button onClick={loadData} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">
            ลองใหม่
          </button>
        </div>
      )}

      {/* ── PWA Install Banner ── */}
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
            <button onClick={handleInstall} className="text-[11px] bg-white text-zinc-900 font-semibold px-3 py-1.5 rounded-lg">
              ติดตั้ง
            </button>
            <button onClick={() => setShowInstallBanner(false)} className="text-zinc-500 text-lg leading-none">✕</button>
          </div>
        </div>
      )}

      {installed && (
        <div className="bg-green-900/20 border-b border-green-900/20 px-4 py-2 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="#16a34a"/>
            <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] text-green-700 font-medium">ติดตั้งแอปแล้ว — ใช้งานได้แบบออฟไลน์</p>
        </div>
      )}

      {/* ── Profile Card ── */}
      <div className="bg-white px-5 py-5 border-b border-zinc-100">
        <div className="flex items-center gap-4 mb-5">
          {/* Avatar */}
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username}
              width={56} height={56}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {(profile.display_name ?? profile.username)[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-zinc-900">{profile.display_name ?? profile.username}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">@{profile.username}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} />
              <span className="text-[10px] font-semibold tracking-widest" style={{ color: tier.color }}>
                {tier.label.toUpperCase()} MEMBER
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: "Points",   value: profile.points.toLocaleString() },
            { label: "ยอดสะสม",  value: totalSpend >= 1000 ? `฿${(totalSpend / 1000).toFixed(1)}K` : `฿${totalSpend}` },
            { label: "Orders",   value: orders.length },
            { label: "Events",   value: bookings.length },
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
              <span className="text-[11px] text-zinc-400">{profile.points.toLocaleString()} / 2,000</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ptsPct}%`, background: tier.color }} />
            </div>
          </div>
        )}

        {/* Spend progress */}
        {tier.next && (
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-zinc-500 font-medium">ยอดซื้อสะสม → {tier.next}</span>
              <span className="text-[11px] text-zinc-400">฿{totalSpend.toLocaleString()} / ฿{tier.nextSpend.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${spendPct}%`, background: tier.color }} />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              อีก ฿{spendRemaining.toLocaleString()} จะขึ้น {tier.next}
            </p>
          </div>
        )}

        {profile.tier === "platinum" && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} />
            <p className="text-[11px] font-semibold" style={{ color: tier.color }}>
              Platinum — ระดับสูงสุด 🎉
            </p>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white border-b border-zinc-100 overflow-x-auto scrollbar-hide">
        {(["overview", "orders", "bookings", "qr"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { overview: "ภาพรวม", orders: "สั่งซื้อ", bookings: "จอง", qr: "QR" };
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-shrink-0 text-[11px] px-5 py-3 tracking-wide border-b-2 transition-colors ${
                activeTab === t ? "border-zinc-900 text-zinc-900 font-semibold" : "border-transparent text-zinc-400"
              }`}
            >
              {labels[t]}
              {t === "orders" && orders.length > 0 && (
                <span className="ml-1 text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                  {orders.length}
                </span>
              )}
              {t === "bookings" && bookings.length > 0 && (
                <span className="ml-1 text-[9px] bg-zinc-900 text-white px-1.5 py-0.5 rounded-full">
                  {bookings.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="px-4 py-4">

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-2">
            {!installed && (
              <div className="card px-4 py-4 mb-4">
                <p className="text-xs font-semibold text-zinc-900 mb-1">ดาวน์โหลดแอป The Cardlist</p>
                <p className="text-[11px] text-zinc-400 mb-3">ติดตั้งเป็นแอปบนมือถือและคอมพิวเตอร์ได้เลย</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleInstall} className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="2" width="14" height="20" rx="2" stroke="#0a0a0a" strokeWidth="1.3"/>
                      <circle cx="12" cy="18" r="1" fill="#0a0a0a"/>
                    </svg>
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-900">มือถือ</p>
                      <p className="text-[9px] text-zinc-400">Android / iOS</p>
                    </div>
                  </button>
                  <button onClick={handleInstall} className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors">
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
                <p className="text-[9px] text-zinc-400 mt-2.5 text-center">* iOS: กด Share → "Add to Home Screen" ใน Safari</p>
              </div>
            )}
            {[
              { label: "แก้ไขโปรไฟล์",       href: "/profile/edit" },
              { label: "ที่อยู่จัดส่ง",        href: "/profile/address" },
              { label: "Collection Tracker",   href: "/profile/collection" },
              { label: "Deck Builder",          href: "/profile/decks" },
              { label: "สิทธิประโยชน์สมาชิก",  href: "/profile/benefits" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="card px-4 py-3.5 flex items-center justify-between active:bg-zinc-50 block"
              >
                <span className="text-sm text-zinc-900">{item.label}</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-300">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-2">
            {orders.length > 0 && (
              <div className="card px-4 py-3 mb-2 flex items-center justify-between bg-zinc-50">
                <span className="text-[11px] text-zinc-500">ยอดซื้อรวมทั้งหมด</span>
                <span className="text-sm font-bold text-zinc-900">฿{totalSpend.toLocaleString()}</span>
              </div>
            )}
            {orders.length === 0 ? (
              <div className="card px-5 py-10 text-center">
                <p className="text-sm text-zinc-400">ยังไม่มีประวัติการสั่งซื้อ</p>
                <Link href="/shop" className="mt-4 inline-block btn-primary px-6 py-2.5">ไปที่ร้านค้า</Link>
              </div>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-[11px] font-semibold text-zinc-500 tracking-wide font-mono">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-900">{formatOrderItems(o.order_items)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-zinc-400">{formatDate(o.created_at)}</p>
                    <p className="text-xs font-bold text-zinc-900">฿{Number(o.total).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* BOOKINGS */}
        {activeTab === "bookings" && (
          <div className="space-y-2">
            {bookings.length === 0 ? (
              <div className="card px-5 py-10 text-center">
                <p className="text-sm text-zinc-400">ยังไม่มีการจองอีเวนต์</p>
                <Link href="/events" className="mt-4 inline-block btn-primary px-6 py-2.5">ดูอีเวนต์</Link>
              </div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-[11px] font-semibold text-zinc-500 tracking-wide font-mono">
                      #{b.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status]}`}>
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-900">{b.events?.title ?? "—"}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {b.events?.date ? formatDate(b.events.date) : "—"}
                    {b.events?.time ? ` · ${b.events.time.slice(0, 5)}` : ""}
                    {b.events?.location ? ` · ${b.events.location}` : ""}
                  </p>
                  <button
                    onClick={() => setActiveTab("qr")}
                    className="mt-3 text-[10px] border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 w-full text-center active:bg-zinc-50"
                  >
                    ดู QR Code
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* QR */}
        {activeTab === "qr" && (
          <div className="space-y-4">
            {genRegs.length === 0 && priorityTickets.length === 0 ? (
              <div className="card px-5 py-10 text-center">
                <p className="text-2xl mb-3">🎫</p>
                <p className="text-sm text-zinc-400">ยังไม่มี QR Code</p>
                <p className="text-[11px] text-zinc-400 mt-1">ลงทะเบียนเข้างานเพื่อรับ QR Code</p>
              </div>
            ) : (
              <>
                {/* General Tickets */}
                {genRegs.map((g) => (
                  <div key={g.id} className="card px-5 py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-semibold">GENERAL</span>
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">ฟรี</span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-900 mb-0.5">{(g.events as any)?.title ?? "—"}</p>
                    <p className="text-[10px] text-zinc-400 mb-4">
                      {(g.events as any)?.date ? formatDate((g.events as any).date) : ""} · {(g.events as any)?.location ?? ""}
                    </p>
                    <div className="flex justify-center mb-2">
                      <QRCode value={g.qr_code} />
                    </div>
                    <Barcode value={g.qr_code} />
                    <p className="text-[10px] text-center text-zinc-400 font-mono mt-2 mb-3">{g.qr_code}</p>
                    {/* สิทธิ์ */}
                    <div className="bg-zinc-50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-zinc-500 tracking-widest uppercase">สิทธิ์ของคุณ</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🏷️</span>
                          <span className="text-[11px] text-zinc-700">ซื้อ Pokemon ราคาป้าย</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.pack_used >= 1 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                          {g.pack_used >= 1 ? "ใช้แล้ว" : "1 ซอง"}
                        </span>
                      </div>
                    </div>
                    {/* pack_paid status + ปุ่มซื้อ */}
                    <div className="mt-3">
                      {g.pack_paid ? (
                        <div className="flex items-center justify-center gap-2 bg-green-50 rounded-xl px-3 py-2">
                          <span className="text-green-600 text-sm">✅</span>
                          <p className="text-[11px] text-green-700 font-semibold">ชำระ ฿49 แล้ว — รับซองได้หน้างาน</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                            <span className="text-amber-600 text-sm">💰</span>
                            <p className="text-[11px] text-amber-700">ยังไม่ได้ซื้อ Booster Pack ล่วงหน้า</p>
                          </div>
                          <button
                            onClick={() => router.push(`/events/${g.event_id}/ticket`)}
                            className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors">
                            🛍️ ซื้อ Booster Pack ราคาป้าย ฿49
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-zinc-400 text-center mt-3">แสดง QR Code นี้หน้างานเพื่อใช้สิทธิ์</p>
                  </div>
                ))}

                {/* Priority Tickets */}
                {priorityTickets.map((p) => (
                  <div key={p.id} className="card px-5 py-5 border-2 border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🥇 PRIORITY GUEST</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-600"}`}>
                        {p.status === "approved" ? "✓ อนุมัติแล้ว" : "รอยืนยัน"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-900 mb-0.5">{(p.events as any)?.title ?? "—"}</p>
                    <p className="text-[10px] text-zinc-400 mb-4">
                      {(p.events as any)?.date ? formatDate((p.events as any).date) : ""} · {(p.events as any)?.location ?? ""}
                    </p>
                    {p.status === "approved" && (
                      <>
                        <div className="flex justify-center mb-2">
                          <QRCode value={p.qr_code} />
                        </div>
                        <Barcode value={p.qr_code} />
                        <p className="text-[10px] text-center text-zinc-400 font-mono mt-2 mb-3">{p.qr_code}</p>
                      </>
                    )}
                    {/* สิทธิ์ */}
                    <div className="bg-amber-50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-zinc-500 tracking-widest uppercase">สิทธิ์ของคุณ</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🎁</span>
                          <span className="text-[11px] text-zinc-700">Pokemon M2 (JP) ฟรี</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.free_pack_redeemed ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                          {p.free_pack_redeemed ? "รับแล้ว" : "1 ซอง"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🏷️</span>
                          <span className="text-[11px] text-zinc-700">ซื้อ M1/M3/M4 ราคาป้าย</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.free_pack_used >= p.free_pack_quota ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                          {p.free_pack_quota - p.free_pack_used}/{p.free_pack_quota} ซอง
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🎲</span>
                          <span className="text-[11px] text-zinc-700">ลุ้น MA5 Box</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.ma5_slot === true ? "bg-green-50 text-green-700" : p.ma5_slot === false ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-500"}`}>
                          {p.ma5_slot === true ? "✅ ได้สิทธิ์!" : p.ma5_slot === false ? "❌ ไม่ได้" : "รอสุ่มหน้างาน"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-400 text-center mt-3">แสดง QR Code นี้หน้างานเพื่อใช้สิทธิ์</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
