"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

export default function EditProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (data) {
        setUserId(session.user.id);
        setUsername(data.username ?? "");
        setDisplayName(data.display_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("รูปภาพต้องไม่เกิน 2MB"); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError("");
  }

  async function handleSave() {
    if (!displayName.trim()) { setError("กรุณากรอกชื่อที่แสดง"); return; }
    if (!username.trim()) { setError("กรุณากรอก Username"); return; }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const supabase = createClient();
      let newAvatarUrl = avatarUrl;

      // Upload avatar if changed
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `avatars/${userId}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        newAvatarUrl = urlData.publicUrl + `?t=${Date.now()}`;
      }

      // Update profile
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: username.trim(),
          avatar_url: newAvatarUrl,
        })
        .eq("id", userId);
      if (updateErr) throw updateErr;

      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
      setSuccess(true);
      setTimeout(() => router.push("/profile"), 1200);
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  const displayAvatar = avatarPreview ?? avatarUrl;

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-zinc-400 active:text-zinc-700">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <span className="text-sm font-semibold text-zinc-900">แก้ไขโปรไฟล์</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-semibold text-zinc-900 disabled:opacity-40"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </header>

      <div className="px-4 py-6 space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button onClick={() => fileRef.current?.click()} className="relative group">
            {displayAvatar ? (
              <Image
                src={displayAvatar}
                alt="avatar"
                width={80} height={80}
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-2xl font-bold">
                {(displayName || username || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 14l4-4 3 3 3-4 4 5H3z" fill="white" fillOpacity="0.9"/>
                <circle cx="13" cy="6" r="2" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
          </button>
          <button onClick={() => fileRef.current?.click()} className="text-xs font-medium text-zinc-500 underline underline-offset-2">
            เปลี่ยนรูปโปรไฟล์
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <p className="text-[10px] text-zinc-400">PNG, JPG ขนาดไม่เกิน 2MB</p>
        </div>

        {/* Form */}
        <div className="card px-5 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              ชื่อที่แสดง
            </label>
            <input
              type="text"
              className="input"
              placeholder="ชื่อ-นามสกุล หรือ ชื่อเล่น"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">@</span>
              <input
                type="text"
                className="input pl-8"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={30}
              />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">ตัวอักษรภาษาอังกฤษ ตัวเลข และ _ เท่านั้น</p>
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" fill="#16a34a"/>
              <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[11px] text-green-700 font-medium">บันทึกสำเร็จ กำลังกลับหน้าโปรไฟล์...</p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3.5 text-sm disabled:opacity-40"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
