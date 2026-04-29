"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
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
  description: string;
  active: boolean;
};

const EMPTY: Omit<Product, "id" | "active"> = {
  name: "", sub: "", price: 0, stock: 0,
  category: "Single Cards", tcg: "One Piece",
  badge: "", rarity: "", image_url: null, description: "",
};

const STATUS_STYLE: Record<string, string> = {
  "PRE-ORDER": "bg-zinc-100 text-zinc-600",
  "HOT":       "bg-red-50 text-red-700",
  "NEW":       "bg-zinc-900 text-white",
  "RARE":      "bg-purple-50 text-purple-700",
};

const TCG_LIST    = ["One Piece", "Pokémon", "MTG", "Dragon Ball", "All"];
const CAT_LIST    = ["Single Cards", "Sealed Box", "Pre-order", "Accessories"];
const BADGE_LIST  = ["", "NEW", "HOT", "PRE-ORDER", "RARE"];
const RARITY_LIST = ["", "Common", "Uncommon", "Rare", "Super Rare", "Secret Rare"];

// ─── Main ──────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const supabase = createClient();

  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterTcg, setFilterTcg] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [form, setForm]           = useState<Omit<Product, "id" | "active">>(EMPTY);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgPreview, setImgPreview]     = useState<string | null>(null);
  const [error, setError]         = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load products ──
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Image upload ──
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("รูปต้องไม่เกิน 3MB"); return; }
    setUploadingImg(true);
    setError("");
    const ext  = file.name.split(".").pop();
    const path = `products/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) {
      setError("อัปโหลดรูปไม่สำเร็จ: " + uploadErr.message);
      setUploadingImg(false);
      return;
    }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    const url = data.publicUrl + `?t=${Date.now()}`;
    setForm(f => ({ ...f, image_url: url }));
    setImgPreview(url);
    setUploadingImg(false);
    e.target.value = "";
  }

  // ── Open modals ──
  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setImgPreview(null);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, sub: p.sub, price: p.price, stock: p.stock,
      category: p.category, tcg: p.tcg, badge: p.badge, rarity: p.rarity,
      image_url: p.image_url, description: p.description,
    });
    setImgPreview(p.image_url);
    setError("");
    setShowModal(true);
  }

  // ── Save ──
  async function handleSave() {
    if (!form.name || form.price <= 0) { setError("กรุณากรอกชื่อและราคา"); return; }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const { error } = await supabase
          .from("products")
          .update({ ...form })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert({ ...form, active: true });
        if (error) throw error;
      }
      await load();
      setShowModal(false);
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──
  async function handleDelete(id: string) {
    setDeleting(true);
    await supabase.from("products").delete().eq("id", id);
    await load();
    setDeleteId(null);
    setDeleting(false);
  }

  // ── Filter ──
  const filtered = products.filter((p) => {
    if (filterTcg !== "All" && p.tcg !== filterTcg) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.sub.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 w-64">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="#a1a1aa" strokeWidth="1.2"/>
              <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 flex-1 outline-none"
              placeholder="ค้นหาสินค้า..." value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 outline-none"
            value={filterTcg} onChange={(e) => setFilterTcg(e.target.value)}>
            <option value="All">ทุก TCG</option>
            {["One Piece", "Pokémon", "MTG", "Dragon Ball"].map(t => <option key={t}>{t}</option>)}
          </select>
          <span className="text-xs text-zinc-400">{filtered.length} รายการ</span>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
          <span className="text-base leading-none font-light">+</span> เพิ่มสินค้า
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-zinc-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["รูป", "ชื่อสินค้า", "TCG", "หมวดหมู่", "ราคา", "สต็อก", "Badge", ""].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-zinc-400">
                    ยังไม่มีสินค้า — กด "เพิ่มสินค้า" เพื่อเริ่มต้น
                  </td>
                </tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors last:border-none">
                  {/* รูป */}
                  <td className="px-4 py-3">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        width={40} height={40}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <rect x="1" y="2" width="14" height="12" rx="2" stroke="#ccc" strokeWidth="1"/>
                          <circle cx="5.5" cy="6" r="1.5" fill="#ccc"/>
                          <path d="M1 10l4-3 3 3 2-2 4 4" stroke="#ccc" strokeWidth="1" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-zinc-900">{p.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{p.sub}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{p.tcg}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{p.category}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-900">฿{p.price.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${p.stock <= 3 ? "text-red-500" : p.stock <= 10 ? "text-amber-500" : "text-green-600"}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.badge && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${STATUS_STYLE[p.badge] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {p.badge}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-2.5 py-1">
                        แก้ไข
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2.5 py-1">
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-zinc-900">
                {editing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* ── Image Upload ── */}
              <div>
                <label className={labelCls}>รูปสินค้า</label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={handleImageSelect} />
                <div className="flex items-start gap-3">
                  {/* Preview */}
                  <div className="w-24 h-24 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                    {imgPreview ? (
                      <Image src={imgPreview} alt="preview" width={96} height={96} className="w-full h-full object-cover" />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="3" width="20" height="18" rx="3" stroke="#ccc" strokeWidth="1.2"/>
                        <circle cx="8" cy="9" r="2" fill="#ccc"/>
                        <path d="M2 15l6-5 4 4 3-3 6 6" stroke="#ccc" strokeWidth="1.2" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      disabled={uploadingImg}
                      className="w-full border border-zinc-200 rounded-xl py-2.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50">
                      {uploadingImg ? "⏳ กำลังอัปโหลด..." : imgPreview ? "✅ เปลี่ยนรูป" : "📸 อัปโหลดรูปสินค้า"}
                    </button>
                    {imgPreview && (
                      <button type="button" onClick={() => { setImgPreview(null); setForm(f => ({ ...f, image_url: null })); }}
                        className="w-full border border-red-100 rounded-xl py-2 text-xs text-red-400 hover:bg-red-50">
                        ลบรูป
                      </button>
                    )}
                    <p className="text-[10px] text-zinc-400">PNG, JPG, WebP · ไม่เกิน 3MB</p>
                  </div>
                </div>
              </div>

              {/* ── Text fields ── */}
              <div>
                <label className={labelCls}>ชื่อสินค้า *</label>
                <input className={inputCls} placeholder="ชื่อสินค้า" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>ชื่อย่อ / ชุด</label>
                <input className={inputCls} placeholder="เช่น One Piece — OP-01" value={form.sub}
                  onChange={e => setForm(f => ({ ...f, sub: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>รายละเอียด</label>
                <textarea rows={2} className={inputCls} placeholder="รายละเอียดสินค้า (ไม่บังคับ)" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ราคา (บาท) *</label>
                  <input type="number" className={inputCls} placeholder="0" value={form.price || ""}
                    onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>จำนวนสต็อก</label>
                  <input type="number" className={inputCls} placeholder="0" value={form.stock || ""}
                    onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>TCG</label>
                  <select className={inputCls} value={form.tcg}
                    onChange={e => setForm(f => ({ ...f, tcg: e.target.value }))}>
                    {TCG_LIST.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>หมวดหมู่</label>
                  <select className={inputCls} value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CAT_LIST.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Badge</label>
                  <select className={inputCls} value={form.badge}
                    onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}>
                    {BADGE_LIST.map(b => <option key={b} value={b}>{b || "ไม่มี"}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>ความหายาก</label>
                  <select className={inputCls} value={form.rarity}
                    onChange={e => setForm(f => ({ ...f, rarity: e.target.value }))}>
                    {RARITY_LIST.map(r => <option key={r} value={r}>{r || "ไม่ระบุ"}</option>)}
                  </select>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-[11px] text-red-600">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl hover:bg-zinc-50">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving || uploadingImg}
                className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
                {saving ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl w-80 mx-4 p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-sm font-bold text-zinc-900 mb-1">ยืนยันการลบ?</p>
            <p className="text-xs text-zinc-400 mb-5">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl">
                ยกเลิก
              </button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                className="flex-1 bg-red-500 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-red-600 disabled:opacity-40">
                {deleting ? "กำลังลบ..." : "ลบสินค้า"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
