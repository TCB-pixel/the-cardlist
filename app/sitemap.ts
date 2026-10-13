import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITE = "https://thecardlistbkk.com";

// ข่าวและอีเวนต์เปลี่ยนบ่อย — สร้างใหม่ทุกชั่วโมงพอ ไม่ต้องยิงฐานข้อมูลทุกคำขอ
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = ["", "/shop", "/events", "/booth", "/news", "/thaiartistcards"].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: now,
  }));

  // เพิ่มหน้าข่าวรายเรื่อง — ถ้าดึงไม่ได้ก็ยังได้ sitemap หน้าหลักตามปกติ
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const db = createClient(url, key);
      const { data } = await db.from("news").select("slug, published_at").not("slug", "is", null).limit(500);
      for (const n of data ?? []) {
        pages.push({
          url: `${SITE}/news/${encodeURIComponent(n.slug)}`,
          lastModified: n.published_at ? new Date(n.published_at) : now,
        });
      }
    }
  } catch {
    /* ข้ามไป */
  }

  return pages;
}
