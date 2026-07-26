"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

type NewsPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  tag: string;
  image_url: string | null;
  published_at: string;
};

const TAG_COLOR: Record<string, string> = {
  "TOURNAMENT": "bg-red-50 text-red-700",
  "RELEASE": "bg-blue-50 text-blue-700",
  "NEWS": "bg-zinc-100 text-zinc-600",
  "DECK GUIDE": "bg-green-50 text-green-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

export default function NewsDetailPage() {
  const params = useParams();
  const supabase = createClient();
  const slug = params?.slug as string;

  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news")
      .select("id, title, slug, excerpt, content, tag, image_url, published_at")
      .eq("slug", slug)
      .single();
    if (error || !data) setNotFound(true);
    else setPost(data);
    setLoading(false);
  }, [slug]);

  useEffect(() => { if (slug) load(); }, [slug, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20">
        <TopBar title="ข่าวสาร" showBack />
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20">
        <TopBar title="ข่าวสาร" showBack />
        <div className="text-center py-24 px-6">
          <p className="text-sm text-zinc-400 mb-4">ไม่พบบทความนี้</p>
          <Link href="/news" className="btn-primary inline-block px-6 py-2.5">กลับไปหน้าข่าวสาร</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar title="ข่าวสาร" showBack />

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt={post.title} className="w-full h-48 object-cover" />
      )}

      <div className="px-5 py-5">
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${TAG_COLOR[post.tag] ?? "bg-zinc-100 text-zinc-600"}`}>{post.tag}</span>
        <h1 className="text-lg font-bold text-zinc-900 mt-3 mb-2 leading-snug">{post.title}</h1>
        <p className="text-[11px] text-zinc-400 mb-5">{formatDate(post.published_at)}</p>

        {post.excerpt && (
          <p className="text-sm text-zinc-600 leading-relaxed mb-4 font-medium">{post.excerpt}</p>
        )}

        <div className="h-px bg-zinc-100 mb-4" />

        <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{post.content}</div>
      </div>

      <BottomNav />
    </div>
  );
}
