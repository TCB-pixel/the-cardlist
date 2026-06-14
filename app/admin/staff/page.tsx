"use client";
import { useState, useEffect } from "react";
import { useAdmin } from "@/lib/admin-context";
import { AdminRole, AdminUser, ROLE_LABEL, ROLE_COLOR, ROLE_BADGE, MANAGEABLE_ROLES, can } from "@/lib/rbac";

const EMPTY_FORM = { name: "", email: "", role: "staff" as AdminRole, active: true, password: "" };

const PERMISSION_MATRIX: { label: string; owner: boolean; head_staff: boolean; staff: boolean }[] = [
  { label: "ดู Dashboard",               owner: true,  head_staff: true,  staff: true  },
  { label: "จัดการสินค้า (เพิ่ม/แก้/ลบ)", owner: true,  head_staff: true,  staff: false },
  { label: "ดูสินค้า",                    owner: true,  head_staff: true,  staff: true  },
  { label: "จัดการคำสั่งซื้อ",            owner: true,  head_staff: true,  staff: true  },
  { label: "จัดการอีเวนต์ (เพิ่ม/แก้/ลบ)",owner: true,  head_staff: true,  staff: false },
  { label: "แก้ไขสถานะอีเวนต์",           owner: true,  head_staff: true,  staff: true  },
  { label: "จัดการข่าวสาร (เพิ่ม/แก้/ลบ)",owner: true,  head_staff: true,  staff: false },
  { label: "จัดการสมาชิก",               owner: true,  head_staff: true,  staff: false  },
  { label: "เพิ่ม/แก้ Staff",             owner: true,  head_staff: true,  staff: false },
  { label: "ลบ Staff",                    owner: true,  head_staff: false, staff: false },
  { label: "จัดการ Owner/Head Staff",     owner: true,  head_staff: false, staff: false },
];

export default function AdminStaffPage() {
  const { currentUser, can: canDo } = useAdmin();
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "permissions">("members");
  const [filterRole, setFilterRole] = useState<"all" | AdminRole>("all");
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string; reset?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const manageableRoles = MANAGEABLE_ROLES[currentUser.role];
  const filtered = staff.filter((s) => filterRole === "all" || s.role === filterRole);

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (res.ok) setStaff(data.staff || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  function canManage(target: AdminUser): boolean {
    if (target.id === currentUser.id) return false;
    return manageableRoles.includes(target.role);
  }

  function canAssignRole(role: AdminRole): boolean {
    return manageableRoles.includes(role);
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrorMsg("");
    setShowModal(true);
  }

  function openEdit(s: AdminUser) {
    setEditing(s);
    setForm({ name: s.name, email: s.email, role: s.role, active: s.active, password: "" });
    setErrorMsg("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.email) return;
    if (!canAssignRole(form.role)) return;
    setSaving(true);
    setErrorMsg("");
    try {
      if (editing) {
        const res = await fetch("/api/admin/staff", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, name: form.name, role: form.role, active: form.active, password: form.password || undefined }),
        });
        const data = await res.json();
        if (!res.ok) { setErrorMsg(data.error || "บันทึกไม่สำเร็จ"); return; }
        setShowModal(false);
        if (data.password) setCreatedInfo({ email: data.member.email, password: data.password, reset: true });
        await loadStaff();
      } else {
        const res = await fetch("/api/admin/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setErrorMsg(data.error || "เพิ่มสมาชิกไม่สำเร็จ"); return; }
        setShowModal(false);
        setCreatedInfo({ email: data.member.email, password: data.password });
        await loadStaff();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch("/api/admin/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    setDeleteTarget(null);
    await loadStaff();
  }

  async function toggleActive(member: AdminUser) {
    await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, active: !member.active }),
    });
    await loadStaff();
  }

  function copyPassword() {
    if (!createdInfo) return;
    navigator.clipboard.writeText(createdInfo.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5";

  const roleCounts = {
    owner: staff.filter((s) => s.role === "owner").length,
    head_staff: staff.filter((s) => s.role === "head_staff").length,
    staff: staff.filter((s) => s.role === "staff").length,
  };

  return (
    <div className="p-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(["owner", "head_staff", "staff"] as AdminRole[]).map((role) => (
          <div key={role} className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
              role === "owner" ? "bg-purple-100 text-purple-700" : role === "head_staff" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"
            }`}>
              {role === "owner" ? "OW" : role === "head_staff" ? "HS" : "ST"}
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-900">{roleCounts[role]}</p>
              <p className="text-[11px] text-zinc-400">{ROLE_LABEL[role]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-5">
        {(["members", "permissions"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`text-xs px-5 py-2.5 font-semibold border-b-2 transition-colors ${activeTab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400"}`}>
            {t === "members" ? "รายชื่อ Admin & Staff" : "ตารางสิทธิ์การใช้งาน"}
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {(["all", "owner", "head_staff", "staff"] as const).map((r) => (
                <button key={r} onClick={() => setFilterRole(r)}
                  className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition-colors ${filterRole === r ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
                  {r === "all" ? "ทั้งหมด" : ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            {canDo("staff:create") && (
              <button onClick={openAdd} className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors">
                <span className="text-base leading-none font-light">+</span> เพิ่มสมาชิกทีม
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {["ชื่อ", "Role", "สถานะ", "เข้าสู่ระบบล่าสุด", "เพิ่มเมื่อ", ""].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีสมาชิกทีม</td></tr>
                ) : filtered.map((member) => (
                  <tr key={member.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          member.role === "owner" ? "bg-purple-100 text-purple-700" : member.role === "head_staff" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"
                        }`}>
                          {member.avatar}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-zinc-900">{member.name}</p>
                            {member.id === currentUser.id && (
                              <span className="text-[8px] bg-zinc-900 text-white px-1.5 py-0.5 rounded font-bold">คุณ</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${ROLE_COLOR[member.role]}`}>
                        {ROLE_LABEL[member.role].toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${member.active ? "bg-green-500" : "bg-zinc-300"}`}></div>
                        <span className={`text-xs ${member.active ? "text-green-600" : "text-zinc-400"}`}>
                          {member.active ? "ใช้งานอยู่" : "ระงับแล้ว"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">{member.lastLogin}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">{member.joinedAt}</td>
                    <td className="px-5 py-3.5">
                      {canManage(member) ? (
                        <div className="flex items-center gap-2 justify-end">
                          {canDo("staff:edit") && (
                            <button onClick={() => openEdit(member)}
                              className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50 transition-colors">
                              แก้ไข
                            </button>
                          )}
                          {canDo("staff:edit") && (
                            <button onClick={() => toggleActive(member)}
                              className={`text-xs border rounded-lg px-2.5 py-1 transition-colors ${member.active ? "text-amber-600 border-amber-100 hover:bg-amber-50" : "text-green-600 border-green-100 hover:bg-green-50"}`}>
                              {member.active ? "ระงับ" : "เปิดใช้"}
                            </button>
                          )}
                          {canDo("staff:delete") && (
                            <button onClick={() => setDeleteTarget(member)}
                              className="text-xs text-red-400 border border-red-100 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors">
                              ลบ
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-300 px-3">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Role info */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(["owner", "head_staff", "staff"] as AdminRole[]).map((role) => (
              <div key={role} className={`rounded-2xl p-4 border ${role === "owner" ? "border-purple-100 bg-purple-50" : role === "head_staff" ? "border-blue-100 bg-blue-50" : "border-zinc-100 bg-zinc-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGE[role]}`}>{ROLE_LABEL[role].toUpperCase()}</span>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  {role === "owner" && "สิทธิ์สูงสุด จัดการทุกอย่างได้รวมถึงระบบและสมาชิกทีมทั้งหมด"}
                  {role === "head_staff" && "จัดการสินค้า อีเวนต์ ข่าวสาร สมาชิก และเพิ่ม/แก้ไข Staff ได้"}
                  {role === "staff" && "ดูข้อมูลและอัปเดตสถานะ Order/Event เท่านั้น ไม่สามารถลบหรือแก้ไขเนื้อหาได้"}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "permissions" && (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3 w-1/2">การดำเนินการ</th>
                {(["owner", "head_staff", "staff"] as AdminRole[]).map((role) => (
                  <th key={role} className="text-center text-[10px] font-semibold tracking-widest uppercase px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${ROLE_COLOR[role]}`}>{ROLE_LABEL[role]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((row, i) => (
                <tr key={i} className="border-b border-zinc-50 last:border-none hover:bg-zinc-50">
                  <td className="px-5 py-3 text-xs text-zinc-700">{row.label}</td>
                  {(["owner", "head_staff", "staff"] as AdminRole[]).map((role) => (
                    <td key={role} className="px-5 py-3 text-center">
                      {row[role] ? (
                        <div className="flex items-center justify-center">
                          <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <div className="w-5 h-5 bg-zinc-100 rounded-full flex items-center justify-center">
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M2 2l4 4M6 2L2 6" stroke="#a1a1aa" strokeWidth="1.3" strokeLinecap="round"/>
                            </svg>
                          </div>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไขข้อมูล" : "เพิ่มสมาชิกทีม"}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>ชื่อ-นามสกุล *</label>
                <input className={inputCls} placeholder="ชื่อ-นามสกุล" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>อีเมล *</label>
                <input type="email" className={inputCls} placeholder="email@thecardlist.com" value={form.email} disabled={!!editing}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
                {editing && <p className="text-[10px] text-zinc-400 mt-1">ไม่สามารถแก้อีเมลของสมาชิกที่มีอยู่แล้วได้</p>}
              </div>
              <div>
                <label className={labelCls}>{editing ? "รีเซ็ตรหัสผ่าน" : "รหัสผ่าน"}</label>
                <input type="text" className={inputCls}
                  placeholder={editing ? "เว้นว่างถ้าไม่เปลี่ยน" : "เว้นว่างให้ระบบสุ่มให้"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="text-[10px] text-zinc-400 mt-1">
                  {editing
                    ? "พิมพ์รหัสใหม่เพื่อรีเซ็ต (อย่างน้อย 6 ตัวอักษร) แล้วบอกพนักงาน"
                    : "พิมพ์รหัสที่ต้องการ หรือเว้นว่างให้ระบบสุ่มรหัสที่ปลอดภัยให้"}
                </p>
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <div className="space-y-2">
                  {(["owner", "head_staff", "staff"] as AdminRole[]).map((role) => {
                    const allowed = canAssignRole(role);
                    return (
                      <label key={role} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${!allowed ? "opacity-40 cursor-not-allowed" : form.role === role ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                        <input type="radio" name="role" value={role} checked={form.role === role} disabled={!allowed} onChange={() => allowed && setForm({ ...form, role })} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLOR[role]}`}>{ROLE_LABEL[role].toUpperCase()}</span>
                            {!allowed && <span className="text-[9px] text-zinc-400">(ไม่มีสิทธิ์)</span>}
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {role === "owner" && "สิทธิ์สูงสุด — จัดการได้ทุกอย่าง"}
                            {role === "head_staff" && "จัดการเนื้อหาได้ทั้งหมด + เพิ่ม Staff"}
                            {role === "staff" && "ดูข้อมูลและอัปเดตสถานะเท่านั้น"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-semibold text-zinc-700">สถานะบัญชี</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">ระงับบัญชีเพื่อไม่ให้เข้าสู่ระบบได้ชั่วคราว</p>
                </div>
                <button onClick={() => setForm({ ...form, active: !form.active })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${form.active ? "bg-zinc-900" : "bg-zinc-200"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.active ? "left-7" : "left-1"}`}></span>
                </button>
              </div>
              {errorMsg && <p className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl hover:bg-zinc-50">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : editing ? "บันทึก" : "เพิ่มสมาชิกทีม"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp password result modal */}
      {createdInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4 p-6">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p className="text-sm font-bold text-zinc-900 text-center mb-1">{createdInfo.reset ? "รีเซ็ตรหัสผ่านสำเร็จ" : "เพิ่มสมาชิกสำเร็จ"}</p>
            <p className="text-[11px] text-zinc-400 text-center mb-4">ส่งอีเมลและรหัสผ่านนี้ให้พนักงานเพื่อเข้าสู่ระบบ</p>

            <div className="space-y-2 mb-3">
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2">
                <p className="text-[10px] text-zinc-400">อีเมล</p>
                <p className="text-xs font-semibold text-zinc-900 break-all">{createdInfo.email}</p>
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2">
                <p className="text-[10px] text-zinc-400">รหัสผ่านชั่วคราว</p>
                <p className="text-sm font-mono font-bold text-zinc-900 tracking-wide">{createdInfo.password}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-4">
              <span className="text-amber-500 text-xs leading-none mt-0.5">⚠</span>
              <p className="text-[10px] text-amber-700 leading-relaxed">รหัสผ่านนี้จะแสดงเพียงครั้งเดียว คัดลอกเก็บไว้ก่อนปิดหน้าต่าง พนักงานสามารถเปลี่ยนรหัสผ่านเองได้ภายหลัง</p>
            </div>

            <div className="flex gap-2">
              <button onClick={copyPassword} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl hover:bg-zinc-50">
                {copied ? "คัดลอกแล้ว ✓" : "คัดลอกรหัสผ่าน"}
              </button>
              <button onClick={() => { setCreatedInfo(null); setCopied(false); }} className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-zinc-700">
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl w-80 mx-4 p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <p className="text-sm font-bold text-zinc-900 mb-1">ลบ {deleteTarget.name}?</p>
            <p className="text-xs text-zinc-400 mb-2">Role: <span className="font-semibold">{ROLE_LABEL[deleteTarget.role]}</span></p>
            <p className="text-xs text-zinc-400 mb-5">บัญชีนี้จะไม่สามารถเข้าสู่ระบบได้อีก</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-zinc-200 text-xs py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 text-white text-xs py-2.5 rounded-xl hover:bg-red-600">ลบบัญชี</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
