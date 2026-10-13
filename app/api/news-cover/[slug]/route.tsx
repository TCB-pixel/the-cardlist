import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

// รูปปกข่าวอัตโนมัติ (1200×630) สำหรับข่าวที่ไม่มีรูป — ใช้ทั้งในหน้าข่าวและตอนแชร์ลิงก์ใน LINE/Facebook
// สร้างจากชื่อข่าว หมวด และวันที่จริงในฐานข้อมูล

const TAG_LABEL: Record<string, string> = {
  NEWS: "ข่าวสาร",
  RELEASE: "สินค้าใหม่ / พรีออเดอร์",
  TOURNAMENT: "ทัวร์นาเมนต์",
  "DECK GUIDE": "Deck Guide",
};

// ดึงฟอนต์ Noto Sans Thai/Noto Sans เฉพาะตัวอักษรที่ใช้ (ไฟล์เล็ก) — ตัวสร้างรูปต้องใช้ไฟล์ TTF
async function loadFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@700&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

function thaiDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: post } = await db
    .from("news")
    .select("title, tag, published_at")
    .eq("slug", decodeURIComponent(slug))
    .maybeSingle();
  if (!post) return new Response("not found", { status: 404 });

  const title = String(post.title ?? "").slice(0, 140);
  const tag = TAG_LABEL[post.tag] ?? post.tag ?? "ข่าวสาร";
  const date = thaiDate(post.published_at);
  const text = `${title}${tag}${date}THE CARDLIST thecardlistbkk.com`;

  const [thai, latin] = await Promise.all([loadFont("Noto+Sans+Thai", text), loadFont("Noto+Sans", text)]);
  const fonts = [
    ...(latin ? [{ name: "NotoSans", data: latin, weight: 700 as const, style: "normal" as const }] : []),
    ...(thai ? [{ name: "NotoSansThai", data: thai, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: "#0a0a0a", color: "#ffffff", padding: "64px 72px",
          fontFamily: "NotoSans, NotoSansThai",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${new URL(req.url).origin}/images/cardlist-logo.png`} width={56} height={74} alt="" />
            <div style={{ fontSize: 30, letterSpacing: 4 }}>THE CARDLIST</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, padding: "10px 24px", borderRadius: 999, background: "#ffffff", color: "#0a0a0a" }}>
            {tag}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: title.length > 70 ? 54 : 64, lineHeight: 1.3 }}>{title}</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 26, color: "#a1a1aa" }}>
          <div style={{ display: "flex" }}>{date}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 44, height: 8, background: "#e24b4a" }} />
            <div style={{ width: 44, height: 8, background: "#f5b301" }} />
            <div style={{ width: 44, height: 8, background: "#1f5aa6" }} />
          </div>
          <div style={{ display: "flex" }}>thecardlistbkk.com</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    }
  );
}
