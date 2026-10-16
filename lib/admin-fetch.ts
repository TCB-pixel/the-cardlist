import { createClient } from "@/lib/supabase";

// fetch ที่แนบ access_token ของแอดมิน ให้ /api/admin/* ตรวจสิทธิ์ได้
export async function adminFetch(input: string, init?: RequestInit) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
  });
}
