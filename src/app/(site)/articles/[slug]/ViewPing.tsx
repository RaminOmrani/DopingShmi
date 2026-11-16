"use client";
import { useEffect } from "react";

/** یک بازدید برای هر مقاله در هر نشست مرورگر (صفحه‌ی مقاله ایستا/ISR است و سرور بازدیدها را نمی‌بیند) */
export function ViewPing({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `ds-view:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    const url = `/articles/${encodeURIComponent(slug)}/view`;
    if (!navigator.sendBeacon?.(url)) fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  }, [slug]);
  return null;
}
