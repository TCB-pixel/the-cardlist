export type AdminRole = "owner" | "head_staff" | "staff";

export type Permission =
  | "dashboard:view"
  | "products:view" | "products:create" | "products:edit" | "products:delete"
  | "orders:view" | "orders:edit"
  | "events:view" | "events:create" | "events:edit" | "events:delete"
  | "news:view" | "news:create" | "news:edit" | "news:delete"
  | "members:view" | "members:edit"
  | "artists:view" | "artists:create" | "artists:edit" | "artists:delete"
  | "staff:view" | "staff:create" | "staff:edit" | "staff:delete";

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: [
    "dashboard:view",
    "products:view", "products:create", "products:edit", "products:delete",
    "orders:view", "orders:edit",
    "events:view", "events:create", "events:edit", "events:delete",
    "news:view", "news:create", "news:edit", "news:delete",
    "members:view", "members:edit",
    "artists:view", "artists:create", "artists:edit", "artists:delete",
    "staff:view", "staff:create", "staff:edit", "staff:delete",
  ],
  head_staff: [
    "dashboard:view",
    "products:view", "products:create", "products:edit", "products:delete",
    "orders:view", "orders:edit",
    "events:view", "events:create", "events:edit", "events:delete",
    "news:view", "news:create", "news:edit", "news:delete",
    "members:view", "members:edit",
    "artists:view", "artists:create", "artists:edit", "artists:delete",
    "staff:view", "staff:create", "staff:edit",
    // head_staff ลบ staff ไม่ได้, สร้าง/แก้ได้แค่ staff (ไม่ใช่ owner/head_staff)
  ],
  staff: [
    "dashboard:view",
    "products:view",
    "orders:view", "orders:edit",
    "events:view", "events:edit",
    "news:view",
    "members:view",
    "artists:view",
    "staff:view",
  ],
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return hasPermission(role, permission);
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Owner",
  head_staff: "Head Staff",
  staff: "Staff",
};

export const ROLE_COLOR: Record<AdminRole, string> = {
  owner: "bg-purple-50 text-purple-700",
  head_staff: "bg-blue-50 text-blue-700",
  staff: "bg-zinc-100 text-zinc-600",
};

export const ROLE_BADGE: Record<AdminRole, string> = {
  owner: "bg-purple-600 text-white",
  head_staff: "bg-blue-600 text-white",
  staff: "bg-zinc-600 text-white",
};

// สิ่งที่แต่ละ role สามารถสร้าง/แก้ได้ (role hierarchy)
export const MANAGEABLE_ROLES: Record<AdminRole, AdminRole[]> = {
  owner: ["owner", "head_staff", "staff"],
  head_staff: ["staff"],
  staff: [],
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar: string;
  joinedAt: string;
  lastLogin: string;
  active: boolean;
};
