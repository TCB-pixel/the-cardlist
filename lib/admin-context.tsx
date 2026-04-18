"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AdminRole, AdminUser, can, Permission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase";

// Role mapping by email — ขยายได้ในอนาคตผ่าน Supabase admin_users table
const EMAIL_ROLE_MAP: Record<string, AdminRole> = {
  "kritanat.suk@gmail.com": "owner",
};

const DEFAULT_USER: AdminUser = {
  id: "1",
  name: "Kritanat Sukhaneskul",
  email: "kritanat.suk@gmail.com",
  role: "owner",
  avatar: "K",
  joinedAt: "1 ม.ค. 2025",
  lastLogin: "วันนี้",
  active: true,
};

type AdminContextType = {
  currentUser: AdminUser;
  can: (permission: Permission) => boolean;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser>(DEFAULT_USER);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const email = user.email ?? "";
      const role = EMAIL_ROLE_MAP[email.toLowerCase()] ?? "staff";
      const meta = user.user_metadata ?? {};
      setCurrentUser({
        id: user.id,
        name: meta.display_name ?? meta.username ?? email.split("@")[0],
        email,
        role,
        avatar: (meta.display_name ?? meta.username ?? email)[0].toUpperCase(),
        joinedAt: new Date(user.created_at).toLocaleDateString("th-TH"),
        lastLogin: "เพิ่งเข้าสู่ระบบ",
        active: true,
      });
    });
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  return (
    <AdminContext.Provider value={{
      currentUser,
      can: (permission) => can(currentUser.role, permission),
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
