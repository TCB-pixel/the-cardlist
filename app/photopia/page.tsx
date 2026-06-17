'use client';

import { useCallback, useEffect, useState } from 'react';

type Campaign = {
  code: string;
  partner_name: string;
  title: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  usage_limit: number;
  used_count: number;
  remaining: number;
  is_full: boolean;
};

export default function PhotopiaStaffPage() {
  const [passcode, setPasscode] = useState('');
  const [entered, setEntered] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/photopia');
      const json = await res.json();
      setCampaigns(json.campaigns || []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (entered) loadStatus();
  }, [entered, loadStatus]);

  function discountLabel(c: Campaign) {
    return c.discount_type === 'percent' ? `${c.discount_value}%` : `฿${c.discount_value}`;
  }

  async function act(code: string, action: 'redeem' | 'undo') {
    if (busy) return;
    setBusy(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/photopia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, code, action }),
      });
      const json = await res.json();

      if (json.error === 'invalid_passcode') {
        setEntered(false);
        setAuthError('รหัสสตาฟไม่ถูกต้อง');
        return;
      }

      // อัปเดตตัวนับจากผลลัพธ์
      setCampaigns((prev) =>
        prev.map((c) =>
          c.code === code
            ? {
                ...c,
                used_count: json.used_count ?? c.used_count,
                remaining: json.remaining ?? c.remaining,
                is_full: (json.remaining ?? c.remaining) <= 0,
              }
            : c
        )
      );

      if (json.ok && action === 'redeem') {
        setFlash(`✅ ใช้สำเร็จ · เหลือ ${json.remaining} สิทธิ์`);
      } else if (json.ok && action === 'undo') {
        setFlash(`↩️ คืนสิทธิ์แล้ว · เหลือ ${json.remaining} สิทธิ์`);
      } else if (json.reason === 'limit_reached') {
        setFlash('⛔ ครบ 200 สิทธิ์แล้ว');
      } else if (json.reason === 'already_zero') {
        setFlash('ยังไม่มีการใช้สิทธิ์');
      } else {
        setFlash('เกิดข้อผิดพลาด');
      }
      setTimeout(() => setFlash(null), 2000);
    } catch {
      setFlash('เกิดข้อผิดพลาด');
      setTimeout(() => setFlash(null), 2000);
    } finally {
      setBusy(false);
    }
  }

  // ---------- หน้าใส่รหัสสตาฟ ----------
  if (!entered) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-bold text-gray-900">Photopia Staff</h1>
        <p className="mt-1 text-sm text-gray-500">กรอกรหัสสตาฟเพื่อเริ่มกดใช้คูปอง</p>
        {authError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{authError}</p>
        )}
        <input
          type="password"
          inputMode="numeric"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="รหัสสตาฟ"
          className="mt-5 w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-pink-500"
        />
        <button
          onClick={() => passcode && setEntered(true)}
          className="mt-3 w-full rounded-xl bg-pink-600 px-4 py-3 font-semibold text-white active:scale-[0.99]"
        >
          เข้าสู่ระบบสตาฟ
        </button>
      </div>
    );
  }

  // ---------- หน้ากดใช้คูปอง ----------
  return (
    <div className="mx-auto max-w-sm px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Photopia · กดใช้คูปอง</h1>
        <button onClick={() => setEntered(false)} className="text-sm text-gray-400">
          ออก
        </button>
      </div>

      {flash && (
        <div className="mt-4 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white">
          {flash}
        </div>
      )}

      {loading && <p className="mt-8 text-center text-sm text-gray-400">กำลังโหลด…</p>}

      <div className="mt-5 flex flex-col gap-5">
        {campaigns.map((c) => (
          <div key={c.code} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
                {c.partner_name}
              </span>
              <span className="font-mono text-xs text-gray-400">{c.code}</span>
            </div>

            <p className="mt-3 text-lg font-bold text-gray-900">
              ส่วนลด {discountLabel(c)} · {c.title}
            </p>

            {/* ตัวนับ */}
            <div className="mt-4 flex items-end justify-center gap-1">
              <span className={`text-5xl font-black ${c.is_full ? 'text-red-500' : 'text-gray-900'}`}>
                {c.remaining}
              </span>
              <span className="pb-1 text-lg text-gray-400">/ {c.usage_limit}</span>
            </div>
            <p className="text-center text-xs text-gray-400">สิทธิ์คงเหลือ</p>

            {/* ปุ่มกดใช้ */}
            <button
              onClick={() => act(c.code, 'redeem')}
              disabled={busy || c.is_full}
              className="mt-5 w-full rounded-2xl bg-pink-600 py-5 text-lg font-bold text-white active:scale-[0.99] disabled:bg-gray-300"
            >
              {c.is_full ? 'ครบ 200 สิทธิ์แล้ว' : 'ใช้ CODE แล้ว'}
            </button>

            {/* คืนสิทธิ์ (เผื่อกดพลาด) */}
            <button
              onClick={() => act(c.code, 'undo')}
              disabled={busy || c.used_count <= 0}
              className="mt-2 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 disabled:opacity-40"
            >
              กดพลาด? คืนสิทธิ์ 1 ครั้ง
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
