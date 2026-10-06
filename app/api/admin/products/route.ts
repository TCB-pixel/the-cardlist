import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AdminRole, can } from "@/lib/rbac";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────────────────
// ตรวจสิทธิ์ผู้เรียกฝั่ง server — ต้องแนบ Authorization: Bearer <access_token>
// (RLS ของ products ปิดการเขียนไว้แล้ว ต้องผ่าน service role ในไฟล์นี้เท่านั้น)
// ─────────────────────────────────────────────────────────────────────────────
type Caller = { userId: string; email: string; role: AdminRole };

async function requireAdmin(
  req: NextRequest
): Promise<{ ok: true; caller: Caller } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "ไม่ได้เข้าสู่ระบบ" };

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user?.email) return { ok: false, status: 401, error: "token ไม่ถูกต้อง" };
  const email = user.email;

  const { data: au } = await admin
    .from("admin_users")
    .select("role, active")
    .eq("email", email)
    .maybeSingle();
  if (au) {
    if (au.active === false) return { ok: false, status: 403, error: "บัญชีถูกระงับ" };
    return { ok: true, caller: { userId: user.id, email, role: au.role as AdminRole } };
  }

  const { data: st } = await admin
    .from("admin_staff")
    .select("role, active")
    .eq("email", email)
    .maybeSingle();
  if (st) {
    if (st.active === false) return { ok: false, status: 403, error: "บัญชีถูกระงับ" };
    return { ok: true, caller: { userId: user.id, email, role: st.role as AdminRole } };
  }

  return { ok: false, status: 403, error: "ไม่มีสิทธิ์เข้าถึง" };
}

// เขียนรูปเพิ่มเติมใหม่ทั้งชุด (ส่ง images มาเป็น array ของ url ตามลำดับที่ต้องการ)
async function replaceImages(productId: string, images: unknown) {
  if (!Array.isArray(images)) return;
  const urls = images.map((u) => String(u ?? "").trim()).filter(Boolean).slice(0, 10);
  await admin.from("product_images").delete().eq("product_id", productId);
  if (urls.length === 0) return;
  await admin.from("product_images").insert(
    urls.map((url, i) => ({ product_id: productId, url, order: i + 1 }))
  );
}

// ---------- GET : ดึงรายการสินค้าทั้งหมด (แอดมินทุกระดับดูได้) หรือประวัติสต็อกของชิ้นเดียว ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const movementsFor = req.nextUrl.searchParams.get("movementsFor");
  if (movementsFor) {
    const { data, error } = await admin
      .from("stock_movements")
      .select("*")
      .eq("product_id", movementsFor)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ movements: data ?? [] });
  }

  const { data, error } = await admin
    .from("products")
    .select("*, product_images(id, url, order)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data ?? []).map((p: any) => {
    const { product_images, ...rest } = p;
    return {
      ...rest,
      images: (product_images ?? [])
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((i: any) => i.url),
    };
  });
  return NextResponse.json({ products });
}

// ---------- POST : เพิ่มสินค้าใหม่ ----------
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!can(auth.caller.role, "products:create")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เพิ่มสินค้า" }, { status: 403 });
    }

    const body = await req.json();
    const { name, sub, sku, price, stock, category, tcg, badge, rarity, image_url, description, cost_price, images } = body;

    if (!name || price === undefined || stock === undefined) {
      return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("products")
      .insert({
        name, sub: sub ?? "", sku: (sku ?? "").trim() || null, price, stock,
        category, tcg, badge: badge ?? "", rarity: rarity ?? "",
        image_url: image_url ?? null, description: description ?? "",
        cost_price: cost_price === undefined || cost_price === "" ? null : Number(cost_price),
        // เริ่มนับอายุ badge ตั้งแต่ตอนตั้งค่า — NEW จะหายเองเมื่อครบ 14 วัน
        badge_set_at: badge ? new Date().toISOString() : null,
        active: true,
      })
      .select("*")
      .single();

    if (error) {
      // unique index products_sku_key — บอกให้ชัดว่า SKU ซ้ำ ไม่ใช่ error ดิบจาก Postgres
      if (error.code === "23505" && error.message.includes("sku")) {
        return NextResponse.json({ error: "SKU นี้ถูกใช้กับสินค้าอื่นแล้ว" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await replaceImages(data.id, images);

    // ถ้าเพิ่มมาพร้อมสต็อกตั้งต้น > 0 ให้บันทึกลง log ว่าเป็นการรับเข้าครั้งแรก
    if (Number(stock) > 0) {
      await admin.from("stock_movements").insert({
        product_id: data.id,
        type: "receive",
        qty_change: Number(stock),
        note: "รับเข้าตอนสร้างสินค้าใหม่",
        created_by: auth.caller.userId,
      });
    }

    return NextResponse.json({ product: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : แก้ไขข้อมูลสินค้า หรือปรับสต็อก (รับเข้า/ปรับ) ----------
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!can(auth.caller.role, "products:edit")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขสินค้า" }, { status: 403 });
    }

    const body = await req.json();
    const { id, stockAdjustment } = body;
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    // ── กรณีปรับสต็อก (รับเข้า / ปรับปรุง) — log ลง stock_movements เสมอ ──
    if (stockAdjustment) {
      const { type, qtyChange, note } = stockAdjustment;
      if (!["receive", "adjustment"].includes(type) || !Number.isFinite(Number(qtyChange))) {
        return NextResponse.json({ error: "ข้อมูลปรับสต็อกไม่ถูกต้อง" }, { status: 400 });
      }

      const { data: current, error: curErr } = await admin
        .from("products")
        .select("stock")
        .eq("id", id)
        .single();
      if (curErr || !current) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });

      const newStock = Math.max(0, current.stock + Number(qtyChange));
      const { data: updated, error: updErr } = await admin
        .from("products")
        .update({ stock: newStock })
        .eq("id", id)
        .select("*")
        .single();
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

      await admin.from("stock_movements").insert({
        product_id: id,
        type,
        qty_change: Number(qtyChange),
        note: note || (type === "receive" ? "รับสินค้าเข้า" : "ปรับปรุงสต็อก"),
        created_by: auth.caller.userId,
      });

      return NextResponse.json({ product: updated });
    }

    // ── กรณีแก้ไขข้อมูลสินค้าปกติ ──
    const update: Record<string, unknown> = {};
    for (const key of ["name", "sub", "sku", "price", "stock", "category", "tcg", "badge", "rarity", "image_url", "description", "active", "cost_price"]) {
      if (body[key] !== undefined) update[key] = body[key] === "" && key === "cost_price" ? null : body[key];
    }
    // เปลี่ยน badge = เริ่มนับ 14 วันใหม่ / ล้าง badge = ล้างวันที่ด้วย
    if (body.badge !== undefined) {
      const { data: cur } = await admin.from("products").select("badge").eq("id", id).maybeSingle();
      if (cur && cur.badge !== body.badge) {
        update.badge_set_at = body.badge ? new Date().toISOString() : null;
      }
    }

    if (body.images !== undefined) await replaceImages(id, body.images);

    if (Object.keys(update).length === 0) {
      // แก้เฉพาะรูปก็ถือว่าสำเร็จ ไม่ใช่ "ไม่มีข้อมูลให้แก้ไข"
      if (body.images !== undefined) {
        const { data: p } = await admin.from("products").select("*").eq("id", id).single();
        return NextResponse.json({ product: p });
      }
      return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("products")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      // unique index products_sku_key — บอกให้ชัดว่า SKU ซ้ำ ไม่ใช่ error ดิบจาก Postgres
      if (error.code === "23505" && error.message.includes("sku")) {
        return NextResponse.json({ error: "SKU นี้ถูกใช้กับสินค้าอื่นแล้ว" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ product: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ลบสินค้า ----------
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!can(auth.caller.role, "products:delete")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ลบสินค้า" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const { error } = await admin.from("products").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
