// คัดลอกข้อมูล Loyverse (POS หน้าร้าน) มาเก็บใน schema loyverse — pg_cron เรียกทุก 10 นาที {"mode":"auto"}
//   ทุกรอบ (ดึงทั้งหมด): stores, categories, payment_types, employees, items, inventory
//   เฉพาะที่เปลี่ยน (ตั้งแต่ sync_state.last_updated_at): customers, receipts
// ข้อมูลเข้าผ่านฟังก์ชัน loyverse.ingest_* ในฐานข้อมูล / บันทึกผลใน loyverse.sync_log + sync_state
// ใช้ข้อมูลนี้: loyverse-daily-report (รายงานยอดขาย 23:05), view loyverse.v_stock / v_receipts ฯลฯ
//
// schema loyverse ไม่ได้เปิดให้ API — จึงต่อฐานข้อมูลตรงด้วย SUPABASE_DB_URL (Supabase ใส่ให้อัตโนมัติ)
// secret: LOYVERSE_TOKEN (Access token จากหลังร้าน Loyverse)
import postgres from "npm:postgres@3";

const API = "https://api.loyverse.com/v1.0";
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const [{ ok }] = await sql`
    select exists (select 1 from vault.decrypted_secrets where name = 'loyverse_cron_secret' and decrypted_secret = ${secret}) as ok`;
  if (!ok) return new Response("Unauthorized", { status: 401 });

  const { mode = "auto" } = await req.json().catch(() => ({}));
  const [{ id: logId }] = await sql`
    insert into loyverse.sync_log (started_at, status, detail) values (now(), 'running', ${sql.json({ mode })}) returning id`;
  const detail: Record<string, unknown> = { mode };

  try {
    // ข้อมูลหลัก — ดึงทั้งหมดทุกรอบ (show_deleted ให้ของที่ลบใน Loyverse ถูกลบในนี้ด้วย)
    for (const [kind, path, key] of [
      ["stores", "/stores", "stores"],
      ["categories", "/categories?show_deleted=true", "categories"],
      ["payment_types", "/payment_types?show_deleted=true", "payment_types"],
      ["employees", "/employees?show_deleted=true", "employees"],
      ["items", "/items?show_deleted=true", "items"],
    ] as const) {
      detail[kind] = await syncFull(kind, path, key, (rows) => sql`select loyverse.ingest_simple(${kind}, ${sql.json(rows)}) as n`);
    }
    detail.inventory = await syncFull("inventory", "/inventory", "inventory_levels",
      (rows) => sql`select loyverse.ingest_inventory(${sql.json(rows)}) as n`);

    // ลูกค้า / บิลขาย — ดึงเฉพาะที่เปลี่ยนตั้งแต่รอบก่อน
    detail.customers = await syncSince("customers", "/customers", "customers",
      (rows) => sql`select loyverse.ingest_simple('customers', ${sql.json(rows)}) as n`);
    detail.receipts = await syncSince("receipts", "/receipts", "receipts",
      (rows) => sql`select loyverse.ingest_receipts(${sql.json(rows)}) as n`);

    await sql`update loyverse.sync_log set finished_at = now(), status = 'ok', detail = ${sql.json(detail)} where id = ${logId}`;
    return Response.json(detail);
  } catch (err) {
    console.error("loyverse sync failed", err);
    detail.error = String((err as Error)?.message ?? err);
    await sql`update loyverse.sync_log set finished_at = now(), status = 'error', detail = ${sql.json(detail)} where id = ${logId}`;
    return new Response("sync failed", { status: 500 });
  }
});

async function api(path: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${Deno.env.get("LOYVERSE_TOKEN")}` } });
  if (!res.ok) throw new Error(`Loyverse ${path.split("?")[0]} ตอบ ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

// ดึงทุกหน้า (ทีละ 250 + cursor) แล้วส่งเข้าฐานข้อมูลทีละหน้า
// deno-lint-ignore no-explicit-any
async function pages(path: string, key: string, ingest: (rows: any[]) => Promise<{ n: number }[]>): Promise<number> {
  let count = 0;
  let cursor = "";
  for (let i = 0; i < 400; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await api(`${path}${sep}limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    const rows = page[key] ?? [];
    if (rows.length) count += (await ingest(rows))[0].n;
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return count;
}

// deno-lint-ignore no-explicit-any
async function syncFull(resource: string, path: string, key: string, ingest: (rows: any[]) => Promise<{ n: number }[]>) {
  const n = await pages(path, key, ingest);
  await sql`
    insert into loyverse.sync_state (resource, last_run_at, last_status, last_count) values (${resource}, now(), 'ok', ${n})
    on conflict (resource) do update set last_run_at = now(), last_status = 'ok', last_count = ${n}`;
  return n;
}

// ดึงเฉพาะที่ updated_at >= เวลาเริ่มรอบก่อน (จดเวลาเริ่มก่อนดึง กันพลาดรายการที่แก้ระหว่างดึง)
// deno-lint-ignore no-explicit-any
async function syncSince(resource: string, path: string, key: string, ingest: (rows: any[]) => Promise<{ n: number }[]>) {
  const [state] = await sql`select last_updated_at from loyverse.sync_state where resource = ${resource}`;
  const startedAt = new Date().toISOString();
  const since = state?.last_updated_at ? new Date(state.last_updated_at).toISOString() : null;
  const n = await pages(since ? `${path}?updated_at_min=${encodeURIComponent(since)}` : path, key, ingest);
  await sql`
    insert into loyverse.sync_state (resource, last_updated_at, last_run_at, last_status, last_count)
    values (${resource}, ${startedAt}, now(), 'ok', ${n})
    on conflict (resource) do update set last_updated_at = ${startedAt}, last_run_at = now(), last_status = 'ok', last_count = ${n}`;
  return n;
}
