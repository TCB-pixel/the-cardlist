import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

// ---------- GET : รายชื่อคนที่ได้สิทธิ์ + สรุปโควตาแต่ละรางวัล ----------
// ?status=granted|used|all (ค่าเริ่มต้น all)
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "play:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const status = new URL(req.url).searchParams.get("status") ?? "all";

  const { data: rewards, error: rErr } = await adminDb
    .from("stamp_rewards")
    .select("*")
    .order("order", { ascending: true });
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });

  let q = adminDb
    .from("stamp_reward_grants")
    .select("id, user_id, reward_id, granted_at, visits_at_grant, status, used_at, used_by_email")
    .order("granted_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);

  const { data: grants, error: gErr } = await q;
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 400 });

  const ids = Array.from(new Set((grants ?? []).map((g) => g.user_id)));
  const { data: profiles } = ids.length
    ? await adminDb.from("profiles").select("id, member_code, display_name, username, phone").in("id", ids)
    : { data: [] as any[] };
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const rewardById = new Map((rewards ?? []).map((r: any) => [r.id, r]));

  return NextResponse.json({
    rewards: rewards ?? [],
    grants: (grants ?? []).map((g) => {
      const p = byId.get(g.user_id);
      const r = rewardById.get(g.reward_id);
      return {
        ...g,
        member_code: p?.member_code ?? "—",
        name: p?.display_name ?? p?.username ?? "(ไม่ทราบชื่อ)",
        phone: p?.phone ?? null,
        reward_name: r?.name ?? "—",
        reward_price: r?.price ?? null,
      };
    }),
  });
}

// ---------- PATCH : staff กดตัดสิทธิ์เมื่อลูกค้าซื้อหน้างานแล้ว ----------
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, "play:scan");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id, status } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });
    if (!["granted", "used", "expired"].includes(status)) {
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    }

    const update: Record<string, unknown> = { status };
    if (status === "used") {
      update.used_at = new Date().toISOString();
      update.used_by_email = auth.caller.email;
    } else {
      update.used_at = null;
      update.used_by_email = null;
    }

    const { data, error } = await adminDb
      .from("stamp_reward_grants")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ grant: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
