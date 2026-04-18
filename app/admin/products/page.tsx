"use client";
import { useState } from "react";

type Product = {
  id: string; name: string; sub: string; price: number; stock: number;
  category: string; tcg: string; badge: string; rarity: string;
};

const INIT_PRODUCTS: Product[] = [
  { id: "1", name: "Booster Box OP-10", sub: "One Piece TCG", price: 3200, stock: 20, category: "Pre-order", tcg: "One Piece", badge: "PRE-ORDER", rarity: "" },
  { id: "2", name: "Monkey D. Luffy SEC", sub: "One Piece — OP-01", price: 4200, stock: 2, category: "Single Cards", tcg: "One Piece", badge: "HOT", rarity: "Secret Rare" },
  { id: "3", name: "Charizard ex SAR", sub: "Pokémon — 151", price: 1850, stock: 3, category: "Single Cards", tcg: "Pokémon", badge: "HOT", rarity: "Super Rare" },
  { id: "4", name: "Booster Box SV8a", sub: "Pokémon TCG", price: 2800, stock: 15, category: "Sealed Box", tcg: "Pokémon", badge: "NEW", rarity: "" },
  { id: "5", name: "Black Lotus LP", sub: "MTG — Alpha", price: 120000, stock: 1, category: "Single Cards", tcg: "MTG", badge: "RARE", rarity: "Secret Rare" },
  { id: "6", name: "Oko, Thief of Crowns Foil", sub: "MTG — ELD", price: 4500, stock: 4, category: "Single Cards", tcg: "MTG", badge: "NEW", rarity: "Rare" },
  { id: "7", name: "Son Goku SPR", sub: "Dragon Ball SCG", price: 890, stock: 8, category: "Single Cards", tcg: "Dragon Ball", badge: "", rarity: "Super Rare" },
  { id: "8", name: "Card Sleeve 100pcs", sub: "Accessories", price: 180, stock: 50, category: "Accessories", tcg: "All", badge: "", rarity: "" },
];

const EMPTY: Omit<Product, "id"> = { name: "", sub: "", price: 0, stock: 0, category: "Single Cards", tcg: "One Piece", badge: "", rarity: "" };

const STATUS_STYLE: Record<string, string> = {
  "PRE-ORDER": "bg-zinc-100 text-zinc-600",
  "HOT": "bg-red-50 text-red-700",
  "NEW": "bg-zinc-900 text-white",
  "RARE": "bg-purple-50 text-purple-700",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>(INIT_PRODUCTS);
  const [search, setSearch] = useState("");
  const [filterTcg, setFilterTcg] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, "id">>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = products.filter((p) => {
    if (filterTcg !== "All" && p.tcg !== filterTcg) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function openAdd() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(p: Product) { setEditing(p); setForm({ name: p.name, sub: p.sub, price: p.price, stock: p.stock, category: p.category, tcg: p.tcg, badge: p.badge, rarity: p.rarity }); setShowModal(true); }

  function handleSave() {
    if (!form.name || form.price <= 0) return;
    if (editing) {
      setProducts((prev) => prev.map((p) => p.id === editing.id ? { ...form, id: editing.id } : p));
    } else {
      setProducts((prev) => [...prev, { ...form, id: Date.now().toString() }]);
    }
    setShowModal(false);
  }

  function handleDelete(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 w-64">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#a1a1aa" strokeWidth="1.2"/><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <input className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 flex-1 outline-none" placeholder="ค้นหาสินค้า..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 outline-none" value={filterTcg} onChange={(e) => setFilterTcg(e.target.value)}>
            <option value="All">ทุก TCG</option>
            {["One Piece", "Pokémon", "MTG", "Dragon Ball"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <span className="text-xs text-zinc-400">{filtered.length} รายการ</span>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors">
          <span className="text-base leading-none font-light">+</span> เพิ่มสินค้า
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {["ชื่อสินค้า", "TCG", "หมวดหมู่", "ราคา", "สต็อก", "Badge", ""].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors last:border-none">
                <td className="px-5 py-3.5">
                  <p className="text-xs font-semibold text-zinc-900">{p.name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{p.sub}</p>
                </td>
                <td className="px-5 py-3.5 text-xs text-zinc-600">{p.tcg}</td>
                <td className="px-5 py-3.5 text-xs text-zinc-600">{p.category}</td>
                <td className="px-5 py-3.5 text-xs font-semibold text-zinc-900">฿{p.price.toLocaleString()}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-semibold ${p.stock <= 3 ? "text-red-500" : p.stock <= 10 ? "text-amber-500" : "text-green-600"}`}>{p.stock}</span>
                </td>
                <td className="px-5 py-3.5">
                  {p.badge && <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${STATUS_STYLE[p.badge] ?? "bg-zinc-100 text-zinc-600"}`}>{p.badge}</span>}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(p)} className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-2.5 py-1 transition-colors">แก้ไข</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2.5 py-1 transition-colors">ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-900 text-lg leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>ชื่อสินค้า *</label>
                  <input className={inputCls} placeholder="ชื่อสินค้า" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>ชื่อย่อ / ชุด</label>
                  <input className={inputCls} placeholder="เช่น One Piece — OP-01" value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>ราคา (บาท) *</label>
                  <input type="number" className={inputCls} value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelCls}>จำนวนสต็อก</label>
                  <input type="number" className={inputCls} value={form.stock || ""} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelCls}>TCG</label>
                  <select className={inputCls} value={form.tcg} onChange={(e) => setForm({ ...form, tcg: e.target.value })}>
                    {["One Piece", "Pokémon", "MTG", "Dragon Ball", "All"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>หมวดหมู่</label>
                  <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {["Single Cards", "Sealed Box", "Pre-order", "Accessories"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Badge</label>
                  <select className={inputCls} value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })}>
                    <option value="">ไม่มี</option>
                    {["NEW", "HOT", "PRE-ORDER", "RARE"].map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>ความหายาก</label>
                  <select className={inputCls} value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
                    <option value="">ไม่ระบุ</option>
                    {["Common", "Uncommon", "Rare", "Super Rare", "Secret Rare"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl hover:bg-zinc-50">ยกเลิก</button>
              <button onClick={handleSave} className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700">
                {editing ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl w-80 mx-4 p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <p className="text-sm font-bold text-zinc-900 mb-1">ยืนยันการลบ?</p>
            <p className="text-xs text-zinc-400 mb-5">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-red-600">ลบสินค้า</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
