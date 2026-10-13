import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// อีเวนต์รายงาน: ตั้งชื่อหน้า/รูปตอนแชร์ตามเนื้อหาจริง และส่งสถานะ 404 จริงเมื่อไม่พบ (ไม่ใช่หน้าเปล่าที่ตอบ 200)
async function load(key: string) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.from("events").select("*").eq("id", key).maybeSingle();
  // ฐานข้อมูลมีปัญหา ≠ ไม่พบ — ปล่อยให้หน้าแสดงตามปกติ
  if (error) return { row: null, failed: error.code !== "22P02" }; // 22P02 = รหัสไม่ใช่รูปแบบที่ถูกต้อง ถือว่าไม่พบ
  return { row: data as any, failed: false };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { row } = await load(decodeURIComponent(id));
  if (!row) return { title: "ไม่พบหน้านี้" };
  const description = String(row.location ? `${row.location}` : row.description ?? "").slice(0, 160);
  return {
    title: row.title,
    description,
    openGraph: { title: row.title, description, ...(row.image_url ? { images: [row.image_url] } : {}) },
  };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { row, failed } = await load(decodeURIComponent(id));
  if (!row && !failed) notFound();
  return children;
}
