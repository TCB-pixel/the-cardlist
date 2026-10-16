"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/i18n";

export default function EditProfilePage() {
  const router = useRouter();
  const { L } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [addressCount, setAddressCount] = useState(0);

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
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setPhone(data.phone ?? "");
        setReceiptEmail(data.receipt_email ?? "");
        setAuthEmail(data.email ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      const { count } = await supabase
        .from("addresses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id);
      setAddressCount(count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError(L("รูปภาพต้องไม่เกิน 2MB", "Image must be 2MB or smaller")); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError("");
  }

  async function handleSave() {
    if (!displayName.trim()) { setError(L("กรุณากรอกชื่อที่แสดง", "Please enter a display name")); return; }
    if (!username.trim()) { setError(L("กรุณากรอก Username", "Please enter a username")); return; }
    // เก็บเบอร์เป็นตัวเลขล้วน ให้ค้นหน้าร้านเจอแน่นอน
    const emailTrim = receiptEmail.trim().toLowerCase();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError(L("อีเมลไม่ถูกต้อง — ตรวจสอบรูปแบบอีกครั้ง เช่น name@gmail.com", "Invalid email — please check the format, e.g. name@gmail.com"));
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits && !/^0\d{8,9}$/.test(phoneDigits)) {
      setError(L("เบอร์โทรไม่ถูกต้อง — กรอกเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0", "Invalid phone number — enter 9-10 digits starting with 0"));
      return;
    }
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
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phoneDigits || null,
          receipt_email: emailTrim || null,
          avatar_url: newAvatarUrl,
        })
        .eq("id", userId);
      if (updateErr) throw updateErr;

      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
      setSuccess(true);
      setTimeout(() => router.push("/profile"), 1200);
    } catch (err: any) {
      setError(err?.message ?? L("บันทึกไม่สำเร็จ", "Couldn't save"));
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
            <Link href="/profile" className="text-zinc-500 active:text-zinc-700">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <span className="text-sm font-semibold text-zinc-900">{L("แก้ไขโปรไฟล์", "Edit profile")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-semibold text-zinc-900 disabled:opacity-40"
            >
              {saving ? L("กำลังบันทึก...", "Saving...") : L("บันทึก", "Save")}
            </button>
          </div>
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
            {L("เปลี่ยนรูปโปรไฟล์", "Change profile photo")}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <p className="text-[11px] text-zinc-500">{L("PNG, JPG ขนาดไม่เกิน 2MB", "PNG or JPG, up to 2MB")}</p>
        </div>

        {/* Form */}
        <div className="card px-5 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("ชื่อที่แสดง", "Display name")}
            </label>
            <input
              type="text"
              className="input"
              placeholder={L("ชื่อ-นามสกุล หรือ ชื่อเล่น", "Full name or nickname")}
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
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">@</span>
              <input
                type="text"
                className="input pl-8"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={30}
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">{L("ตัวอักษรภาษาอังกฤษ ตัวเลข และ _ เท่านั้น", "English letters, numbers and _ only")}</p>
          </div>

          {/* ── ชื่อ-นามสกุลจริง ── */}
          <div className="pt-4 border-t border-zinc-100">
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("ชื่อ-นามสกุล", "Full name")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" className="input" placeholder={L("ชื่อจริง", "First name")}
                value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} />
              <input type="text" className="input" placeholder={L("นามสกุล", "Last name")}
                value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">{L("ใช้สำหรับยืนยันตัวตนตอนรับสิทธิ์และรับสินค้า", "Used to verify your identity when claiming rewards and picking up orders")}</p>
          </div>

          {/* ── เบอร์โทร ── */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("เบอร์โทรศัพท์", "Phone number")}
            </label>
            <input type="tel" inputMode="numeric" className="input" placeholder="08x-xxx-xxxx"
              value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
            <p className="text-[11px] text-zinc-500 mt-1">
              {L("พนักงานใช้ค้นหาคุณตอนบันทึกรอบเล่น เผื่อกรณีเปิด QR ไม่ได้", "Staff use this to find you when logging play sessions, in case your QR won't open")}
            </p>
          </div>

          {/* ── อีเมลรับใบเสร็จ ── */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              {L("อีเมลรับใบเสร็จ / ยืนยันคำสั่งซื้อ", "Email for receipts / order confirmations")}
            </label>
            <input type="email" inputMode="email" className="input" placeholder="name@gmail.com"
              value={receiptEmail} onChange={(e) => setReceiptEmail(e.target.value)} maxLength={120} />
            <p className="text-[11px] text-zinc-500 mt-1">
              {/^line_[a-z0-9]+@thecardlist\.com$/i.test(authEmail)
                ? L("บัญชีที่ล็อกอินด้วย LINE ไม่มีอีเมลจริง — กรอกอีเมลของคุณเพื่อรับใบเสร็จทางอีเมลด้วย (ไม่บังคับ)", "LINE accounts don't have a real email — add yours to get receipts by email too (optional)")
                : L("ถ้าไม่กรอก เราจะส่งไปที่อีเมลที่ใช้สมัคร", "If left blank, we'll send to the email you signed up with")}
            </p>
          </div>
        </div>

        {/* ── ที่อยู่จัดส่ง (จัดการในหน้าแยก รองรับหลายที่อยู่) ── */}
        <Link href="/profile/address"
          className="card px-5 py-4 flex items-center justify-between mt-4 active:bg-zinc-50 transition-colors">
          <div>
            <p className="text-sm text-zinc-900">{L("ที่อยู่จัดส่ง", "Shipping address")}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {addressCount > 0 ? L(`บันทึกไว้ ${addressCount} ที่อยู่`, `${addressCount} saved ${addressCount === 1 ? "address" : "addresses"}`) : L("ยังไม่ได้เพิ่มที่อยู่", "No addresses added yet")}
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-zinc-300">
            <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

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
            <p className="text-[11px] text-green-700 font-medium">{L("บันทึกสำเร็จ กำลังกลับหน้าโปรไฟล์...", "Saved! Returning to your profile...")}</p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3.5 text-sm disabled:opacity-40"
        >
          {saving ? L("กำลังบันทึก...", "Saving...") : L("บันทึกการเปลี่ยนแปลง", "Save changes")}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
