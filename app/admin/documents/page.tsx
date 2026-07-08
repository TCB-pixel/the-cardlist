"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

// ─── Types ─────────────────────────────────────────────────────────────────

type DocType = "receipt" | "invoice" | "delivery";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type DocData = {
  doc_type: DocType;
  doc_number: string;
  doc_date: string;
  due_date: string;
  // Customer
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_tax_id: string;
  // Delivery
  delivery_address: string;
  delivery_date: string;
  tracking_number: string;
  // Items
  items: LineItem[];
  // Notes
  note: string;
  // Payment
  payment_method: string;
  discount: number;
  vat_enabled: boolean;
};

type Order = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  profiles: { display_name: string | null; username: string } | null;
  order_items: { name: string | null; price: number; qty: number }[];
};

// ─── Config ────────────────────────────────────────────────────────────────

const DOC_CONFIG: Record<DocType, { label: string; color: string; prefix: string }> = {
  receipt:  { label: "ใบเสร็จรับเงิน",    color: "#1D9E75", prefix: "REC" },
  invoice:  { label: "ใบแจ้งหนี้ / Invoice", color: "#185FA5", prefix: "INV" },
  delivery: { label: "ใบส่งของ",           color: "#633806", prefix: "DO"  },
};

const COMPANY = {
  name:    "The Cardlist BKK",
  address: "กรุงเทพมหานคร",
  phone:   "thecardlistbkk@gmail.com",
  website: "thecardlistbkk.com",
  tax_id:  "",
};

function genDocNumber(type: DocType) {
  const d = new Date();
  const yy = d.getFullYear().toString().slice(2);
  const mm = (d.getMonth()+1).toString().padStart(2,"0");
  const rand = Math.floor(Math.random()*9000+1000);
  return `${DOC_CONFIG[type].prefix}-${yy}${mm}-${rand}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function dueDateStr(days=7) {
  const d = new Date();
  d.setDate(d.getDate()+days);
  return d.toISOString().split("T")[0];
}

function thaiDate(str: string) {
  if (!str) return "";
  const d = new Date(str);
  return d.toLocaleDateString("th-TH", { day:"numeric", month:"long", year:"numeric" });
}

const EMPTY_ITEM = (): LineItem => ({
  id: Date.now().toString(),
  description: "",
  quantity: 1,
  unit_price: 0,
});

const EMPTY_DOC = (type: DocType): DocData => ({
  doc_type: type,
  doc_number: genDocNumber(type),
  doc_date: todayStr(),
  due_date: dueDateStr(7),
  customer_name: "",
  customer_address: "",
  customer_phone: "",
  customer_tax_id: "",
  delivery_address: "",
  delivery_date: todayStr(),
  tracking_number: "",
  items: [EMPTY_ITEM()],
  note: "",
  payment_method: "โอนเงิน",
  discount: 0,
  vat_enabled: false,
});

// ─── Print styles ──────────────────────────────────────────────────────────

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: fixed; left: 0; top: 0; width: 100%; }
}
`;

// ─── Document Preview Component ────────────────────────────────────────────

function DocPreview({ doc }: { doc: DocData }) {
  const cfg = DOC_CONFIG[doc.doc_type];
  const subtotal = doc.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discountAmt = doc.discount;
  const vatBase = subtotal - discountAmt;
  const vatAmt = doc.vat_enabled ? Math.round(vatBase * 0.07) : 0;
  const total = vatBase + vatAmt;

  return (
    <div id="print-area" style={{
      fontFamily: "'Noto Sans Thai', 'Noto Sans', sans-serif",
      fontSize: 13,
      color: "#1a1a1a",
      background: "#fff",
      padding: "32px 40px",
      maxWidth: 680,
      margin: "0 auto",
      border: "1px solid #e5e5e5",
      borderRadius: 8,
    }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0a0a0a" }}>{COMPANY.name}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{COMPANY.address}</div>
          <div style={{ fontSize: 11, color: "#666" }}>{COMPANY.phone} · {COMPANY.website}</div>
          {COMPANY.tax_id && <div style={{ fontSize: 11, color: "#666" }}>เลขที่ผู้เสียภาษี {COMPANY.tax_id}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            display: "inline-block",
            background: cfg.color,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            padding: "4px 14px",
            borderRadius: 6,
            marginBottom: 6,
            letterSpacing: 1,
          }}>
            {cfg.label.toUpperCase()}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0a0a0a" }}>เลขที่ {doc.doc_number}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>วันที่ {thaiDate(doc.doc_date)}</div>
          {doc.doc_type === "invoice" && (
            <div style={{ fontSize: 11, color: "#c00" }}>ครบกำหนด {thaiDate(doc.due_date)}</div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: "#e5e5e5", marginBottom: 20 }} />

      {/* Customer + Delivery */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, marginBottom: 6 }}>ลูกค้า / BILL TO</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.customer_name || "—"}</div>
          {doc.customer_address && <div style={{ fontSize: 11, color: "#555", marginTop: 2, lineHeight: 1.6 }}>{doc.customer_address}</div>}
          {doc.customer_phone && <div style={{ fontSize: 11, color: "#555" }}>โทร {doc.customer_phone}</div>}
          {doc.customer_tax_id && <div style={{ fontSize: 11, color: "#555" }}>เลขผู้เสียภาษี {doc.customer_tax_id}</div>}
        </div>
        {doc.doc_type === "delivery" && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, marginBottom: 6 }}>ที่อยู่จัดส่ง / SHIP TO</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "#555" }}>{doc.delivery_address || "—"}</div>
            {doc.delivery_date && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>วันที่จัดส่ง {thaiDate(doc.delivery_date)}</div>}
            {doc.tracking_number && <div style={{ fontSize: 11, color: "#555" }}>Tracking: {doc.tracking_number}</div>}
          </div>
        )}
        {doc.doc_type === "invoice" && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, marginBottom: 6 }}>วิธีชำระเงิน</div>
            <div style={{ fontSize: 12, color: "#555" }}>{doc.payment_method}</div>
            <div style={{ fontSize: 11, color: "#c00", marginTop: 4, fontWeight: 600 }}>ครบกำหนด {thaiDate(doc.due_date)}</div>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ textAlign:"left", padding:"8px 10px", fontSize:11, fontWeight:700, color:"#666", letterSpacing:0.5 }}>#</th>
            <th style={{ textAlign:"left", padding:"8px 10px", fontSize:11, fontWeight:700, color:"#666" }}>รายการ</th>
            <th style={{ textAlign:"center", padding:"8px 10px", fontSize:11, fontWeight:700, color:"#666" }}>จำนวน</th>
            <th style={{ textAlign:"right", padding:"8px 10px", fontSize:11, fontWeight:700, color:"#666" }}>ราคา/หน่วย</th>
            <th style={{ textAlign:"right", padding:"8px 10px", fontSize:11, fontWeight:700, color:"#666" }}>รวม</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, idx) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding:"8px 10px", fontSize:12, color:"#999" }}>{idx+1}</td>
              <td style={{ padding:"8px 10px", fontSize:12 }}>{item.description || "—"}</td>
              <td style={{ padding:"8px 10px", fontSize:12, textAlign:"center" }}>{item.quantity}</td>
              <td style={{ padding:"8px 10px", fontSize:12, textAlign:"right" }}>฿{item.unit_price.toLocaleString()}</td>
              <td style={{ padding:"8px 10px", fontSize:12, textAlign:"right", fontWeight:600 }}>฿{(item.quantity*item.unit_price).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom: 20 }}>
        <div style={{ width: 240 }}>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12, color:"#555" }}>
            <span>ยอดรวม</span><span>฿{subtotal.toLocaleString()}</span>
          </div>
          {discountAmt > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12, color:"#c00" }}>
              <span>ส่วนลด</span><span>-฿{discountAmt.toLocaleString()}</span>
            </div>
          )}
          {doc.vat_enabled && (
            <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12, color:"#555" }}>
              <span>ภาษีมูลค่าเพิ่ม 7%</span><span>฿{vatAmt.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderTop:"2px solid #0a0a0a", fontSize:14, fontWeight:700 }}>
            <span>ยอดรวมทั้งสิ้น</span><span style={{ color: cfg.color }}>฿{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Payment info for receipt */}
      {doc.doc_type === "receipt" && (
        <div style={{ background:"#f5f5f5", borderRadius:6, padding:"10px 14px", marginBottom:16, fontSize:11, color:"#555" }}>
          <span style={{ fontWeight:700 }}>วิธีชำระเงิน:</span> {doc.payment_method} &nbsp;·&nbsp;
          <span style={{ fontWeight:700, color:"#1D9E75" }}>ชำระเรียบร้อยแล้ว</span>
        </div>
      )}

      {/* Note */}
      {doc.note && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>
          <strong style={{ color: "#555" }}>หมายเหตุ:</strong> {doc.note}
        </div>
      )}

      {/* Signature area */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginTop:32, paddingTop:16, borderTop:"1px solid #e5e5e5" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ height:40 }} />
          <div style={{ borderTop:"1px solid #ccc", paddingTop:6, fontSize:11, color:"#888" }}>ผู้รับสินค้า / ลูกค้า</div>
          <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>วันที่ ________________</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ height:40 }} />
          <div style={{ borderTop:"1px solid #ccc", paddingTop:6, fontSize:11, color:"#888" }}>ผู้ออกเอกสาร / {COMPANY.name}</div>
          <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>วันที่ ________________</div>
        </div>
      </div>

      <div style={{ textAlign:"center", marginTop:20, fontSize:10, color:"#bbb" }}>
        {COMPANY.name} · {COMPANY.website}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const supabase = createClient();

  const [step, setStep] = useState<"select"|"form"|"preview">("select");
  const [docType, setDocType] = useState<DocType>("receipt");
  const [doc, setDoc] = useState<DocData>(EMPTY_DOC("receipt"));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [sourceMode, setSourceMode] = useState<"order"|"manual">("manual");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  // Load orders
  useEffect(() => {
    async function load() {
      setLoadingOrders(true);
      const { data } = await supabase
        .from("orders")
        .select(`id, created_at, total_amount, status, profiles(display_name, username), order_items(name, price, qty)`)
        .order("created_at", { ascending: false })
        .limit(50);
      setOrders((data as unknown as Order[]) ?? []);
      setLoadingOrders(false);
    }
    load();
  }, []);

  // Fill from order
  function fillFromOrder(orderId: string) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const customerName = order.profiles?.display_name ?? order.profiles?.username ?? "";
    const items: LineItem[] = (order.order_items ?? []).map((oi, i) => ({
      id: i.toString(),
      description: oi.name ?? "สินค้า",
      quantity: oi.qty,
      unit_price: Number(oi.price),
    }));
    setDoc(prev => ({
      ...prev,
      customer_name: customerName,
      items: items.length ? items : [EMPTY_ITEM()],
      doc_date: new Date(order.created_at).toISOString().split("T")[0],
      payment_method: order.status === "completed" ? "โอนเงิน" : "รอชำระ",
    }));
  }

  function handleSelectType(type: DocType) {
    setDocType(type);
    setDoc(EMPTY_DOC(type));
    setStep("form");
  }

  function handlePrint() {
    window.print();
  }

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setDoc(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, [field]: value } : i),
    }));
  }

  function addItem() {
    setDoc(prev => ({ ...prev, items: [...prev.items, EMPTY_ITEM()] }));
  }

  function removeItem(id: string) {
    setDoc(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5";

  const subtotal = doc.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const vatAmt = doc.vat_enabled ? Math.round((subtotal - doc.discount) * 0.07) : 0;
  const total = subtotal - doc.discount + vatAmt;

  return (
    <div className="p-6">
      <style>{PRINT_STYLE}</style>

      {/* ── Step 1: Select document type ── */}
      {step === "select" && (
        <>
          <h2 className="text-sm font-bold text-zinc-900 mb-5">ออกเอกสาร</h2>
          <div className="grid grid-cols-3 gap-4">
            {(Object.entries(DOC_CONFIG) as [DocType, typeof DOC_CONFIG.receipt][]).map(([type, cfg]) => (
              <button key={type} onClick={() => handleSelectType(type)}
                className="bg-white border border-zinc-100 rounded-2xl p-6 text-left hover:border-zinc-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: cfg.color + "20" }}>
                  <div className="w-4 h-4 rounded" style={{ background: cfg.color }} />
                </div>
                <p className="text-sm font-bold text-zinc-900">{cfg.label}</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  {type === "receipt" ? "สำหรับการชำระเงินที่สำเร็จแล้ว" :
                   type === "invoice" ? "ใบแจ้งยอดรอการชำระเงิน" :
                   "เอกสารยืนยันการจัดส่งสินค้า"}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Step 2: Form ── */}
      {step === "form" && (
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setStep("select")} className="text-zinc-400 hover:text-zinc-700">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: DOC_CONFIG[docType].color }} />
              <h2 className="text-sm font-bold text-zinc-900">{DOC_CONFIG[docType].label}</h2>
            </div>
          </div>

          {/* Source mode */}
          <div className="card px-4 py-4 mb-4">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide mb-3">แหล่งข้อมูล</p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setSourceMode("order")}
                className={`text-xs px-4 py-2 rounded-xl border transition-colors ${sourceMode === "order" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                ดึงจาก Order
              </button>
              <button onClick={() => setSourceMode("manual")}
                className={`text-xs px-4 py-2 rounded-xl border transition-colors ${sourceMode === "manual" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                กรอกเอง
              </button>
            </div>
            {sourceMode === "order" && (
              <div className="flex gap-2">
                <select className={inputCls + " flex-1"} value={selectedOrderId}
                  onChange={e => { setSelectedOrderId(e.target.value); fillFromOrder(e.target.value); }}>
                  <option value="">เลือก Order</option>
                  {loadingOrders ? (
                    <option disabled>กำลังโหลด...</option>
                  ) : orders.map(o => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0,8).toUpperCase()} · {o.profiles?.display_name ?? o.profiles?.username} · ฿{Number(o.total_amount).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Doc info */}
          <div className="card px-4 py-4 mb-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">ข้อมูลเอกสาร</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>เลขที่เอกสาร</label>
                <input className={inputCls} value={doc.doc_number}
                  onChange={e => setDoc(p => ({ ...p, doc_number: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>วันที่</label>
                <input type="date" className={inputCls} value={doc.doc_date}
                  onChange={e => setDoc(p => ({ ...p, doc_date: e.target.value }))} />
              </div>
              {docType === "invoice" && (
                <div>
                  <label className={labelCls}>ครบกำหนด</label>
                  <input type="date" className={inputCls} value={doc.due_date}
                    onChange={e => setDoc(p => ({ ...p, due_date: e.target.value }))} />
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="card px-4 py-4 mb-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">ข้อมูลลูกค้า</p>
            <input className={inputCls} placeholder="ชื่อลูกค้า / บริษัท *" value={doc.customer_name}
              onChange={e => setDoc(p => ({ ...p, customer_name: e.target.value }))} />
            <textarea rows={2} className={inputCls} placeholder="ที่อยู่" value={doc.customer_address}
              onChange={e => setDoc(p => ({ ...p, customer_address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} placeholder="เบอร์โทร" value={doc.customer_phone}
                onChange={e => setDoc(p => ({ ...p, customer_phone: e.target.value }))} />
              <input className={inputCls} placeholder="เลขผู้เสียภาษี" value={doc.customer_tax_id}
                onChange={e => setDoc(p => ({ ...p, customer_tax_id: e.target.value }))} />
            </div>
          </div>

          {/* Delivery fields */}
          {docType === "delivery" && (
            <div className="card px-4 py-4 mb-4 space-y-3">
              <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">ข้อมูลการจัดส่ง</p>
              <textarea rows={2} className={inputCls} placeholder="ที่อยู่จัดส่ง" value={doc.delivery_address}
                onChange={e => setDoc(p => ({ ...p, delivery_address: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>วันที่จัดส่ง</label>
                  <input type="date" className={inputCls} value={doc.delivery_date}
                    onChange={e => setDoc(p => ({ ...p, delivery_date: e.target.value }))} />
                </div>
                <input className={inputCls} placeholder="Tracking Number" value={doc.tracking_number}
                  onChange={e => setDoc(p => ({ ...p, tracking_number: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Items */}
          <div className="card px-4 py-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">รายการสินค้า</p>
              <button onClick={addItem} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">+ เพิ่ม</button>
            </div>
            <div className="space-y-2">
              {doc.items.map((item, idx) => (
                <div key={item.id} className="flex gap-2 items-start">
                  <span className="text-[11px] text-zinc-400 pt-3 w-4 flex-shrink-0">{idx+1}</span>
                  <input className={inputCls + " flex-1"} placeholder="รายการสินค้า" value={item.description}
                    onChange={e => updateItem(item.id, "description", e.target.value)} />
                  <input className={inputCls + " w-16"} type="number" placeholder="จำนวน" value={item.quantity}
                    onChange={e => updateItem(item.id, "quantity", Number(e.target.value))} />
                  <input className={inputCls + " w-24"} type="number" placeholder="ราคา" value={item.unit_price}
                    onChange={e => updateItem(item.id, "unit_price", Number(e.target.value))} />
                  {doc.items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="text-red-400 pt-2.5 flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary + Settings */}
          <div className="card px-4 py-4 mb-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wide">ยอดและการชำระ</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>วิธีชำระเงิน</label>
                <select className={inputCls} value={doc.payment_method}
                  onChange={e => setDoc(p => ({ ...p, payment_method: e.target.value }))}>
                  <option>โอนเงิน</option>
                  <option>เงินสด</option>
                  <option>บัตรเครดิต</option>
                  <option>พร้อมเพย์</option>
                  <option>รอชำระ</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>ส่วนลด (฿)</label>
                <input type="number" className={inputCls} value={doc.discount}
                  onChange={e => setDoc(p => ({ ...p, discount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setDoc(p => ({ ...p, vat_enabled: !p.vat_enabled }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${doc.vat_enabled ? "bg-zinc-900" : "bg-zinc-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${doc.vat_enabled ? "left-5" : "left-0.5"}`} />
              </button>
              <span className="text-xs text-zinc-600">รวม VAT 7%</span>
            </div>
            <div className="bg-zinc-50 rounded-xl px-3 py-2.5 space-y-1">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>ยอดรวม</span><span>฿{subtotal.toLocaleString()}</span>
              </div>
              {doc.discount > 0 && (
                <div className="flex justify-between text-xs text-red-500">
                  <span>ส่วนลด</span><span>-฿{doc.discount.toLocaleString()}</span>
                </div>
              )}
              {doc.vat_enabled && (
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>VAT 7%</span><span>฿{vatAmt.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                <span>ยอดสุทธิ</span><span>฿{total.toLocaleString()}</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>หมายเหตุ</label>
              <textarea rows={2} className={inputCls} placeholder="หมายเหตุ (ถ้ามี)" value={doc.note}
                onChange={e => setDoc(p => ({ ...p, note: e.target.value }))} />
            </div>
          </div>

          <button onClick={() => setStep("preview")} className="btn-primary w-full py-3.5 text-sm">
            ดูตัวอย่างและพิมพ์
          </button>
        </div>
      )}

      {/* ── Step 3: Preview + Print ── */}
      {step === "preview" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("form")} className="text-zinc-400 hover:text-zinc-700">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h2 className="text-sm font-bold text-zinc-900">ตัวอย่างเอกสาร</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="white" strokeWidth="1.2"/>
                  <path d="M4 4V2h6v2" stroke="white" strokeWidth="1.2"/>
                  <rect x="3.5" y="7" width="7" height="3" rx="1" fill="white"/>
                </svg>
                พิมพ์ / Export PDF
              </button>
              <button onClick={() => { setStep("select"); setDoc(EMPTY_DOC(docType)); }}
                className="text-xs border border-zinc-200 text-zinc-600 px-4 py-2.5 rounded-xl hover:bg-zinc-50">
                สร้างใหม่
              </button>
            </div>
          </div>

          <div ref={printRef}>
            <DocPreview doc={doc} />
          </div>

          <p className="text-[11px] text-zinc-400 text-center mt-4">
            กด "พิมพ์ / Export PDF" แล้วเลือก "Save as PDF" ในหน้าต่างพิมพ์ได้เลยครับ
          </p>
        </div>
      )}
    </div>
  );
}
