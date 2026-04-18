"use client";
import Image from "next/image";
import Link from "next/link";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}

export default function TopBar({ title, showBack, rightSlot }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
      <div className="flex items-center justify-between px-4 h-12">
        <div className="flex items-center gap-2">
          {showBack && (
            <button onClick={() => window.history.back()} className="mr-1 text-zinc-500">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {title ? (
            <span className="text-sm font-semibold text-zinc-900 tracking-wide">{title}</span>
          ) : (
            <Link href="/">
              <Image
                src="/images/logo-long.jpg"
                alt="The Cardlist"
                width={130}
                height={42}
                className="h-7 w-auto object-contain"
                style={{ background: "transparent" }}
              />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">{rightSlot}</div>
      </div>
    </header>
  );
}
