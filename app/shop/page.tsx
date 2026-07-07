"use client";
import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase";

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
};

type CartItem = { id: string; name: string; price: number; qty: number };

// ─── Config ────────────────────────────────────────────────────────────────

const TCG_TABS       = ["All", "One Piece", "Pokémon", "MTG", "Dragon Ball"];
const CATEGORIES     = ["ทั้งหมด", "Sealed Box", "Single Cards", "Pre-order", "Accessories"];
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
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [sort, setSort]                   = useState("default");
  const [search, setSearch]               = useState("");
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [showCart, setShowCart]           = useState(false);
  const [toast, setToast]                 = useState<string | null>(null);

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

  // ── Fetch products from Supabase ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("id, name, sub, price, stock, category, tcg, badge, rarity, image_url")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Filter & sort ──
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeTab !== "All" && p.tcg !== activeTab) return false;
      if (activeCategory !== "ทั้งหมด" && p.category !== activeCategory) return false;
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
        {TCG_TABS.map((tab) => (
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
        {CATEGORIES.map((cat) => (
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
            {filtered.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                {/* Product Image */}
                <div className="relative">
                  {p.badge && (
                    <span className={`absolute top-2 left-2 z-10 ${BADGE_CLASS[p.badge] ?? "badge-pre"}`}>
                      {p.badge}
                    </span>
                  )}
                  {p.image_url ? (
                    <div className="h-36 relative bg-zinc-50 overflow-hidden">
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
                  <p className="text-[11px] font-semibold text-zinc-900 leading-snug line-clamp-2">{p.name}</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight truncate">{p.sub}</p>
                  <p className="text-[13px] font-bold text-zinc-900 mt-2">฿{p.price.toLocaleString()}</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5">
                    {p.stock <= 0 ? "หมดสต็อก" : p.stock <= 3 ? `เหลือ ${p.stock} ใบ` : "มีสต็อก"}
                  </p>
                  <button
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                    className="mt-2 w-full text-[10px] bg-zinc-900 text-white rounded-lg py-1.5 tracking-wide active:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">
                    {p.stock <= 0 ? "หมดสต็อก" : "+ ตะกร้า"}
                  </button>
                </div>
              </div>
            ))}
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
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500">รวมทั้งหมด</span>
                <span className="text-base font-bold text-zinc-900">฿{totalPrice.toLocaleString()}</span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={async () => {
                    try {
                      // ต้องล็อกอินก่อนชำระเงิน — webhook ใช้ user_id ผูก order
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
                      }
                      else alert(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                    } catch {
                      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
                    }
                  }}
                  className="btn-primary w-full py-3.5 text-center text-sm font-semibold">
                  ชำระเงินผ่าน Stripe →
                </button>
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

      <BottomNav />
    </div>
  );
}
