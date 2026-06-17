import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ===================== CONFIG =====================
// แสดงคูปองเฉพาะ "คนที่ลงทะเบียนเข้างานแล้ว" เท่านั้นหรือไม่
const REQUIRE_REGISTRATION = false;
const REGISTRATION_TABLE = 'registrations';
const REGISTRATION_USER_COLUMN = 'user_id';
// ==================================================

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getUser(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (REQUIRE_REGISTRATION) {
      const { count } = await admin
        .from(REGISTRATION_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq(REGISTRATION_USER_COLUMN, user.id);
      if (!count || count < 1) {
        return NextResponse.json({ coupons: [] });
      }
    }

    const { data: campaigns, error } = await admin
      .from('coupon_campaigns')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const coupons = (campaigns || []).map((c: any) => {
      const remaining = Math.max(0, (c.usage_limit || 0) - (c.used_count || 0));
      return {
        code: c.code,
        partner_name: c.partner_name,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        terms: c.terms,
        usage_limit: c.usage_limit,
        used_count: c.used_count,
        remaining,
        is_full: remaining <= 0,
      };
    });

    return NextResponse.json({ coupons });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'server_error' }, { status: 500 });
  }
}
