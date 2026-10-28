import { BUILD, logPlayback, newSessionId, platformCtx } from "@/lib/playback-log";

/**
 * ابزار مشترک صفحه‌های خطا (error.tsx و global-error.tsx):
 * گزارش خطا به /api/playback-log و بارگذاری دوباره‌ی خودکار وقتی فایل‌های JS/CSS نسخه‌ی قبلی سایت دیگر وجود ندارند.
 */

/** خطای بارگذاری chunk (معمولاً صفحه‌ای که از قبل باز بوده و در این فاصله نسخه‌ی جدید سایت منتشر شده) */
const CHUNK_RE = /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to load chunk|dynamically imported module|Importing a module script failed/i;
const RELOAD_KEY = "ds-chunk-reload";
/** اگر در این فاصله یک بار خودکار بارگذاری شده، دوباره نه (جلوگیری از حلقه‌ی بی‌پایان) */
const RELOAD_GUARD_MS = 60_000;

type ErrLike = { name?: unknown; message?: unknown; digest?: unknown };
const asErr = (error: unknown): ErrLike => (error && typeof error === "object" ? (error as ErrLike) : { message: error });

export function isChunkError(error: unknown) {
  const e = asErr(error);
  return CHUNK_RE.test(`${String(e.name ?? "")} ${String(e.message ?? "")}`);
}

/** گزارش خطا (برای کاربر واردنشده ۴۰۱ می‌گیرد که اشکالی ندارد). هیچ‌وقت خطا پرتاب نمی‌کند. */
export function reportJsError(error: unknown, boundary: "app" | "global") {
  try {
    const e = asErr(error);
    const detail = `${String(e.name ?? "Error")}: ${String(e.message ?? "")} ${e.digest ? String(e.digest) : ""}`.trim().slice(0, 300);
    logPlayback({
      kind: "js-error",
      sessionId: newSessionId(),
      detail,
      ctx: { ...platformCtx(), build: BUILD, boundary, path: location.pathname, chunk: isChunkError(error) },
    });
  } catch {
    /* گزارش اختیاری است */
  }
}

/** مرورگر می‌گوید اینترنت قطع است (خطای chunk آن‌وقت «نسخه‌ی تازه» نیست، فقط آفلاین بودن است) */
export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * خطای chunk: یک بار خودکار بارگذاری دوباره (با پرچم sessionStorage). خروجی: آیا بارگذاری شروع شد.
 * آفلاین نه: بارگذاری دوباره فقط وضعیت صفحه را دور می‌ریزد و صفحه‌ی آفلاین می‌آورد.
 */
export function reloadOnceForChunkError(error: unknown) {
  if (!isChunkError(error) || isOffline()) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false; // بدون sessionStorage نمی‌شود جلوی حلقه را گرفت؛ دکمه‌ی بارگذاری دوباره کافی است
  }
  location.reload();
  return true;
}
