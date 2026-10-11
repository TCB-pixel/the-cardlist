// ซิงก์สินค้า Loyverse (POS หน้าร้าน) → เว็บ (ตาราง products)
// (แยกจาก loyverse-sync ซึ่งคัดลอกข้อมูล Loyverse ทั้งหมดไปเก็บใน schema loyverse สำหรับรายงาน)
//   {"trigger":"cron"}                 pg_cron ทุก 15 นาที — ทำงานเฉพาะเมื่อเปิด auto_sync ใน loyverse_settings
//   {"trigger":"manual","dry_run":bool} ปุ่มในหน้าแอดมิน — dry_run = คำนวณให้ดูเฉยๆ ไม่เขียนอะไรเลย
//
// ลำดับในแต่ละรอบ
//   1. ดึงสินค้า + สต็อกจาก Loyverse
//   2. จับคู่กับสินค้าบนเว็บ (loyverse_variant_id ก่อน แล้วค่อย SKU/บาร์โค้ด)
//   3. ออเดอร์เว็บที่จ่ายแล้วแต่ยังไม่หักใน Loyverse → หักสต็อกใน Loyverse
//   4. อัปเดตสต็อก (+ราคา) บนเว็บตาม Loyverse / สร้างสินค้าใหม่แบบซ่อน
// secret: LOYVERSE_TOKEN (ตัวเดียวกับ loyverse-sync), LOYVERSE_STORE_ID ถ้ามีหลายสาขา
import { db } from "../_shared/db.ts";

const API = "https://api.loyverse.com/v1.0";

type Variant = {
  variant_id: string;
  sku: string | null;
  barcode: string | null;
  default_price: number | null;
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
  stores?: { store_id: string; pricing_type: string; price: number | null; available_for_sale: boolean }[];
};
type Item = {
  id: string;
  item_name: string;
  category_id: string | null;
  track_stock: boolean;
  deleted_at: string | null;
  variants: Variant[];
};
type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku: string | null;
  active: boolean;
  loyverse_variant_id: string | null;
};
type Change = { name: string; field: "stock" | "price" | "new"; from: number | null; to: number };

Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: valid } = await db.rpc("chatbot_verify_cron_secret", { p_secret: secret });
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const trigger = body.trigger === "manual" ? "manual" : "cron";
  const dryRun = trigger === "manual" && body.dry_run === true;

  const { data: settings } = await db.from("loyverse_settings").select("*").single();
  if (trigger === "cron" && !settings?.auto_sync) return new Response("auto sync off — skipped");
  if (!Deno.env.get("LOYVERSE_TOKEN")) return new Response("LOYVERSE_TOKEN not set — skipped");

  // กันซิงก์ซ้อนกัน (cron กับปุ่มกดพร้อมกัน) — รอบที่ยังไม่จบภายใน 5 นาที = ยังทำงานอยู่
  const { data: running } = await db.from("loyverse_sync_runs").select("id")
    .is("finished_at", null).gte("started_at", new Date(Date.now() - 5 * 60_000).toISOString()).limit(1);
  if (running?.length) return new Response("another sync is running — skipped");

  const { data: run } = await db.from("loyverse_sync_runs")
    .insert({ trigger, dry_run: dryRun }).select("id").single();

  try {
    const result = await sync(settings, dryRun);
    await db.from("loyverse_sync_runs").update({ ...result, ok: true, finished_at: new Date().toISOString() }).eq("id", run!.id);
    return Response.json(result);
  } catch (err) {
    console.error("loyverse web sync failed", err);
    await db.from("loyverse_sync_runs")
      .update({ ok: false, error: String((err as Error)?.message ?? err), finished_at: new Date().toISOString() })
      .eq("id", run!.id);
    return new Response("sync failed", { status: 500 });
  }
});

// ── Loyverse API ──────────────────────────────────────────────────────────

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${Deno.env.get("LOYVERSE_TOKEN")}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Loyverse ${path.split("?")[0]} ตอบ ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

// ดึงทุกหน้า (Loyverse ให้ทีละ 250 รายการ + cursor)
async function all<T>(path: string, key: string): Promise<T[]> {
  const out: T[] = [];
  let cursor = "";
  for (let i = 0; i < 100; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await api(`${path}${sep}limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    out.push(...(page[key] ?? []));
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

async function pickStore(): Promise<{ id: string; name: string }> {
  const { stores } = await api("/stores") as { stores: { id: string; name: string }[] };
  const wanted = Deno.env.get("LOYVERSE_STORE_ID");
  if (wanted) {
    const s = stores.find((x) => x.id === wanted);
    if (!s) throw new Error(`ไม่พบสาขา LOYVERSE_STORE_ID=${wanted} ใน Loyverse`);
    return s;
  }
  if (stores.length === 1) return stores[0];
  throw new Error(`Loyverse มี ${stores.length} สาขา ต้องตั้ง LOYVERSE_STORE_ID เป็นสาขาที่จะใช้: ` +
    stores.map((s) => `${s.name} = ${s.id}`).join(" | "));
}

// ── ซิงก์ ─────────────────────────────────────────────────────────────────

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// deno-lint-ignore no-explicit-any
async function sync(settings: any, dryRun: boolean) {
  const store = await pickStore();
  const [items, levels, categories] = await Promise.all([
    all<Item>("/items", "items"),
    all<{ variant_id: string; store_id: string; in_stock: number }>(`/inventory?store_ids=${store.id}`, "inventory_levels"),
    all<{ id: string; name: string }>("/categories", "categories"),
  ]);
  const inStock = new Map(levels.filter((l) => l.store_id === store.id).map((l) => [l.variant_id, Number(l.in_stock) || 0]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const warnings: string[] = [];

  // variant ทั้งหมดใน Loyverse (ข้ามสินค้าที่ถูกลบ)
  const variants = items.filter((i) => !i.deleted_at).flatMap((item) => item.variants.map((v) => ({ item, v })));
  const byVariant = new Map(variants.map((x) => [x.v.variant_id, x]));
  const byCode = new Map<string, (typeof variants)[number]>();
  for (const x of variants) {
    for (const code of [norm(x.v.sku), norm(x.v.barcode)]) {
      if (!code) continue;
      if (byCode.has(code) && byCode.get(code)!.v.variant_id !== x.v.variant_id) warnings.push(`SKU/บาร์โค้ดซ้ำใน Loyverse: ${code}`);
      else byCode.set(code, x);
    }
  }

  const { data: productRows, error } = await db.from("products")
    .select("id, name, price, stock, sku, active, loyverse_variant_id");
  if (error) throw error;
  const products = (productRows ?? []) as Product[];

  // 2) จับคู่
  const pairs: { p: Product; x: (typeof variants)[number] }[] = [];
  const usedVariants = new Set<string>();
  const unmatchedWeb: { name: string; sku: string | null }[] = [];
  for (const p of products) {
    const x = (p.loyverse_variant_id && byVariant.get(p.loyverse_variant_id)) || (p.sku ? byCode.get(norm(p.sku)) : undefined);
    if (!x || usedVariants.has(x.v.variant_id)) {
      unmatchedWeb.push({ name: p.name, sku: p.sku });
      continue;
    }
    usedVariants.add(x.v.variant_id);
    pairs.push({ p, x });
  }
  const productByVariant = new Map(pairs.map(({ p, x }) => [x.v.variant_id, p]));

  // 3) ออเดอร์เว็บ → หักสต็อกใน Loyverse
  const ordersPushed = await pushWebOrders(settings, store.id, productByVariant, inStock, warnings, dryRun);

  // ออเดอร์ที่เข้ามาระหว่างรอบนี้ (ยังไม่ได้หักใน Loyverse) — กันสต็อกเว็บเด้งกลับเกินจริงชั่วคราว
  const pendingQty = dryRun ? new Map<string, number>() : await pendingWebQty(settings);

  // 4) อัปเดตสต็อก/ราคาบนเว็บ
  const changes: Change[] = [];
  const now = new Date().toISOString();
  for (const { p, x } of pairs) {
    const patch: Record<string, unknown> = {};
    if (p.loyverse_variant_id !== x.v.variant_id) patch.loyverse_variant_id = x.v.variant_id;

    if (x.item.track_stock) {
      const stock = Math.max(0, Math.floor(inStock.get(x.v.variant_id) ?? 0) - (pendingQty.get(p.id) ?? 0));
      if (stock !== p.stock) {
        patch.stock = stock;
        changes.push({ name: p.name, field: "stock", from: p.stock, to: stock });
      }
    }
    const price = priceOf(x.v, store.id);
    if (settings?.sync_price && price !== null && price !== Number(p.price)) {
      patch.price = price;
      changes.push({ name: p.name, field: "price", from: Number(p.price), to: price });
    }

    if (!dryRun && Object.keys(patch).length) {
      const { error: upErr } = await db.from("products").update({ ...patch, loyverse_synced_at: now }).eq("id", p.id);
      if (upErr) warnings.push(`อัปเดต ${p.name} ไม่สำเร็จ: ${upErr.message}`);
    }
  }

  // สินค้าใหม่ใน Loyverse → สร้างบนเว็บแบบซ่อน
  let created = 0;
  if (settings?.create_missing) {
    for (const x of variants) {
      if (usedVariants.has(x.v.variant_id)) continue;
      const name = [x.item.item_name, x.v.option1_value, x.v.option2_value, x.v.option3_value].filter(Boolean).join(" ");
      const stock = x.item.track_stock ? Math.max(0, Math.floor(inStock.get(x.v.variant_id) ?? 0)) : 0;
      changes.push({ name, field: "new", from: null, to: stock });
      created++;
      if (dryRun) continue;
      const { error: insErr } = await db.from("products").insert({
        name,
        price: priceOf(x.v, store.id) ?? 0,
        stock,
        sku: x.v.sku || x.v.barcode || null,
        category: (x.item.category_id && categoryName.get(x.item.category_id)) || "อื่นๆ",
        tcg: "อื่นๆ",
        active: false, // แอดมินใส่รูป/หมวดแล้วค่อยเปิดขาย
        loyverse_variant_id: x.v.variant_id,
        loyverse_synced_at: now,
      });
      if (insErr) warnings.push(`สร้าง ${name} ไม่สำเร็จ: ${insErr.message}`);
    }
  }

  return {
    store_name: store.name,
    loyverse_items: variants.length,
    matched: pairs.length,
    updated: new Set(changes.filter((c) => c.field !== "new").map((c) => c.name)).size,
    created,
    orders_pushed: ordersPushed,
    changes: changes.slice(0, 500),
    unmatched_web: unmatchedWeb,
    warnings: [...new Set(warnings)].slice(0, 100),
  };
}

// ราคาของสาขานี้ (ถ้าตั้งราคาเฉพาะสาขา) ไม่งั้นราคาตั้งต้น — null = ราคาแปรผัน ไม่ซิงก์
function priceOf(v: Variant, storeId: string): number | null {
  const s = v.stores?.find((x) => x.store_id === storeId);
  if (s?.pricing_type === "VARIABLE") return null;
  const price = s?.price ?? v.default_price;
  return price === null || price === undefined ? null : Number(price);
}

// ออเดอร์ที่ต้องหักใน Loyverse: จ่ายแล้ว ไม่ถูกยกเลิก เกิดหลังเปิดซิงก์ และยังไม่เคยหัก
// deno-lint-ignore no-explicit-any
function unsyncedOrders(settings: any) {
  return db.from("orders")
    .select("id, order_items(product_id, qty, quantity)")
    .is("loyverse_synced_at", null)
    .not("status", "in", "(cancelled,refunded,pending)")
    .gte("created_at", settings?.enabled_at ?? "9999-01-01");
}

// deno-lint-ignore no-explicit-any
async function pendingWebQty(settings: any): Promise<Map<string, number>> {
  const qty = new Map<string, number>();
  const { data } = await unsyncedOrders(settings);
  for (const o of data ?? []) {
    // deno-lint-ignore no-explicit-any
    for (const it of (o.order_items ?? []) as any[]) {
      if (it.product_id) qty.set(it.product_id, (qty.get(it.product_id) ?? 0) + (it.qty ?? it.quantity ?? 0));
    }
  }
  return qty;
}

async function pushWebOrders(
  // deno-lint-ignore no-explicit-any
  settings: any,
  storeId: string,
  productByVariant: Map<string, Product>,
  inStock: Map<string, number>,
  warnings: string[],
  dryRun: boolean,
): Promise<number> {
  if (!settings?.enabled_at) return 0; // ยังไม่เคยเปิดซิงก์ — ไม่ย้อนหักออเดอร์เก่า
  const { data: orders, error } = await unsyncedOrders(settings);
  if (error) throw error;
  if (!orders?.length) return 0;
  if (dryRun) return orders.length;

  // จองออเดอร์ก่อน (กันสองรอบหักซ้ำ) — ถ้าส่ง Loyverse ไม่สำเร็จค่อยคืน
  const { data: claimed } = await db.from("orders")
    .update({ loyverse_synced_at: new Date().toISOString() })
    .in("id", orders.map((o) => o.id)).is("loyverse_synced_at", null)
    .select("id, order_items(product_id, qty, quantity)");
  if (!claimed?.length) return 0;

  const variantOf = new Map([...productByVariant].map(([vid, p]) => [p.id, vid]));
  const deduct = new Map<string, number>();
  for (const o of claimed) {
    // deno-lint-ignore no-explicit-any
    for (const it of (o.order_items ?? []) as any[]) {
      const vid = it.product_id && variantOf.get(it.product_id);
      if (!vid) {
        warnings.push(`ออเดอร์ ${o.id.slice(0, 8)}: สินค้า ${it.product_id} ไม่ได้ผูกกับ Loyverse — หักสต็อกใน Loyverse เองด้วย`);
        continue;
      }
      deduct.set(vid, (deduct.get(vid) ?? 0) + (it.qty ?? it.quantity ?? 0));
    }
  }

  if (deduct.size) {
    const inventory_levels = [...deduct].map(([variant_id, q]) => ({
      variant_id,
      store_id: storeId,
      stock_after: (inStock.get(variant_id) ?? 0) - q,
    }));
    try {
      await api("/inventory", { method: "POST", body: JSON.stringify({ inventory_levels }) });
    } catch (err) {
      await db.from("orders").update({ loyverse_synced_at: null }).in("id", claimed.map((o) => o.id));
      throw err;
    }
    for (const l of inventory_levels) inStock.set(l.variant_id, l.stock_after);
  }
  return claimed.length;
}
