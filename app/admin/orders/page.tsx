"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import IshipDialog from "./IshipDialog";
import { CARRIERS, carrierById, trackingLooksValid } from "@/lib/carriers";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

type Order = {
  id: string;
  created_at: string;
  email: string | null;
  total_amount: number;
  status: string;
  payment_id: string | null;
  recipient_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  tracking_no: string | null;
  carrier: string | null;
  shipped_notified_at: string | null;
  shipped_notify_error: string | null;
  shipping_fee: number | null;
  confirm_email_sent_at: string | null;
  confirm_email_error: string | null;
  order_items: OrderItem[];
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  paid:      { text: "รอจัดส่ง",   cls: "bg-amber-100 text-amber-700" },
  shipped:   { text: "จัดส่งแล้ว", cls: "bg-green-100 text-green-700" },
  cancelled: { text: "ยกเลิก",     cls: "bg-zinc-100 text-zinc-500" },
  pending:   { text: "รอชำระ",    cls: "bg-zinc-100 text-zinc-500" },
};

export default function AdminOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const [resending, setResending] = useState<string | null>(null);
  const [carrierDraft, setCarrierDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [ishipFor, setIshipFor] = useState<Order | null>(null);

  async function authedFetch(input: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await authedFetch("/api/admin/orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "โหลดไม่สำเร็จ");
      setOrders(data.orders ?? []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ส่งการ์ดยืนยันออเดอร์ให้ลูกค้าทาง LINE อีกครั้ง (ถามยืนยันก่อน เพราะเป็นข้อความถึงลูกค้าจริง)
  async function resendConfirm(o: Order) {
    if (resending) return;
    const who = o.recipient_name || o.email || "ลูกค้า";
    if (!window.confirm(`ส่งการ์ดยืนยันออเดอร์ #${o.id.slice(0, 8).toUpperCase()} ให้ ${who} ทาง LINE อีกครั้งใช่ไหม?`)) return;
    setResending(o.id);
    try {
      const res = await authedFetch("/api/admin/orders/resend-confirm", {
        method: "POST",
        body: JSON.stringify({ orderId: o.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "ส่งไม่สำเร็จ");
      window.alert("ส่งการ์ดยืนยันให้ลูกค้าแล้ว");
      load();
    } catch (e: any) {
      window.alert("ส่งไม่สำเร็จ: " + (e?.message ?? "ไม่ทราบสาเหตุ"));
    } finally {
      setResending(null);
    }
  }

  async function markShipped(o: Order) {
    const tracking = (trackingDraft[o.id] ?? o.tracking_no ?? "").trim();
    const carrier = carrierDraft[o.id] ?? o.carrier ?? "";
    if (!carrier) { alert("เลือกขนส่งก่อนกดจัดส่ง"); return; }
    if (!tracking) { alert("กรอกเลขพัสดุก่อนกดจัดส่ง — ลูกค้าจะได้ตามพัสดุได้"); return; }
    if (!trackingLooksValid(carrier, tracking)) {
      const c = carrierById(carrier);
      if (!window.confirm(`เลขพัสดุนี้ดูไม่ตรงรูปแบบของ ${c?.name} (${c?.hint})\nยืนยันว่าถูกต้องและส่งแจ้งลูกค้าเลยไหม?`)) return;
    }
    setSaving(o.id);
    try {
      const res = await authedFetch("/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ orderId: o.id, status: "shipped", carrier, tracking_no: tracking }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      await load();
      // บอกผลการแจ้งลูกค้าให้ชัด จะได้ไม่ต้องเดาว่าลูกค้ารู้หรือยัง
      const n = data.notify;
      if (n) {
        if (n.ok) alert("บันทึกแล้ว และแจ้งเลขพัสดุให้ลูกค้าแล้ว" + (n.line === "sent" ? " (LINE)" : "") + (n.email === "sent" ? " (อีเมล)" : ""));
        else alert("บันทึกการจัดส่งแล้ว แต่แจ้งลูกค้าไม่สำเร็จ — โปรดแจ้งเองทางโทรศัพท์\n" + (n.errors ?? []).join("\n"));
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(null);
    }
  }

  const filtered = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-zinc-900">คำสั่งซื้อ</h1>
        <button onClick={load} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-3 py-1.5">
          ↻ รีเฟรช
        </button>
      </div>
      <p className="text-xs text-zinc-400 mb-4">{orders.length} รายการทั้งหมด</p>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[
          ["all", "ทั้งหมด"],
          ["paid", "รอจัดส่ง"],
          ["shipped", "จัดส่งแล้ว"],
          ["cancelled", "ยกเลิก"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
              filter === key ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {err && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400 py-10 text-center">กำลังโหลด...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-400 py-10 text-center">ไม่มีคำสั่งซื้อ</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const st = STATUS_LABEL[o.status] ?? { text: o.status, cls: "bg-zinc-100 text-zinc-500" };
            return (
              <div key={o.id} className="bg-white border border-zinc-100 rounded-2xl p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-mono text-zinc-400">#{o.id.slice(0, 8)}</p>
                    <p className="text-[11px] text-zinc-400">
                      {new Date(o.created_at).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>
                    {st.text}
                  </span>
                </div>

                {/* Items */}
                <div className="border-t border-zinc-50 pt-2 space-y-1">
                  {(o.order_items ?? []).map((it) => (
                    <div key={it.id} className="flex justify-between text-xs">
                      <span className="text-zinc-700">{it.name} <span className="text-zinc-400">×{it.qty}</span></span>
                      <span className="text-zinc-500">฿{(Number(it.price) * it.qty).toLocaleString()}</span>
                    </div>
                  ))}
                  {Number(o.shipping_fee ?? 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">ค่าบริการจัดส่ง</span>
                      <span className="text-zinc-500">฿{Number(o.shipping_fee).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-zinc-100 mt-1">
                    <span>รวม</span>
                    <span>฿{Number(o.total_amount).toLocaleString()}</span>
                  </div>
                </div>

                {/* Shipping address */}
                <div className="bg-zinc-50 rounded-xl p-3 mt-3 text-xs leading-relaxed">
                  <p className="font-semibold text-zinc-700 mb-0.5">📦 ที่อยู่จัดส่ง</p>
                  {o.recipient_name || o.address_line1 ? (
                    <p className="text-zinc-600">
                      {o.recipient_name}<br />
                      {o.address_line1} {o.address_line2}<br />
                      {o.district} {o.province} {o.postal_code}<br />
                      โทร {o.phone ?? "-"} • {o.email ?? "-"}
                    </p>
                  ) : (
                    <p className="text-red-500">⚠ ไม่มีที่อยู่ (ออเดอร์เก่าก่อนเปิดฟอร์ม — ติดต่อลูกค้า: {o.email ?? "ไม่มีอีเมล"})</p>
                  )}
                </div>

                {/* สถานะอีเมลยืนยัน */}
                {o.confirm_email_sent_at ? (
                  <p className="text-[11px] text-green-600 mt-2">
                    ✉️ ส่งอีเมลยืนยันแล้ว {new Date(o.confirm_email_sent_at).toLocaleString("th-TH")}
                  </p>
                ) : o.confirm_email_error ? (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-2">
                    <p className="text-[11px] text-red-600 font-semibold">⚠ อีเมลยืนยันส่งไม่สำเร็จ — ลูกค้ายังไม่ได้รับ</p>
                    <p className="text-[10px] text-red-400 mt-0.5 break-all">{o.confirm_email_error}</p>
                  </div>
                ) : null}

                <button onClick={() => resendConfirm(o)} disabled={resending === o.id}
                  className="mt-2 text-[11px] text-zinc-500 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40">
                  {resending === o.id ? "กำลังส่ง..." : "📨 ส่งการ์ดยืนยันซ้ำทาง LINE"}
                </button>

                {/* Actions */}
                {o.status === "paid" && (
                  <button onClick={() => setIshipFor(o)}
                    className="mt-3 text-xs font-semibold border border-zinc-900 text-zinc-900 rounded-lg px-4 py-2 hover:bg-zinc-50">
                    📦 สร้างพัสดุที่ iShip
                  </button>
                )}
                {o.status === "paid" && (
                  <div className="flex gap-2 mt-2">
                    <select
                      className="text-xs border border-zinc-200 rounded-lg px-2 py-2 outline-none bg-white"
                      value={carrierDraft[o.id] ?? o.carrier ?? ""}
                      onChange={(e) => setCarrierDraft((d) => ({ ...d, [o.id]: e.target.value }))}>
                      <option value="">เลือกขนส่ง</option>
                      {CARRIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder="เลขพัสดุ"
                      className="flex-1 text-xs border border-zinc-200 rounded-lg px-3 py-2 outline-none"
                      value={trackingDraft[o.id] ?? o.tracking_no ?? ""}
                      onChange={(e) => setTrackingDraft((d) => ({ ...d, [o.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => markShipped(o)}
                      disabled={saving === o.id}
                      className="text-xs bg-zinc-900 text-white rounded-lg px-4 py-2 disabled:opacity-40">
                      {saving === o.id ? "กำลังบันทึก..." : "✓ จัดส่งแล้ว"}
                    </button>
                  </div>
                )}
                {o.status === "shipped" && o.tracking_no && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-zinc-500">
                      🚚 {carrierById(o.carrier)?.name ?? "ไม่ระบุขนส่ง"} · เลขพัสดุ: <span className="font-mono">{o.tracking_no}</span>
                    </p>
                    {o.shipped_notified_at ? (
                      <p className="text-[11px] text-green-600">
                        ✅ แจ้งลูกค้าแล้ว {new Date(o.shipped_notified_at).toLocaleString("th-TH")}
                      </p>
                    ) : (
                      <p className="text-[11px] text-red-600">
                        ⚠ ยังไม่ได้แจ้งลูกค้า{o.shipped_notify_error ? ` — ${o.shipped_notify_error}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {ishipFor && (
        <IshipDialog
          orderId={ishipFor.id}
          orderRef={ishipFor.id.slice(0, 8).toUpperCase()}
          onClose={() => setIshipFor(null)}
          onCreated={(tracking, env) => {
            setIshipFor(null);
            load();
            alert(env === "prod"
              ? "สร้างพัสดุแล้ว เลข " + tracking + " — ออเดอร์ขึ้นสถานะจัดส่งและแจ้งลูกค้าแล้ว (ถ้าขนส่งรู้จัก) ตรวจผลที่การ์ดออเดอร์"
              : "สร้างพัสดุทดสอบ (UAT) แล้ว เลข " + tracking + " — ไม่ได้เปลี่ยนสถานะออเดอร์และไม่ได้แจ้งลูกค้า");
          }}
        />
      )}
    </div>
  );
}
