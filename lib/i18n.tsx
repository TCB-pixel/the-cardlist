"use client";
// ระบบสองภาษา (ไทย / English) ฝั่งหน้าเว็บลูกค้า
// - ภาษาไทยเป็นค่าเริ่มต้น ผู้ใช้เลือกผ่าน <LangToggle /> แล้วจำไว้ใน localStorage + cookie "lang"
// - ใช้ในคอมโพเนนต์:  const { L, lang } = useLang();  แล้วเขียน  L("ข้อความไทย", "English text")
// - วันที่/ตัวเลข: ใช้ locale จาก useLang() ("th-TH" หรือ "en-GB") แทนการ hardcode "th-TH"
// - หน้าแอดมินยังเป็นภาษาไทยอย่างเดียว ไม่ต้องใช้ระบบนี้
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "th" | "en";
const STORAGE_KEY = "lang";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** เลือกข้อความตามภาษาปัจจุบัน */
  L: (th: string, en: string) => string;
  /** locale สำหรับ toLocaleString / toLocaleDateString */
  locale: "th-TH" | "en-GB";
}

const LangContext = createContext<LangContextValue>({
  lang: "th",
  setLang: () => {},
  L: (th) => th,
  locale: "th-TH",
});

function readSaved(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "th" || v === "en") return v;
  } catch {}
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)lang=(th|en)/) : null;
  return (m?.[1] as Lang) ?? null;
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    const saved = readSaved();
    if (saved && saved !== "th") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<LangContextValue>(() => ({
    lang,
    setLang,
    L: (th, en) => (lang === "en" ? en : th),
    locale: lang === "en" ? "en-GB" : "th-TH",
  }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
