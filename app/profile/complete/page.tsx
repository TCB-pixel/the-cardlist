"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CompleteProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lineDisplayName, setLineDisplayName] = useState("");
  const [lineAvatar, setLineAvatar] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile?.first_name && profile?.last_name) {
        router.replace("/profile");
        return;
      }

      // ดึงชื่อ LINE จาก display_name หรือ metadata
      const name = profile?.display_name ?? session.user.user_metadata?.full_name ?? "";
      // ถ้าชื่อขึ้นต้นด้วย line_ แสดงว่ายังไม่ได้ดึงชื่อจริง ให้แสดงว่าง
      setLineDisplayName(name.startsWith("line_") ? "" : name);
      setLineAvatar(profile?.avatar_url ?? null);
      setLoading(false);
    }
    check();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!firstName || !lastName) { setError("กรุณากรอกชื่อและนามสกุล"); return; }
    if (!username) { setError("กรุณากรอก username"); return; }

    // validate วันเกิด
    let birthDate: string | null = null;
    if (birthDay && birthMonth && birthYear) {
      if (birthYear.length !== 4) { setError("กรุณากรอกปี ค.ศ. 4 หลัก เช่น 2000"); return; }
      birthDate = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", session.user.id)
        .single();

      if (existing) { setError("Username นี้ถูกใช้แล้ว กรุณาเลือกใหม่"); setSaving(false); return; }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          username,
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
          birth_date: birthDate,
          phone: phone || null,
        })
        .eq("id", session.user.id);

      if (updateErr) throw updateErr;
      router.replace("/profile");
    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const months = [
    { v: "1", l: "มกราคม" }, { v: "2", l: "กุมภาพันธ์" }, { v: "3", l: "มีนาคม" },
    { v: "4", l: "เมษายน" }, { v: "5", l: "พฤษภาคม" }, { v: "6", l: "มิถุนายน" },
    { v: "7", l: "กรกฎาคม" }, { v: "8", l: "สิงหาคม" }, { v: "9", l: "กันยายน" },
    { v: "10", l: "ตุลาคม" }, { v: "11", l: "พฤศจิกายน" }, { v: "12", l: "ธันวาคม" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex flex-col items-center text-center px-6 pt-10 pb-6">
        {lineAvatar ? (
          <Image src={lineAvatar} alt={lineDisplayName || "LINE"} width={80} height={80}
            className="w-20 h-20 rounded-2xl object-cover mb-4" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-[#06C755] flex items-center justify-center mb-4">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          {lineDisplayName && (
            <span className="text-sm font-bold text-zinc-900">{lineDisplayName}</span>
          )}
          <span className="text-[10px] bg-[#06C755] text-white px-2 py-0.5 rounded-full font-semibold">LINE</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 mt-3">กรอกข้อมูลเพิ่มเติม</h1>
        <p className="text-sm text-zinc-400 mt-1.5">กรอกข้อมูลเพื่อสมบูรณ์การสมัครสมาชิก</p>
      </div>

      <div className="flex-1 px-6 pb-10">
        <form onSubmit={handleSave} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
                ชื่อ <span className="text-red-400">*</span>
              </label>
              <input type="text" className="input" placeholder="ชื่อจริง"
                value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
                นามสกุล <span className="text-red-400">*</span>
              </label>
              <input type="text" className="input" placeholder="นามสกุล"
                value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
              Username <span className="text-red-400">*</span>
            </label>
            <input type="text" className="input" placeholder="@username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_]/g, ""))}
              required />
            <p className="text-[10px] text-zinc-400 mt-1">ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ เท่านั้น</p>
          </div>

          {/* วันเกิด แบบ dropdown */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">วันเกิด</label>
            <div className="grid grid-cols-3 gap-2">
              <select className="input text-sm" value={birthDay} onChange={(e) => setBirthDay(e.target.value)}>
                <option value="">วัน</option>
                {days.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="input text-sm" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
                <option value="">เดือน</option>
                {months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
              <input type="number" className="input text-sm" placeholder="ปี (ค.ศ.)"
                value={birthYear} onChange={(e) => setBirthYear(e.target.value)}
                min="1900" max="2099" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">เบอร์โทรศัพท์</label>
            <input type="tel" className="input" placeholder="08x-xxx-xxxx"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          <button type="submit" disabled={saving}
            className={`btn-primary w-full py-3.5 text-sm mt-2 ${saving ? "opacity-50 cursor-not-allowed" : ""}`}>
            {saving ? "กำลังบันทึก..." : "บันทึกและเข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
