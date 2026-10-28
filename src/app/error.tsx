"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { isChunkError, isOffline, reloadOnceForChunkError, reportJsError } from "./error-report";

/**
 * خطای پیش‌بینی‌نشده در صفحه‌ها و layoutهای زیر ریشه (از جمله layout پنل):
 * به‌جای صفحه‌ی انگلیسی پیش‌فرض Next، پیام فارسی با تلاش دوباره.
 * retry در Next 16: داده‌ی سرور را دوباره می‌گیرد و بخش خطادار را دوباره رندر می‌کند.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const chunk = isChunkError(error);
  // خطای chunk در حالت آفلاین یعنی اینترنت قطع است، نه نسخه‌ی تازه (بعد از mount خوانده می‌شود تا hydration یکی باشد)
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    reportJsError(error, "app");
    if (!chunk || !isOffline()) {
      reloadOnceForChunkError(error);
      return;
    }
    setOffline(true);
    // به محض وصل شدن اینترنت همین صفحه دوباره بارگذاری می‌شود
    const reload = () => location.reload();
    window.addEventListener("online", reload, { once: true });
    return () => window.removeEventListener("online", reload);
  }, [error, chunk]);

  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div className="card w-full max-w-sm p-8">
        <Icon className={`mx-auto mb-4 size-12 ${offline ? "text-cyan" : "text-amber"}`} />
        <h1 className="mb-2 text-xl font-black">{offline ? "اتصال اینترنت برقرار نیست" : "مشکلی پیش آمد"}</h1>
        <p className="text-sm leading-7 text-white/60">
          {offline
            ? "به محض وصل شدن اینترنت، صفحه خودکار دوباره بارگذاری می‌شود."
            : chunk
              ? "نسخه‌ی تازه‌ی سایت منتشر شده است؛ صفحه را دوباره بارگذاری کنید."
              : "نمایش این صفحه با خطا روبه‌رو شد. دوباره تلاش کنید؛ اگر درست نشد، صفحه را دوباره بارگذاری کنید."}
        </p>
        {error?.digest && (
          <p className="mt-3 text-[11px] text-white/35">
            کد خطا: <span dir="ltr">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 grid gap-2">
          <button type="button" onClick={() => retry()} className={chunk ? "btn-ghost" : "btn-primary"}>
            <RotateCcw className="size-4" /> تلاش دوباره
          </button>
          <button type="button" onClick={() => location.reload()} className={chunk ? "btn-primary" : "btn-ghost"}>
            <RefreshCw className="size-4" /> بارگذاری دوباره صفحه
          </button>
          <Link href="/panel" className="btn-ghost">
            <LayoutDashboard className="size-4" /> رفتن به پنل
          </Link>
        </div>
      </div>
    </div>
  );
}
