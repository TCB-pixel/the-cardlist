"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Banner, BannerType } from "@/lib/banners";
import { createClient } from "@/lib/supabase";

// ── DB row type (snake_case จาก Supabase) ──────────────────────────────────
type BannerRow = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  badge: string;
  cta_label: string;
  cta_href: string;
  cta_secondary_label: string | null;
  cta_secondary_href: string | null;
  bg_color: string;
  image_url: string | null;
  product_image_url: string | null;
  active: boolean;
  order: number;
};

// ── Convert DB row → Banner type ──────────────────────────────────────────
function rowToBanner(r: BannerRow): Banner {
  return {
    id: r.id,
    type: r.type as BannerType,
    title: r.title,
    subtitle: r.subtitle,
    badge: r.badge,
    ctaLabel: r.cta_label,
    ctaHref: r.cta_href,
    ctaSecondaryLabel: r.cta_secondary_label ?? "",
    ctaSecondaryHref: r.cta_secondary_href ?? "",
    bgColor: r.bg_color,
    imageUrl: r.image_url,
    productImageUrl: r.product_image_url,
    active: r.active,
    order: r.order,
  };
}

// ── Convert Banner → DB insert/update payload ─────────────────────────────
function bannerToRow(b: Omit<Banner, "id">) {
  return {
    type: b.type,
    title: b.title,
    subtitle: b.subtitle,
    badge: b.badge,
    cta_label: b.ctaLabel,
    cta_href: b.ctaHref,
    cta_secondary_label: b.ctaSecondaryLabel || null,
    cta_secondary_href: b.ctaSecondaryHref || null,
    bg_color: b.bgColor,
    image_url: b.imageUrl,
    product_image_url: b.productImageUrl,
    active: b.active,
    order: b.order,
  };
}

const EMPTY_FORM = (type: BannerType, order: number): Omit<Banner, "id"> => ({
  type, title: "", subtitle: "", badge: "NEW RELEASE",
  ctaLabel: "ดูเพิ่มเติม", ctaHref: "/shop",
  ctaSecondaryLabel: "", ctaSecondaryHref: "",
  bgColor: "#111111", imageUrl: null, productImageUrl: null,
  active: true, order,
});

const BG_PRESETS = [
  { label: "ดำ",          value: "#111111" },
  { label: "Navy",        value: "#1a1a2e" },
  { label: "น้ำตาลเข้ม",  value: "#1c1410" },
  { label: "เขียวเข้ม",   value: "#0d1f0f" },
  { label: "แดงเข้ม",    value: "#1f0d0d" },
  { label: "น้ำเงินเข้ม", value: "#0d1520" },
];

type Tab = "home" | "tournament";

export default function AdminBannersPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [banners, setBanners]     = useState<Banner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Banner | null>(null);
  const [form, setForm]           = useState<Omit<Banner, "id">>(EMPTY_FORM("home", 1));
  const [uploadingBg, setUploadingBg]         = useState(false);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [error, setError]         = useState("");

  const bgFileRef      = useRef<HTMLInputElement>(null);
  const productFileRef = useRef<HTMLInputElement>(null);

  // ── Load banners from Supabase ──────────────────────────────────────────
  async function loadBanners(type: Tab) {
    setLoading(true);
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("type", type)
      .order("order", { ascending: true });
    if (!error && data) setBanners(data.map(rowToBanner));
    setLoading(false);
  }

  useEffect(() => { loadBanners(activeTab); }, [activeTab]);

  // ── Upload image to Supabase Storage ───────────────────────────────────
  async function uploadImage(file: File, folder: "bg" | "product"): Promise<string | null> {
    const ext  = file.name.split(".").pop();
    const path = `banners/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("banners")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setError("อัปโหลดรูปไม่สำเร็จ: " + error.message); return null; }
    const { data } = supabase.storage.from("banners").getPublicUrl(path);
    return data.publicUrl;
  }

  // ── Handle file select ─────────────────────────────────────────────────
  async function handleFileSelect(type: "bg" | "product", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("ไฟล์ต้องไม่เกิน 3MB"); return; }
    setError("");

    if (type === "bg") {
      setUploadingBg(true);
      const url = await uploadImage(file, "bg");
      if (url) setForm(f => ({ ...f, imageUrl: url }));
      setUploadingBg(false);
    } else {
      setUploadingProduct(true);
      const url = await uploadImage(file, "product");
      if (url) setForm(f => ({ ...f, productImageUrl: url }));
      setUploadingProduct(false);
    }
    e.target.value = "";
  }

  // ── Save (insert or update) ────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { setError("กรุณากรอกชื่อ Banner"); return; }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const { error } = await supabase
          .from("banners")
          .update(bannerToRow(form))
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("banners")
          .insert({ ...bannerToRow(form), type: activeTab });
        if (error) throw error;
      }
      await loadBanners(activeTab);
      setShowModal(false);
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ──────────────────────────────────────────────────────
  async function toggleActive(b: Banner) {
    await supabase.from("banners").update({ active: !b.active }).eq("id", b.id);
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x));
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  async function deleteBanner(id: string) {
    if (!confirm("ลบ Banner นี้?")) return;
    await supabase.from("banners").delete().eq("id", id);
    setBanners(prev => prev.filter(b => b.id !== id));
  }

  // ── Move up/down ───────────────────────────────────────────────────────
  async function move(id: string, dir: "up" | "down") {
    const idx = banners.findIndex(b => b.id === id);
    if (dir === "up"   && idx === 0)               return;
    if (dir === "down" && idx === banners.length-1) return;
    const arr  = [...banners];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    const updated = arr.map((b, i) => ({ ...b, order: i + 1 }));
    setBanners(updated);
    // update order in DB
    await Promise.all(updated.map(b =>
      supabase.from("banners").update({ order: b.order }).eq("id", b.id)
    ));
  }

  // ── Open modal ─────────────────────────────────────────────────────────
  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM(activeTab, banners.length + 1));
    setError("");
    setShowModal(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setForm({
      type: b.type, title: b.title, subtitle: b.subtitle, badge: b.badge,
      ctaLabel: b.ctaLabel, ctaHref: b.ctaHref,
      ctaSecondaryLabel: b.ctaSecondaryLabel ?? "",
      ctaSecondaryHref:  b.ctaSecondaryHref  ?? "",
      bgColor: b.bgColor, imageUrl: b.imageUrl,
      productImageUrl: b.productImageUrl ?? null,
      active: b.active, order: b.order,
    });
    setError("");
    setShowModal(true);
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5";
  const INFO = {
    home:       { label: "Home Page",           size: "1920×600px" },
    tournament: { label: "Tournament / Events", size: "1200×400px" },
  };

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-5">
        {(["home", "tournament"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`text-xs px-5 py-2.5 font-semibold border-b-2 transition-colors ${activeTab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400"}`}>
            {INFO[t].label}
          </button>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5">
          <circle cx="9" cy="9" r="8" stroke="#3b82f6" strokeWidth="1.2"/>
          <line x1="9" y1="8" x2="9" y2="13" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="9" cy="5.5" r="0.8" fill="#3b82f6"/>
        </svg>
        <div>
          <p className="text-xs font-semibold text-blue-800">ขนาดรูปแนะนำ — {INFO[activeTab].label}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">
            Background: <strong>{INFO[activeTab].size}</strong> · Product image: PNG transparent ดีที่สุด
          </p>
          <p className="text-[10px] text-blue-500 mt-1">Background จะถูกทำให้มืด 75% อัตโนมัติ · รูปสินค้าแสดงฝั่งขวา</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-400">
          {loading ? "กำลังโหลด..." : `${banners.length} banner · ${banners.filter(b => b.active).length} แสดงอยู่`}
        </p>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
          <span className="text-base leading-none">+</span> เพิ่ม Banner
        </button>
      </div>

      {/* Banner list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-32 bg-zinc-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b, idx) => (
            <div key={b.id}
              className={`bg-white border rounded-2xl overflow-hidden ${b.active ? "border-zinc-100" : "border-zinc-100 opacity-50"}`}>
              {/* Preview */}
              <div className="h-20 relative flex items-end" style={{ background: b.bgColor }}>
                {b.imageUrl && (
                  <>
                    <Image src={b.imageUrl} alt="" fill className="object-cover object-center" />
                    <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)" }} />
                  </>
                )}
                {b.productImageUrl && (
                  <div className="absolute right-4 bottom-0 h-full flex items-end pb-1 z-10">
                    <Image src={b.productImageUrl} alt="" width={56} height={56}
                      className="object-contain object-bottom h-16 w-auto"
                      style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))" }} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="relative z-10 px-4 pb-3">
                  <span className="text-[8px] tracking-widest text-zinc-300 font-semibold">{b.badge}</span>
                  <p className="text-sm font-bold text-white leading-tight">{b.title.split("\n")[0]}</p>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">#{idx + 1}</div>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{b.title.replace("\n", " · ")}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{b.subtitle || "ไม่มีคำอธิบาย"}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: b.bgColor, border: "1px solid #ccc" }} />
                    <span className="text-[10px] text-zinc-400">CTA: {b.ctaLabel}</span>
                    {b.imageUrl        && <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">BG รูป</span>}
                    {b.productImageUrl && <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-semibold">รูปสินค้า</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => move(b.id, "up")} disabled={idx === 0}
                    className="w-7 h-7 flex items-center justify-center border border-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button onClick={() => move(b.id, "down")} disabled={idx === banners.length - 1}
                    className="w-7 h-7 flex items-center justify-center border border-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button onClick={() => toggleActive(b)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${b.active ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-400"}`}>
                    {b.active ? "แสดง" : "ซ่อน"}
                  </button>
                  <button onClick={() => openEdit(b)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">แก้ไข</button>
                  <button onClick={() => deleteBanner(b.id)} className="text-xs text-red-400 border border-red-100 rounded-lg px-2.5 py-1 hover:bg-red-50">ลบ</button>
                </div>
              </div>
            </div>
          ))}

          {banners.length === 0 && (
            <div className="text-center py-12 text-zinc-400 text-sm border-2 border-dashed border-zinc-200 rounded-2xl">
              ยังไม่มี Banner — กด "เพิ่ม Banner" เพื่อเริ่มต้น
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-xl mx-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไข Banner" : "เพิ่ม Banner ใหม่"}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>

            {/* Live preview */}
            <div className="mx-6 mt-4 rounded-xl overflow-hidden flex-shrink-0 relative flex items-center"
              style={{ background: form.bgColor, minHeight: 90 }}>
              {form.imageUrl && (
                <>
                  <Image src={form.imageUrl} alt="" fill className="object-cover object-center" />
                  <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)" }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 70%)" }} />
                </>
              )}
              <div className="relative z-10 px-4 py-3 flex-1">
                <p className="text-[8px] tracking-widest text-zinc-400 font-semibold">{form.badge || "BADGE"}</p>
                <p className="text-sm font-bold text-white leading-tight mt-0.5">{form.title || "ชื่อ Banner"}</p>
                {form.subtitle && <p className="text-[10px] text-zinc-400 mt-0.5">{form.subtitle}</p>}
                <div className="flex gap-1.5 mt-2">
                  <span className="text-[9px] bg-white text-zinc-900 font-semibold px-2.5 py-1 rounded-lg">{form.ctaLabel || "CTA"}</span>
                  {form.ctaSecondaryLabel && <span className="text-[9px] border border-zinc-600 text-zinc-300 px-2.5 py-1 rounded-lg">{form.ctaSecondaryLabel}</span>}
                </div>
              </div>
              {form.productImageUrl && (
                <div className="relative z-10 pr-4 flex-shrink-0">
                  <Image src={form.productImageUrl} alt="" width={64} height={64}
                    className="object-contain h-16 w-auto"
                    style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))" }} />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Image uploads */}
              <div className="grid grid-cols-2 gap-3">
                {/* BG */}
                <div>
                  <label className={labelCls}>
                    🖼 รูปพื้นหลัง
                    <span className="text-zinc-400 font-normal block mt-0.5">มืด 75% อัตโนมัติ</span>
                  </label>
                  <input ref={bgFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => handleFileSelect("bg", e)} />
                  <div className="space-y-1.5">
                    <button type="button" onClick={() => bgFileRef.current?.click()} disabled={uploadingBg}
                      className="w-full border-2 border-dashed border-zinc-200 rounded-xl py-3 text-xs text-zinc-500 hover:border-zinc-400 transition-colors text-center disabled:opacity-50">
                      {uploadingBg ? "⏳ กำลังอัปโหลด..." : form.imageUrl ? "✅ เปลี่ยนรูป BG" : "อัปโหลดรูป BG"}
                    </button>
                    {form.imageUrl && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: null }))}
                        className="w-full border border-red-100 rounded-xl py-1.5 text-xs text-red-400 hover:bg-red-50">
                        ลบรูป BG
                      </button>
                    )}
                  </div>
                </div>

                {/* Product */}
                <div>
                  <label className={labelCls}>
                    📦 รูปสินค้า
                    <span className="text-zinc-400 font-normal block mt-0.5">แสดงฝั่งขวา · PNG แนะนำ</span>
                  </label>
                  <input ref={productFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => handleFileSelect("product", e)} />
                  <div className="space-y-1.5">
                    <button type="button" onClick={() => productFileRef.current?.click()} disabled={uploadingProduct}
                      className="w-full border-2 border-dashed border-zinc-200 rounded-xl py-3 text-xs text-zinc-500 hover:border-zinc-400 transition-colors text-center disabled:opacity-50">
                      {uploadingProduct ? "⏳ กำลังอัปโหลด..." : form.productImageUrl ? "✅ เปลี่ยนรูปสินค้า" : "อัปโหลดรูปสินค้า"}
                    </button>
                    {form.productImageUrl && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, productImageUrl: null }))}
                        className="w-full border border-red-100 rounded-xl py-1.5 text-xs text-red-400 hover:bg-red-50">
                        ลบรูปสินค้า
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Text fields */}
              <div>
                <label className={labelCls}>Badge Label</label>
                <input className={inputCls} placeholder="NEW RELEASE, PRE-ORDER ฯลฯ"
                  value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>ชื่อหลัก (Title) * <span className="text-zinc-400 font-normal">ขึ้นบรรทัดใหม่ด้วย \n</span></label>
                <textarea rows={2} className={inputCls} placeholder={"One Piece TCG\nOP-17 BOX"}
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>คำอธิบาย (Subtitle)</label>
                <input className={inputCls} placeholder="วางจำหน่าย 30 พฤษภาคม 2026"
                  value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ปุ่มหลัก (label)</label>
                  <input className={inputCls} placeholder="Pre-order"
                    value={form.ctaLabel} onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ปุ่มหลัก (ลิงก์)</label>
                  <input className={inputCls} placeholder="/shop?category=preorder"
                    value={form.ctaHref} onChange={e => setForm(f => ({ ...f, ctaHref: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ปุ่มรอง (label)</label>
                  <input className={inputCls} placeholder="ดูทั้งหมด (เว้นว่างถ้าไม่ต้องการ)"
                    value={form.ctaSecondaryLabel ?? ""} onChange={e => setForm(f => ({ ...f, ctaSecondaryLabel: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ปุ่มรอง (ลิงก์)</label>
                  <input className={inputCls} placeholder="/shop"
                    value={form.ctaSecondaryHref ?? ""} onChange={e => setForm(f => ({ ...f, ctaSecondaryHref: e.target.value }))} />
                </div>
              </div>

              {/* BG Color */}
              <div>
                <label className={labelCls}>สีพื้นหลัง</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {BG_PRESETS.map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, bgColor: c.value }))} title={c.label}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${form.bgColor === c.value ? "border-zinc-900 scale-110" : "border-zinc-200"}`}
                      style={{ background: c.value }} />
                  ))}
                  <input type="color" value={form.bgColor} onChange={e => setForm(f => ({ ...f, bgColor: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-zinc-200 cursor-pointer p-0.5" />
                  <span className="text-[11px] text-zinc-400 font-mono">{form.bgColor}</span>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-700">แสดง Banner นี้</p>
                  <p className="text-[10px] text-zinc-400">ปิดเพื่อซ่อนชั่วคราวโดยไม่ลบ</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${form.active ? "bg-zinc-900" : "bg-zinc-200"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.active ? "left-7" : "left-1"}`} />
                </button>
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
              <button onClick={handleSave} disabled={saving || !form.title}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-xl transition-colors ${form.title && !saving ? "bg-zinc-900 text-white hover:bg-zinc-700" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
                {saving ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : "เพิ่ม Banner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
