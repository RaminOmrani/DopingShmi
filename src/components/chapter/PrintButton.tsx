"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * دکمه‌ی «نسخه‌ی چاپی» نمونه سؤال‌ها. پیش از چاپ (با همین دکمه یا Ctrl+P) همه‌ی پاسخ‌های بسته‌ی
 * بخش targetId را باز می‌کند تا پاسخ‌نامه پس از سؤال‌ها چاپ شود، و پس از چاپ دوباره می‌بندد.
 */
export function PrintButton({ targetId, label = "نسخه‌ی چاپی" }: { targetId: string; label?: string }) {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      const root = document.getElementById(targetId);
      opened = root ? Array.from(root.querySelectorAll<HTMLDetailsElement>("details:not([open])")) : [];
      opened.forEach((d) => (d.open = true));
    };
    const after = () => {
      opened.forEach((d) => (d.open = false));
      opened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [targetId]);

  return (
    <button type="button" onClick={() => window.print()} className="btn-ghost btn-sm print:hidden">
      <Printer aria-hidden className="size-4" /> {label}
    </button>
  );
}
