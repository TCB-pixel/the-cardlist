"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { FEATURES } from "@/lib/features";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile, Booking, Event } from "@/lib/types";
import { getTier, getNextTier, TIER_LABEL, TIER_COLOR } from "@/lib/tiers";
import BottomNav from "@/components/BottomNav";
import LogoLoader from "@/components/LogoLoader";
import FacebookFollowCard from "@/components/FacebookFollowCard";
import TopBar from "@/components/TopBar";
import { useLang } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  created_at: string;
  total_amount: number;
  status: "pending" | "paid" | "shipped" | "completed" | "cancelled";
  order_items: {
    name: string;
    qty: number;
  }[];
};

type BookingWithEvent = Booking & {
  events: Pick<Event, "title" | "date" | "time" | "location"> | null;
};

// ─── Config ───────────────────────────────────────────────────────────────────


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
const STATUS_LABEL_EN: Record<string, string> = {
  completed: "Completed",
  shipped:   "Shipped",
  pending:   "Awaiting payment",
  paid:      "Paid",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

type Tab = "overview" | "orders" | "bookings" | "qr";

type GenReg = {
  id: string;
  qr_code: string;
  pack_used: number;
  pack_paid: boolean;
  event_id: string;
  events: { title: string; date: string; location: string; general_perk_enabled: boolean } | null;
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

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatOrderItems(items: Order["order_items"], L: (th: string, en: string) => string) {
  if (!items?.length) return "—";
  const first = items[0];
  const name = first.name ?? L("สินค้า", "Item");
  const qty = first.qty;
  const extra = items.length > 1 ? L(` +${items.length - 1} รายการ`, ` +${items.length - 1} more`) : "";
  return `${name} × ${qty}${extra}`;
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <LogoLoader />
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
  const { L, lang, locale } = useLang();

  // Auth & data state
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<BookingWithEvent[]>([]);
  const [genRegs, setGenRegs] = useState<GenReg[]>([]);
  const [priorityTickets, setPriorityTickets] = useState<PriorityTicket[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [fetchError, setFetchError] = useState("");

  // สะสมรอบเล่น — staff สแกน QR ประจำตัวหน้าร้านเพื่อบันทึก
  const [playCount, setPlayCount] = useState(0);
  const [stampRewards, setStampRewards] = useState<{ id: string; name: string; required_visits: number; price: number | null; quota: number | null; granted_count: number }[]>([]);
  const [myGrants, setMyGrants] = useState<{ reward_id: string; status: string }[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loggingOut, setLoggingOut] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [showLineBanner, setShowLineBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  // ── PWA ──
  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
    });
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
  }, []);

  async function handleInstall() {
    // iOS และเบราว์เซอร์ที่ไม่มีปุ่มติดตั้งอัตโนมัติ → บอกวิธีติดตั้งเอง
    if (!deferredPrompt) { setShowInstallHint(true); return; }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
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

      // 2.5) สะสมรอบเล่น + สิทธิ์ที่ได้รับ (RLS ให้อ่านได้เฉพาะของตัวเอง)
      const [playRes, rewardRes, grantRes] = await Promise.all([
        supabase.from("play_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("stamp_rewards").select("id, name, required_visits, price, quota, granted_count")
          .eq("active", true).order("required_visits", { ascending: true }),
        supabase.from("stamp_reward_grants").select("reward_id, status").eq("user_id", userId),
      ]);
      setPlayCount(playRes.count ?? 0);
      setStampRewards(rewardRes.data ?? []);
      setMyGrants(grantRes.data ?? []);

      // 3) Orders (with items + product name for summary)
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select(`
          id, created_at, total_amount, status,
          order_items (
            name,
            qty
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
        .select("total_amount")
        .eq("user_id", userId)
        .in("status", ["completed", "shipped", "paid"]);
      const spend = (spendData ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0);
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
        const { data: ev } = await supabase.from("events").select("title, date, location, general_perk_enabled").eq("id", g.event_id).single();
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
      console.error("profile load failed:", err);
      setFetchError("load_failed");
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

  // ── โหลดพลาดทั้งที่ล็อกอินอยู่ — บอกให้ลองใหม่ ไม่ใช่ให้ไปล็อกอิน ──
  if (!profile && fetchError) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20" role="alert">
        <h2 className="text-lg font-bold text-zinc-900 mb-2">{L("โหลดข้อมูลไม่สำเร็จ", "Couldn't load data")}</h2>
        <p className="text-sm text-zinc-500 mb-8">{L("โหลดข้อมูลโปรไฟล์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่", "Couldn't load your profile. Check your connection and try again.")}</p>
        <button onClick={loadData} className="bg-zinc-900 text-white text-sm font-semibold px-8 py-3 rounded-xl">{L("ลองใหม่", "Try again")}</button>
        <BottomNav />
      </div>
    );
  }

  // ── Not logged in (fallback — middleware should catch this first) ──
  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center pb-20">
        <Image src="/images/logo-square.jpg" alt="The Cardlist" width={52} height={52} className="mb-6" />
        <h2 className="text-lg font-bold text-zinc-900 mb-2">{L("เข้าสู่ระบบก่อน", "Please log in")}</h2>
        <p className="text-sm text-zinc-500 mb-8">{L("เพื่อดูโปรไฟล์ ประวัติสั่งซื้อ และการจองอีเวนต์", "To see your profile, order history and event bookings")}</p>
        <Link href="/login" className="bg-zinc-900 text-white text-sm font-semibold px-8 py-3 rounded-xl mb-3 block">
          {L("เข้าสู่ระบบ", "Log in")}
        </Link>
        <Link href="/register" className="border border-zinc-200 text-zinc-700 text-sm font-semibold px-8 py-3 rounded-xl block">
          {L("สมัครสมาชิก", "Sign up")}
        </Link>
        <BottomNav />
      </div>
    );
  }

  // Tier คำนวณสดจากยอดซื้อสะสมจริง (ไม่ใช้ profiles.tier ที่เป็นค่า static)
  const tierKey = getTier(totalSpend);
  const tierColor = TIER_COLOR[tierKey];
  const tierLabel = TIER_LABEL[tierKey];
  const { next: nextTierKey, nextThreshold } = getNextTier(tierKey);
  const spendPct = nextThreshold ? Math.min(Math.round((totalSpend / nextThreshold) * 100), 100) : 100;
  const spendRemaining = nextThreshold ? Math.max(nextThreshold - totalSpend, 0) : 0;

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">

      <TopBar title={L("โปรไฟล์", "Profile")} />

      {/* ── Error Banner ── */}
      {fetchError && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
          <p className="text-[11px] text-red-700">{L("โหลดข้อมูลโปรไฟล์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่", "Couldn't load your profile. Check your connection and try again.")}</p>
          <button onClick={loadData} className="text-xs font-semibold text-red-700 underline flex-shrink-0 py-2">
            {L("ลองใหม่", "Try again")}
          </button>
        </div>
      )}

      {/* ── ข้อมูลสมาชิก: ชื่อ ระดับ ตัวเลขหลัก และความคืบหน้าระดับถัดไป (แถบเดียว) ── */}
      <section className="bg-white px-4 pt-5 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username}
              width={52} height={52}
              className="w-[52px] h-[52px] rounded-2xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-[52px] h-[52px] rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {(profile.display_name ?? profile.username)[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-zinc-900 truncate">{profile.display_name ?? profile.username}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: tierColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tierColor }} />
                {tierLabel} Member
              </span>
              <span className="text-[11px] text-zinc-500 truncate">@{profile.username}</span>
            </div>
          </div>
          {profile.member_code && (
            <button
              onClick={() => setActiveTab("qr")}
              aria-label={L("QR สมาชิก", "Member QR")}
              className="w-11 h-11 rounded-xl border border-zinc-200 flex flex-col items-center justify-center text-zinc-900 active:bg-zinc-50 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h3v-3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 mt-4 divide-x divide-zinc-100">
          {[
            { label: "Points", value: profile.points.toLocaleString() },
            { label: L("ยอดสะสม", "Spent"), value: totalSpend >= 1000 ? `฿${(totalSpend / 1000).toFixed(1)}K` : `฿${totalSpend}` },
            { label: L("มาเล่น", "Visits"), value: `${playCount}` },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-base font-bold text-zinc-900">{s.value}</p>
              <p className="text-[11px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>

        {nextTierKey && nextThreshold !== null ? (
          <div className="mt-4">
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${spendPct}%`, background: tierColor }} />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              {L(`อีก ฿${spendRemaining.toLocaleString()} จะขึ้น ${TIER_LABEL[nextTierKey]}`, `฿${spendRemaining.toLocaleString()} more to reach ${TIER_LABEL[nextTierKey]}`)}
            </p>
          </div>
        ) : tierKey === "platinum" ? (
          <p className="text-[11px] font-semibold mt-4" style={{ color: tierColor }}>
            {L("Platinum — ระดับสูงสุดแล้ว", "Platinum — top tier")}
          </p>
        ) : null}
      </section>

      {/* ── เตือนให้กรอกเบอร์ — พนักงานใช้ค้นหาตอนบันทึกรอบเล่น ── */}
      {!profile.phone && (
        <Link href="/profile/edit"
          className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-amber-800 min-w-0">
            <span className="font-semibold">{L("ยังไม่ได้กรอกเบอร์โทร", "No phone number yet")}</span>
            {" — "}{L("พนักงานใช้ค้นหาคุณเมื่อเปิด QR ไม่ได้", "staff use it to find you if your QR won't open")}
          </p>
          <span className="text-xs font-semibold text-amber-800 underline flex-shrink-0">{L("กรอกเลย", "Add")}</span>
        </Link>
      )}

      {/* ── CARDLIST PASSPORT — ธีมทองเดียวกับหน้า /passport ── */}
      <div className="px-4 pt-4">
        <Link href="/passport"
          className="relative block overflow-hidden rounded-2xl bg-[#141414] px-5 py-5 ring-1 ring-[#a88c4a]/50 active:opacity-90">
          {/* วงรีทองโปร่ง (ลวดลายเดียวกับธีมอีเวนต์) */}
          <svg className="pointer-events-none absolute -right-10 -top-8 h-48 w-48 text-[#a88c4a] opacity-30" viewBox="0 0 200 200" fill="none" aria-hidden="true">
            <ellipse cx="100" cy="100" rx="90" ry="60" stroke="currentColor" />
            <ellipse cx="100" cy="100" rx="70" ry="44" stroke="currentColor" />
            <ellipse cx="100" cy="100" rx="50" ry="30" stroke="currentColor" />
          </svg>
          <div className="relative flex items-center gap-4">
            <img src="/images/passport/c-mark.png" alt="" className="h-12 w-12 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="font-cardlist font-normal text-[11px] tracking-[0.18em] text-[#a88c4a]">THE CARDLIST</p>
              <p className="font-cardlist font-normal text-[32px] leading-none tracking-[0.04em] bg-gradient-to-b from-[#f6e7bd] via-[#e9d29a] to-[#a88c4a] bg-clip-text text-transparent">
                PASSPORT
              </p>
            </div>
          </div>
          <p className="relative mt-3 text-[11px] text-zinc-400">
            {L("สะสมแสตมป์ในงานอีเวนต์ · ฉีกซองลุ้นรางวัล · Learn To Play ฟรี", "Collect event stamps · open reward packs · Learn To Play for free")}
          </p>
          <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#a88c4a]/70 px-3 py-1.5 text-xs font-semibold text-[#e9d29a]">
            {L("เปิดพาสปอร์ต", "Open passport")}
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </Link>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white border-y border-zinc-100 overflow-x-auto scrollbar-hide mt-4" role="tablist">
        {(["overview", "orders", "bookings", "qr"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { overview: L("เมนู", "Menu"), orders: L("สั่งซื้อ", "Orders"), bookings: L("จอง", "Bookings"), qr: "QR" };
          return (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 flex-shrink-0 text-xs px-4 py-3 border-b-2 transition-colors ${
                activeTab === t ? "border-zinc-900 text-zinc-900 font-semibold" : "border-transparent text-zinc-500"
              }`}
            >
              {labels[t]}
              {t === "orders" && orders.length > 0 && (
                <span className="ml-1 text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                  {orders.length}
                </span>
              )}
              {t === "bookings" && bookings.length > 0 && (
                <span className="ml-1 text-[10px] bg-zinc-900 text-white px-1.5 py-0.5 rounded-full">
                  {bookings.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="px-4 py-4">

        {/* MENU — รวมเป็นกลุ่ม แทนการ์ดแยกทีละอัน */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {[
              {
                title: L("บัญชีของฉัน", "My account"),
                items: [
                  { label: L("แก้ไขโปรไฟล์", "Edit profile"), href: "/profile/edit" },
                  { label: L("ประวัติการสั่งซื้อ", "Order history"), href: "/orders" },
                  { label: L("ที่อยู่จัดส่ง", "Shipping address"), href: "/profile/address" },
                  { label: L("สิทธิประโยชน์สมาชิก", "Member benefits"), href: "/profile/benefits" },
                  ...(FEATURES.collectionTracker ? [{ label: "Collection Tracker", href: "/profile/collection" }] : []),
                  ...(FEATURES.deckBuilder ? [{ label: "Deck Builder", href: "/profile/decks" }] : []),
                ],
              },
              {
                title: L("ความเป็นส่วนตัว", "Privacy"),
                items: [
                  { label: L("นโยบายความเป็นส่วนตัว", "Privacy policy"), href: "/privacy" },
                  { label: L("ลบบัญชี", "Delete account"), href: "/account/delete" },
                ],
              },
            ].map((group) => (
              <div key={group.title}>
                <p className="text-[11px] font-semibold text-zinc-500 px-1 mb-1.5">{group.title}</p>
                <div className="card divide-y divide-zinc-100 overflow-hidden">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href}
                      className="px-4 py-3.5 flex items-center justify-between active:bg-zinc-50">
                      <span className="text-sm text-zinc-900">{item.label}</span>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-400" aria-hidden="true">
                        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* ติดตั้งแอป — แถวเดียว (เดิมมีทั้งแบนเนอร์บนสุดและการ์ด 2 ปุ่ม) */}
            {!installed && (
              <div className="card px-4 py-3.5">
                <button onClick={handleInstall} className="w-full flex items-center justify-between gap-3 text-left">
                  <span className="flex items-center gap-3 min-w-0">
                    <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="rounded-lg flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm text-zinc-900">{L("ติดตั้งแอป", "Install the")} <span className="font-cardlist font-normal tracking-wide">The Cardlist</span>{L("", " app")}</span>
                      <span className="block text-[11px] text-zinc-500">{L("เปิดเร็วขึ้นจากหน้าจอหลัก", "Open faster from your home screen")}</span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 flex-shrink-0">{L("ติดตั้ง", "Install")}</span>
                </button>
                {showInstallHint && (
                  <p className="text-[11px] text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
                    {L('iPhone/iPad: กด Share ใน Safari → "Add to Home Screen" · Android/คอม: เปิดเมนูเบราว์เซอร์ → "ติดตั้งแอป"', 'iPhone/iPad: tap Share in Safari → "Add to Home Screen" · Android/desktop: open the browser menu → "Install app"')}
                  </p>
                )}
              </div>
            )}

            <FacebookFollowCard />

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn-outline w-full disabled:opacity-40"
            >
              {loggingOut ? L("กำลังออก...", "Logging out...") : L("ออกจากระบบ", "Log out")}
            </button>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-2">
            {orders.length > 0 && (
              <div className="card px-4 py-3 mb-2 flex items-center justify-between bg-zinc-50">
                <span className="text-[11px] text-zinc-500">{L("ยอดซื้อรวมทั้งหมด", "Total spend")}</span>
                <span className="text-sm font-bold text-zinc-900">฿{totalSpend.toLocaleString()}</span>
              </div>
            )}
            {orders.length === 0 ? (
              <div className="card px-5 py-10 text-center">
                <p className="text-sm text-zinc-500">{L("ยังไม่มีประวัติการสั่งซื้อ", "No orders yet")}</p>
                <Link href="/shop" className="mt-4 inline-block btn-primary px-6 py-2.5">{L("ไปที่ร้านค้า", "Go to shop")}</Link>
              </div>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-[11px] font-semibold text-zinc-500 tracking-wide font-mono">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status]}`}>
                      {(lang === "en" ? STATUS_LABEL_EN : STATUS_LABEL)[o.status]}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-900">{formatOrderItems(o.order_items, L)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-zinc-500">{formatDate(o.created_at, locale)}</p>
                    <p className="text-xs font-bold text-zinc-900">฿{Number(o.total_amount).toLocaleString()}</p>
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
                <p className="text-sm text-zinc-500">{L("ยังไม่มีการจองอีเวนต์", "No event bookings yet")}</p>
                <Link href="/events" className="mt-4 inline-block btn-primary px-6 py-2.5">{L("ดูอีเวนต์", "Browse events")}</Link>
              </div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-[11px] font-semibold text-zinc-500 tracking-wide font-mono">
                      #{b.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status]}`}>
                      {(lang === "en" ? STATUS_LABEL_EN : STATUS_LABEL)[b.status]}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-900">{b.events?.title ?? "—"}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {b.events?.date ? formatDate(b.events.date, locale) : "—"}
                    {b.events?.time ? ` · ${b.events.time.slice(0, 5)}` : ""}
                    {b.events?.location ? ` · ${b.events.location}` : ""}
                  </p>
                  <button
                    onClick={() => setActiveTab("qr")}
                    className="mt-3 text-[11px] border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 w-full text-center active:bg-zinc-50"
                  >
                    {L("ดู QR Code", "View QR code")}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* QR */}
        {activeTab === "qr" && (
          <div className="space-y-4">
            {/* ── QR ประจำตัวสมาชิก — ให้ staff สแกนทุกครั้งที่มาเล่น ── */}
            {profile?.member_code && (
              <div className="card px-5 py-5">
                <div className="text-center">
                  <p className="text-[10px] font-semibold text-zinc-500 tracking-widest mb-1">MEMBER QR</p>
                  <p className="text-xs text-zinc-500 mb-4">{L("ยื่นให้พนักงานสแกนทุกครั้งที่มาเล่น", "Show this to staff every time you play")}</p>
                  <QRCode value={profile.member_code} />
                  <p className="text-sm font-mono font-semibold text-zinc-900 mt-3 tracking-wider">{profile.member_code}</p>
                </div>

                {/* สะสมรอบเล่น */}
                <div className="mt-5 pt-4 border-t border-zinc-100">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className="text-[10px] font-semibold text-zinc-500 tracking-widest">{L("สะสมรอบเล่น", "PLAY STAMPS")}</p>
                    <p className="text-xs text-zinc-900"><span className="text-xl font-bold">{playCount}</span> {L("ครั้ง", playCount === 1 ? "visit" : "visits")}</p>
                  </div>

                  {stampRewards.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">{L("ยังไม่มีสิทธิ์พิเศษในช่วงนี้", "No rewards available right now")}</p>
                  ) : stampRewards.map((r) => {
                    const grant = myGrants.find((g) => g.reward_id === r.id);
                    const pct = Math.min(100, (playCount / r.required_visits) * 100);
                    const soldOut = r.quota != null && r.granted_count >= r.quota && !grant;
                    return (
                      <div key={r.id} className="mb-3 last:mb-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11px] text-zinc-600 leading-tight">{r.name}</p>
                          {grant ? (
                            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-widest ${
                              grant.status === "used" ? "bg-zinc-100 text-zinc-500" : "bg-green-50 text-green-700"}`}>
                              {grant.status === "used" ? L("ใช้แล้ว", "Used") : L("ได้สิทธิ์แล้ว", "Earned")}
                            </span>
                          ) : soldOut ? (
                            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-widest bg-red-50 text-red-600">{L("เต็มแล้ว", "Full")}</span>
                          ) : (
                            <span className="flex-shrink-0 text-[11px] text-zinc-500">{playCount}/{r.required_visits}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${grant ? "bg-green-600" : "bg-zinc-900"}`} style={{ width: `${pct}%` }} />
                        </div>
                        {r.quota != null && !grant && (
                          <p className="text-[10px] text-zinc-500 mt-1">{L(`เหลือ ${Math.max(0, r.quota - r.granted_count)} สิทธิ์จาก ${r.quota}`, `${Math.max(0, r.quota - r.granted_count)} of ${r.quota} left`)}</p>
                        )}
                      </div>
                    );
                  })}
                  {myGrants.some((g) => g.status === "granted") && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                      {L("🎁 คุณมีสิทธิ์ที่ยังไม่ได้ใช้ — แจ้งพนักงานหน้างานเพื่อใช้สิทธิ์ได้เลย", "🎁 You have an unused reward — ask staff in store to redeem it")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {genRegs.length === 0 && priorityTickets.length === 0 ? (
              <div className="card px-5 py-10 text-center">
                <p className="text-2xl mb-3">🎫</p>
                <p className="text-sm text-zinc-500">{L("ยังไม่มีบัตรเข้างาน", "No event tickets yet")}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{L("ลงทะเบียนเข้างานเพื่อรับ QR บัตรเข้างาน", "Register for an event to get your ticket QR")}</p>
              </div>
            ) : (
              <>
                {/* General Tickets */}
                {genRegs.map((g) => (
                  <div key={g.id} className="card px-5 py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-semibold">GENERAL</span>
                      <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{L("ฟรี", "FREE")}</span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-900 mb-0.5">{(g.events as any)?.title ?? "—"}</p>
                    <p className="text-[11px] text-zinc-500 mb-4">
                      {(g.events as any)?.date ? formatDate((g.events as any).date, locale) : ""} · {(g.events as any)?.location ?? ""}
                    </p>
                    <div className="flex justify-center mb-2">
                      <QRCode value={g.qr_code} />
                    </div>
                    <Barcode value={g.qr_code} />
                    <p className="text-[11px] text-center text-zinc-500 font-mono mt-2 mb-3">{g.qr_code}</p>
                    {/* สิทธิ์ — โชว์เฉพาะ event ที่เปิดสิทธิ์นี้ไว้ (general_perk_enabled) */}
                    {(g.events as any)?.general_perk_enabled !== false && (
                      <div className="bg-zinc-50 rounded-xl p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-zinc-500 tracking-widest uppercase">{L("สิทธิ์ของคุณ", "Your perks")}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">🎲</span>
                            <span className="text-[11px] text-zinc-700">{L("สิทธิ์ลุ้นซื้อ ชุด “30th CELEBRATION” FUTURISTIC RARE", "Chance to buy the “30th CELEBRATION” FUTURISTIC RARE set")}</span>
                          </div>
                          <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{L("ลุ้นหน้างาน", "Drawn on site")}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-500 text-center mt-3">{L("แสดง QR Code นี้หน้างานเพื่อใช้สิทธิ์", "Show this QR code at the event to redeem")}</p>
                  </div>
                ))}

                {/* Priority Tickets */}
                {priorityTickets.map((p) => (
                  <div key={p.id} className="card px-5 py-5 border-2 border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🥇 PRIORITY GUEST</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${p.status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-600"}`}>
                        {p.status === "approved" ? L("✓ อนุมัติแล้ว", "✓ Approved") : L("รอยืนยัน", "Pending")}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-900 mb-0.5">{(p.events as any)?.title ?? "—"}</p>
                    <p className="text-[11px] text-zinc-500 mb-4">
                      {(p.events as any)?.date ? formatDate((p.events as any).date, locale) : ""} · {(p.events as any)?.location ?? ""}
                    </p>
                    {p.status === "approved" && (
                      <>
                        <div className="flex justify-center mb-2">
                          <QRCode value={p.qr_code} />
                        </div>
                        <Barcode value={p.qr_code} />
                        <p className="text-[11px] text-center text-zinc-500 font-mono mt-2 mb-3">{p.qr_code}</p>
                      </>
                    )}
                    {/* สิทธิ์ */}
                    <div className="bg-amber-50 rounded-xl p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-zinc-500 tracking-widest uppercase">{L("สิทธิ์ของคุณ", "Your perks")}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">🎲</span>
                          <span className="text-[11px] text-zinc-700">{L("สิทธิ์ลุ้นซื้อ ชุด “30th CELEBRATION” FUTURISTIC RARE", "Chance to buy the “30th CELEBRATION” FUTURISTIC RARE set")}</span>
                        </div>
                        <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{L("ลุ้นหน้างาน", "Drawn on site")}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center mt-3">{L("แสดง QR Code นี้หน้างานเพื่อใช้สิทธิ์", "Show this QR code at the event to redeem")}</p>
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
