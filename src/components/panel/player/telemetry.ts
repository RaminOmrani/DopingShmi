import { BUILD, logPlayback, newSessionId, platformCtx } from "@/lib/playback-log";

/** رخدادهای پایانی از سقف کلی صفحه بیرون‌اند (سرور هم سهمیه‌ی جدا برایشان دارد) */
const TERMINAL = new Set(["giveup", "session-end"]);
/**
 * سقف جدای رخدادهای پایانی: قطع کاملِ پیاپی در اینترنت ناپایدار (هر ~۲ دقیقه) سهمیه‌ی ساعتی سرور را پر می‌کرد
 * و خلاصه‌های تماشا (session-end) رد می‌شدند؛ بقیه‌ی قطع‌ها در stats.giveups همان خلاصه شمرده می‌شوند
 */
const TERMINAL_CAP: Record<string, number> = { giveup: 5 };
const PER_KIND = 3;
const PER_PAGE = 25;
/** سرور ctx بزرگ‌تر از ۲۰۰۰ نویسه را دور می‌ریزد */
const CTX_LIMIT = 1800;

export interface ReportExtra {
  code?: number;
  detail?: string;
  fatal?: boolean;
  /** داده‌ی اضافه‌ی همین رخداد (کنار وضعیت پلیر در ctx) */
  x?: Record<string, unknown>;
  /** لحظه‌ی بسته شدن صفحه (pagehide) */
  beacon?: boolean;
}
export type Report = (kind: string, e?: ReportExtra) => void;

/** پلیر وضعیت لحظه‌ای خودش را از این راه به هر گزارش می‌دهد */
export interface ReportSource {
  engine: () => string | undefined;
  position: () => number;
  ctx: () => Record<string, unknown>;
}

const safe = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

/**
 * گزارش‌گر رخدادهای پخش برای یک بار باز شدن پلیر (sessionId تازه).
 * حداکثر ۳ گزارش از هر نوع و ۲۵ گزارش در کل؛ session-end همیشه و giveup تا ۵ بار، بیرون از این سقف‌ها.
 */
export function createReporter(videoId: string) {
  const sessionId = newSessionId();
  const startedAt = Date.now();
  const perKind = new Map<string, number>();
  let total = 0;
  let src: ReportSource | null = null;

  const buildCtx = (x?: Record<string, unknown>) => {
    const base = { ...safe(platformCtx), build: BUILD };
    let ctx: Record<string, unknown> = { ...base, ...safe(() => src?.ctx()), ...x };
    if (JSON.stringify(ctx).length > CTX_LIMIT) ctx = { ...base, ...x, cut: 1 };
    if (JSON.stringify(ctx).length > CTX_LIMIT) ctx = { ...base, cut: 2 };
    return ctx;
  };

  const report: Report = (kind, e = {}) => {
    try {
      const n = perKind.get(kind) ?? 0;
      if (!TERMINAL.has(kind)) {
        if (n >= PER_KIND || total >= PER_PAGE) return;
        total++;
      } else if (n >= (TERMINAL_CAP[kind] ?? Infinity)) return;
      perKind.set(kind, n + 1);
      const pos = safe(() => src?.position());
      logPlayback(
        {
          kind,
          sessionId,
          videoId,
          engine: safe(() => src?.engine()),
          position: typeof pos === "number" && Number.isFinite(pos) ? Math.round(pos) : undefined,
          sinceLoadSec: Math.round((Date.now() - startedAt) / 1000),
          code: typeof e.code === "number" && Number.isFinite(e.code) ? e.code : undefined,
          detail: e.detail?.slice(0, 300),
          fatal: e.fatal,
          ctx: buildCtx(e.x),
        },
        { beacon: e.beacon },
      );
    } catch {
      /* گزارش اختیاری است */
    }
  };

  return {
    sessionId,
    report,
    bind: (s: ReportSource | null) => {
      src = s;
    },
  };
}
export type Reporter = ReturnType<typeof createReporter>;
