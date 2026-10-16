"use client";
import { useLang, type Lang } from "@/lib/i18n";

function FlagTH() {
  return (
    <svg viewBox="0 0 30 20" className="w-full h-full" aria-hidden>
      <rect width="30" height="20" fill="#A51931" />
      <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
      <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
    </svg>
  );
}

function FlagUK() {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full" aria-hidden>
      <clipPath id="uk-clip"><rect width="60" height="40" /></clipPath>
      <g clipPath="url(#uk-clip)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="3" />
        <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="12" />
        <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="7" />
      </g>
    </svg>
  );
}

const OPTIONS: { value: Lang; label: string; Flag: () => React.ReactElement }[] = [
  { value: "th", label: "ภาษาไทย", Flag: FlagTH },
  { value: "en", label: "English", Flag: FlagUK },
];

/** ปุ่มสลับภาษา (ธงไทย / ธงอังกฤษ) — ธงที่เลือกอยู่มีกรอบ ธงที่ไม่ได้เลือกจะจางลง */
export default function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Language / ภาษา" className={`flex items-center gap-1 ${className}`}>
      {OPTIONS.map(({ value, label, Flag }) => {
        const active = lang === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`relative flex items-center justify-center w-10 h-10 -my-1 transition`}
          >
            <span
              className={`block w-7 h-[19px] rounded-[5px] overflow-hidden transition ${
                active
                  ? "ring-2 ring-zinc-400 ring-offset-1 ring-offset-white"
                  : "opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
              }`}
            >
              <Flag />
            </span>
          </button>
        );
      })}
    </div>
  );
}
