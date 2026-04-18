"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

const TCG_TABS = ["All", "One Piece", "Pokémon", "MTG", "Dragon Ball"];
const CATEGORIES = ["ทั้งหมด", "Sealed Box", "Single Cards", "Pre-order", "Accessories"];

const TCG_MAP: Record<string, string> = {
  "All": "", "One Piece": "onepiece", "Pokémon": "pokemon", "MTG": "mtg", "Dragon Ball": "dragonball"
};

const PRODUCTS = [
  { id: "1", name: "Booster Box OP-10", sub: "One Piece TCG", price: 3200, stock: 20, category: "Pre-order", tcg: "One Piece", badge: "PRE-ORDER", rarity: null, color: "#E24B4A", shape: "box" },
  { id: "2", name: "Monkey D. Luffy SEC", sub: "One Piece — OP-01", price: 4200, stock: 2, category: "Single Cards", tcg: "One Piece", badge: "HOT", rarity: "Secret Rare", color: "#E24B4A", shape: "circle" },
  { id: "3", name: "Roronoa Zoro SR", sub: "One Piece — OP-01", price: 1200, stock: 5, category: "Single Cards", tcg: "One Piece", badge: null, rarity: "Super Rare", color: "#E24B4A", shape: "diamond" },
  { id: "4", name: "Booster Box SV8a", sub: "Pokémon TCG", price: 2800, stock: 15, category: "Sealed Box", tcg: "Pokémon", badge: "NEW", rarity: null, color: "#EF9F27", shape: "box" },
  { id: "5", name: "Charizard ex SAR", sub: "Pokémon — 151", price: 1850, stock: 3, category: "Single Cards", tcg: "Pokémon", badge: "HOT", rarity: "Super Rare", color: "#EF9F27", shape: "flame" },
  { id: "6", name: "Pikachu ex SAR", sub: "Pokémon — SV", price: 2800, stock: 1, category: "Single Cards", tcg: "Pokémon", badge: "HOT", rarity: "Super Rare", color: "#EF9F27", shape: "circle" },
  { id: "7", name: "Black Lotus LP", sub: "MTG — Alpha", price: 120000, stock: 1, category: "Single Cards", tcg: "MTG", badge: "RARE", rarity: "Secret Rare", color: "#7F77DD", shape: "diamond" },
  { id: "8", name: "Oko, Thief of Crowns Foil", sub: "MTG — ELD", price: 4500, stock: 4, category: "Single Cards", tcg: "MTG", badge: "NEW", rarity: "Rare", color: "#7F77DD", shape: "triangle" },
  { id: "9", name: "Sol Ring Borderless", sub: "MTG — Commander", price: 980, stock: 6, category: "Single Cards", tcg: "MTG", badge: null, rarity: "Uncommon", color: "#7F77DD", shape: "star" },
  { id: "10", name: "Son Goku SPR", sub: "Dragon Ball SCG", price: 890, stock: 8, category: "Single Cards", tcg: "Dragon Ball", badge: null, rarity: "Super Rare", color: "#1D9E75", shape: "star" },
  { id: "11", name: "Booster Box FB01", sub: "Dragon Ball SCG", price: 2200, stock: 10, category: "Sealed Box", tcg: "Dragon Ball", badge: "NEW", rarity: null, color: "#1D9E75", shape: "box" },
  { id: "12", name: "Card Sleeve (100pcs)", sub: "Accessories", price: 180, stock: 50, category: "Accessories", tcg: "All", badge: null, rarity: null, color: "#888780", shape: "box" },
];

const BADGE_CLASS: Record<string, string> = {
  "PRE-ORDER": "badge-pre",
  "HOT": "badge-hot",
  "NEW": "badge-new",
  "RARE": "badge-rare",
};

function CardArt({ shape, color }: { shape: string; color: string }) {
  const s = { stroke: color, fill: "none", strokeWidth: 1.2 };
  const W = 40; const H = 54;
  const card = <rect x="1" y="1" width={W-2} height={H-2} rx="3" {...s} />;
  const bg = <rect x="4" y="4" width={W-8} height={H-16} rx="2" fill={color} fillOpacity={0.07} stroke="none" />;
  let inner = null;
  if (shape === "circle") inner = <circle cx={W/2} cy={H/2-4} r="11" fill={color} fillOpacity={0.12} {...s} />;
  else if (shape === "diamond") inner = <polygon points={`${W/2},10 ${W-6},${H/2-4} ${W/2},${H-18} 6,${H/2-4}`} fill={color} fillOpacity={0.1} {...s} />;
  else if (shape === "flame") inner = <path d={`M${W/2} 10 C${W/2} 10 ${W-8} 20 ${W-9} 30 C${W-10} 38 10 38 10 30 C10 22 ${W/2} 10 ${W/2} 10Z`} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1} />;
  else if (shape === "triangle") inner = <polygon points={`${W/2},8 ${W-6},${H-18} 6,${H-18}`} fill={color} fillOpacity={0.1} {...s} />;
  else if (shape === "star") inner = <polygon points={`${W/2},8 ${W/2+4},17 ${W-6},17 ${W/2+7},23 ${W/2+4},32 ${W/2},26 ${W/2-4},32 ${W/2-7},23 6,17 ${W/2-4},17`} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1} />;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>{card}{bg}{inner}</svg>
  );
}

type CartItem = { id: string; name: string; price: number; qty: number };

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [sort, setSort] = useState("default");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      if (activeTab !== "All" && p.tcg !== activeTab) return false;
      if (activeCategory !== "ทั้งหมด" && p.category !== activeCategory) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sub.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return 0;
    });
  }, [activeTab, activeCategory, sort, search]);

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function addToCart(p: typeof PRODUCTS[0]) {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
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
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{totalItems}</span>
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
          <input type="text" placeholder="ค้นหาการ์ด, ชุด, สินค้า..." className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 flex-1 outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} className="text-zinc-400 text-xs">✕</button>}
        </div>
      </div>

      {/* TCG Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide bg-white border-b border-zinc-100">
        {TCG_TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 text-[11px] px-4 py-2.5 tracking-wide border-b-2 transition-colors ${activeTab === tab ? "border-zinc-900 text-zinc-900 font-semibold" : "border-transparent text-zinc-400"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3 bg-white">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 text-[10px] px-3 py-1.5 rounded-full border tracking-wide transition-colors ${activeCategory === cat ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-50">
        <p className="text-[11px] text-zinc-400">{filtered.length} รายการ</p>
        <select className="text-[11px] text-zinc-600 border border-zinc-100 rounded-lg px-2 py-1 bg-white outline-none" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">เรียงตามค่าเริ่มต้น</option>
          <option value="price_asc">ราคา น้อย → มาก</option>
          <option value="price_desc">ราคา มาก → น้อย</option>
        </select>
      </div>

      {/* Grid */}
      <main className="px-4 pt-2 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 text-sm">ไม่พบสินค้าที่ค้นหา</div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="flex items-center justify-center py-4 bg-zinc-50 relative">
                  {p.badge && <span className={`absolute top-2 left-2 ${BADGE_CLASS[p.badge] ?? "badge-pre"}`}>{p.badge}</span>}
                  <CardArt shape={p.shape} color={p.color} />
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-semibold text-zinc-900 leading-snug">{p.name}</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{p.sub}</p>
                  <p className="text-[13px] font-bold text-zinc-900 mt-2">฿{p.price.toLocaleString()}</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5">{p.stock <= 3 ? `เหลือ ${p.stock} ใบ` : "มีสต็อก"}</p>
                  <button onClick={() => addToCart(p)}
                    className="mt-2 w-full text-[10px] bg-zinc-900 text-white rounded-lg py-1.5 tracking-wide active:opacity-70 transition-opacity">
                    + ตะกร้า
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">ตะกร้าสินค้า ({totalItems})</h3>
              <button onClick={() => setShowCart(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>
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
            {cart.length > 0 && (
              <div className="px-5 py-4 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-500">รวมทั้งหมด</span>
                  <span className="text-base font-bold text-zinc-900">฿{totalPrice.toLocaleString()}</span>
                </div>
                <button className="btn-primary w-full py-3 text-center text-sm">ดำเนินการสั่งซื้อ</button>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
