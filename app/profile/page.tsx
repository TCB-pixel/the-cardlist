"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile, Booking, Event } from "@/lib/types";
import { getTier, getNextTier, TIER_LABEL, TIER_COLOR } from "@/lib/tiers";
import BottomNav from "@/components/BottomNav";

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

const PACK_PRICE = 49;

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

type Tab = "overview" | "orders" | "bookings" | "qr" | "coupon";

type Coupon = {
  campaign_id: string;
  code: string;
  partner_name: string;
  title: string;
  subtitle: string | null;
  discount_type: "fixed" | "percent";
  discount_value: number;
  terms: string | null;
  usage_limit: number;
  used_count: number;
  status: "active" | "used";
};

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
  const name = first.name ?? "สินค้า";
  const qty = first.qty;
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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [totalSpend, setTotalSpend] = useState(0);
  const [fetchError, setFetchError] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loggingOut, setLoggingOut] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showLineBanner, setShowLineBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  // ── Inline Booster Pack payment (PromptPay) ──
  const [payReg, setPayReg] = useState<GenReg | null>(null);   // reg ที่กำลังจ่าย / เปิด overlay
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [payQrImage, setPayQrImage] = useState<string | null>(null);
  const [payIntentId, setPayIntentId] = useState("");
  const [payDone, setPayDone] = useState(false);
  const payPollRef = useRef<NodeJS.Timeout | null>(null);

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

      // 8) Coupons (per-user) — โชว์เฉพาะคนที่ลงทะเบียนเข้างานแล้ว
      const isRegistered = (genWithEvents?.length ?? 0) > 0 || (priorityWithEvents?.length ?? 0) > 0;
      if (isRegistered) {
        // แจกคูปองให้ user ปัจจุบัน (idempotent)
        await supabase.rpc("ensure_my_coupons");

        const [{ data: campRows }, { data: ucRows }] = await Promise.all([
          supabase
            .from("coupon_campaigns")
            .select("id, code, partner_name, title, subtitle, discount_type, discount_value, terms, usage_limit, used_count")
            .eq("is_active", true),
          supabase
            .from("user_coupons")
            .select("campaign_id, status")
            .eq("user_id", userId),
        ]);

        const ucMap = new Map((ucRows ?? []).map((u: any) => [u.campaign_id, u.status]));
        const merged: Coupon[] = (campRows ?? [])
          .filter((c: any) => ucMap.has(c.id))
          .map((c: any) => ({
            campaign_id: c.id,
            code: c.code,
            partner_name: c.partner_name,
            title: c.title,
            subtitle: c.subtitle,
            discount_type: c.discount_type,
            discount_value: c.discount_value,
            terms: c.terms,
            usage_limit: c.usage_limit,
            used_count: c.used_count,
            status: (ucMap.get(c.id) as "active" | "used") ?? "active",
          }));
        setCoupons(merged);
      } else {
        setCoupons([]);
      }

    } catch (err: any) {
      setFetchError(err?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── เคลียร์ poll เมื่อออกจากหน้า ──
  useEffect(() => () => { if (payPollRef.current) clearInterval(payPollRef.current); }, []);

  // ── ซื้อ Booster Pack ราคาป้าย → สร้าง QR PromptPay แล้วโชว์ overlay จ่ายเงินในหน้านี้เลย ──
  async function handleBuyPack(g: GenReg) {
    if (payLoading) return;
    setPayError("");
    setPayDone(false);
    setPayQrImage(null);
    setPayIntentId("");
    setPayReg(g);          // เปิด overlay (สถานะ loading)
    setPayLoading(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { router.push("/login"); return; }

      const res = await fetch("/api/stripe/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: PACK_PRICE,
          description: `Booster Pack ราคาป้าย — ${(g.events as any)?.title ?? "Event"}`,
          paymentMethod: "promptpay",
          email: (profile as any)?.email ?? user.email ?? "guest@thecardlist.com",

          // metadata เดียวกับหน้า ticket — webhook ใช้ผูก payment กับ general_registrations
          metadata: {
            type: "general_pack",
            user_id: user.id,
            reg_id: g.id,
            event_id: g.event_id,
          },
          userId: user.id,
          eventId: g.event_id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPayIntentId(data.paymentIntentId);
      setPayQrImage(data.qrImage);

      payPollRef.current = setInterval(async () => {
        const s = await fetch(`/api/stripe/charge?paymentIntentId=${data.paymentIntentId}`);
        const sd = await s.json();
        if (sd.status === "succeeded") {
          if (payPollRef.current) clearInterval(payPollRef.current);
          setPayDone(true);
          loadData();   // refresh pack_paid → การ์ดอัพเดทเป็น "ชำระแล้ว"
        } else if (sd.status === "canceled" || sd.status === "requires_payment_method") {
          if (payPollRef.current) clearInterval(payPollRef.current);
          setPayError("การชำระเงินล้มเหลว กรุณาลองใหม่");
        }
      }, 3000);
    } catch (err: any) {
      setPayError(err?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setPayLoading(false);
    }
  }

  function closePay() {
    if (payPollRef.current) clearInterval(payPollRef.current);
    payPollRef.current = null;
    setPayReg(null);
    setPayQrImage(null);
    setPayIntentId("");
    setPayError("");
    setPayDone(false);
    setPayLoading(false);
  }

  // ── Logout ──
  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ── ใช้สิทธิ์คูปอง (สตาฟกดบนจอลูกค้า) ──
  async function redeemCoupon(c: Coupon) {
    if (redeeming) return;
    const discount = c.discount_type === "percent" ? `${c.discount_value}%` : `฿${c.discount_value}`;
    if (!window.confirm(`ยืนยันใช้สิทธิ์ ${c.partner_name} ส่วนลด ${discount}?\nใช้แล้วกดซ้ำไม่ได้`)) return;

    setRedeeming(c.code);
    try {
      const { data, error } = await supabase.rpc("redeem_my_coupon", { p_code: c.code });
      const row: any = Array.isArray(data) ? data[0] : data;

      if (error || !row?.success) {
        const reason = row?.reason;
        if (reason === "already_used") window.alert("คูปองนี้ถูกใช้ไปแล้ว");
        else if (reason === "limit_reached") window.alert("สิทธิ์เต็ม 200 ใบแล้ว");
        else window.alert("ใช้สิทธิ์ไม่สำเร็จ ลองใหม่อีกครั้ง");
        // ดึงสถานะล่าสุดกลับมา
        if (reason === "already_used") {
          setCoupons((prev) => prev.map((x) => x.code === c.code ? { ...x, status: "used" } : x));
        } else if (reason === "limit_reached") {
          setCoupons((prev) => prev.map((x) => x.code === c.code ? { ...x, used_count: x.usage_limit } : x));
        }
        return;
      }

      // สำเร็จ → อัปเดตการ์ดเป็น "ใช้แล้ว" + ตัวนับรวม
      const usedCount = row.usage_limit - (row.remaining ?? 0);
      setCoupons((prev) =>
        prev.map((x) => x.code === c.code ? { ...x, status: "used", used_count: usedCount } : x)
      );
    } catch {
      window.alert("ใช้สิทธิ์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setRedeeming(null);
    }
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

  // Tier คำนวณสดจากยอดซื้อสะสมจริง (ไม่ใช้ profiles.tier ที่เป็นค่า static)
  const tierKey = getTier(totalSpend);
  const tierColor = TIER_COLOR[tierKey];
  const tierLabel = TIER_LABEL[tierKey];
  const { next: nextTierKey, nextThreshold } = getNextTier(tierKey);
  const ptsPct = Math.min(Math.round((profile.points / 2000) * 100), 100);
  const spendPct = nextThreshold ? Math.min(Math.round((totalSpend / nextThreshold) * 100), 100) : 100;
  const spendRemaining = nextThreshold ? Math.max(nextThreshold - totalSpend, 0) : 0;

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
              <span className="w-2 h-2 rounded-full" style={{ background: tierColor }} />
              <span className="text-[10px] font-semibold tracking-widest" style={{ color: tierColor }}>
                {tierLabel.toUpperCase()} MEMBER
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
        {nextTierKey && (
          <div className="mb-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-zinc-500 font-medium">Points: {tierLabel} → {TIER_LABEL[nextTierKey]}</span>
              <span className="text-[11px] text-zinc-400">{profile.points.toLocaleString()} / 2,000</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ptsPct}%`, background: tierColor }} />
            </div>
          </div>
        )}

        {/* Spend progress */}
        {nextTierKey && nextThreshold !== null && (
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-zinc-500 font-medium">ยอดซื้อสะสม → {TIER_LABEL[nextTierKey]}</span>
              <span className="text-[11px] text-zinc-400">฿{totalSpend.toLocaleString()} / ฿{nextThreshold.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${spendPct}%`, background: tierColor }} />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              อีก ฿{spendRemaining.toLocaleString()} จะขึ้น {TIER_LABEL[nextTierKey]}
            </p>
          </div>
        )}

        {tierKey === "platinum" && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: tierColor }} />
            <p className="text-[11px] font-semibold" style={{ color: tierColor }}>
              Platinum — ระดับสูงสุด 🎉
            </p>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white border-b border-zinc-100 overflow-x-auto scrollbar-hide">
        {(["overview", "orders", "bookings", "qr", "coupon"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { overview: "ภาพรวม", orders: "สั่งซื้อ", bookings: "จอง", qr: "QR", coupon: "คูปอง" };
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
              {t === "coupon" && coupons.length > 0 && (genRegs.length > 0 || priorityTickets.length > 0) && (
                <span className="ml-1 text-[9px] bg-pink-500 text-white px-1.5 py-0.5 rounded-full">
                  {coupons.length}
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
              { label: "ประวัติการสั่งซื้อ",   href: "/orders" },
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
                            onClick={() => handleBuyPack(g)}
                            disabled={payLoading && payReg?.id === g.id}
                            className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {payLoading && payReg?.id === g.id ? "กำลังสร้าง QR..." : "🛍️ ซื้อ Booster Pack ราคาป้าย ฿49"}
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

        {/* COUPON */}
        {activeTab === "coupon" && (
          <div className="space-y-4">
            {(genRegs.length === 0 && priorityTickets.length === 0) ? (
              <div className="card px-5 py-10 text-center">
                <p className="text-2xl mb-3">🎟️</p>
                <p className="text-sm text-zinc-400">ยังไม่มีคูปอง</p>
                <p className="text-[11px] text-zinc-400 mt-1">ลงทะเบียนเข้างานเพื่อรับคูปองจากพาร์ทเนอร์</p>
                <Link href="/events" className="mt-4 inline-block btn-primary px-6 py-2.5">ดูอีเวนต์</Link>
              </div>
            ) : (
              <>
                {/* คูปอง Photopia (ดิจิทัล · สตาฟกดใช้บนจอลูกค้า) */}
                {coupons.map((c) => {
                  const remaining = Math.max(0, (c.usage_limit || 0) - (c.used_count || 0));
                  const isFull = remaining <= 0;
                  const isUsed = c.status === "used";
                  const discount = c.discount_type === "percent" ? `${c.discount_value}%` : `฿${c.discount_value}`;
                  const banner = c.partner_name === "Photopia" ? "/coupons/photopia.png" : null;
                  return (
                    <div key={c.code} className="rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
                      {banner ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={banner} alt={c.title} className={`w-full h-auto block ${isUsed ? "grayscale opacity-60" : ""}`} />
                      ) : (
                        <div className="px-5 pt-5">
                          <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-semibold">🎟️ {c.partner_name}</span>
                          <div className="flex items-baseline gap-1.5 mt-2">
                            <span className="text-2xl font-extrabold text-zinc-900">{discount}</span>
                            <span className="text-xs text-zinc-400">ส่วนลด</span>
                          </div>
                          <p className="text-xs font-semibold text-zinc-900">{c.title}</p>
                        </div>
                      )}

                      <div className="px-4 py-3 border-t border-zinc-100">
                        {isUsed ? (
                          <div className="flex items-center justify-center gap-2 py-1.5">
                            <span className="text-green-600 text-base">✅</span>
                            <span className="text-sm font-bold text-green-700">ใช้สิทธิ์แล้ว</span>
                          </div>
                        ) : isFull ? (
                          <div className="text-center text-sm font-bold text-zinc-400 py-1.5">สิทธิ์เต็ม 200 ใบแล้ว</div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] text-zinc-400">เหลือ {remaining}/{c.usage_limit} สิทธิ์</span>
                              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">พร้อมใช้</span>
                            </div>
                            <button
                              onClick={() => redeemCoupon(c)}
                              disabled={redeeming === c.code}
                              className="w-full rounded-xl bg-pink-600 py-3.5 text-base font-bold text-white active:scale-[0.99] disabled:opacity-50"
                            >
                              {redeeming === c.code ? "กำลังใช้สิทธิ์..." : "ให้สตาฟกดใช้สิทธิ์"}
                            </button>
                            <p className="text-[9px] text-zinc-400 text-center mt-2">ยื่นจอนี้ให้สตาฟที่บูธ {c.partner_name} กดใช้สิทธิ์</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* คูปองกระดาษ (รับที่จุดลงทะเบียน · โชว์ภาพอย่างเดียว) */}
                <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/coupons/restaurant.jpg" alt="คูปองส่วนลดร้านอาหาร ฿100" className="w-full h-auto block" />
                  <p className="text-[10px] text-zinc-400 text-center py-2">🧾 คูปองกระดาษ · รับได้ที่จุดลงทะเบียนหน้างาน</p>
                </div>

                <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/coupons/loft.jpg" alt="LOFT ส่วนลด ฿200" className="w-full h-auto block" />
                  <p className="text-[10px] text-zinc-400 text-center py-2">🧾 คูปองกระดาษ · รับได้ที่จุดลงทะเบียนหน้างาน</p>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* ─── Overlay: จ่ายเงิน Booster Pack (PromptPay) ─── */}
      {payReg && (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col">
          <header className="sticky top-0 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 h-12 flex-shrink-0">
            <button onClick={closePay} className="text-zinc-400" aria-label="ปิด">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-sm font-semibold text-zinc-900">{payDone ? "ชำระเงินสำเร็จ" : "สแกนจ่าย PromptPay"}</span>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col items-center">
            {payDone ? (
              <div className="w-full max-w-xs flex flex-col items-center text-center pt-4">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-5">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M6 14l6 6L22 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-zinc-900 mb-2">ชำระเงินสำเร็จ!</h2>
                <p className="text-sm text-zinc-400 mb-6">สิทธิ์ซื้อ Booster Pack ราคาป้าย 1 ซองพร้อมแล้ว</p>
                <div className="bg-zinc-50 rounded-2xl p-4 w-full mb-6 text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[11px] text-zinc-400">งาน</span>
                    <span className="text-[11px] font-semibold text-zinc-900">{(payReg.events as any)?.title ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-zinc-400">สิทธิ์</span>
                    <span className="text-[11px] font-semibold text-green-700">🛍️ Booster Pack ราคาป้าย 1 ซอง ✅</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-zinc-400">วิธีรับ</span>
                    <span className="text-[11px] text-zinc-600">แสดง QR Code หน้างาน</span>
                  </div>
                </div>
                <button onClick={closePay} className="btn-primary w-full py-3.5">เสร็จสิ้น →</button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <p className="text-[11px] text-zinc-400 mb-1">ชำระผ่าน PromptPay</p>
                  <p className="text-3xl font-bold text-zinc-900">฿{PACK_PRICE}</p>
                  <p className="text-xs text-zinc-400 mt-1">Booster Pack ราคาป้าย — {(payReg.events as any)?.title ?? ""}</p>
                </div>
                <div className="bg-white border-2 border-zinc-100 rounded-3xl p-6 mb-6 w-full max-w-xs">
                  {payQrImage ? (
                    <Image src={payQrImage} alt="PromptPay QR" width={240} height={240} className="w-full" unoptimized />
                  ) : (
                    <div className="w-full aspect-square bg-zinc-100 rounded-2xl animate-pulse" />
                  )}
                  <p className="text-center text-[11px] text-zinc-400 mt-3">สแกนด้วยแอปธนาคารหรือ Wallet</p>
                </div>
                {!payError && (
                  <div className="w-full max-w-xs bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                      <p className="text-xs font-semibold text-amber-800">รอการชำระเงิน...</p>
                    </div>
                    <p className="text-[10px] text-amber-600">ระบบจะอัพเดทอัตโนมัติหลังจ่ายเสร็จ</p>
                  </div>
                )}
                {payError && (
                  <div className="w-full max-w-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
                    <p className="text-[11px] text-red-600 text-center">{payError}</p>
                    <button onClick={() => handleBuyPack(payReg)} className="w-full mt-2 text-[11px] font-bold text-red-700 underline">
                      ลองสร้าง QR ใหม่
                    </button>
                  </div>
                )}
                {payIntentId && (
                  <div className="w-full max-w-xs bg-zinc-50 rounded-2xl p-3 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">ยอดชำระ</span>
                      <span className="font-semibold text-zinc-900">฿{PACK_PRICE}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">Payment ID</span>
                      <span className="font-mono text-zinc-500 text-[9px]">{payIntentId.slice(0, 16)}...</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
