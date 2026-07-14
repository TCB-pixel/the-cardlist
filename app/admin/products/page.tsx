"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

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
  cost_price: number | null;
};

type StockMovement = {
  id: string;
  type: "receive" | "sale" | "adjustment";
  qty_change: number;
  note: string | null;
  created_at: string;
};

type Lottery = {
  id: string;
  product_id: string;
  quota: number;
  status: "open" | "drawn" | "cancelled";
  created_at: string;
  drawn_at: string | null;
  entryCounts: { pending: number; won: number; lost: number };
};

type LotteryEntry = {
  id: string;
  user_id: string;
  status: string;
  won_at: string | null;
  purchase_deadline: string | null;
  created_at: string;
  profiles: { username: string | null; line_user_id: string | null } | null;
};

const LOTTERY_ENTRY_LABEL: Record<string, string> = {
  pending: "รอผล",
  won: "ได้สิทธิ์",
  lost: "พลาดสิทธิ์",
  expired: "หมดเวลา",
  purchased: "ซื้อแล้ว",
};

const EMPTY: Omit<Product, "id" | "active"> = {
  name: "", sub: "", price: 0, stock: 0,
  category: "Single Cards", tcg: "One Piece",
  badge: "", rarity: "", image_url: null, description: "",
  cost_price: null,
};

const STATUS_STYLE: Record<string, string> = {
  "PRE-ORDER": "bg-zinc-100 text-zinc-600",
  "HOT":       "bg-red-50 text-red-700",
  "NEW":       "bg-zinc-900 text-white",
  "RARE":      "bg-purple-50 text-purple-700",
};

const MOVEMENT_LABEL: Record<string, string> = {
  receive: "รับเข้า",
  sale: "ขายออก",
  adjustment: "ปรับปรุง",
};

const TCG_LIST    = ["One Piece", "Pokémon", "MTG", "Dragon Ball", "All"];
const CAT_LIST    = ["Single Cards", "Sealed Box", "Pre-order", "Accessories"];
const BADGE_LIST  = ["", "NEW", "HOT", "PRE-ORDER", "RARE"];
const RARITY_LIST = ["", "Common", "Uncommon", "Rare", "Super Rare", "Secret Rare"];

// ─── Main ──────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const supabase = createClient();
  const { can: canDo } = useAdmin();

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

  // ── ปรับสต็อก (รับเข้า/ปรับปรุง) ──
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockType, setStockType] = useState<"receive" | "adjustment">("receive");
  const [stockQty, setStockQty] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState("");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // ── Lottery ("ขอสิทธิ์ซื้อ") ──
  const [lotteryTarget, setLotteryTarget] = useState<Product | null>(null);
  const [currentLottery, setCurrentLottery] = useState<Lottery | null>(null);
  const [lotteryEntries, setLotteryEntries] = useState<LotteryEntry[]>([]);
  const [lotteryLoading, setLotteryLoading] = useState(false);
  const [lotteryQuota, setLotteryQuota] = useState("");
  const [lotteryBusy, setLotteryBusy] = useState(false);
  const [lotteryError, setLotteryError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  // แนบ access_token ไปกับทุก request ให้ /api/admin/products ตรวจสิทธิ์ได้
  async function authedFetch(input: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
  }

  // ── Load products ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/products");
      const data = await res.json();
      if (res.ok) setProducts(data.products ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Image upload (ตรง Supabase Storage — ไม่ใช่ตาราง products จึงไม่โดน RLS เขียนตรง) ──
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
      cost_price: p.cost_price,
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
      const res = editing
        ? await authedFetch("/api/admin/products", {
            method: "PATCH",
            body: JSON.stringify({ id: editing.id, ...form }),
          })
        : await authedFetch("/api/admin/products", {
            method: "POST",
            body: JSON.stringify(form),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
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
    await authedFetch("/api/admin/products", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    await load();
    setDeleteId(null);
    setDeleting(false);
  }

  // ── เปิด modal ปรับสต็อก + โหลดประวัติ ──
  async function openStockAdjust(p: Product) {
    setStockTarget(p);
    setStockType("receive");
    setStockQty("");
    setStockNote("");
    setStockError("");
    setMovements([]);
    setMovementsLoading(true);
    try {
      const res = await authedFetch(`/api/admin/products?movementsFor=${p.id}`);
      const data = await res.json();
      if (res.ok) setMovements(data.movements ?? []);
    } catch {
      /* ignore */
    } finally {
      setMovementsLoading(false);
    }
  }

  async function handleStockSave() {
    if (!stockTarget) return;
    const qty = Number(stockQty);
    if (!qty || qty === 0) { setStockError("กรอกจำนวนที่ไม่ใช่ 0"); return; }
    setStockSaving(true);
    setStockError("");
    try {
      // รับเข้า = บวกเสมอ, ปรับปรุง = ใช้เครื่องหมายตามที่กรอก (ติดลบได้ถ้าต้องการลดสต็อก)
      const qtyChange = stockType === "receive" ? Math.abs(qty) : qty;
      const res = await authedFetch("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({
          id: stockTarget.id,
          stockAdjustment: { type: stockType, qtyChange, note: stockNote },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ปรับสต็อกไม่สำเร็จ");
      await load();
      setStockTarget(null);
    } catch (err: any) {
      setStockError(err?.message ?? "ปรับสต็อกไม่สำเร็จ");
    } finally {
      setStockSaving(false);
    }
  }

  // ── Lottery: เปิด modal + โหลด lottery ล่าสุดของสินค้านี้ ──
  async function openLottery(p: Product) {
    setLotteryTarget(p);
    setCurrentLottery(null);
    setLotteryEntries([]);
    setLotteryQuota("");
    setLotteryError("");
    setLotteryLoading(true);
    try {
      const res = await authedFetch("/api/admin/lotteries");
      const data = await res.json();
      if (res.ok) {
        const mine: Lottery[] = (data.lotteries ?? []).filter((l: any) => l.product_id === p.id);
        const latest = mine[0] ?? null; // เรียงจาก created_at desc มาแล้วจาก API
        setCurrentLottery(latest);
        if (latest && latest.status !== "open") {
          await loadLotteryEntries(latest.id);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLotteryLoading(false);
    }
  }

  async function loadLotteryEntries(lotteryId: string) {
    try {
      const res = await authedFetch(`/api/admin/lotteries?lotteryId=${lotteryId}`);
      const data = await res.json();
      if (res.ok) setLotteryEntries(data.entries ?? []);
    } catch {
      /* ignore */
    }
  }

  async function handleCreateLottery() {
    if (!lotteryTarget) return;
    const quota = Number(lotteryQuota);
    if (!quota || quota <= 0) { setLotteryError("กรอกจำนวนสิทธิ์ที่จะสุ่ม"); return; }
    setLotteryBusy(true);
    setLotteryError("");
    try {
      const res = await authedFetch("/api/admin/lotteries", {
        method: "POST",
        body: JSON.stringify({ productId: lotteryTarget.id, quota }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เปิดรอบไม่สำเร็จ");
      await openLottery(lotteryTarget);
    } catch (err: any) {
      setLotteryError(err?.message ?? "เปิดรอบไม่สำเร็จ");
    } finally {
      setLotteryBusy(false);
    }
  }

  async function handleDrawLottery() {
    if (!currentLottery) return;
    if (!confirm(`ยืนยันปิดรับคำขอและสุ่มผู้ชนะ ${currentLottery.quota} สิทธิ์? การกระทำนี้ย้อนกลับไม่ได้`)) return;
    setLotteryBusy(true);
    setLotteryError("");
    try {
      const res = await authedFetch("/api/admin/lotteries", {
        method: "PATCH",
        body: JSON.stringify({ lotteryId: currentLottery.id, action: "close_and_draw" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สุ่มไม่สำเร็จ");
      if (lotteryTarget) await openLottery(lotteryTarget);
    } catch (err: any) {
      setLotteryError(err?.message ?? "สุ่มไม่สำเร็จ");
    } finally {
      setLotteryBusy(false);
    }
  }

  async function handleCancelLottery() {
    if (!currentLottery) return;
    if (!confirm("ยกเลิกรอบขอสิทธิ์นี้?")) return;
    setLotteryBusy(true);
    setLotteryError("");
    try {
      const res = await authedFetch("/api/admin/lotteries", {
        method: "PATCH",
        body: JSON.stringify({ lotteryId: currentLottery.id, action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ยกเลิกไม่สำเร็จ");
      if (lotteryTarget) await openLottery(lotteryTarget);
    } catch (err: any) {
      setLotteryError(err?.message ?? "ยกเลิกไม่สำเร็จ");
    } finally {
      setLotteryBusy(false);
    }
  }

  // ── Filter ──
  const filtered = products.filter((p) => {
    if (filterTcg !== "All" && p.tcg !== filterTcg) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.sub.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const canEdit = canDo("products:edit");
  const canCreate = canDo("products:create");
  const canDelete = canDo("products:delete");

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
        {canCreate && (
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
            <span className="text-base leading-none font-light">+</span> เพิ่มสินค้า
          </button>
        )}
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
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                    ฿{p.price.toLocaleString()}
                    {p.cost_price != null && (
                      <p className="text-[9px] text-zinc-400 font-normal mt-0.5">ทุน ฿{p.cost_price.toLocaleString()}</p>
                    )}
                  </td>
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
                      {canEdit && (
                        <button onClick={() => openStockAdjust(p)}
                          className="text-xs text-blue-500 hover:text-blue-700 border border-blue-100 rounded-lg px-2.5 py-1">
                          ปรับสต็อก
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => openLottery(p)}
                          className="text-xs text-purple-500 hover:text-purple-700 border border-purple-100 rounded-lg px-2.5 py-1">
                          🎟️ Lottery
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => openEdit(p)}
                          className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-2.5 py-1">
                          แก้ไข
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteId(p.id)}
                          className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2.5 py-1">
                          ลบ
                        </button>
                      )}
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
                  <label className={labelCls}>ราคาขาย (บาท) *</label>
                  <input type="number" className={inputCls} placeholder="0" value={form.price || ""}
                    onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>ราคาทุน (บาท)</label>
                  <input type="number" className={inputCls} placeholder="กรอกทีหลังได้" value={form.cost_price ?? ""}
                    onChange={e => setForm(f => ({ ...f, cost_price: e.target.value === "" ? null : Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>จำนวนสต็อก{editing ? " (แก้ตรงนี้ไม่ถูก log — ใช้ปุ่ม \"ปรับสต็อก\" แทน)" : ""}</label>
                  <input type="number" className={inputCls} placeholder="0" value={form.stock || ""}
                    disabled={!!editing}
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

      {/* ── Stock Adjust Modal ── */}
      {stockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStockTarget(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">ปรับสต็อก</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{stockTarget.name} — คงเหลือ {stockTarget.stock} ชิ้น</p>
              </div>
              <button onClick={() => setStockTarget(null)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex gap-2">
                {(["receive", "adjustment"] as const).map((t) => (
                  <button key={t} onClick={() => setStockType(t)}
                    className={`flex-1 text-xs font-semibold py-2.5 rounded-xl border transition-colors ${stockType === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                    {t === "receive" ? "📦 รับเข้า" : "✏️ ปรับปรุง"}
                  </button>
                ))}
              </div>

              <div>
                <label className={labelCls}>
                  {stockType === "receive" ? "จำนวนที่รับเข้า" : "จำนวนที่เปลี่ยน (ใส่ - เพื่อลด เช่น -2)"}
                </label>
                <input type="number" className={inputCls} placeholder={stockType === "receive" ? "เช่น 10" : "เช่น -2 หรือ 5"}
                  value={stockQty} onChange={e => setStockQty(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>หมายเหตุ</label>
                <input className={inputCls} placeholder="เช่น รับจากซัพพลายเออร์ / นับสต็อกใหม่พบต่างจากระบบ"
                  value={stockNote} onChange={e => setStockNote(e.target.value)} />
              </div>

              {stockError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-[11px] text-red-600">{stockError}</p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold text-zinc-500 tracking-wide mb-2">ประวัติล่าสุด</p>
                {movementsLoading ? (
                  <p className="text-xs text-zinc-400 text-center py-4">กำลังโหลด...</p>
                ) : movements.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-4">ยังไม่มีประวัติ</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {movements.map((m) => (
                      <div key={m.id} className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-[11px] font-medium text-zinc-700">
                            {MOVEMENT_LABEL[m.type] ?? m.type}
                            {m.note ? ` — ${m.note}` : ""}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {new Date(m.created_at).toLocaleString("th-TH")}
                          </p>
                        </div>
                        <span className={`text-xs font-bold ${m.qty_change > 0 ? "text-green-600" : "text-red-500"}`}>
                          {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100 flex-shrink-0">
              <button onClick={() => setStockTarget(null)}
                className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl hover:bg-zinc-50">
                ยกเลิก
              </button>
              <button onClick={handleStockSave} disabled={stockSaving}
                className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
                {stockSaving ? "กำลังบันทึก..." : "บันทึกการปรับสต็อก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lottery Modal ── */}
      {lotteryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLotteryTarget(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">🎟️ ขอสิทธิ์ซื้อ (Lottery)</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{lotteryTarget.name}</p>
              </div>
              <button onClick={() => setLotteryTarget(null)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {lotteryLoading ? (
                <p className="text-xs text-zinc-400 text-center py-6">กำลังโหลด...</p>
              ) : !currentLottery || currentLottery.status === "cancelled" ? (
                <>
                  <p className="text-xs text-zinc-500">
                    ยังไม่มีรอบขอสิทธิ์เปิดอยู่ — เปิดรอบใหม่เพื่อให้ลูกค้ากดขอสิทธิ์ซื้อสินค้านี้แทนการซื้อตรงได้
                  </p>
                  <div>
                    <label className={labelCls}>จำนวนสิทธิ์ที่จะสุ่มให้ (quota)</label>
                    <input type="number" className={inputCls} placeholder="เช่น 5"
                      value={lotteryQuota} onChange={(e) => setLotteryQuota(e.target.value)} />
                  </div>
                  {lotteryError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <p className="text-[11px] text-red-600">{lotteryError}</p>
                    </div>
                  )}
                  <button onClick={handleCreateLottery} disabled={lotteryBusy}
                    className="w-full bg-purple-600 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-40">
                    {lotteryBusy ? "กำลังเปิด..." : "เปิดรับคำขอ"}
                  </button>
                </>
              ) : currentLottery.status === "open" ? (
                <>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-purple-700">🟢 กำลังเปิดรับคำขอ</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      จะสุ่ม {currentLottery.quota} สิทธิ์ — มีคนขอแล้ว {currentLottery.entryCounts.pending} คน
                    </p>
                  </div>
                  {lotteryError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <p className="text-[11px] text-red-600">{lotteryError}</p>
                    </div>
                  )}
                  <button onClick={handleDrawLottery} disabled={lotteryBusy}
                    className="w-full bg-purple-600 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-40">
                    {lotteryBusy ? "กำลังสุ่ม..." : `ปิดรับคำขอ + สุ่มผู้ชนะ`}
                  </button>
                  <button onClick={handleCancelLottery} disabled={lotteryBusy}
                    className="w-full border border-red-100 text-red-500 text-xs font-semibold py-2.5 rounded-xl hover:bg-red-50 disabled:opacity-40">
                    ยกเลิกรอบนี้
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-zinc-700">✅ สุ่มผลแล้ว</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      ได้สิทธิ์ {currentLottery.entryCounts.won} คน · พลาดสิทธิ์ {currentLottery.entryCounts.lost} คน
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-zinc-500 tracking-wide mb-2">รายชื่อผู้ได้สิทธิ์</p>
                    {lotteryEntries.filter((e) => e.status === "won" || e.status === "purchased").length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-4">ไม่มีผู้ได้สิทธิ์</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {lotteryEntries
                          .filter((e) => e.status === "won" || e.status === "purchased")
                          .map((e) => (
                            <div key={e.id} className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2">
                              <p className="text-[11px] font-medium text-zinc-700">
                                @{e.profiles?.username ?? e.user_id.slice(0, 8)}
                              </p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.status === "purchased" ? "bg-green-50 text-green-700" : "bg-purple-50 text-purple-700"}`}>
                                {LOTTERY_ENTRY_LABEL[e.status] ?? e.status}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <button onClick={() => { setCurrentLottery(null); setLotteryEntries([]); }}
                    className="w-full border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl hover:bg-zinc-50">
                    เปิดรอบใหม่
                  </button>
                </>
              )}
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
