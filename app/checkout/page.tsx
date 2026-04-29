"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

// ─── Types ─────────────────────────────────────────────────────────────────

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  image_url?: string | null;
};

// ─── Config ────────────────────────────────────────────────────────────────

const SHIPPING_OPTIONS = [
  { id: "Kerry",   label: "Kerry Express",  price: 60,  days: "1-2 วัน" },
  { id: "Flash",   label: "Flash Express",  price: 50,  days: "1-2 วัน" },
  { id: "ThaiPost",label: "ไปรษณีย์ไทย",    price: 40,  days: "3-5 วัน" },
  { id: "Pickup",  label: "รับที่ร้าน",      price: 0,   days: "นัดรับ" },
];

// PromptPay QR — ใส่เบอร์หรือเลขประจำตัวของร้าน
const PROMPTPAY_NUMBER = "0634463792"; // ← เปลี่ยนเป็นเบอร์ร้านจริง
const PROMPTPAY_NAME   = "KRITANAT SUKHANESKUL";

// ─── PromptPay QR SVG (placeholder — ใช้ API จริงใน production) ─────────────

function PromptPayQR({ amount }: { amount: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-44 h-44 bg-white border-2 border-zinc-200 rounded-2xl flex items-center justify-center p-3">
        {/* QR placeholder — ใน production ใช้ promptpay-qr library */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <rect width="100" height="100" fill="white"/>
          {/* Finder patterns */}
          <rect x="5" y="5" width="30" height="30" rx="3" fill="none" stroke="#0a0a0a" strokeWidth="3"/>
          <rect x="10" y="10" width="20" height="20" rx="1" fill="#0a0a0a"/>
          <rect x="65" y="5" width="30" height="30" rx="3" fill="none" stroke="#0a0a0a" strokeWidth="3"/>
          <rect x="70" y="10" width="20" height="20" rx="1" fill="#0a0a0a"/>
          <rect x="5" y="65" width="30" height="30" rx="3" fill="none" stroke="#0a0a0a" strokeWidth="3"/>
          <rect x="10" y="70" width="20" height="20" rx="1" fill="#0a0a0a"/>
          {/* Data modules */}
          {[40,45,50,55,60,42,48,52,58,44,46,54,56].map((x, i) => (
            <rect key={i} x={x} y={[40,42,44,46,48,50,52,54,56,58,60,45,55][i]} width="4" height="4" fill="#0a0a0a"/>
          ))}
          {[15,25,35,45,55,65,75,85,20,30,50,70,80].map((x, i) => (
            <rect key={`d${i}`} x={x} y={[40,45,50,55,60,40,45,50,55,60,40,55,45][i]} width="3" height="3" fill="#0a0a0a"/>
          ))}
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[11px] text-zinc-500">พร้อมเพย์ · {PROMPTPAY_NUMBER}</p>
        <p className="text-sm font-bold text-zinc-900">{PROMPTPAY_NAME}</p>
        <p className="text-lg font-bold text-zinc-900 mt-1">฿{amount.toLocaleString()}</p>
        <p className="text-[10px] text-zinc-400 mt-1">สแกน QR เพื่อชำระเงิน</p>
      </div>
    </div>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────

type Step = "info" | "payment" | "success";

// ─── Main ──────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const slipRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("info");
  const [userId, setUserId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Form
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState("Kerry");
  const [note, setNote]       = useState("");

  // Payment
  const [slipFile, setSlipFile]       = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [orderId, setOrderId]         = useState("");

  // Load cart from localStorage + session
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);

      // Load cart from localStorage
      const saved = localStorage.getItem("cardlist_cart");
      if (saved) {
        try { setCartItems(JSON.parse(saved)); } catch {}
      }
    }
    init();
  }, []);

  // Compute totals
  const selectedShipping = SHIPPING_OPTIONS.find(s => s.id === shipping)!;
  const subtotal    = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const shippingFee = selectedShipping?.price ?? 60;
  const total       = subtotal + shippingFee;

  // Validate step 1
  function handleNextToPayment() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    setError("");
    setStep("payment");
    window.scrollTo(0, 0);
  }

  // Handle slip upload
  function handleSlipSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("ไฟล์ต้องไม่เกิน 5MB"); return; }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
    setError("");
  }

  // Submit order
  async function handleSubmitOrder() {
    if (!slipFile) { setError("กรุณาแนบสลิปการโอนเงินก่อน"); return; }
    if (!userId || cartItems.length === 0) return;

    setSubmitting(true);
    setError("");

    try {
      // 1) Upload slip
      setUploading(true);
      const ext  = slipFile.name.split(".").pop();
      const path = `slips/${userId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("slips")
        .upload(path, slipFile, { upsert: true, contentType: slipFile.type });
      if (uploadErr) throw uploadErr;
      const { data: slipData } = supabase.storage.from("slips").getPublicUrl(path);
      setUploading(false);

      // 2) Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id:          userId,
          total:            total,
          status:           "pending",
          shipping_name:    name.trim(),
          shipping_phone:   phone.trim(),
          shipping_address: address.trim(),
          shipping_method:  shipping,
          slip_url:         slipData.publicUrl,
          note:             note.trim(),
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      // 3) Create order_items
      const items = cartItems.map(item => ({
        order_id:   order.id,
        product_id: item.id,
        quantity:   item.qty,
        price:      item.price,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      // 4) Clear cart
      localStorage.removeItem("cardlist_cart");

      setOrderId(order.id);
      setStep("success");
      window.scrollTo(0, 0);

    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-300 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5";

  // ── Step Progress ──
  function StepIndicator() {
    const steps = [
      { key: "info",    label: "ข้อมูล" },
      { key: "payment", label: "ชำระเงิน" },
      { key: "success", label: "สำเร็จ" },
    ];
    const current = steps.findIndex(s => s.key === step);
    return (
      <div className="flex items-center justify-center gap-2 py-4 px-4 bg-white border-b border-zinc-100">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
              i <= current ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
            }`}>{i + 1}</div>
            <span className={`text-[11px] font-medium ${i <= current ? "text-zinc-900" : "text-zinc-400"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="w-6 h-px bg-zinc-200" />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center gap-3 px-4 h-12">
          <button onClick={() => step === "payment" ? setStep("info") : router.back()}
            className="text-zinc-400 active:text-zinc-700">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-sm font-semibold text-zinc-900">ชำระเงิน</span>
        </div>
      </header>

      <StepIndicator />

      {/* ── STEP 1: ข้อมูลจัดส่ง ── */}
      {step === "info" && (
        <div className="px-4 py-4 space-y-4">

          {/* Order summary */}
          <div className="card px-4 py-4">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide mb-3">สินค้าที่สั่ง</p>
            {cartItems.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-4">ตะกร้าว่างอยู่</p>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name} width={40} height={40}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-zinc-100 rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-zinc-400">× {item.qty}</p>
                    </div>
                    <p className="text-xs font-semibold text-zinc-900">฿{(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shipping form */}
          <div className="card px-4 py-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">ข้อมูลผู้รับ</p>
            <div>
              <label className={labelCls}>ชื่อ-นามสกุล *</label>
              <input className={inputCls} placeholder="ชื่อผู้รับสินค้า" value={name}
                onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>เบอร์โทรศัพท์ *</label>
              <input className={inputCls} placeholder="08x-xxx-xxxx" type="tel" value={phone}
                onChange={e => setPhone(e.target.value)} maxLength={10} />
            </div>
            <div>
              <label className={labelCls}>ที่อยู่จัดส่ง *</label>
              <textarea rows={3} className={inputCls}
                placeholder="บ้านเลขที่ ถนน ซอย แขวง เขต จังหวัด รหัสไปรษณีย์"
                value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>หมายเหตุ (ไม่บังคับ)</label>
              <input className={inputCls} placeholder="เช่น ฝากไว้ที่นิติฯ" value={note}
                onChange={e => setNote(e.target.value)} />
            </div>
          </div>

          {/* Shipping method */}
          <div className="card px-4 py-4">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide mb-3">วิธีจัดส่ง</p>
            <div className="space-y-2">
              {SHIPPING_OPTIONS.map((opt) => (
                <button key={opt.id} onClick={() => setShipping(opt.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                    shipping === opt.id ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 text-zinc-700"
                  }`}>
                  <div>
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className={`text-[10px] mt-0.5 ${shipping === opt.id ? "text-zinc-400" : "text-zinc-400"}`}>
                      {opt.days}
                    </p>
                  </div>
                  <p className="text-sm font-bold">
                    {opt.price === 0 ? "ฟรี" : `฿${opt.price}`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Total summary */}
          <div className="card px-4 py-4 space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>ยอดสินค้า</span><span>฿{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>ค่าจัดส่ง ({selectedShipping?.label})</span>
              <span>{shippingFee === 0 ? "ฟรี" : `฿${shippingFee}`}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-zinc-900 pt-2 border-t border-zinc-100">
              <span>รวมทั้งสิ้น</span><span>฿{total.toLocaleString()}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          <button onClick={handleNextToPayment}
            disabled={cartItems.length === 0}
            className="btn-primary w-full py-3.5 text-sm disabled:opacity-40">
            ไปชำระเงิน →
          </button>
        </div>
      )}

      {/* ── STEP 2: ชำระเงิน ── */}
      {step === "payment" && (
        <div className="px-4 py-4 space-y-4">

          {/* QR Code */}
          <div className="card px-5 py-6 text-center">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide mb-4">สแกน QR พร้อมเพย์</p>
            <PromptPayQR amount={total} />
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-amber-700 font-medium">
                ⚠️ โอนให้ตรงจำนวน ฿{total.toLocaleString()} พอดี
              </p>
              <p className="text-[10px] text-amber-600 mt-1">
                เพื่อให้ทีมงานตรวจสอบได้รวดเร็ว
              </p>
            </div>
          </div>

          {/* Order summary mini */}
          <div className="card px-4 py-3">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>ยอดสินค้า ({cartItems.reduce((s,i) => s+i.qty, 0)} รายการ)</span>
              <span>฿{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mb-2">
              <span>ค่าจัดส่ง</span>
              <span>{shippingFee === 0 ? "ฟรี" : `฿${shippingFee}`}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-zinc-900 border-t border-zinc-100 pt-2">
              <span>รวม</span><span>฿{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Slip upload */}
          <div className="card px-4 py-4">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide mb-3">แนบสลิปการโอนเงิน</p>
            <input ref={slipRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handleSlipSelect} />

            {slipPreview ? (
              <div className="space-y-3">
                <div className="relative w-full aspect-video bg-zinc-50 rounded-xl overflow-hidden">
                  <Image src={slipPreview} alt="slip" fill className="object-contain" />
                </div>
                <button onClick={() => slipRef.current?.click()}
                  className="w-full border border-zinc-200 rounded-xl py-2.5 text-xs text-zinc-500 hover:bg-zinc-50">
                  เปลี่ยนรูปสลิป
                </button>
              </div>
            ) : (
              <button onClick={() => slipRef.current?.click()}
                className="w-full border-2 border-dashed border-zinc-200 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-zinc-400 transition-colors">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="2" y="3" width="24" height="22" rx="3" stroke="#ccc" strokeWidth="1.2"/>
                  <circle cx="9" cy="10" r="2.5" fill="#ccc"/>
                  <path d="M2 18l7-6 5 5 4-4 8 8" stroke="#ccc" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
                <p className="text-xs text-zinc-400">กดเพื่อแนบสลิป</p>
                <p className="text-[10px] text-zinc-300">JPG, PNG ไม่เกิน 5MB</p>
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          <button onClick={handleSubmitOrder}
            disabled={submitting || uploading}
            className="btn-primary w-full py-3.5 text-sm disabled:opacity-40">
            {uploading ? "กำลังอัปโหลดสลิป..." :
             submitting ? "กำลังบันทึกออเดอร์..." :
             "ยืนยันการสั่งซื้อ"}
          </button>

          <p className="text-[11px] text-zinc-400 text-center">
            ทีมงานจะตรวจสอบและยืนยันออเดอร์ภายใน 1 ชั่วโมง
          </p>
        </div>
      )}

      {/* ── STEP 3: Success ── */}
      {step === "success" && (
        <div className="px-4 py-8 text-center space-y-4">
          <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M7 18l8 8L29 10" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 mb-1">สั่งซื้อสำเร็จ!</h2>
            <p className="text-sm text-zinc-500">ขอบคุณที่ใช้บริการ The Cardlist</p>
          </div>

          <div className="card px-5 py-4 text-left space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Order ID</span>
              <span className="font-mono font-semibold text-zinc-900">#{orderId.slice(0,8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">ยอดชำระ</span>
              <span className="font-semibold text-zinc-900">฿{total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">จัดส่งโดย</span>
              <span className="font-semibold text-zinc-900">{selectedShipping?.label}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">สถานะ</span>
              <span className="text-amber-600 font-semibold">รอตรวจสอบการชำระเงิน</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-left">
            <p className="text-[11px] text-blue-700 font-medium">📋 ขั้นตอนต่อไป</p>
            <p className="text-[11px] text-blue-600 mt-1 leading-relaxed">
              ทีมงานจะตรวจสอบสลิปและยืนยันออเดอร์ภายใน 1 ชั่วโมง
              หลังยืนยันแล้วจะจัดส่งสินค้าทันที
            </p>
          </div>

          <div className="space-y-2">
            <button onClick={() => router.push("/profile")}
              className="btn-primary w-full py-3">
              ดูสถานะออเดอร์
            </button>
            <button onClick={() => router.push("/shop")}
              className="btn-outline w-full py-3">
              ซื้อสินค้าต่อ
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
