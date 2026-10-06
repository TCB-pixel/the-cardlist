// ── Loyverse API client ──
// เอกสาร: https://developer.loyverse.com/docs/
// ใช้ access token จาก Loyverse (Settings → Access tokens) ตั้งใน env ชื่อ LOYVERSE_ACCESS_TOKEN
// ตอนนี้ใช้อ่านอย่างเดียว — ยังไม่มีฟังก์ชันไหนเขียนกลับไปที่ Loyverse

const BASE = "https://api.loyverse.com/v1.0";

export class LoyverseError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function token() {
  const t = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!t) throw new LoyverseError("ยังไม่ได้ตั้งค่า LOYVERSE_ACCESS_TOKEN", 503);
  return t;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) throw new LoyverseError("Loyverse ปฏิเสธ token (401) — ตรวจสอบว่า token ถูกต้องและยังไม่ถูกเพิกถอน", 401);
    if (res.status === 429) throw new LoyverseError("เรียก Loyverse ถี่เกินไป (429) — รอสักครู่แล้วลองใหม่", 429);
    throw new LoyverseError(`Loyverse ตอบ ${res.status}${body ? ": " + body.slice(0, 200) : ""}`, res.status);
  }
  return res.json() as Promise<T>;
}

// ดึงทุกหน้าโดยไล่ตาม cursor — Loyverse แบ่งหน้าแบบ cursor ไม่ใช่ offset
async function getAll<T>(path: string, key: string, params: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = [];
  let cursor = "";
  // กันวนไม่รู้จบถ้า API ส่ง cursor เดิมกลับมา
  for (let page = 0; page < 50; page++) {
    const data = await get<Record<string, any>>(path, { ...params, limit: "250", cursor });
    const rows = (data[key] ?? []) as T[];
    out.push(...rows);
    const next = data.cursor as string | undefined;
    if (!next || next === cursor || rows.length === 0) break;
    cursor = next;
  }
  return out;
}

export type LoyverseStore = { id: string; name: string };

export type LoyverseVariant = {
  variant_id: string;
  item_id: string;
  sku: string | null;
  barcode: string | null;
  option1_value?: string | null;
  default_price?: number | null;
};

export type LoyverseItem = {
  id: string;
  item_name: string;
  category_id?: string | null;
  variants: LoyverseVariant[];
  deleted_at?: string | null;
};

export type LoyverseInventoryLevel = {
  variant_id: string;
  store_id: string;
  in_stock: number;
  updated_at: string;
};

export const listStores = () => getAll<LoyverseStore>("/stores", "stores");
export const listItems = () => getAll<LoyverseItem>("/items", "items");
export const listInventory = (storeIds?: string) =>
  getAll<LoyverseInventoryLevel>("/inventory", "inventory_levels", storeIds ? { store_ids: storeIds } : {});

// SKU ฝั่ง Loyverse กับฝั่งเว็บอาจพิมพ์ต่างกันเล็กน้อย — เทียบแบบไม่สนตัวพิมพ์/ช่องว่าง/ขีด
export function normaliseSku(sku: string | null | undefined) {
  return (sku ?? "").toUpperCase().replace(/[\s\-_]/g, "");
}
