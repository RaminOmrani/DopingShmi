"use client";

import { Printer } from "lucide-react";

/** دکمه‌ی «نسخه‌ی چاپی» برگه‌ی فرمول (چاپ مرورگر یا ذخیره به‌صورت PDF)؛ در خود چاپ پنهان است */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ghost btn-sm print:hidden">
      <Printer aria-hidden className="size-4" /> نسخه‌ی چاپی
    </button>
  );
}
