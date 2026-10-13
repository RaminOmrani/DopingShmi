"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** تازه‌سازی خودکار صفحه (مثلاً هنگام انتقال ویدیو) */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
