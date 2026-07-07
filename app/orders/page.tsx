"use client";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase";

type OrderItem = { id: string; name: string; price: number; qty: number };

type Order = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  tracking_no: string | null;
  order_items: OrderItem[];
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  paid:      { text: "รอจัดส่ง",   cls: "bg-amber-100 text-amber-700" },
  shipped:   { text: "จัดส่งแล้ว", cls: "bg-green-100 text-green-700" },
  cancelled: { text: "ยกเลิก",     cls: "bg-zinc-100 text-zinc-500" },
  pending:   { text: "รอชำระ",    cls: "bg-zinc-100 text-zinc-500" },
};

export default function MyOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNeedLogin(true);
        setLoading(false);
        return;
      }
      // RLS policy "own orders read" ทำให้เห็นเฉพาะออเดอร์ตัวเอง
      const { data } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status, tracking_no, order_items(id, name, price, qty)")
        .order("created_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar />
      <main className="px-4 pt-4">
        <h1 className="text-base font-bold text-zinc-900 mb-3">ประวัติการสั่งซื้อ</h1>

        {loading ? (
          <p className="text-sm text-zinc-400 py-10 text-center">กำลังโหลด...</p>
        ) : needLogin ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-400 mb-3">กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อ</p>
            <a href="/login" className="text-xs bg-zinc-900 text-white rounded-lg px-4 py-2 inline-block">
              เข้าสู่ระบบ
            </a>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-400 mb-3">ยังไม่มีคำสั่งซื้อ</p>
            <a href="/shop" className="text-xs bg-zinc-900 text-white rounded-lg px-4 py-2 inline-block">
              ไปช้อปเลย →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const st = STATUS_LABEL[o.status] ?? { text: o.status, cls: "bg-zinc-100 text-zinc-500" };
              return (
                <div key={o.id} className="bg-white border border-zinc-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-zinc-400">
                      {new Date(o.created_at).toLocaleDateString("th-TH", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>
                      {st.text}
                    </span>
                  </div>

                  <div className="space-y-1 border-t border-zinc-50 pt-2">
                    {(o.order_items ?? []).map((it) => (
                      <div key={it.id} className="flex justify-between text-xs">
                        <span className="text-zinc-700 truncate mr-2">{it.name} <span className="text-zinc-400">×{it.qty}</span></span>
                        <span className="text-zinc-500 flex-shrink-0">฿{(Number(it.price) * it.qty).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-50">
                    <span className="text-xs text-zinc-500">รวมทั้งหมด</span>
                    <span className="text-sm font-bold text-zinc-900">฿{Number(o.total_amount).toLocaleString()}</span>
                  </div>

                  {o.status === "shipped" && o.tracking_no && (
                    <div className="bg-green-50 rounded-xl px-3 py-2 mt-2">
                      <p className="text-[11px] text-green-700">
                        🚚 เลขพัสดุ: <span className="font-mono font-semibold">{o.tracking_no}</span>
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
