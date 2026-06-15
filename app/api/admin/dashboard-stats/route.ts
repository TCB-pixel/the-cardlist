import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
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
    .select("total_amount, status")
    .in("status", ["paid", "completed", "shipped"]);

  const shopRevenue = shopOrders?.reduce((sum, o) => sum + (o.total_amount ?? 0), 0) ?? 0;
  const shopOrderCount = shopOrders?.length ?? 0;

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
  });
}
