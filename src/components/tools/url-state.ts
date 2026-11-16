"use client";

import { useEffect } from "react";

/**
 * وضعیت ابزار در نشانی (مثل ?f=H2SO4) فقط در مرورگر و پس از mount خوانده می‌شود تا صفحه ایستا بماند
 * (searchParams سمت سرور خوانده نمی‌شود و canonical همیشه نشانی ساده‌ی ابزار است).
 * apply فقط یک بار، با مقدار پارامتر، صدا زده می‌شود (setState ها پایدارند).
 */
export function useInitialParam(name: string, apply: (value: string) => void) {
  useEffect(() => {
    let v: string | null = null;
    try {
      v = new URLSearchParams(window.location.search).get(name);
    } catch {
      v = null;
    }
    if (v && v.trim()) apply(v.trim().slice(0, 200));
    // فقط هنگام mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}

/** پارامتر نشانی را بدون بارگذاری دوباره عوض می‌کند (null = حذف)؛ برای اشتراک‌گذاری نتیجه */
export function writeParam(name: string, value: string | null) {
  try {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    const next = url.pathname + url.search + url.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, "", next);
  } catch {
    /* محیط بدون history (مثلاً پیش‌نمایش)؛ نادیده */
  }
}
