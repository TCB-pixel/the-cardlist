"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { Banner, BannerType, DEFAULT_HOME_BANNERS, DEFAULT_TOURNAMENT_BANNERS } from "@/lib/banners";

const EMPTY_BANNER = (type: BannerType, order: number): Omit<Banner, "id"> => ({
  type,
  title: "",
  subtitle: "",
  badge: "NEW RELEASE",
  ctaLabel: "ดูเพิ่มเติม",
  ctaHref: "/shop",
  ctaSecondaryLabel: "",
  ctaSecondaryHref: "",
  bgColor: "#111111",
  imageUrl: null,
  active: true,
  order,
});

const BG_PRESETS = [
  { label: "ดำ", value: "#111111" },
  { label: "Navy", value: "#1a1a2e" },
  { label: "น้ำตาลเข้ม", value: "#1c1410" },
  { label: "เขียวเข้ม", value: "#0d1f0f" },
  { label: "แดงเข้ม", value: "#1f0d0d" },
  { label: "น้ำเงินเข้ม", value: "#0d1520" },
];

type Tab = "home" | "tournament";

export default function AdminBannersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [homeBanners, setHomeBanners] = useState<Banner[]>(DEFAULT_HOME_BANNERS);
  const [tournamentBanners, setTournamentBanners] = useState<Banner[]>(DEFAULT_TOURNAMENT_BANNERS);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<Omit<Banner, "id">>(EMPTY_BANNER("home", 1));
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const banners = activeTab === "home" ? homeBanners : tournamentBanners;
  const setBanners = activeTab === "home" ? setHomeBanners : setTournamentBanners;

  function openAdd() {
    setEditing(null);
    setPreviewImg(null);
    setForm(EMPTY_BANNER(activeTab, banners.length + 1));
    setShowModal(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setPreviewImg(b.imageUrl);
    setForm({ type: b.type, title: b.title, subtitle: b.subtitle, badge: b.badge, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref, ctaSecondaryLabel: b.ctaSecondaryLabel ?? "", ctaSecondaryHref: b.ctaSecondaryHref ?? "", bgColor: b.bgColor, imageUrl: b.imageUrl, active: b.active, order: b.order });
    setShowModal(true);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("ไฟล์ใหญ่เกิน 2MB กรุณาบีบอัดรูปก่อน"); return; }
    const url = URL.createObjectURL(file);
    setPreviewImg(url);
    setForm((f) => ({ ...f, imageUrl: url }));
  }

  function handleSave() {
    if (!form.title) return;
    if (editing) {
      setBanners((prev) => prev.map((b) => b.id === editing.id ? { ...form, id: editing.id } : b));
    } else {
      setBanners((prev) => [...prev, { ...form, id: Date.now().toString() }]);
    }
    setShowModal(false);
  }

  function toggleActive(id: string) {
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active: !b.active } : b));
  }

  function deleteBanner(id: string) {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }

  function moveUp(id: string) {
    setBanners((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === 0) return prev;
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr.map((b, i) => ({ ...b, order: i + 1 }));
    });
  }

  function moveDown(id: string) {
    setBanners((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr.map((b, i) => ({ ...b, order: i + 1 }));
    });
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5";

  const INFO = {
    home: { label: "Home Page", size: "1920 × 600 px", ratio: "16:5", maxMB: "2 MB" },
    tournament: { label: "Tournament / Events", size: "1200 × 400 px", ratio: "3:1", maxMB: "1 MB" },
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

      {/* Image spec info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5">
          <circle cx="9" cy="9" r="8" stroke="#3b82f6" strokeWidth="1.2"/>
          <line x1="9" y1="8" x2="9" y2="13" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="9" cy="5.5" r="0.8" fill="#3b82f6"/>
        </svg>
        <div>
          <p className="text-xs font-semibold text-blue-800">ขนาดรูปภาพที่แนะนำสำหรับ {INFO[activeTab].label}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">
            ขนาด <strong>{INFO[activeTab].size}</strong> · สัดส่วน {INFO[activeTab].ratio} · ไฟล์ JPG/PNG ไม่เกิน <strong>{INFO[activeTab].maxMB}</strong>
          </p>
          <p className="text-[10px] text-blue-500 mt-1">
            {activeTab === "home"
              ? "เนื้อหาสำคัญควรอยู่ตรงกลาง 800px เพราะมือถือจะตัดขอบซ้าย-ขวา"
              : "เหมาะสำหรับแบนเนอร์อีเวนต์ — ใส่ชื่องาน วันที่ และ Call-to-action ให้ชัดเจน"}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-400">{banners.length} banner · {banners.filter(b => b.active).length} แสดงอยู่</p>
        <button onClick={openAdd} className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
          <span className="text-base leading-none">+</span> เพิ่ม Banner
        </button>
      </div>

      {/* Banner list */}
      <div className="space-y-3">
        {banners.map((b, idx) => (
          <div key={b.id}
            className={`bg-white border rounded-2xl overflow-hidden transition-all ${b.active ? "border-zinc-100" : "border-zinc-100 opacity-50"}`}>
            {/* Preview strip */}
            <div className="h-20 relative flex items-end" style={{ background: b.bgColor }}>
              {b.imageUrl && (
                <Image src={b.imageUrl} alt="" fill className="object-cover object-center" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="relative z-10 px-4 pb-3">
                <span className="text-[8px] tracking-widest text-zinc-300 font-semibold">{b.badge}</span>
                <p className="text-sm font-bold text-white leading-tight">{b.title.split("\n")[0]}</p>
              </div>
              {/* Order badge */}
              <div className="absolute top-2 right-2 bg-black/50 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                #{idx + 1}
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-900 truncate">{b.title.replace("\n", " · ")}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{b.subtitle || "ไม่มีคำอธิบาย"}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.bgColor, border: "1px solid #ccc" }}></div>
                  <span className="text-[10px] text-zinc-400">CTA: {b.ctaLabel}</span>
                  {b.imageUrl && <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-semibold">มีรูป</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Move up/down */}
                <button onClick={() => moveUp(b.id)} disabled={idx === 0}
                  className="w-7 h-7 flex items-center justify-center border border-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button onClick={() => moveDown(b.id)} disabled={idx === banners.length - 1}
                  className="w-7 h-7 flex items-center justify-center border border-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {/* Toggle */}
                <button onClick={() => toggleActive(b.id)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${b.active ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-400"}`}>
                  {b.active ? "แสดง" : "ซ่อน"}
                </button>
                {/* Edit */}
                <button onClick={() => openEdit(b)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">แก้ไข</button>
                {/* Delete */}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-xl mx-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไข Banner" : "เพิ่ม Banner ใหม่"}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>

            {/* Live preview */}
            <div className="mx-6 mt-4 rounded-xl overflow-hidden flex-shrink-0" style={{ background: form.bgColor, minHeight: 80 }}>
              {form.imageUrl && (
                <div className="relative h-20">
                  <Image src={form.imageUrl} alt="" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/50" />
                </div>
              )}
              <div className={`px-4 py-3 ${form.imageUrl ? "relative -mt-16" : ""}`}>
                <p className="text-[8px] tracking-widest text-zinc-400 font-semibold">{form.badge || "BADGE"}</p>
                <p className="text-sm font-bold text-white leading-tight mt-0.5">
                  {form.title || "ชื่อ Banner"}
                </p>
                {form.subtitle && <p className="text-[10px] text-zinc-400 mt-0.5">{form.subtitle}</p>}
                <div className="flex gap-1.5 mt-2">
                  <span className="text-[9px] bg-white text-zinc-900 font-semibold px-2.5 py-1 rounded-lg">{form.ctaLabel || "CTA"}</span>
                  {form.ctaSecondaryLabel && <span className="text-[9px] border border-zinc-600 text-zinc-300 px-2.5 py-1 rounded-lg">{form.ctaSecondaryLabel}</span>}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Image upload */}
              <div>
                <label className={labelCls}>
                  รูปภาพพื้นหลัง
                  <span className="text-zinc-400 font-normal ml-1">
                    ({activeTab === "home" ? "1920×600px, ≤2MB" : "1200×400px, ≤1MB"})
                  </span>
                </label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex-1 border-2 border-dashed border-zinc-200 rounded-xl py-3 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors text-center">
                    {form.imageUrl ? "เปลี่ยนรูปภาพ" : "คลิกเพื่ออัปโหลดรูป"}
                  </button>
                  {form.imageUrl && (
                    <button type="button" onClick={() => { setPreviewImg(null); setForm(f => ({ ...f, imageUrl: null })); }}
                      className="border border-zinc-200 rounded-xl px-3 text-xs text-red-400 hover:bg-red-50">
                      ลบรูป
                    </button>
                  )}
                </div>
              </div>

              {/* Text content */}
              <div>
                <label className={labelCls}>Badge Label</label>
                <input className={inputCls} placeholder="เช่น NEW RELEASE, PRE-ORDER" value={form.badge} onChange={(e) => setForm(f => ({ ...f, badge: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>ชื่อหลัก (Title) *<span className="text-zinc-400 font-normal ml-1">ขึ้นบรรทัดใหม่ด้วย \n</span></label>
                <textarea rows={2} className={inputCls} placeholder={"One Piece TCG\nOP-10 Manga"} value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>คำอธิบาย (Subtitle)</label>
                <input className={inputCls} placeholder="วางจำหน่าย 20 เมษายน 2026" value={form.subtitle} onChange={(e) => setForm(f => ({ ...f, subtitle: e.target.value }))} />
              </div>

              {/* CTA Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ปุ่มหลัก (label)</label>
                  <input className={inputCls} placeholder="Pre-order" value={form.ctaLabel} onChange={(e) => setForm(f => ({ ...f, ctaLabel: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ปุ่มหลัก (ลิงก์)</label>
                  <input className={inputCls} placeholder="/shop?category=preorder" value={form.ctaHref} onChange={(e) => setForm(f => ({ ...f, ctaHref: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ปุ่มรอง (label)</label>
                  <input className={inputCls} placeholder="ดูทั้งหมด (ถ้าไม่ต้องการ เว้นว่าง)" value={form.ctaSecondaryLabel ?? ""} onChange={(e) => setForm(f => ({ ...f, ctaSecondaryLabel: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ปุ่มรอง (ลิงก์)</label>
                  <input className={inputCls} placeholder="/shop" value={form.ctaSecondaryHref ?? ""} onChange={(e) => setForm(f => ({ ...f, ctaSecondaryHref: e.target.value }))} />
                </div>
              </div>

              {/* Background color */}
              <div>
                <label className={labelCls}>สีพื้นหลัง (ใช้เมื่อไม่มีรูป)</label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {BG_PRESETS.map((c) => (
                      <button key={c.value} onClick={() => setForm(f => ({ ...f, bgColor: c.value }))} title={c.label}
                        className={`w-7 h-7 rounded-lg border-2 transition-all ${form.bgColor === c.value ? "border-zinc-900 scale-110" : "border-zinc-200"}`}
                        style={{ background: c.value }}>
                      </button>
                    ))}
                  </div>
                  <input type="color" value={form.bgColor} onChange={(e) => setForm(f => ({ ...f, bgColor: e.target.value }))}
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
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.active ? "left-7" : "left-1"}`}></span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl hover:bg-zinc-50">ยกเลิก</button>
              <button onClick={handleSave} disabled={!form.title}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-xl ${form.title ? "bg-zinc-900 text-white hover:bg-zinc-700" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
                {editing ? "บันทึกการแก้ไข" : "เพิ่ม Banner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
