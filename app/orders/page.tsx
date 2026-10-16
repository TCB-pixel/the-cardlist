"use client";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import LogoLoader from "@/components/LogoLoader";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";

type OrderItem = { id: string; name: string; price: number; qty: number };

type Order = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  tracking_no: string | null;
  order_items: OrderItem[];
};

const STATUS_LABEL: Record<string, { text: string; en: string; cls: string }> = {
  paid:      { text: "รอจัดส่ง",   en: "To ship",   cls: "bg-amber-100 text-amber-700" },
  shipped:   { text: "จัดส่งแล้ว", en: "Shipped",   cls: "bg-green-100 text-green-700" },
  cancelled: { text: "ยกเลิก",     en: "Cancelled", cls: "bg-zinc-100 text-zinc-500" },
  pending:   { text: "รอชำระ",    en: "Awaiting payment", cls: "bg-zinc-100 text-zinc-500" },
};

export default function MyOrdersPage() {
  const supabase = createClient();
  const { L, lang, locale } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNeedLogin(true);
        setLoading(false);
        return;
      }
      // RLS policy "own orders read" ทำให้เห็นเฉพาะออเดอร์ตัวเอง
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status, tracking_no, order_items(id, name, price, qty)")
        .order("created_at", { ascending: false });
      if (error) setLoadError(true);
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    }
    load().catch(() => { setLoadError(true); setLoading(false); });
  }, [reloadKey]);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar />
      <main className="px-4 pt-4">
        <h1 className="text-base font-bold text-zinc-900 mb-3">{L("ประวัติการสั่งซื้อ", "Order history")}</h1>

        {loading ? (
          <LogoLoader />
        ) : needLogin ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-500 mb-3">{L("กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อ", "Please log in to see your orders")}</p>
            <a href="/login?next=%2Forders" className="text-xs bg-zinc-900 text-white rounded-lg px-4 py-2 inline-block">
              {L("เข้าสู่ระบบ", "Log in")}
            </a>
          </div>
        ) : loadError ? (
          <div className="text-center py-16" role="alert">
            <p className="text-sm font-semibold text-zinc-700">{L("โหลดคำสั่งซื้อไม่สำเร็จ", "Couldn't load your orders")}</p>
            <p className="text-xs text-zinc-500 mt-1">{L("ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง", "Check your internet and try again.")}</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="mt-4 text-xs font-semibold border border-zinc-200 rounded-xl px-5 py-2.5 text-zinc-700">{L("ลองใหม่", "Try again")}</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-500 mb-3">{L("ยังไม่มีคำสั่งซื้อ", "No orders yet")}</p>
            <a href="/shop" className="text-xs bg-zinc-900 text-white rounded-lg px-4 py-2 inline-block">
              {L("ไปช้อปเลย →", "Start shopping →")}
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const st = STATUS_LABEL[o.status] ?? { text: o.status, en: o.status, cls: "bg-zinc-100 text-zinc-500" };
              return (
                <div key={o.id} className="bg-white border border-zinc-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-zinc-500">
                      {new Date(o.created_at).toLocaleDateString(locale, {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>
                      {lang === "en" ? st.en : st.text}
                    </span>
                  </div>

                  <div className="space-y-1 border-t border-zinc-50 pt-2">
                    {(o.order_items ?? []).map((it) => (
                      <div key={it.id} className="flex justify-between text-xs">
                        <span className="text-zinc-700 truncate mr-2">{it.name} <span className="text-zinc-500">×{it.qty}</span></span>
                        <span className="text-zinc-500 flex-shrink-0">฿{(Number(it.price) * it.qty).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-50">
                    <span className="text-xs text-zinc-500">{L("รวมทั้งหมด", "Total")}</span>
                    <span className="text-sm font-bold text-zinc-900">฿{Number(o.total_amount).toLocaleString()}</span>
                  </div>

                  {o.status === "shipped" && o.tracking_no && (
                    <div className="bg-green-50 rounded-xl px-3 py-2 mt-2">
                      <p className="text-[11px] text-green-700">
                        🚚 {L("เลขพัสดุ", "Tracking no.")}: <span className="font-mono font-semibold">{o.tracking_no}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
