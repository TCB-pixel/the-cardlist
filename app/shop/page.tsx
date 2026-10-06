"use client";
import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase";
import { SHIPPING_FEE } from "@/lib/order-email";

// ─── Types ─────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  sub: string;
  price: number;
  stock: number;
  category: string;
  tcg: string;
  badge: string;
  rarity: string;
  image_url: string | null;
  images?: string[];
  badge_set_at?: string | null;
  description?: string | null;
};

type CartItem = { id: string; name: string; price: number; qty: number };

type LotteryInfo = {
  lotteryId: string;
  status: "open" | "drawn";
  quota: number;
  myEntry: { status: string; purchaseDeadline: string | null } | null;
};

// ─── Config ────────────────────────────────────────────────────────────────

const ALL_TCG        = "All";
const ALL_CAT        = "ทั้งหมด";
// NEW หายเองเมื่อครบ 14 วันนับจากวันที่ตั้ง badge
const NEW_BADGE_DAYS = 14;

function badgeOf(p: { badge: string; badge_set_at?: string | null }) {
  if (p.badge !== "NEW") return p.badge;
  if (!p.badge_set_at) return p.badge;
  const ageDays = (Date.now() - new Date(p.badge_set_at).getTime()) / 86400000;
  return ageDays > NEW_BADGE_DAYS ? "" : p.badge;
}
const BADGE_CLASS: Record<string, string> = {
  "PRE-ORDER": "badge-pre",
  "HOT":       "badge-hot",
  "NEW":       "badge-new",
  "RARE":      "badge-rare",
};
const TCG_COLOR: Record<string, string> = {
  "One Piece":   "#E24B4A",
  "Pokémon":     "#EF9F27",
  "MTG":         "#7F77DD",
  "Dragon Ball": "#1D9E75",
};

// ─── Placeholder card (no image) ──────────────────────────────────────────

function CardPlaceholder({ tcg }: { tcg: string }) {
  const color = TCG_COLOR[tcg] ?? "#888780";
  return (
    <div className="w-full aspect-[3/4] flex items-center justify-center bg-zinc-50">
      <svg width="44" height="58" viewBox="0 0 44 58" fill="none">
        <rect x="1" y="1" width="42" height="56" rx="4" stroke={color} strokeWidth="1.2" fill="none"/>
        <rect x="4" y="4" width="36" height="36" rx="2" fill={color} fillOpacity="0.07"/>
        <circle cx="22" cy="24" r="10" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1"/>
      </svg>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const supabase = createClient();

  const [products, setProducts]           = useState<Product[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState("All");
  const [activeCategory, setActiveCategory] = useState(ALL_CAT);
  const [detail, setDetail] = useState<Product | null>(null);
  const [sort, setSort]                   = useState("default");
  const [search, setSearch]               = useState("");
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [showCart, setShowCart]           = useState(false);
  const [toast, setToast]                 = useState<string | null>(null);
  const [lotteries, setLotteries]         = useState<Record<string, LotteryInfo>>({});
  const [requesting, setRequesting]       = useState<string | null>(null);

  // ── ตะกร้าค้างไว้แม้ refresh (localStorage) ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cardlist_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cardlist_cart", JSON.stringify(cart));
    } catch { /* ignore */ }
  }, [cart]);

  // แท็บมาจากสินค้าที่ขายอยู่จริง หมวดหมู่/TCG ที่แอดมินเพิ่มใหม่จึงโผล่เองโดยไม่ต้องแก้โค้ด
  const tcgTabs = useMemo(() => {
    const found = Array.from(new Set(products.map((p) => p.tcg).filter(Boolean)));
    return [ALL_TCG, ...found.filter((t) => t !== ALL_TCG).sort()];
  }, [products]);

  const categoryTabs = useMemo(() => {
    const found = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return [ALL_CAT, ...found.sort()];
  }, [products]);

  // ── Fetch products from Supabase ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("id, name, sub, description, price, stock, category, tcg, badge, badge_set_at, rarity, image_url, product_images(url, order)")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setProducts(((data ?? []) as any[]).map((p) => ({
        ...p,
        images: (p.product_images ?? [])
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
          .map((i: any) => i.url),
      })) as Product[]);
      setLoading(false);
    }
    load();
  }, []);

  // ── ดึงสถานะ lottery ("ขอสิทธิ์ซื้อ") ของสินค้าที่แสดงอยู่ ──
  async function loadLotteries(productIds: string[]) {
    if (productIds.length === 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/lottery?productIds=${productIds.join(",")}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json();
      if (data.lotteries) setLotteries(data.lotteries);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (products.length > 0) loadLotteries(products.map((p) => p.id));
  }, [products]);

  async function requestToBuy(p: Product) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("กรุณาเข้าสู่ระบบก่อนขอสิทธิ์ซื้อ");
      window.location.href = "/login";
      return;
    }
    setRequesting(p.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/lottery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ productId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "ขอสิทธิ์ไม่สำเร็จ");
      } else {
        await loadLotteries(products.map((pp) => pp.id));
      }
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setRequesting(null);
    }
  }

  // ── นับเวลาที่เหลือแบบคร่าวๆ (ชม.) จาก deadline ──
  function hoursLeft(deadline: string | null) {
    if (!deadline) return null;
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60));
  }

  const [checkingOut, setCheckingOut] = useState<"card" | "promptpay" | null>(null);

  // ── ชำระเงิน — แยกปุ่มบัตร (มีค่าธรรมเนียม 3% แจ้งชัดเจนก่อนกด) กับ PromptPay (ไม่มีค่าธรรมเนียม) ──
  async function startCheckout(paymentMethod: "card" | "promptpay") {
    setCheckingOut(paymentMethod);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("กรุณาเข้าสู่ระบบก่อนชำระเงิน");
        window.location.href = "/login";
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "shop",
          userId: user.id,
          email: user.email ?? null,
          paymentMethod,
          items: cart.map(i => ({
            id: i.id,
            name: i.name,
            price: i.price,
            qty: i.qty,
            image_url: products.find(p => p.id === i.id)?.image_url ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (data.url) {
        try { localStorage.removeItem("cardlist_cart"); } catch { /* ignore */ }
        window.location.href = data.url;
      } else {
        alert(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setCheckingOut(null);
    }
  }

  // ── Filter & sort ──
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeTab !== "All" && p.tcg !== activeTab) return false;
      if (activeCategory !== ALL_CAT && p.category !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.name ?? ""} ${p.sub ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sort === "price_asc")  return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return 0;
    });
  }, [products, activeTab, activeCategory, sort, search]);

  // ── Cart ──
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);
  // ค่าจัดส่งคิดต่อคำสั่งซื้อ ตะกร้าว่างไม่ต้องคิด
  const shippingFee = cart.length > 0 ? SHIPPING_FEE : 0;
  const cardFee = Math.round(totalPrice * 0.03);

  function addToCart(p: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) return prev; // ห้ามเกินสต็อก
        return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
    setToast(p.name);
    setTimeout(() => setToast(null), 2000);
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar
        rightSlot={
          <button onClick={() => setShowCart(true)} className="relative p-1">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 4h2.5l2 10h9l2-10H17" stroke="#0a0a0a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="8.5" cy="18" r="1.2" fill="#0a0a0a"/>
              <circle cx="15" cy="18" r="1.2" fill="#0a0a0a"/>
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        }
      />

      {/* Search */}
      <div className="bg-white px-4 pb-3 pt-2 border-b border-zinc-100">
        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="#a1a1aa" strokeWidth="1.2"/>
            <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="ค้นหาการ์ด, ชุด, สินค้า..."
            className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 flex-1 outline-none"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} className="text-zinc-400 text-xs">✕</button>}
        </div>
      </div>

      {/* TCG Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide bg-white border-b border-zinc-100">
        {tcgTabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 text-[11px] px-4 py-2.5 tracking-wide border-b-2 transition-colors ${
              activeTab === tab ? "border-zinc-900 text-zinc-900 font-semibold" : "border-transparent text-zinc-400"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3 bg-white">
        {categoryTabs.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 text-[10px] px-3 py-1.5 rounded-full border tracking-wide transition-colors ${
              activeCategory === cat ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-50">
        <p className="text-[11px] text-zinc-400">{loading ? "กำลังโหลด..." : `${filtered.length} รายการ`}</p>
        <select className="text-[11px] text-zinc-600 border border-zinc-100 rounded-lg px-2 py-1 bg-white outline-none"
          value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">เรียงตามค่าเริ่มต้น</option>
          <option value="price_asc">ราคา น้อย → มาก</option>
          <option value="price_desc">ราคา มาก → น้อย</option>
        </select>
      </div>

      {/* Product Grid */}
      <main className="px-4 pt-2 pb-4">
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="aspect-[3/4] bg-zinc-100" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-zinc-100 rounded w-3/4" />
                  <div className="h-2 bg-zinc-100 rounded w-1/2" />
                  <div className="h-4 bg-zinc-100 rounded w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 text-sm">
            {products.length === 0 ? "ยังไม่มีสินค้า" : "ไม่พบสินค้าที่ค้นหา"}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((p) => {
              const lot = lotteries[p.id];
              return (
              <div key={p.id} className="card overflow-hidden">
                {/* Product Image */}
                <div className="relative">
                  {badgeOf(p) && (
                    <span className={`absolute top-2 left-2 z-10 ${BADGE_CLASS[badgeOf(p)] ?? "badge-pre"}`}>
                      {badgeOf(p)}
                    </span>
                  )}
                  {lot && (
                    <span className="absolute top-2 right-2 z-10 text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white tracking-wide">
                      🎟️ ลุ้นสิทธิ์
                    </span>
                  )}
                  {p.image_url ? (
                    <div className="h-36 relative bg-zinc-50 overflow-hidden cursor-pointer" onClick={() => setDetail(p)}>
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        fill
                        className="object-contain p-2"
                        sizes="(max-width: 768px) 33vw, 20vw"
                      />
                    </div>
                  ) : (
                    <CardPlaceholder tcg={p.tcg} />
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p onClick={() => setDetail(p)}
                    className="text-[11px] font-semibold text-zinc-900 leading-snug line-clamp-2 cursor-pointer hover:underline">{p.name}</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight truncate">{p.sub}</p>
                  <p className="text-[13px] font-bold text-zinc-900 mt-2">฿{p.price.toLocaleString()}</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5">
                    {p.stock <= 0 ? "หมดสต็อก" : p.stock <= 3 ? `เหลือ ${p.stock} ใบ` : "มีสต็อก"}
                  </p>

                  {!lot ? (
                    <button
                      onClick={() => addToCart(p)}
                      disabled={p.stock <= 0}
                      className="mt-2 w-full text-[10px] bg-zinc-900 text-white rounded-lg py-1.5 tracking-wide active:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">
                      {p.stock <= 0 ? "หมดสต็อก" : "+ ตะกร้า"}
                    </button>
                  ) : lot.status === "open" ? (
                    lot.myEntry ? (
                      <button disabled className="mt-2 w-full text-[10px] bg-zinc-100 text-zinc-400 rounded-lg py-1.5 tracking-wide cursor-not-allowed">
                        ขอสิทธิ์แล้ว รอผล
                      </button>
                    ) : (
                      <button
                        onClick={() => requestToBuy(p)}
                        disabled={requesting === p.id}
                        className="mt-2 w-full text-[10px] bg-purple-600 text-white rounded-lg py-1.5 tracking-wide active:opacity-70 transition-opacity disabled:opacity-50">
                        {requesting === p.id ? "กำลังส่ง..." : "🎟️ ขอสิทธิ์ซื้อ"}
                      </button>
                    )
                  ) : lot.myEntry?.status === "won" && hoursLeft(lot.myEntry.purchaseDeadline) !== 0 ? (
                    <>
                      <p className="text-[9px] text-purple-600 font-semibold mt-2">
                        🎉 ได้สิทธิ์! เหลือ {hoursLeft(lot.myEntry.purchaseDeadline)} ชม.
                      </p>
                      <button
                        onClick={() => addToCart(p)}
                        disabled={p.stock <= 0}
                        className="mt-1 w-full text-[10px] bg-purple-600 text-white rounded-lg py-1.5 tracking-wide active:opacity-70 transition-opacity disabled:opacity-30">
                        {p.stock <= 0 ? "หมดสต็อก" : "+ ตะกร้า"}
                      </button>
                    </>
                  ) : lot.myEntry?.status === "purchased" ? (
                    <button disabled className="mt-2 w-full text-[10px] bg-zinc-100 text-zinc-400 rounded-lg py-1.5 tracking-wide cursor-not-allowed">
                      ซื้อแล้ว
                    </button>
                  ) : (
                    <button disabled className="mt-2 w-full text-[10px] bg-zinc-100 text-zinc-400 rounded-lg py-1.5 tracking-wide cursor-not-allowed">
                      {lot.myEntry?.status === "won" ? "หมดเวลาซื้อ" : "พลาดสิทธิ์รอบนี้"}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-x-0 bottom-16 z-50 flex flex-col justify-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "60vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 flex-shrink-0">
              <h3 className="text-sm font-semibold text-zinc-900">ตะกร้าสินค้า ({totalItems})</h3>
              <button onClick={() => setShowCart(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>
            {/* Items - scrollable */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-sm text-zinc-400 py-8">ตะกร้าว่างอยู่</p>
              ) : cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">฿{item.price.toLocaleString()} × {item.qty}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-zinc-900">฿{(item.price * item.qty).toLocaleString()}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-zinc-300 hover:text-red-400 text-sm">✕</button>
                  </div>
                </div>
              ))}
            </div>
            {/* Checkout - always visible at bottom */}
            <div className="flex-shrink-0 px-5 pt-3 pb-6 border-t border-zinc-100 bg-white">
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">ยอดสินค้า</span>
                  <span className="text-xs text-zinc-700">฿{totalPrice.toLocaleString()}</span>
                </div>
                {shippingFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">ค่าบริการจัดส่ง</span>
                    <span className="text-xs text-zinc-700">฿{shippingFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100">
                  <span className="text-xs font-semibold text-zinc-700">รวม</span>
                  <span className="text-base font-bold text-zinc-900">฿{(totalPrice + shippingFee).toLocaleString()}</span>
                </div>
              </div>
              {cart.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => startCheckout("promptpay")}
                    disabled={checkingOut !== null}
                    className="btn-primary w-full py-3.5 text-center text-sm font-semibold disabled:opacity-50">
                    {checkingOut === "promptpay" ? "กำลังไปหน้าชำระเงิน..." : `ชำระผ่าน PromptPay — ฿${(totalPrice + shippingFee).toLocaleString()} (ไม่มีค่าธรรมเนียมบัตร)`}
                  </button>
                  <button
                    onClick={() => startCheckout("card")}
                    disabled={checkingOut !== null}
                    className="w-full py-3.5 text-center text-sm font-semibold rounded-xl border border-zinc-200 text-zinc-700 active:opacity-70 transition-opacity disabled:opacity-50">
                    {checkingOut === "card"
                      ? "กำลังไปหน้าชำระเงิน..."
                      : `ชำระด้วยบัตรเครดิต/เดบิต — ฿${(totalPrice + shippingFee + cardFee).toLocaleString()}`}
                  </button>
                  <p className="text-[10px] text-zinc-400 text-center">
                    ค่าบริการจัดส่ง ฿{SHIPPING_FEE.toLocaleString()} ต่อคำสั่งซื้อ · การชำระด้วยบัตรมีค่าธรรมเนียม 3% ของยอดสินค้า (ธนาคาร/เครือข่ายบัตรเรียกเก็บ) แสดงแยกให้เห็นชัดเจนก่อนชำระเงินเสมอ
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] animate-bounce-in">
          <div className="bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 whitespace-nowrap">
            <span>🛒</span>
            <span>เพิ่ม "{toast.length > 20 ? toast.slice(0, 20) + "..." : toast}" ลงตะกร้าแล้ว</span>
            <span className="text-green-400">✓</span>
          </div>
        </div>
      )}

      {/* ── รายละเอียดสินค้า + แกลเลอรีรูป ── */}
      {detail && (
        <ProductDetail
          product={detail}
          lottery={lotteries[detail.id]}
          onClose={() => setDetail(null)}
          onAdd={() => { addToCart(detail); setDetail(null); }}
        />
      )}

      <BottomNav />
    </div>
  );
}

// ─── รายละเอียดสินค้า ────────────────────────────────────────────────────────

function ProductDetail({ product, lottery, onClose, onAdd }: {
  product: Product;
  lottery?: LotteryInfo;
  onClose: () => void;
  onAdd: () => void;
}) {
  // รูปปกมาก่อน แล้วตามด้วยรูปเพิ่มเติม
  const gallery = [product.image_url, ...(product.images ?? [])].filter(Boolean) as string[];
  const [active, setActive] = useState(0);
  const badge = badgeOf(product);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* รูปใหญ่ */}
        <div className="relative aspect-square bg-zinc-50">
          {gallery.length > 0 ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={gallery[active]} alt={product.name} className="w-full h-full object-contain p-4" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-300">🃏</div>
          )}
          {badge && (
            <span className={`absolute top-3 left-3 ${BADGE_CLASS[badge] ?? "badge-pre"}`}>{badge}</span>
          )}
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-zinc-600 flex items-center justify-center text-lg leading-none">
            ×
          </button>
        </div>

        {/* รูปย่อย — โชว์เมื่อมีมากกว่า 1 รูป */}
        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-3">
            {gallery.map((url, i) => (
              <button key={url} onClick={() => setActive(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === active ? "border-zinc-900" : "border-zinc-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-4">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded tracking-wider">{product.tcg}</span>
            <span className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded tracking-wider">{product.category}</span>
            {product.rarity && <span className="badge-rare">{product.rarity}</span>}
          </div>

          <h2 className="text-base font-semibold text-zinc-900 leading-snug">{product.name}</h2>
          {product.sub && <p className="text-[11px] text-zinc-400 mt-0.5">{product.sub}</p>}

          <p className="text-xl font-bold text-zinc-900 mt-3">฿{product.price.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {product.stock <= 0 ? "หมดสต็อก" : product.stock <= 3 ? `เหลือ ${product.stock} ชิ้น` : "มีสต็อก"}
          </p>

          {product.description && (
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <p className="text-[9px] text-zinc-400 tracking-widest font-semibold mb-1.5">รายละเอียด</p>
              <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {lottery ? (
            <p className="mt-4 text-center text-[11px] text-purple-700 bg-purple-50 border border-purple-100 rounded-xl py-2.5">
              🎟️ สินค้านี้ต้องขอสิทธิ์ซื้อ — กดที่ปุ่มในหน้ารายการสินค้า
            </p>
          ) : (
            <button onClick={onAdd} disabled={product.stock <= 0}
              className="mt-4 w-full bg-zinc-900 text-white text-xs font-semibold py-3 rounded-xl active:opacity-70 disabled:opacity-30">
              {product.stock <= 0 ? "หมดสต็อก" : "+ เพิ่มลงตะกร้า"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
