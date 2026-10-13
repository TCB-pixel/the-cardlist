import { NextResponse } from "next/server";
import { adminDb } from "@/lib/require-admin";
import { getUserFromRequest } from "@/lib/booth";

export const maxDuration = 30;

const BUCKET = "vendor-logos";
const MAX_BYTES = 2 * 1024 * 1024;

// ตรวจชนิดไฟล์จากเนื้อไฟล์จริง (ไม่เชื่อนามสกุล/ชนิดที่ส่งมา) — รับเฉพาะ PNG / JPEG / WebP, ไม่รับ SVG
function sniff(buf: Uint8Array): { ext: string; mime: string } | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length > 12 && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

// อัปโหลดโลโก้ร้านของ Vendor (ผ่านเซิร์ฟเวอร์ เพราะผู้ใช้ทั่วไปเขียน Storage ตรงไม่ได้)
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "เข้าสู่ระบบก่อนอัปโหลดโลโก้" }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "อ่านไฟล์ไม่สำเร็จ" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 2 MB" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return NextResponse.json({ error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP" }, { status: 400 });

  const path = `${user.id}/${Date.now()}.${kind.ext}`;
  const { error: upErr } = await adminDb.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (upErr) {
    console.error("vendor logo upload:", upErr.message);
    return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }

  // ไม่ลบไฟล์เก่า: รายการจองที่ผ่านมาอ้างอิงโลโก้ ณ ตอนจองไว้ ลบแล้วรูปในหลังบ้านจะหาย

  const { data } = adminDb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
