import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ตรวจสิทธิ์ผู้เรียก (แอดมินระดับใดก็ได้) — ต้องแนบ Authorization: Bearer <access_token>
async function requireAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return false;

  const { data: au } = await supabase
    .from("admin_users")
    .select("active")
    .eq("email", user.email)
    .maybeSingle();
  if (au) return au.active !== false;

  const { data: st } = await supabase
    .from("admin_staff")
    .select("active")
    .eq("email", user.email)
    .maybeSingle();
  return !!st && st.active !== false;
}

export async function GET(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });

  const supabase = getSupabase();

  // General registrations
  const { data: genData } = await supabase
    .from("general_registrations")
    .select("id, pack_paid");

  const generalTotal = genData?.length ?? 0;
  const generalPaidPack = genData?.filter((g) => g.pack_paid === true).length ?? 0;
  const generalNotPaid = generalTotal - generalPaidPack;

  // Priority tickets
  const { data: priData } = await supabase
    .from("event_tickets")
    .select("id, status");

  const priorityApproved = priData?.filter((t) => t.status === "approved").length ?? 0;
  const priorityPending = priData?.filter((t) => t.status === "pending").length ?? 0;
  const priorityRejected = priData?.filter((t) => t.status === "rejected").length ?? 0;
  const priorityTotal = priorityApproved + priorityPending;

  // Recent orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(5);

  // Shop revenue
  const { data: shopOrders } = await supabase
    .from("orders")
    .select("id, total_amount, status")
    .in("status", ["paid", "completed", "shipped"]);

  const shopRevenue = shopOrders?.reduce((sum, o) => sum + (o.total_amount ?? 0), 0) ?? 0;
  const shopOrderCount = shopOrders?.length ?? 0;

  // ── มูลค่าสต็อกคงเหลือ (ราคาขาย + ราคาทุน ถ้ามี) ──
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name, stock, price, cost_price");

  const stockValueRetail =
    allProducts?.reduce((sum, p) => sum + p.stock * Number(p.price ?? 0), 0) ?? 0;
  const productsWithCost = allProducts?.filter((p) => p.cost_price != null) ?? [];
  const stockValueCost = productsWithCost.reduce(
    (sum, p) => sum + p.stock * Number(p.cost_price ?? 0),
    0
  );
  const productsMissingCost = (allProducts?.length ?? 0) - productsWithCost.length;

  // ── กำไรขั้นต้น + สินค้าขายดี (จาก order_items ของออเดอร์ที่จ่ายแล้วเท่านั้น) ──
  const paidOrderIds = (shopOrders ?? []).map((o) => o.id);
  let grossProfit = 0;
  let profitItemsMissingCost = 0;
  let bestSellers: { product_id: string; name: string; qtySold: number; revenue: number }[] = [];

  if (paidOrderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, name, qty, price")
      .in("order_id", paidOrderIds);

    const costMap = new Map((allProducts ?? []).map((p) => [p.id, p.cost_price]));
    const salesByProduct = new Map<
      string,
      { name: string; qtySold: number; revenue: number }
    >();

    for (const it of items ?? []) {
      const qty = Number(it.qty ?? 0);
      const price = Number(it.price ?? 0);
      const cost = costMap.get(it.product_id);

      if (cost != null) {
        grossProfit += (price - Number(cost)) * qty;
      } else {
        profitItemsMissingCost += qty;
      }

      const key = it.product_id ?? it.name;
      const existing = salesByProduct.get(key);
      if (existing) {
        existing.qtySold += qty;
        existing.revenue += price * qty;
      } else {
        salesByProduct.set(key, { name: it.name, qtySold: qty, revenue: price * qty });
      }
    }

    bestSellers = Array.from(salesByProduct.entries())
      .map(([product_id, v]) => ({ product_id, ...v }))
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 5);
  }

  return NextResponse.json({
    shopRevenue,
    shopOrderCount,
    eventStats: {
      generalTotal,
      generalPaidPack,
      generalNotPaid,
      priorityApproved,
      priorityPending,
      priorityRejected,
      priorityTotal,
    },
    recentOrders: recentOrders ?? [],
    inventory: {
      stockValueRetail,
      stockValueCost,
      productsMissingCost, // จำนวนสินค้าที่ยังไม่ได้กรอกราคาทุน
      lowStock: (allProducts ?? [])
        .filter((p) => p.stock <= 5)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    },
    profit: {
      grossProfit, // กำไรขั้นต้นจากสินค้าที่มีราคาทุนแล้วเท่านั้น
      itemsSoldMissingCost: profitItemsMissingCost, // จำนวนชิ้นที่ขายไปแล้วแต่ยังคำนวณกำไรไม่ได้ (ไม่มีราคาทุน ณ ตอนนั้น)
    },
    bestSellers,
  });
}
