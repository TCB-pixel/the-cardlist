"use client";
import { useEffect } from "react";

// ใช้กับหน้าต่างซ้อน (modal/drawer): กด Esc เพื่อปิด และล็อกการเลื่อนหน้าด้านหลังระหว่างเปิด
export function useModal(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);
}
