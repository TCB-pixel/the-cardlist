"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

type Address = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address_line: string;
  district: string;
  province: string;
  postal_code: string;
  is_default: boolean;
};

const EMPTY: Omit<Address, "id" | "is_default"> = {
  label: "บ้าน",
  full_name: "",
  phone: "",
  address_line: "",
  district: "",
  province: "",
  postal_code: "",
};

export default function AddressPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  async function loadAddresses(uid: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", uid)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    setAddresses((data as Address[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      await loadAddresses(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  function openAdd() {
    setForm(EMPTY);
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(a: Address) {
    setForm({
      label: a.label,
      full_name: a.full_name,
      phone: a.phone,
      address_line: a.address_line,
      district: a.district,
      province: a.province,
      postal_code: a.postal_code,
    });
    setEditId(a.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.full_name.trim() || !form.phone.trim() || !form.address_line.trim() ||
        !form.district.trim() || !form.province.trim() || !form.postal_code.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      if (editId) {
        await supabase.from("addresses").update({ ...form }).eq("id", editId);
      } else {
        const isFirst = addresses.length === 0;
        await supabase.from("addresses").insert({
          ...form,
          user_id: userId,
          is_default: isFirst,
        });
      }
      await loadAddresses(userId);
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    const supabase = createClient();
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    await loadAddresses(userId);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const supabase = createClient();
    await supabase.from("addresses").delete().eq("id", id);
    await loadAddresses(userId);
    setDeleting(null);
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

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
            <span className="text-sm font-semibold text-zinc-900">ที่อยู่จัดส่ง</span>
          </div>
          {!showForm && (
            <button onClick={openAdd} className="text-xs font-semibold text-zinc-900">+ เพิ่ม</button>
          )}
        </div>
      </header>

      {/* Form */}
      {showForm && (
        <div className="bg-white border-b border-zinc-100 px-4 py-5">
          <p className="text-xs font-semibold text-zinc-900 mb-4">
            {editId ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่ใหม่"}
          </p>
          <div className="space-y-3">
            {/* Label */}
            <div className="flex gap-2">
              {["บ้าน", "ที่ทำงาน", "อื่นๆ"].map((l) => (
                <button
                  key={l}
                  onClick={() => setForm({ ...form, label: l })}
                  className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                    form.label === l
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "border-zinc-200 text-zinc-600"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <input className="input" placeholder="ชื่อ-นามสกุล ผู้รับ" value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input className="input" placeholder="เบอร์โทรศัพท์" type="tel" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={10} />
            <input className="input" placeholder="บ้านเลขที่ ถนน ซอย อาคาร" value={form.address_line}
              onChange={(e) => setForm({ ...form, address_line: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="แขวง/ตำบล" value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })} />
              <input className="input" placeholder="เขต/อำเภอ" value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })} />
            </div>
            <input className="input" placeholder="รหัสไปรษณีย์" type="number" value={form.postal_code}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })} maxLength={5} />

            {error && <p className="text-[11px] text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="btn-outline flex-1 py-3">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 disabled:opacity-40">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="px-4 py-4 space-y-3">
        {addresses.length === 0 && !showForm && (
          <div className="card px-5 py-10 text-center">
            <p className="text-sm text-zinc-400 mb-1">ยังไม่มีที่อยู่จัดส่ง</p>
            <p className="text-[11px] text-zinc-400 mb-4">เพิ่มที่อยู่เพื่อใช้งานในการสั่งซื้อ</p>
            <button onClick={openAdd} className="btn-primary px-6 py-2.5">เพิ่มที่อยู่</button>
          </div>
        )}

        {addresses.map((a) => (
          <div key={a.id} className={`card px-4 py-4 ${a.is_default ? "ring-1 ring-zinc-900" : ""}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                  {a.label}
                </span>
                {a.is_default && (
                  <span className="text-[9px] font-bold bg-zinc-900 text-white px-2 py-0.5 rounded">
                    ค่าเริ่มต้น
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => openEdit(a)} className="text-[11px] text-zinc-500 underline">แก้ไข</button>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deleting === a.id}
                  className="text-[11px] text-red-500 underline disabled:opacity-40"
                >
                  {deleting === a.id ? "..." : "ลบ"}
                </button>
              </div>
            </div>
            <p className="text-sm font-medium text-zinc-900">{a.full_name}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{a.phone}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {a.address_line} แขวง{a.district} เขต{a.province} {a.postal_code}
            </p>
            {!a.is_default && (
              <button onClick={() => handleSetDefault(a.id)} className="mt-3 text-[11px] text-zinc-500 border border-zinc-200 rounded-lg px-3 py-1.5 w-full text-center active:bg-zinc-50">
                ตั้งเป็นค่าเริ่มต้น
              </button>
            )}
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
