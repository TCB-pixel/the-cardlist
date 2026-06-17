import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET: สถานะตัวนับของแคมเปญที่ active (ไม่ต้องใส่ passcode)
export async function GET() {
  try {
    const { data, error } = await admin
      .from('coupon_campaigns')
      .select('code, partner_name, title, discount_type, discount_value, usage_limit, used_count, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const campaigns = (data || []).map((c: any) => ({
      ...c,
      remaining: Math.max(0, (c.usage_limit || 0) - (c.used_count || 0)),
      is_full: (c.usage_limit || 0) - (c.used_count || 0) <= 0,
    }));
    return NextResponse.json({ campaigns });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'server_error' }, { status: 500 });
  }
}

// POST: กดใช้ / คืนสิทธิ์ (ต้องมี passcode)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const passcode = (body.passcode || '').toString();
    const code = (body.code || '').toString().trim();
    const action = (body.action || 'redeem').toString(); // 'redeem' | 'undo'

    if (!process.env.PHOTOPIA_STAFF_PASSCODE || passcode !== process.env.PHOTOPIA_STAFF_PASSCODE) {
      return NextResponse.json({ ok: false, error: 'invalid_passcode' }, { status: 401 });
    }
    if (!code) {
      return NextResponse.json({ ok: false, error: 'no_code' }, { status: 400 });
    }

    const fn = action === 'undo' ? 'undo_partner_code' : 'redeem_partner_code';
    const { data, error } = await admin.rpc(fn, { p_code: code });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
    }

    return NextResponse.json({
      ok: !!row.success,
      reason: row.reason,
      used_count: row.used_count,
      usage_limit: row.usage_limit,
      remaining: row.remaining,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'server_error' }, { status: 500 });
  }
}
