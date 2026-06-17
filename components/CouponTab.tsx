'use client';

import { useEffect, useState } from 'react';
// 👇 ปรับ path ให้ตรงกับ Supabase browser client ของคุณ
import { createClient } from '@/lib/supabase/client';

type Coupon = {
  code: string;
  partner_name: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  terms?: string | null;
  remaining: number;
  usage_limit: number;
  is_full: boolean;
};

function discountLabel(c: Coupon) {
  return c.discount_type === 'percent' ? `${c.discount_value}%` : `฿${c.discount_value}`;
}

export default function CouponTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (alive) {
            setError('กรุณาเข้าสู่ระบบ');
            setLoading(false);
          }
          return;
        }
        const res = await fetch('/api/coupons', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'load_failed');
        if (alive) {
          setCoupons(json.coupons || []);
          setLoading(false);
        }
      } catch (e: any) {
        if (alive) {
          setError(e.message || 'เกิดข้อผิดพลาด');
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (loading)
    return <div className="py-16 text-center text-sm text-gray-400">กำลังโหลดคูปอง…</div>;
  if (error)
    return <div className="py-16 text-center text-sm text-gray-400">{error}</div>;
  if (coupons.length === 0)
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        ยังไม่มีคูปอง ลงทะเบียนเข้างานเพื่อรับคูปองจากพาร์ทเนอร์
      </div>
    );

  return (
    <div className="flex flex-col gap-5 pb-8">
      {coupons.map((c) => (
        <div
          key={c.code}
          className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
            c.is_full ? 'border-gray-200 opacity-70' : 'border-gray-200'
          }`}
        >
          {/* หัวการ์ด */}
          <div className="flex items-center justify-between px-5 pt-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
              🎟️ {c.partner_name}
            </span>
            {c.is_full ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-500">
                สิทธิ์เต็มแล้ว
              </span>
            ) : (
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-600">
                เหลือ {c.remaining}/{c.usage_limit} สิทธิ์
              </span>
            )}
          </div>

          {/* ส่วนลด */}
          <div className="px-5 pt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{discountLabel(c)}</span>
              <span className="text-sm text-gray-500">ส่วนลด</span>
            </div>
            <p className="mt-1 text-base font-semibold text-gray-900">{c.title}</p>
            {c.subtitle && <p className="text-sm text-gray-500">{c.subtitle}</p>}
          </div>

          {/* เส้นประแบบตั๋ว */}
          <div className="relative my-4">
            <div className="border-t border-dashed border-gray-200" />
            <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-gray-50" />
            <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-gray-50" />
          </div>

          {/* โค้ด */}
          <div className="px-5">
            <p className="text-center text-xs text-gray-400">โค้ดส่วนลด</p>
            <button
              onClick={() => copy(c.code)}
              disabled={c.is_full}
              className="mx-auto mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-4 disabled:opacity-50"
            >
              <span className="font-mono text-2xl font-bold tracking-widest text-gray-900">
                {c.code}
              </span>
              <span className="text-xs text-gray-400">
                {copied === c.code ? '✓ คัดลอกแล้ว' : 'แตะเพื่อคัดลอก'}
              </span>
            </button>
            <p className="mt-3 text-center text-xs text-gray-400">
              {c.is_full
                ? 'สิทธิ์ถูกใช้ครบแล้ว'
                : 'แสดงโค้ดนี้ให้สตาฟที่บูธ Photopia'}
            </p>
          </div>

          {/* เงื่อนไข */}
          {c.terms && (
            <p className="px-5 pb-5 pt-4 text-center text-[11px] leading-relaxed text-gray-400">
              {c.terms}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
