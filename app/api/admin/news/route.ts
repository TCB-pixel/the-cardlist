import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AdminRole, can } from "@/lib/rbac";

// service role client — bypass RLS (เรียกได้เฉพาะฝั่ง server)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9฀-๿]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- GET : ดึงรายการบทความทั้งหมด (แอดมินทุกระดับดูได้) ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!can(auth.caller.role, "news:view")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข่าวสาร" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("news")
    .select("*")
    .order("published_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ news: data ?? [] });
}

// ---------- POST : เขียนบทความใหม่ ----------
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!can(auth.caller.role, "news:create")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เขียนบทความ" }, { status: 403 });
    }

    const body = await req.json();
    const { title, slug, excerpt, content, tag, image_url, published_at } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
    }

    const finalSlug = (slug && slug.trim()) || slugify(title);

    const { data, error } = await admin
      .from("news")
      .insert({
        title,
        slug: finalSlug,
        excerpt: excerpt ?? null,
        content,
        tag: tag || "NEWS",
        image_url: image_url || null,
        published_at: published_at ? new Date(published_at).toISOString() : new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยน" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ post: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : แก้ไขบทความ ----------
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!can(auth.caller.role, "news:edit")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขบทความ" }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, slug, excerpt, content, tag, image_url, published_at } = body;
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (slug !== undefined) update.slug = slug.trim() || slugify(title ?? "");
    if (excerpt !== undefined) update.excerpt = excerpt || null;
    if (content !== undefined) update.content = content;
    if (tag !== undefined) update.tag = tag || "NEWS";
    if (image_url !== undefined) update.image_url = image_url || null;
    if (published_at !== undefined) update.published_at = new Date(published_at).toISOString();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("news")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยน" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ post: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ลบบทความ ----------
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!can(auth.caller.role, "news:delete")) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ลบบทความ" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const { error } = await admin.from("news").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
