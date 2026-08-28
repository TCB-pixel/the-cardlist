"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AdminRole, AdminUser, can, Permission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase";

// ผู้ใช้ชั่วคราวระหว่างรอ /api/admin/me — ให้สิทธิ์ต่ำสุดไว้ก่อน (least privilege)
// role จริงมาจาก admin_users / admin_staff ใน DB เท่านั้น ห้าม hardcode
const LOADING_USER: AdminUser = {
  id: "",
  name: "กำลังโหลด…",
  email: "",
  role: "staff",
  avatar: "?",
  joinedAt: "—",
  lastLogin: "—",
  active: true,
};

type AdminContextType = {
  currentUser: AdminUser;
  loading: boolean;
  can: (permission: Permission) => boolean;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser>(LOADING_USER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        window.location.href = "/admin/login";
        return;
      }

      try {
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // ไม่มีสิทธิ์ / บัญชีถูกระงับ — เด้งกลับหน้า login แทนที่จะปล่อยเข้า Admin Panel
          window.location.href = "/admin/login?error=unauthorized";
          return;
        }
        const me = await res.json();
        if (cancelled) return;
        setCurrentUser({
          id: me.id,
          name: me.name,
          email: me.email,
          role: me.role as AdminRole,
          avatar: me.avatar,
          joinedAt: me.joinedAt,
          lastLogin: me.lastLogin,
          active: me.active,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMe();
    return () => { cancelled = true; };
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  return (
    <AdminContext.Provider value={{
      currentUser,
      loading,
      // ระหว่างโหลดยังไม่รู้ role จริง — ปิดสิทธิ์ไว้ก่อนกันเมนูกระพริบผิดระดับ
      can: (permission) => (loading ? false : can(currentUser.role, permission)),
      logout,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
