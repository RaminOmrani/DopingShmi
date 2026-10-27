/**
 * گزارش رخدادهای پخش ویدیو برای عیب‌یابی از راه دور (سمت مرورگر).
 * رخدادها در /api/playback-log ذخیره و در پنل مدیریت ← «گزارش پخش» نمایش داده می‌شوند.
 * وقتی اینترنت قطع است در localStorage صف می‌شوند و بعداً فرستاده می‌شوند.
 */
export const BUILD = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";
const ENDPOINT = "/api/playback-log";
const QUEUE_KEY = "ds-tlm-q";
const QUEUE_MAX = 20;
/** نشانگر «در حال تماشا»؛ برای تشخیص بسته شدن ناگهانی صفحه (کرش/بسته شدن اپ) */
export const WATCH_KEY = "ds-watch";

export interface PlaybackEvent {
  kind: string; // ≤ 40
  sessionId: string; // ≤ 40
  videoId?: string;
  engine?: string; // hls | native | file
  position?: number;
  sinceLoadSec?: number;
  code?: number;
  detail?: string; // ≤ 300
  fatal?: boolean;
  /** وضعیت دستگاه/شبکه/پلیر (JSON حداکثر ۲۰۰۰ نویسه) */
  ctx?: Record<string, unknown>;
  queued?: boolean;
  /** زمان رخداد به ساعت دستگاه (میلی‌ثانیه) */
  at?: number;
}

export interface WatchMarker {
  sid: string;
  videoId: string;
  title?: string;
  pos: number;
  at: number;
  vis: string;
  playing: boolean;
  standalone: boolean;
  build: string;
  clean: boolean;
}

export const newSessionId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
};

/** اپ نصب‌شده روی صفحه‌ی اصلی (PWA) */
export const isStandalone = () => {
  try {
    return (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches;
  } catch {
    return false;
  }
};

/** مرورگر داخلی پیام‌رسان‌ها (تلگرام، ایتا، روبیکا، بله، اینستاگرام) یا WebView اندروید */
export const IN_APP_RE = /Telegram|Eitaa|Rubika|Bale|Instagram|FBAN|FBAV|; wv\)/i;
export const isInAppBrowser = () => typeof navigator !== "undefined" && IN_APP_RE.test(navigator.userAgent);

export const iosVersion = () => {
  const ua = navigator.userAgent;
  const m = ua.match(/OS (\d+)[._](\d+)/);
  return /iPhone|iPad|iPod/.test(ua) && m ? `${m[1]}.${m[2]}` : undefined;
};

/** وضعیت دستگاه و شبکه برای ctx هر گزارش */
export function platformCtx(): Record<string, unknown> {
  const n = navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    deviceMemory?: number;
  };
  const c = n.connection;
  return {
    standalone: isStandalone(),
    inApp: isInAppBrowser(),
    ios: iosVersion(),
    vis: document.visibilityState,
    online: navigator.onLine,
    net: c ? { t: c.type, e: c.effectiveType, d: c.downlink, r: c.rtt, s: c.saveData } : undefined,
    mem: n.deviceMemory,
    cpu: navigator.hardwareConcurrency,
  };
}

const readQueue = (): PlaybackEvent[] => {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
};
const enqueue = (events: PlaybackEvent[]) => {
  try {
    const q = [...readQueue(), ...events.map((e) => ({ ...e, queued: true }))];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
  } catch {
    /* حالت خصوصی مرورگر */
  }
};
const post = (events: PlaybackEvent[]) =>
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }), keepalive: true })
    .then((r) => {
      if (r.status >= 500) enqueue(events); // خطای سرور: بعداً دوباره؛ 4xx (مثلاً سهمیه) دور ریخته می‌شود
    })
    .catch(() => enqueue(events));

/**
 * ارسال یک رخداد. beacon=true برای لحظه‌ی بسته شدن صفحه (pagehide).
 * هیچ‌وقت خطا پرتاب نمی‌کند.
 */
export function logPlayback(ev: PlaybackEvent, opts: { beacon?: boolean } = {}) {
  try {
    const e: PlaybackEvent = { ...ev, at: ev.at ?? Date.now() };
    if (opts.beacon && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify({ events: [e] })], { type: "application/json" }))) return;
      } catch {
        /* ادامه با fetch */
      }
    }
    if (!navigator.onLine) return enqueue([e]);
    void post([e]);
  } catch {
    /* گزارش اختیاری است */
  }
}

let flushing = false;
/** ارسال رخدادهای صف‌شده (هنگام وصل شدن اینترنت، برگشت به صفحه، یا باز شدن صفحه‌ی بعدی) */
export function flushPlaybackQueue() {
  try {
    if (flushing || !navigator.onLine) return;
    const q = readQueue();
    if (!q.length) return;
    flushing = true;
    localStorage.removeItem(QUEUE_KEY);
    void post(q.slice(-QUEUE_MAX)).finally(() => (flushing = false));
  } catch {
    flushing = false;
  }
}

export function writeWatchMarker(m: WatchMarker) {
  try {
    const s = JSON.stringify(m);
    localStorage.setItem(WATCH_KEY, s);
    sessionStorage.setItem(WATCH_KEY, s);
  } catch {
    /* حالت خصوصی مرورگر */
  }
}

const parseMarker = (s: string | null): WatchMarker | null => {
  try {
    const m = s ? JSON.parse(s) : null;
    return m && typeof m.sid === "string" && typeof m.videoId === "string" ? m : null;
  } catch {
    return null;
  }
};
/** local: آخرین نشانگر در این دستگاه؛ session: فقط اگر همین زبانه دوباره بارگذاری شده باشد */
export function readWatchMarker() {
  try {
    return { local: parseMarker(localStorage.getItem(WATCH_KEY)), session: parseMarker(sessionStorage.getItem(WATCH_KEY)) };
  } catch {
    return { local: null, session: null };
  }
}
export function clearWatchMarker() {
  try {
    localStorage.removeItem(WATCH_KEY);
    sessionStorage.removeItem(WATCH_KEY);
  } catch {
    /* حالت خصوصی مرورگر */
  }
}
