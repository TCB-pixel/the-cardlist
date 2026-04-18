// Admin whitelist — เฉพาะ email เหล่านี้เท่านั้นที่เข้า /admin ได้
// ในอนาคตสามารถย้ายไปเก็บใน Supabase admin_users table ได้
export const ADMIN_EMAILS = [
  "kritanat.suk@gmail.com",
];

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
