import { useEffect, useLayoutEffect, useState } from "react";

/** کاربر واردشده از دید صفحه‌های عمومی (نام فقط برای نمایش؛ در حافظه‌ی مرورگر ذخیره نمی‌شود) */
export type Me = { name: string; admin: boolean } | null;

/** نشانه‌ی سبک در localStorage تا دکمه‌ی «پنل من» پس از بارگذاری کامل صفحه بی‌چشمک بیاید: "a" مدیر، "u" کاربر */
const HINT = "ds-me";
const readHint = (): Me | undefined => {
  try {
    const v = localStorage.getItem(HINT);
    return v === "a" || v === "u" ? { name: "", admin: v === "a" } : undefined;
  } catch {
    return undefined;
  }
};
const writeHint = (m: Me) => {
  try {
    if (m) localStorage.setItem(HINT, m.admin ? "a" : "u");
    else localStorage.removeItem(HINT);
  } catch {}
};

let pending: Promise<Me | undefined> | null = null;

/**
 * وضعیت ورود از GET /api/me (صفحه‌های عمومی ایستا هستند و کوکی را روی سرور نمی‌خوانند).
 * درخواست‌های هم‌زمان یکی می‌شوند؛ بعد از پاسخ دوباره آزاد است تا بعد از خروج/ورود مقدار تازه بیاید.
 * خطای شبکه → undefined (همان حالت قبلی می‌ماند).
 */
export function fetchMe(): Promise<Me | undefined> {
  pending ??= fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
    .then(async (r) => (r.ok ? (((await r.json()) as { user?: Me }).user ?? null) : r.status === 401 ? null : undefined))
    .catch(() => undefined)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** undefined یعنی هنوز معلوم نیست (پیش‌فرض: مهمان) */
export function useMe(): Me | undefined {
  const [me, setMe] = useState<Me | undefined>(undefined);
  useLayoutEffect(() => {
    const h = readHint();
    if (h !== undefined) setMe(h);
  }, []);
  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live || m === undefined) return;
      setMe(m);
      writeHint(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return me;
}
