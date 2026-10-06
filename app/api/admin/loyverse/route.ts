import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import {
  LoyverseError, listItems, listInventory, listStores, normaliseSku,
  type LoyverseVariant,
} from "@/lib/loyverse";

export const maxDuration = 60;

type Row = {
  sku: string;
  name: string;
  webStock: number | null;
  posStock: number | null;
  status: "match" | "diff" | "web_only" | "pos_only";
};

// ---------- GET : เทียบสต็อกเว็บกับ Loyverse (อ่านอย่างเดียว ไม่เขียนทับอะไร) ----------
// ?storeId=... เลือกสาขา (ไม่ใส่ = รวมทุกสาขา)
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "products:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const storeId = new URL(req.url).searchParams.get("storeId") ?? "";

  try {
    const [stores, items, inventory, { data: products }] = await Promise.all([
      listStores(),
      listItems(),
      listInventory(storeId),
      adminDb.from("products").select("sku, name, stock, active"),
    ]);

    // variant_id -> ข้อมูลสินค้าใน Loyverse
    const variantById = new Map<string, { v: LoyverseVariant; itemName: string }>();
    for (const item of items) {
      if (item.deleted_at) continue;
      for (const v of item.variants ?? []) {
        const label = v.option1_value ? `${item.item_name} (${v.option1_value})` : item.item_name;
        variantById.set(v.variant_id, { v, itemName: label });
      }
    }

    // รวมสต็อกต่อ variant (ถ้าไม่เลือกสาขา = บวกทุกสาขา)
    const stockByVariant = new Map<string, number>();
    for (const lvl of inventory) {
      stockByVariant.set(lvl.variant_id, (stockByVariant.get(lvl.variant_id) ?? 0) + (lvl.in_stock ?? 0));
    }

    // ฝั่ง Loyverse: SKU -> { ชื่อ, สต็อก }
    const posBySku = new Map<string, { name: string; stock: number }>();
    let posNoSku = 0;
    for (const [variantId, { v, itemName }] of variantById) {
      const key = normaliseSku(v.sku);
      if (!key) { posNoSku++; continue; }
      const stock = stockByVariant.get(variantId) ?? 0;
      const prev = posBySku.get(key);
      // SKU ซ้ำกันใน Loyverse ให้รวมสต็อก
      posBySku.set(key, { name: prev?.name ?? itemName, stock: (prev?.stock ?? 0) + stock });
    }

    const rows: Row[] = [];
    const seen = new Set<string>();
    let webNoSku = 0;

    for (const p of products ?? []) {
      const key = normaliseSku(p.sku);
      if (!key) { webNoSku++; continue; }
      seen.add(key);
      const pos = posBySku.get(key);
      rows.push({
        sku: p.sku as string,
        name: p.name,
        webStock: p.stock,
        posStock: pos ? pos.stock : null,
        status: !pos ? "web_only" : pos.stock === p.stock ? "match" : "diff",
      });
    }

    for (const [key, pos] of posBySku) {
      if (seen.has(key)) continue;
      rows.push({ sku: key, name: pos.name, webStock: null, posStock: pos.stock, status: "pos_only" });
    }

    const order = { diff: 0, web_only: 1, pos_only: 2, match: 3 } as const;
    rows.sort((a, b) => order[a.status] - order[b.status] || a.sku.localeCompare(b.sku));

    return NextResponse.json({
      stores,
      storeId,
      summary: {
        match:    rows.filter((r) => r.status === "match").length,
        diff:     rows.filter((r) => r.status === "diff").length,
        webOnly:  rows.filter((r) => r.status === "web_only").length,
        posOnly:  rows.filter((r) => r.status === "pos_only").length,
        webNoSku,
        posNoSku,
      },
      rows,
    });
  } catch (e: any) {
    if (e instanceof LoyverseError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e?.message ?? "เชื่อมต่อ Loyverse ไม่สำเร็จ" }, { status: 500 });
  }
}
