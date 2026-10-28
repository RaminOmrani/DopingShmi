"use client";
import { useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import type { ErrorData, Level, RetryConfig } from "hls.js";
import { Loader2, Lock, AlertTriangle, CheckCircle2, RotateCw, Settings2, PlayCircle, LogIn } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { faNum } from "@/lib/utils";
import { BUILD, flushPlaybackQueue, isStandalone, WATCH_LOCK, writeWatchMarker } from "@/lib/playback-log";
import { createReporter, type Reporter } from "./player/telemetry";
import { createWakeLock } from "./player/wake-lock";
import { createHlsWatchdog } from "./player/hls-watchdog";
import { fetchPlay } from "./player/fetch-play";
import { aheadOf, isFullscreen, nearEnd, round1 } from "./player/media";

interface Play {
  hls?: string | null;
  mp4?: string | null;
  playerUrl?: string | null;
  poster?: string | null;
  lastPosition: number;
  watermark: string | null;
  duration: number;
  /** انقضای لینک امن و ساعت سرور (میلی‌ثانیه) — مهلت با ساعت سرور حساب می‌شود، نه ساعت گوشی */
  expiresAt?: number | null;
  serverNow?: number;
}
type PlayResponse = Play & { error?: string };
type Engine = "hls" | "native" | "file";
interface Quality {
  height: number;
  label: string;
}
/** پیام قطع کامل؛ login = نشست تمام شده و دکمه به صفحه‌ی ورود می‌رود */
interface Overlay {
  msg: string;
  login?: boolean;
}
/** reload = پاسخ HTML بود (چالش CDN یا صفحه‌ی خطا): دکمه کل صفحه را دوباره بارگذاری می‌کند */
interface LoadErr {
  msg: string;
  retry: boolean;
  reload?: boolean;
  login?: boolean;
}
/** final = نشست/دسترسی تمام شده (تلاش خودکار بی‌فایده است) */
interface GiveUpOpts {
  msg?: string;
  login?: boolean;
  final?: boolean;
}
/** نتیجه‌ی گرفتن لینک تازه؛ own = خطای JSON خود سرور ما (نه CDN/nginx) */
interface LinkResult {
  play?: Play;
  status: number;
  type: string;
  own: boolean;
  error?: string;
}

const QUALITY_KEY = "ds-quality"; // کیفیت انتخابی دانش‌آموز (ارتفاع تصویر؛ ۰ = خودکار)
const ENGINE_KEY = "ds-engine"; // موتور پخش اجباری برای پشتیبانی/آزمایش: 'hls' | 'native'
/** لینک امن منقضی/نامعتبر: باید لینک تازه گرفت (تلاش دوباره با همان لینک بی‌فایده است) */
const NEW_URL_CODES = new Set([401, 403, 410]);
/** فاصله‌ی تلاش‌های گرفتن لینک تازه؛ از دومی به بعد بیرون از پنجره‌ی ۱۵ ثانیه‌ای سرور (وگرنه همان لینک قبلی برمی‌گردد) */
const REFRESH_DELAYS = [0, 16000, 32000];
/** بعد از قطع کامل، تلاش خودکار (فقط وقتی صفحه پیداست) */
const AUTO_RETRY_DELAYS = [30_000, 60_000, 120_000];
const MSG_NET = "اتصال به سرور ویدیو قطع شد. اینترنت خود را بررسی کنید و «تلاش دوباره» را بزنید.";
const MSG_LINK = "سرور ویدیو فعلاً اجازه‌ی پخش نمی‌دهد. چند لحظه بعد «تلاش دوباره» را بزنید؛ اگر درست نشد به پشتیبانی خبر دهید.";
const MSG_MEDIA = "پخش این ویدیو در مرورگر شما با مشکل مواجه شد. «تلاش دوباره» را بزنید یا مرورگر دیگری را امتحان کنید.";
const MSG_SERVER = "سرور ویدیو موقتاً پاسخ نمی‌دهد. چند لحظه بعد «تلاش دوباره» را بزنید.";
const MSG_LOGIN = "نشست شما تمام شده است؛ دوباره وارد شوید تا ویدیو از همین‌جا ادامه پیدا کند.";
const MSG_DEMOTED = "به‌خاطر کندی اینترنت، کیفیت روی «خودکار» رفت";
type Cause = "net" | "link" | "media" | "server";
const MSG: Record<Cause, string> = { net: MSG_NET, link: MSG_LINK, media: MSG_MEDIA, server: MSG_SERVER };

const readPref = () => {
  try {
    return Number(localStorage.getItem(QUALITY_KEY)) || 0;
  } catch {
    return 0;
  }
};
const savePref = (h: number) => {
  try {
    localStorage.setItem(QUALITY_KEY, String(h));
  } catch {
    /* حالت خصوصی مرورگر */
  }
};
const readEngine = (): "hls" | "native" | null => {
  try {
    const e = localStorage.getItem(ENGINE_KEY);
    return e === "hls" || e === "native" ? e : null;
  } catch {
    return null;
  }
};
const goLogin = () => {
  location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
};
/** دلیل‌هایی که خود لینک امن مشکل دارد (بازسازی با همان لینک فایده ندارد) */
const isLinkReason = (r: string) => r === "expired" || r === "expiring" || r === "net0" || /^http4\d\d$/.test(r);

/**
 * سقف کیفیت خودکار به اندازه‌ی صفحه‌ی گوشی، یک بار هنگام بارگذاری؛
 * (capLevelToPlayerSize با تمام‌صفحه شدن سقف را عوض می‌کرد و بافر خالی می‌شد)
 */
const capIndex = (levels: Level[]) => {
  let limit = 0;
  try {
    limit = Math.min(screen.width, screen.height) * Math.min(window.devicePixelRatio || 1, 2) * 1.1;
  } catch {
    /* بدون سقف */
  }
  if (!limit) return -1;
  let cap = -1;
  levels.forEach((l, i) => {
    if (!l.height || l.height <= limit) cap = i; // کیفیت‌ها به ترتیب ارتفاع مرتب‌اند
  });
  return cap === levels.length - 1 ? -1 : Math.max(cap, 0);
};

/** شمارنده‌های خلاصه‌ی تماشا (session-end)؛ بعد از هر ارسال صفر می‌شوند تا دو بار شمرده نشوند */
const newStats = () => ({
  playedSec: 0,
  stalls: 0,
  stallMsTotal: 0,
  maxStallMs: 0,
  refreshes: 0,
  giveups: 0,
  autoRetryFails: 0,
  mediaRecovers: 0,
  fragStalls: 0,
  qualityChanges: 0,
  fsEnters: 0,
  maxAhead: 0,
  errHist: {} as Record<string, number>,
});

/**
 * پلیر ویدیو:
 *  - hls.js هر جا پشتیبانی شود، وگرنه پخش داخلی مرورگر؛ آیفونِ «افزوده به صفحه‌ی اصلی» همیشه پخش داخلی (روشن ماندن صفحه)
 *  - خطای شبکه/لینک منقضی/دانلود گیرکرده ← بازیابی خودکار از همان ثانیه؛ ویدیو هیچ‌وقت از صفحه حذف نمی‌شود
 *  - روشن نگه داشتن صفحه در تمام مدت تماشا (Screen Wake Lock)
 *  - انتخاب کیفیت توسط دانش‌آموز (در hls.js)؛ کیفیت دستیِ سنگین‌تر از اینترنت خودکار می‌شود
 *  - گزارش رخدادهای پخش و خلاصه‌ی تماشا برای پنل مدیریت (src/lib/playback-log.ts)
 */
export function VideoPlayer({ videoId }: { videoId: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<Play | null>(null);
  const [loadErr, setLoadErr] = useState<LoadErr | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [busy, setBusy] = useState(false);
  const [stalled, setStalled] = useState(false); // ویدیو منتظر داده است (کندی/قطعی اینترنت)
  const [tapToPlay, setTapToPlay] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [levels, setLevels] = useState<Quality[]>([]);
  const [selected, setSelected] = useState(0); // کیفیتی که الان واقعاً انتخاب است (۰ = خودکار)
  const [playingH, setPlayingH] = useState(0);
  const [wm, setWm] = useState({ x: 10, y: 10 });
  const [done, setDone] = useState(false);
  const [supportCode, setSupportCode] = useState(""); // کد پیگیری کوتاه برای پشتیبانی (۶ نویسه‌ی اول sessionId)
  const acc = useRef({ delta: 0, lastT: -1, sentAt: 0 });
  const recoveringRef = useRef(false); // در حین بازیابی یا بعد از قطع کامل، موقعیت (صفر موقت) ثبت نشود
  const wantPlayRef = useRef(false); // آیا دانش‌آموز می‌خواهد ویدیو پخش شود
  const qualityRef = useRef(0); // ترجیح ذخیره‌شده‌ی دانش‌آموز
  const tlm = useRef<Reporter | null>(null);
  const ctl = useRef<{ retry: () => void; setQuality: (h: number) => void } | null>(null);
  const retryBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    qualityRef.current = readPref();
  }, []);

  // گزارش رخدادها: یک sessionId برای هر بار باز شدن پلیر (پیش از بقیه‌ی افکت‌ها، چون آن‌ها از آن استفاده می‌کنند)
  useEffect(() => {
    const rep = createReporter(videoId);
    tlm.current = rep;
    setSupportCode(rep.sessionId.slice(0, 6));
    flushPlaybackQueue(); // گزارش‌هایی که دفعه‌ی قبل آفلاین صف شدند
    const onOnline = () => flushPlaybackQueue();
    const onVisible = () => document.visibilityState === "visible" && flushPlaybackQueue();
    const onError = (e: ErrorEvent) => {
      const file = (e.filename || "").split("/").pop();
      rep.report("js-error", { detail: `${e.message || "error"}${file ? ` @${file}:${e.lineno}` : ""}`.slice(0, 200) });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: unknown = e.reason;
      const m = r instanceof Error ? `${r.name}: ${r.message}` : String(r);
      rep.report("js-error", { detail: `unhandled ${m}`.slice(0, 200) });
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      // خود گزارش‌گر نابود نمی‌شود: افکت پخش هنگام بسته شدن هنوز خلاصه‌ی تماشا را با آن می‌فرستد
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    const fail = (e: LoadErr, code: number, type: string) => {
      tlm.current?.report("load-fail", { code, detail: type || "none" });
      setLoadErr(e);
    };
    fetchPlay(`/api/videos/${videoId}/play`, 20000)
      .then(({ ok, status, type, body }) => {
        if (cancelled) return;
        const d = body as PlayResponse | null;
        if (ok && d && (d.hls || d.mp4 || d.playerUrl)) return setData(d);
        const ct = type.split(";")[0];
        // خطای خود سرور ما (JSON با پیام فارسی)
        if (!ok && typeof d?.error === "string") return fail({ msg: d.error, retry: status !== 403 && status !== 404, login: status === 401 }, status, ct);
        // HTML (چالش CDN/صفحه‌ی خطای nginx) یا پاسخ ناقص
        fail({ msg: "اتصال برقرار نشد", retry: true, reload: ct.includes("html") }, status, ct);
      })
      .catch((e: unknown) => !cancelled && fail({ msg: "اتصال برقرار نشد", retry: true }, 0, (e as Error)?.name === "AbortError" ? "timeout" : "network"));
    return () => {
      cancelled = true;
    };
  }, [videoId, reloadKey]);

  // ارسال پیشرفت (پیش از افکت پخش، تا ارسال نهایی هنگام خروج قبل از نابودی پلیر انجام شود)
  useEffect(() => {
    const v = ref.current;
    if (!v || !data || data.playerUrl) return;
    const send = (force = false) => {
      // در حین بازیابی یا وقتی رسانه هنوز بارگذاری نشده، موقعیت (صفر موقت) ثبت نشود
      if (recoveringRef.current || v.readyState === 0) return;
      const a = acc.current;
      if (!force && Date.now() - a.sentAt < 15000) return;
      if (a.delta < 1 && !force) return;
      const delta = Math.round(a.delta);
      a.delta = 0;
      a.sentAt = Date.now();
      const payload = JSON.stringify({ position: v.currentTime || 0, delta, duration: v.duration || 0 });
      if (force && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/videos/${videoId}/progress`, new Blob([payload], { type: "application/json" }));
        return;
      }
      // ارسال نشد (قطعی کوتاه اینترنت/خطای سرور): ثانیه‌ها در ارسال بعدی حساب شوند (حداکثر ۴۰، مثل سقف سرور)
      const giveBack = () => {
        acc.current.delta += Math.min(delta, 40);
      };
      fetch(`/api/videos/${videoId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }).then(async (r) => {
        if (!r.ok) return giveBack();
        const d = await r.json().catch(() => null);
        if (d?.justCompleted) {
          setDone(true);
          toast.ok(`آفرین! ویدیو کامل شد و ${faNum(d.bonus)} امتیاز گرفتی 🎉`);
        }
      }, giveBack);
    };
    const onTime = () => {
      const a = acc.current;
      const t = v.currentTime;
      if (a.lastT >= 0 && !v.paused && !v.seeking && !recoveringRef.current) {
        const d = t - a.lastT;
        if (d > 0 && d < 2.5) a.delta += d;
      }
      a.lastT = t;
      send();
    };
    const onSeek = () => (acc.current.lastT = v.currentTime);
    const onPause = () => send(true);
    const onHide = () => document.visibilityState === "hidden" && send(true);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeek);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      send(true);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeek);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [data, videoId]);

  // راه‌اندازی پخش و بازیابی خطا
  useEffect(() => {
    const v = ref.current;
    const rep = tlm.current;
    if (!v || !data || data.playerUrl || !rep) return;
    const report = rep.report;
    let disposed = false;
    let Hls: typeof HlsType | null = null;
    let hls: HlsType | null = null;
    let mode: Engine | null = null;
    let engineWhy = "";
    let url = data.hls || data.mp4 || "";
    let expiresAt = 0; // به ساعت همین دستگاه
    let spare: Play | null = null; // لینک تازه‌ای که در پس‌زمینه گرفته شد؛ اگر بعداً سرور در دسترس نبود به کار می‌رود
    let refreshing = false;
    let refreshTimes: number[] = [];
    let lastRefreshAt = 0;
    let refreshCount = 0;
    let linkRefreshTried = false; // برای لینک فعلی یک بار به‌خاطر خطای ۰/4xx لینک تازه گرفته شده
    let refreshTok = 0; // هر لینک تازه شماره‌ی خودش را دارد؛ جواب درخواستِ کهنه (بعد از قطع کامل/تلاش دوباره) نادیده گرفته می‌شود
    let bgToken = 0;
    let bgScheduled = false;
    let netTries = 0;
    let netRetryPending = false; // تلاش دوباره‌ی شبکه در صف است؛ نگهبان دخالت نکند
    let mediaErrors: number[] = [];
    let lastMediaRecover = 0;
    let lastGood = 0; // آخرین موقعیت معتبر (شامل مقصد جابه‌جایی)
    let anchor: number | null = null; // موقعیتی که بازیابی باید از آن ادامه دهد
    let recoverSince = 0;
    let gaveUp = false;
    /** قطع کامل معوق: end = انتهای بافر هنگام تعویق (رسیدن داده‌ی تازه یعنی پخش درست شده)، t/frozenSince = سنجش ایستادن نقطه‌ی پخش */
    let pendingGiveUp: { why: string; o: GiveUpOpts; at: number; end: number; t: number; frozenSince: number } | null = null;
    let finalGiveUp = false; // قطع کامل به‌خاطر نشست/دسترسی: تلاش خودکار بی‌فایده است
    let overlayUp = false;
    let quietRetry = false; // تلاش خودکار: پیام تا موفق شدن پخش سر جایش می‌ماند
    let retrying: string | null = null; // برای گزارش موفقیت «تلاش دوباره»
    let autoTries = 0;
    let lastAutoAt = 0;
    let ignorePause = false;
    let playingAtRecovery = false; // هنگام شروع گرفتن لینک تازه ویدیو در حال پخش بود
    let cause: Cause = "net"; // علت آخرین مشکل، برای انتخاب پیام
    let refreshedAt = -1; // موقعیتی که آخرین لینک تازه از آن شروع شد
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let lastErr: { d: string; code?: number; fatal: boolean; atSec: number } | undefined;
    let expiredReported = false;
    // کیفیت
    let fragsBuffered = 0;
    let prefDecided = true;
    let lastLevel = -1;
    let stallWin: { at: number; ms: number }[] = []; // توقف‌های دقیقه‌ی اخیر (برای کیفیت دستی)
    let lastRanges: Partial<Record<string, TimeRanges>> | undefined;
    // توقف‌ها (waiting ← playing)
    let waitAt = 0;
    let waitSeek = false;
    let waitEligible = false;
    let aheadAt15: number | undefined;
    let lastSeekAt = -Infinity;
    let manualAt = -Infinity; // آخرین انتخاب کیفیت توسط دانش‌آموز (توقفِ ناشی از تعویض کیفیت حساب نشود)
    let firstPlayAt = 0;
    let firstPlayingAt = 0;
    // گزارش و نشانگر تماشا
    const loadedAt = performance.now();
    let lastInteract = loadedAt;
    let lastTimeAt = 0;
    let lastPlayT = -1;
    let stats = newStats();
    let statsFrom = Date.now();
    let summarySeq = 0;
    let startupSent = false;
    let markerOn = false;
    let lastMarkAt = 0;
    let unloading = false; // pagehide آمد (بارگذاری دوباره/رفتن به صفحه‌ی دیگر/بستن): نشانگر تمیز دیگر «ناتمام» نشود
    let hidPlaying = false; // صفحه وسط پخش پنهان شد؛ توقفِ بعدی کار سیستم است (قفل صفحه/پس‌زمینه)، نه دانش‌آموز
    let waitAfterStart = false; // توقف فعلی بعد از شروع پخش است (انتظار پیش از اولین تصویر توقف حساب نمی‌شود)
    let lastBw = 0; // تخمین سرعت نمونه‌ی قبلی hls.js برای شروع سریع‌تر نمونه‌ی تازه
    const onlineWaiters = new Set<() => void>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (!disposed) fn();
      }, ms);
      timers.add(t);
    };
    const setDeadline = (d: Play) => {
      expiresAt = d.expiresAt ? Date.now() + Math.max(0, d.expiresAt - (d.serverNow ?? Date.now())) : 0;
    };
    setDeadline(data);
    const start = data.lastPosition > 5 && (!data.duration || data.lastPosition < data.duration - 10) ? data.lastPosition : 0;
    /** موقعیت فعلی؛ وقتی رسانه در حال بارگذاری دوباره است (currentTime صفر)، آخرین موقعیت معتبر */
    const pos = () => (v.currentTime > 0 && v.readyState > 0 ? v.currentTime : anchor ?? (lastGood || start));
    const sinceLoadSec = () => Math.round((performance.now() - loadedAt) / 1000);

    const wake = createWakeLock(() => !disposed && !gaveUp && wantPlayRef.current);

    // ─── وضعیت لحظه‌ای برای هر گزارش (کلیدهای کوتاه؛ کل ctx زیر ۲۰۰۰ نویسه) ───
    const playerCtx = () => {
      const now = performance.now();
      const q = v.getVideoPlaybackQuality?.();
      const c: Record<string, unknown> = {
        rs: v.readyState,
        ns: v.networkState,
        paused: v.paused,
        wantPlay: wantPlayRef.current,
        ahead: round1(aheadOf(v)),
        ranges: v.buffered.length,
        fs: isFullscreen(v),
        wakeLock: wake.held(),
        idleSec: Math.round((now - lastInteract) / 1000),
        linkLeftSec: expiresAt ? Math.round((expiresAt - Date.now()) / 1000) : undefined,
        refreshes: refreshCount,
        netTries,
        lastErr,
        frames: q ? { dropped: q.droppedVideoFrames, total: q.totalVideoFrames } : undefined,
        engineWhy,
      };
      const h = hls;
      if (h) {
        const lv = h.levels[h.currentLevel];
        const bw = h.bandwidthEstimate;
        c.hls = {
          h: lv?.height,
          kbps: lv ? Math.round(lv.bitrate / 1000) : undefined,
          auto: h.autoLevelEnabled,
          bwKbps: Number.isFinite(bw) ? Math.round(bw / 1000) : undefined,
          buffering: h.bufferingEnabled,
          cap: h.autoLevelCapping,
        };
        const f = h.inFlightFragments.main?.frag;
        const st = f?.stats;
        if (f && st && st.loading.start && !st.loading.end) {
          c.frag = {
            sn: f.sn,
            level: f.level,
            loaded: st.loaded,
            total: st.total,
            ttfbMs: st.loading.first ? Math.round(st.loading.first - st.loading.start) : undefined,
            sinceStartMs: Math.round(now - st.loading.start),
            sinceLastByteMs: wd.fragIdleMs(),
          };
        }
      }
      return c;
    };
    rep.bind({ engine: () => mode ?? undefined, position: () => pos(), ctx: () => playerCtx() });

    /** نشانگر «در حال تماشا» برای تشخیص بسته شدن ناگهانی صفحه (کرش/بسته شدن اپ) در WatchMarker پنل */
    const mark = (playing: boolean, clean = false) => {
      // بعد از pagehide (Chromium: pagehide ← visibilitychange ← unload) نشانگر تمیز دوباره «ناتمام» نشود
      if (unloading && !clean) return;
      lastMarkAt = performance.now();
      writeWatchMarker({ sid: rep.sessionId, videoId, pos: Math.round(pos()), at: Date.now(), vis: document.visibilityState, playing, standalone: isStandalone(), build: BUILD, clean });
    };
    /** نشانگر با وضعیت فعلی؛ ویدیویی که سیستم هنگام پنهان شدن صفحه متوقف کرد «در حال پخش» می‌ماند */
    const markNow = () => mark(!v.paused || (document.hidden && hidPlaying));
    // قفل Web Lock تا وقتی این پلیر زنده است (حتی متوقف یا در زبانه‌ی پنهانِ منجمد)؛ با کرش/بسته شدن صفحه خودش آزاد می‌شود.
    // WatchMarker زبانه/اپ دیگر با آن نشست زنده را از بسته شدن ناگهانی تشخیص می‌دهد
    let lockSeq = 0;
    let lockGen = 0; // ۰ = قفل نمی‌خواهیم
    let releaseLock: (() => void) | undefined;
    const holdLock = () => {
      if (lockGen || !("locks" in navigator) || typeof navigator.locks?.request !== "function") return;
      const g = (lockGen = ++lockSeq);
      navigator.locks
        .request(
          `${WATCH_LOCK}${rep.sessionId}`,
          { mode: "shared" },
          () =>
            new Promise<void>((r) => {
              if (lockGen === g) releaseLock = r;
              else r(); // پیش از گرفتن قفل، دیگر لازم نبود
            }),
        )
        .catch(() => {});
    };
    const dropLock = () => {
      lockGen = 0;
      releaseLock?.();
      releaseLock = undefined;
    };

    /** خلاصه‌ی تماشا: هر بار فقط افزایش‌ها از ارسال قبلی (جمع ردیف‌های یک sessionId = کل جلسه) */
    const sendSummary = (beacon: boolean) => {
      const s = stats;
      const openMs = waitAt ? Math.round(performance.now() - waitAt) : 0;
      // انتظار باز هنگام بسته شدن: وسط پخش = توقف؛ پیش از اولین تصویر = شروعی که هیچ‌وقت نرسید
      const openStallMs = waitAfterStart ? openMs : 0;
      const openStartMs = waitAfterStart ? 0 : openMs;
      const changed = s.playedSec >= 1 || s.stalls || s.refreshes || s.giveups || s.autoRetryFails || s.mediaRecovers || s.fragStalls || openMs;
      // چیزی برای گزارش نیست؛ ولی اولین خلاصه‌ی کسی که پخش را زده همیشه فرستاده می‌شود (مخرج «در هر جلسه»)
      if (!changed && (summarySeq > 0 || !firstPlayAt)) return;
      summarySeq++;
      const errHist = Object.fromEntries(Object.entries(s.errHist).sort((a, b) => b[1] - a[1]).slice(0, 8));
      const startup = !startupSent && firstPlayingAt ? { startupMs: Math.round(firstPlayingAt - loadedAt), firstPlayMs: Math.round(firstPlayAt - loadedAt) } : {};
      if (firstPlayingAt) startupSent = true;
      report("session-end", {
        beacon,
        x: {
          seq: summarySeq,
          playedSec: Math.round(s.playedSec),
          wallSec: Math.round((Date.now() - statsFrom) / 1000),
          stalls: s.stalls,
          stallMsTotal: Math.round(s.stallMsTotal),
          maxStallMs: Math.round(s.maxStallMs),
          openStallMs: openStallMs || undefined,
          openStartMs: openStartMs || undefined,
          refreshes: s.refreshes,
          giveups: s.giveups,
          autoRetryFails: s.autoRetryFails || undefined,
          mediaRecovers: s.mediaRecovers,
          fragStalls: s.fragStalls,
          qualityChanges: s.qualityChanges,
          fsEnters: s.fsEnters,
          maxAhead: round1(s.maxAhead),
          errHist,
          ...startup,
        },
      });
      stats = newStats();
      statsFrom = Date.now();
    };

    /** fresh = اقدام تازه (منبع تازه یا بازیابی رسانه): مهلت ۳۰ ثانیه‌ای «بازیابی بی‌نتیجه» از همین حالا */
    const beginRecovery = (fresh = false) => {
      if (fresh || !recoveringRef.current || !recoverSince) recoverSince = performance.now();
      recoveringRef.current = true;
    };
    const finishRecovery = () => {
      recoveringRef.current = false;
      recoverSince = 0;
      anchor = null;
      if (!disposed) setBusy(false);
    };
    /** بعد از بارگذاری دوباره، اگر دانش‌آموز در حال تماشا بود، پخش ادامه پیدا کند */
    const resumeAfter = () => {
      v.addEventListener(
        "canplay",
        () => {
          if (disposed || gaveUp) return;
          if (overlayUp) {
            overlayUp = false; // تلاش خودکار بعد از قطع کامل موفق شد
            quietRetry = false; // قطع کامل بعدی، قطع کامل تازه است و گزارش می‌شود
            autoTries = 0; // قطع کامل بعدی دوباره ۳۰/۶۰/۱۲۰ ثانیه
            setOverlay(null);
          }
          if (retrying) {
            report("retry-ok", { detail: retrying });
            retrying = null;
          }
          const wasPlaying = playingAtRecovery;
          playingAtRecovery = false;
          if (!wantPlayRef.current) {
            finishRecovery();
            if (wasPlaying) setTapToPlay(true); // پخش به‌خاطر خطا متوقف شده بود، نه به دست دانش‌آموز
            return;
          }
          v.play().then(finishRecovery, () => {
            finishRecovery();
            setTapToPlay(true); // مرورگر پخش خودکار را اجازه نداد
          });
        },
        { once: true },
      );
    };
    let selfExitAt = -Infinity; // آخرین بار که خود پلیر (قطع کامل) از تمام‌صفحه خارج شد
    const exitFullscreen = () => {
      selfExitAt = performance.now();
      try {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        const w = v as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean; webkitExitFullscreen?: () => void };
        if (w.webkitDisplayingFullscreen) w.webkitExitFullscreen?.();
      } catch {
        /* بدون تمام‌صفحه */
      }
    };
    const clearStall = () => {
      clearTimeout(stallTimer);
      stallTimer = undefined;
      if (!disposed) setStalled(false);
    };

    // ─── قطع کامل ───
    /**
     * قطع کامل: پیام با دکمه‌ی «تلاش دوباره»؛ ویدیو متوقف و از تمام‌صفحه خارج می‌شود تا پیام دیده شود.
     * اگر هنوز چند ثانیه ویدیو در بافر هست، اول همان پخش می‌شود و پیام وقتی بافر تمام شد می‌آید.
     */
    const giveUp = (why: string, o: GiveUpOpts = {}) => {
      if (disposed || gaveUp) return;
      refreshing = false;
      if (!v.paused && !v.ended && aheadOf(v) > 3) {
        if (!pendingGiveUp) pendingGiveUp = { why, o, at: performance.now(), end: bufEnd(), t: v.currentTime, frozenSince: 0 };
        return;
      }
      pendingGiveUp = null;
      doGiveUp(why, o, 0);
    };
    const runPendingGiveUp = () => {
      const p = pendingGiveUp;
      if (!p || disposed || gaveUp) return;
      pendingGiveUp = null;
      doGiveUp(p.why, p.o, performance.now() - p.at);
    };
    /** انتهای بازه‌ی بافرشده‌ای که نقطه‌ی پخش داخل آن است */
    const bufEnd = () => v.currentTime + aheadOf(v);
    const bufferedToEnd = () => v.duration > 0 && bufEnd() >= v.duration - 0.5;
    /**
     * قطع کامل معوق (هر ثانیه): در مدت تعویق همه‌ی نگهبان‌ها خاموش‌اند، پس اینجا تصمیم گرفته می‌شود:
     * داده‌ی تازه رسید ← لغو (پخش درست شد)؛ بافر تمام شد یا نقطه‌ی پخش با وجود داده ۵ ثانیه ایستاد ← پیام «تلاش دوباره»
     */
    const checkPending = (now: number) => {
      const p = pendingGiveUp;
      if (!p || disposed || gaveUp) return;
      // قطع کامل به‌خاطر نشست/دسترسی لغو نمی‌شود؛ فقط تا تمام شدن بافر صبر می‌کند
      if (!p.o.final && (bufEnd() > p.end + 8 || bufferedToEnd())) {
        pendingGiveUp = null;
        report("giveup-cancelled", { detail: `${p.why} +${Math.round((now - p.at) / 1000)}s` });
        if (recoveringRef.current) finishRecovery();
        else setBusy(false);
        return;
      }
      if (v.paused || v.seeking || document.hidden) {
        p.frozenSince = 0;
        p.t = v.currentTime;
        return;
      }
      if (aheadOf(v) < 1 && !bufferedToEnd()) return runPendingGiveUp();
      // نقطه‌ی پخش با وجود داده جلو نمی‌رود (hls.js در یک بازه‌ی پیوسته تکان نمی‌دهد و نگهبان ما خاموش است)
      if (Math.abs(v.currentTime - p.t) >= 0.5) {
        p.t = v.currentTime;
        p.frozenSince = 0;
      } else if (!p.frozenSince) p.frozenSince = now;
      else if (now - p.frozenSince > 5000) runPendingGiveUp();
    };
    const doGiveUp = (why: string, o: GiveUpOpts, deferredMs: number) => {
      const quiet = quietRetry;
      quietRetry = false;
      retrying = null;
      gaveUp = true;
      refreshing = false;
      refreshTok++; // لینک تازه‌ای که هنوز در راه است دیگر پلیر را نسازد
      finalGiveUp = !!o.final;
      recoveringRef.current = true; // موقعیت واقعی معلوم نیست؛ پیشرفت ثبت نشود
      recoverSince = 0;
      if (anchor == null) anchor = pos();
      endWait("giveup");
      wake.release();
      clearStall();
      setBusy(false);
      overlayUp = true;
      setOverlay({ msg: o.msg ?? MSG[cause], login: o.login });
      if (!v.paused) {
        ignorePause = true; // این توقف کار ماست، نه دانش‌آموز
        v.pause();
      }
      exitFullscreen();
      if (quiet) {
        // تلاش خودکار دوباره نشد؛ پیام از قبل روی صفحه است (قطع کامل جدید حساب نمی‌شود)
        stats.autoRetryFails++;
        report("retry-fail", { detail: `${why} cause=${cause}`, x: { reason: why, cause } });
      } else {
        stats.giveups++;
        const d = Math.round(deferredMs / 1000);
        report("giveup", { detail: `${why} cause=${cause}${d ? ` deferred=${d}s` : ""}`, x: { reason: why, cause, deferredSec: d || undefined } });
      }
      if (!finalGiveUp) scheduleAutoRetry();
    };
    const resetBudgets = () => {
      refreshTimes = [];
      netTries = 0;
      mediaErrors = [];
      wd.resetBudget();
    };
    /** تلاش خودکار بعد از قطع کامل (۳۰/۶۰/۱۲۰ ثانیه، برگشت به صفحه، وصل شدن اینترنت)؛ پیام تا موفقیت می‌ماند */
    const autoRetry = (why: string) => {
      if (!gaveUp || disposed || finalGiveUp || document.visibilityState !== "visible") return;
      if (Date.now() - lastAutoAt < 10_000) return;
      lastAutoAt = Date.now();
      gaveUp = false;
      quietRetry = true;
      retrying = `auto-${why}`;
      resetBudgets();
      refresh("auto-retry");
    };
    const scheduleAutoRetry = () => {
      if (autoTries >= AUTO_RETRY_DELAYS.length) return;
      later(() => autoRetry("timer"), AUTO_RETRY_DELAYS[autoTries++]);
    };

    // ─── hls.js ───
    const rc = (maxNumRetry: number, retryDelayMs: number, maxRetryDelayMs: number): RetryConfig => ({
      maxNumRetry,
      retryDelayMs,
      maxRetryDelayMs,
      backoff: "exponential",
      // قطعی‌های کوتاه اینترنت موبایل (status 0) هم دوباره تلاش شوند؛ لینک منقضی نه (باید لینک تازه گرفت)
      shouldRetry: (cfg, count, isTimeout, res, retry) => {
        const code = res?.code;
        if (code && NEW_URL_CODES.has(code)) return false;
        if (!isTimeout && code === 0) return count < (cfg?.maxNumRetry ?? 0);
        return retry;
      },
    });
    const policy = (ttfb: number, total: number, t: RetryConfig, e: RetryConfig) => ({ default: { maxTimeToFirstByteMs: ttfb, maxLoadTimeMs: total, timeoutRetry: t, errorRetry: e } });

    const syncLevels = () => {
      if (!hls) return;
      const hs = new Set<number>();
      hls.levels.forEach((l) => l.height && hs.add(l.height));
      setLevels([...hs].sort((a, b) => b - a).map((h) => ({ height: h, label: `${faNum(h)}p` })));
    };
    /** بهترین نسخه با ارتفاع داده‌شده؛ اگر این ویدیو آن کیفیت را ندارد، نزدیک‌ترین کیفیت پایین‌تر */
    const levelIndex = (h: number) => {
      if (!hls) return -1;
      const ls = hls.levels;
      const target = ls.some((l) => l.height === h) ? h : Math.max(0, ...ls.filter((l) => l.height && l.height < h).map((l) => l.height));
      let best = -1;
      ls.forEach((l, i) => {
        if (l.height === target && (best < 0 || l.bitrate > ls[best].bitrate)) best = i;
      });
      if (best < 0) ls.forEach((l, i) => (best < 0 || l.bitrate < ls[best].bitrate) && (best = i)); // پایین‌ترین
      return best;
    };
    const syncSelected = () => {
      if (!hls) return;
      setSelected(hls.autoLevelEnabled ? 0 : hls.levels[hls.manualLevel]?.height ?? 0);
    };
    /** کیفیت دستی سنگین‌تر از اینترنت: برگشت به خودکار (برای همیشه، تا دانش‌آموز دوباره انتخاب کند) */
    const demoteToAuto = (why: string) => {
      const h = hls;
      if (!h || h.autoLevelEnabled) return;
      const from = h.levels[h.manualLevel]?.height;
      h.loadLevel = -1;
      qualityRef.current = 0;
      savePref(0);
      syncSelected();
      stallWin = [];
      toast.ok(MSG_DEMOTED);
      report("quality-demoted", { detail: `${from ?? "?"}p ${why}` });
    };
    /** ≥۳ توقف یا بیش از ۵ ثانیه توقف در یک دقیقه با کیفیت دستیِ غیرپایین‌ترین ← خودکار */
    const checkDemote = () => {
      const h = hls;
      if (!h || h.autoLevelEnabled) return;
      const cur = h.levels[h.manualLevel];
      if (!cur || h.levels.every((l) => l.bitrate >= cur.bitrate)) return; // پایین‌ترین کیفیت است
      const now = performance.now();
      stallWin = stallWin.filter((s) => now - s.at < 60_000);
      const open = waitAt && waitEligible ? now - waitAt : 0;
      const count = stallWin.length + (open ? 1 : 0);
      const total = stallWin.reduce((a, s) => a + s.ms, 0) + open;
      if (count >= 3 || total > 5000) demoteToAuto("stalls");
    };
    /** کیفیت ذخیره‌شده فقط وقتی سرعت فعلی کافی است (وگرنه خودکار می‌ماند؛ ترجیح دانش‌آموز پاک نمی‌شود) */
    const applyPref = (h: HlsType) => {
      prefDecided = true;
      const i = levelIndex(qualityRef.current);
      const lv = h.levels[i];
      if (!lv || !h.autoLevelEnabled) return;
      if (h.bandwidthEstimate >= 1.2 * lv.bitrate) {
        h.loadLevel = i;
        syncSelected();
      }
    };
    /** انتهای بافر صدا/تصویر نزدیک نقطه‌ی پخش (برای گزارش گیر کردن) */
    const sourceEnds = () => {
      if (!lastRanges) return undefined;
      const t = v.currentTime;
      const out: Record<string, number> = {};
      for (const [name, tr] of Object.entries(lastRanges)) {
        if (!tr) continue;
        let end = 0;
        for (let i = 0; i < tr.length; i++) if (tr.start(i) <= t + 0.2) end = tr.end(i);
        out[name] = round1(end);
      }
      return out;
    };

    const createHls = (startPosition: number) => {
      const H = Hls!;
      const h = new H({
        startPosition: startPosition > 0 ? startPosition : -1,
        startLevel: -1,
        // بافر کوتاه‌تر: حافظه‌ی کمتر در گوشی؛ مرگ بارگیری را نگهبان زود می‌فهمد (نه بعد از ۲ دقیقه بافر)
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 30,
        errorPenaltyExpireMs: 30000,
        manifestLoadPolicy: policy(15000, 30000, rc(3, 500, 4000), rc(3, 1000, 8000)),
        playlistLoadPolicy: policy(15000, 30000, rc(4, 500, 4000), rc(4, 1000, 8000)),
        // maxLoadTimeMs سقف کل دانلود است نه بیکاری؛ کم کردنش دانلودهای کند ولی سالم را قطع می‌کند
        fragLoadPolicy: policy(12000, 120000, rc(6, 1000, 8000), rc(8, 1000, 8000)),
        // بازسازی (لینک تازه/بازیابی): سرعت سنجیده‌ی نمونه‌ی قبلی؛ بدون دانلود قطعه‌ی آزمایشی که در اینترنت کند بازیابی را کند می‌کرد
        ...(lastBw > 0 ? { abrEwmaDefaultEstimate: lastBw, testBandwidth: false } : {}),
      });
      wd.reset();
      fragsBuffered = 0;
      prefDecided = !qualityRef.current;
      lastLevel = -1;
      expiredReported = false;
      netRetryPending = false;
      lastRanges = undefined;
      h.on(H.Events.MANIFEST_PARSED, () => {
        syncLevels();
        h.autoLevelCapping = capIndex(h.levels);
        syncSelected(); // کیفیت ذخیره‌شده بعد از ۲ قطعه و با سنجش سرعت (applyPref)
      });
      h.on(H.Events.LEVELS_UPDATED, syncLevels);
      h.on(H.Events.LEVEL_SWITCHING, syncSelected); // اگر hls.js به‌خاطر خطا به خودکار برگشت، منو هم نشان دهد
      h.on(H.Events.LEVEL_SWITCHED, (_e, d) => {
        setPlayingH(h.levels[d.level]?.height ?? 0);
        if (lastLevel >= 0 && d.level !== lastLevel) stats.qualityChanges++;
        lastLevel = d.level;
      });
      h.on(H.Events.FRAG_LOADED, () => wd.bytesArrived());
      h.on(H.Events.FRAG_BUFFERED, (_e, d) => {
        netTries = 0;
        if (!recoveringRef.current && !refreshing) setBusy(false);
        if ((d.frag.type as string) !== "main") return;
        wd.fragBuffered();
        if (!prefDecided && ++fragsBuffered >= 2) applyPref(h);
      });
      h.on(H.Events.BUFFER_APPENDED, (_e, d) => (lastRanges = d.timeRanges));
      h.on(H.Events.ERROR, (_e, d) => onHlsError(h, d));
      h.attachMedia(v);
      h.loadSource(url);
      return h;
    };

    /** بازیابی خطای رسانه (از خطای کشنده یا نگهبان، با بودجه‌ی مشترک)؛ بیش از ۳ بار در دقیقه ← پلیر از نو */
    const recoverMedia = (h: HlsType, why: string) => {
      if (disposed || gaveUp || h !== hls) return;
      cause = "media";
      const now = performance.now();
      mediaErrors = mediaErrors.filter((x) => now - x < 60000);
      mediaErrors.push(now);
      if (mediaErrors.length > 3) return refresh("media");
      stats.mediaRecovers++;
      beginRecovery(true);
      setBusy(true);
      const p = pos();
      if (anchor == null) anchor = p;
      if (now - lastMediaRecover < 3000) h.swapAudioCodec();
      lastMediaRecover = now;
      lastErr = { d: `recover:${why}`.slice(0, 60), fatal: false, atSec: sinceLoadSec() };
      h.recoverMediaError();
      h.startLoad(p); // بعد از خطای کشنده hls.js بارگذاری را متوقف کرده؛ از همین ثانیه ادامه بده
      resumeAfter();
    };

    const onHlsError = (h: HlsType, d: ErrorData) => {
      if (disposed || h !== hls || !Hls || gaveUp) return;
      const code = d.response?.code;
      const E = Hls.ErrorDetails;
      lastErr = { d: d.details, code, fatal: d.fatal, atSec: sinceLoadSec() };
      if (!d.fatal) stats.errHist[d.details] = (stats.errHist[d.details] ?? 0) + 1;
      // لینک منقضی/نامعتبر: لینک تازه فقط اگر کشنده است، فهرست پخش است یا لینک نزدیک انقضاست؛
      // ۴۰۳ تک قطعه را hls.js با کیفیت دیگر جبران می‌کند (نابود کردن پلیر سالم و بافرش لازم نیست)
      if (code && NEW_URL_CODES.has(code)) {
        const playlist = d.details === E.MANIFEST_LOAD_ERROR || d.details === E.LEVEL_LOAD_ERROR || d.details === E.AUDIO_TRACK_LOAD_ERROR;
        const renew = d.fatal || playlist || (expiresAt > 0 && expiresAt - Date.now() < 10 * 60_000);
        if (!expiredReported) {
          expiredReported = true;
          report("expired-link", { code, detail: `${d.details}${renew ? "" : " failover"}`, fatal: d.fatal });
        }
        if (renew) {
          cause = "link";
          refresh("expired");
        }
        return;
      }
      // hls.js خودش رسانه را از نو وصل کرده؛ فقط پخش را ادامه بده
      if (!d.fatal && d.details === E.MEDIA_SOURCE_REQUIRES_RESET) {
        beginRecovery();
        if (anchor == null) anchor = lastGood || null;
        resumeAfter();
        return;
      }
      if (!d.fatal) return;
      report("fatal", { code, detail: d.details, fatal: true });
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
        cause = code && code >= 500 ? "server" : code && code >= 400 ? "link" : "net";
        if (d.details === E.MANIFEST_LOAD_ERROR || d.details === E.MANIFEST_LOAD_TIMEOUT || d.details === E.MANIFEST_PARSING_ERROR) return refresh("manifest");
        const timeout = d.details === E.FRAG_LOAD_TIMEOUT || d.details === E.LEVEL_LOAD_TIMEOUT || d.details === E.AUDIO_TRACK_LOAD_TIMEOUT;
        const load = timeout || d.details === E.FRAG_LOAD_ERROR || d.details === E.LEVEL_LOAD_ERROR || d.details === E.AUDIO_TRACK_LOAD_ERROR;
        // ۴۰۳/۴۲۹ بدون هدر CORS از CDN ویدیو به شکل status 0 می‌رسد: با اینترنت وصل، لینک مشکوک است؛ یک بار لینک تازه
        const suspect = (!code && navigator.onLine && !timeout) || (!!code && code >= 400 && code < 500 && code !== 416);
        if (load && suspect && !linkRefreshTried) {
          linkRefreshTried = true;
          cause = "link";
          report("link-suspect", { code, detail: d.details });
          return refresh(code ? `http${code}` : "net0");
        }
        if (++netTries > 6) return giveUp("net-tries");
        setBusy(true);
        netRetryPending = true;
        const retry = () => {
          onlineWaiters.delete(retry);
          later(() => {
            if (hls !== h) return;
            netRetryPending = false;
            if (!gaveUp) h.startLoad(pos());
          }, Math.min(1000 * 2 ** netTries, 15000));
        };
        if (navigator.onLine) retry();
        else {
          onlineWaiters.add(retry);
          window.addEventListener("online", retry, { once: true });
        }
      } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
        cause = "media";
        // این مرورگر قالب ویدیو را با hls.js پخش نمی‌کند (پیش از آماده شدن کیفیت‌ها): پخش داخلی مرورگر را امتحان کن
        if (!h.levels.length || d.details === E.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
          if (data.hls && v.canPlayType("application/vnd.apple.mpegurl")) {
            const p = pos();
            hls = null;
            h.destroy();
            mode = "native";
            engineWhy = `fallback:${d.details}`.slice(0, 40);
            setEngine("native");
            setLevels([]);
            report("engine", { detail: `native ${engineWhy}` });
            beginRecovery();
            loadNative(p);
            if (wantPlayRef.current) v.play().catch(() => {}); // مثل install: منتظر canplay نماند
            resumeAfter();
            return;
          }
          return giveUp("media-incompatible");
        }
        recoverMedia(h, d.details);
      } else {
        cause = "media";
        refresh("other");
      }
    };

    // ─── پخش داخلی مرورگر (آیفون PWA، آیفون‌های قدیمی و مرورگرهای بدون MSE) ───
    const loadNative = (t: number) => {
      v.src = url;
      v.addEventListener("loadedmetadata", () => t > 0 && (v.currentTime = t), { once: true });
      // iOS گاهی جابه‌جایی هنگام loadedmetadata را نادیده می‌گیرد؛ فقط اگر هنوز اول ویدیوست دوباره جابه‌جا کن
      v.addEventListener("canplay", () => t > 2 && v.currentTime < 1 && (v.currentTime = t), { once: true });
    };
    const onNativeError = () => {
      if (mode === "hls" || refreshing || gaveUp) return;
      const e = v.error;
      lastErr = { d: `media-err-${e?.code ?? "?"}`, code: e?.code, fatal: true, atSec: sinceLoadSec() };
      report("native-error", { code: e?.code, detail: e?.message?.slice(0, 200) });
      cause = e?.code === 3 ? "media" : navigator.onLine ? "link" : "net";
      refresh("native");
    };

    // ─── لینک تازه ───
    const fetchLink = async (): Promise<LinkResult> => {
      try {
        const r = await fetchPlay(`/api/videos/${videoId}/play?fresh=1`, 15000);
        const d = r.body as PlayResponse | null;
        if (r.ok && d && (d.hls || d.mp4)) return { play: d, status: r.status, type: r.type, own: true };
        return { status: r.status, type: r.type.split(";")[0] || "none", own: typeof d?.error === "string", error: d?.error };
      } catch (e) {
        return { status: 0, type: (e as Error)?.name === "AbortError" ? "timeout" : "network", own: false };
      }
    };
    /** پلیر را با لینک تازه (یا null = همان لینک فعلی) از همان ثانیه از نو می‌سازد */
    const install = (d: Play | null) => {
      // در مدت گرفتن لینک، نسخه‌ی قبلی ممکن است از بافر جلو رفته باشد
      const t = v.currentTime > 0 && v.readyState > 0 ? v.currentTime : anchor ?? (lastGood || start);
      anchor = t;
      beginRecovery(true);
      setBusy(true);
      if (d) {
        const next = d.hls || d.mp4 || url;
        if (next !== url) {
          url = next;
          linkRefreshTried = false;
        }
        if (d.expiresAt) setDeadline(d);
        spare = null;
      }
      pendingGiveUp = null;
      lastRefreshAt = Date.now();
      refreshedAt = t;
      refreshCount++;
      stats.refreshes++;
      if (mode === "hls") {
        const bw = hls?.bandwidthEstimate;
        if (bw && Number.isFinite(bw)) lastBw = bw;
        hls?.destroy();
        hls = createHls(t);
      } else {
        loadNative(t);
        // تعویض src ویدیو را بی‌رویداد pause متوقف می‌کند؛ اگر canplay هرگز نرسد پخش داخلی گیر می‌ماند.
        // دانش‌آموز قبلاً پخش را لمس کرده، پس play() همین حالا مجاز است (نگهبان پخش داخلی هم دوباره فعال می‌شود)
        if (wantPlayRef.current) v.play().catch(() => {});
      }
      refreshing = false; // خطای منبع تازه دوباره بازیابی شود
      resumeAfter();
    };
    /** لینک تازه از سرور و ادامه از همان ثانیه؛ تلاش‌ها با فاصله، و بعد از ۳ بار در ۲ دقیقه پیام «تلاش دوباره» */
    const refresh = (reason: string) => {
      if (refreshing || disposed || gaveUp) return;
      const now = Date.now();
      refreshTimes = refreshTimes.filter((x) => now - x < 120000);
      const attempt = refreshTimes.length;
      if (attempt >= REFRESH_DELAYS.length) {
        report("refresh-loop", { detail: `${reason}/${cause}` });
        return giveUp(`refresh-loop:${reason}`);
      }
      refreshTimes.push(now);
      refreshing = true;
      const tok = ++refreshTok;
      bgToken++; // جواب گرفتن لینک در پس‌زمینه دیگر کهنه است
      playingAtRecovery = wantPlayRef.current || (!v.paused && !v.ended);
      beginRecovery();
      if (anchor == null) anchor = pos();
      setBusy(true);
      later(() => {
        if (tok === refreshTok) void doRefresh(reason, tok);
      }, REFRESH_DELAYS[attempt]);
    };
    const doRefresh = async (reason: string, tok: number) => {
      const res = await fetchLink();
      if (disposed || gaveUp || tok !== refreshTok) return;
      refreshing = false;
      // بازسازیِ کند در همین فاصله به پخش رسید: نابود کردنش لازم نیست؛ لینک تازه برای بازسازی بعدی می‌ماند
      if (reason === "recover-stuck" && !recoveringRef.current) {
        if (res.play && (res.play.hls || res.play.mp4) !== url) spare = res.play;
        report("refresh-skip", { detail: reason });
        return;
      }
      if (res.play) {
        // سرور در پنجره‌ی ۱۵ ثانیه‌ای همان لینک قبلی را داد: بازسازی با لینک خراب فایده ندارد؛ دست‌کم ۱۶ ثانیه بعد
        if (isLinkReason(reason) && res.play.expiresAt && (res.play.hls || res.play.mp4) === url) {
          report("refresh-bad", { code: res.status, detail: `same-url ${reason}` });
          return refresh(reason);
        }
        return install(res.play);
      }
      report("refresh-bad", { code: res.status, detail: `${reason} ${res.type}` });
      // خطای خود سرور ما: نشست تمام شده، دسترسی نیست یا ویدیو حذف شده
      if (res.own && (res.status === 401 || res.status === 403 || res.status === 404)) {
        return giveUp(`api-${res.status}`, { msg: res.error || (res.status === 401 ? MSG_LOGIN : MSG_LINK), login: res.status === 401, final: true });
      }
      if (spare) return install(spare);
      // مسیر سرور (خارج از کشور) کند/قطع است ولی لینک فعلی آروان هنوز معتبر است: با همان لینک ادامه بده
      const left = expiresAt ? expiresAt - Date.now() : Infinity;
      if (!isLinkReason(reason) && left > 5 * 60_000) {
        install(null);
        if (!bgScheduled) {
          bgScheduled = true;
          later(() => {
            bgScheduled = false;
            void backgroundRefresh();
          }, 30_000);
        }
        return;
      }
      cause = res.status ? "server" : "net";
      refresh(reason);
    };
    /** گرفتن لینک تازه در پس‌زمینه، خارج از سقف تلاش‌ها؛ پخش قطع نمی‌شود و لینک برای بازسازی بعدی نگه داشته می‌شود */
    const backgroundRefresh = async () => {
      if (disposed || gaveUp || refreshing) return;
      const token = ++bgToken;
      const res = await fetchLink();
      if (disposed || token !== bgToken) return;
      if (!res.play) report("refresh-bad", { code: res.status, detail: `background ${res.type}` });
      else if ((res.play.hls || res.play.mp4) !== url) spare = res.play;
    };

    // ─── نگهبان پخش hls.js ───
    const wd = createHlsWatchdog({
      video: v,
      hls: () => (mode === "hls" ? hls : null),
      busy: () => refreshing || gaveUp || !!pendingGiveUp || recoveringRef.current || netRetryPending || !wantPlayRef.current,
      pos: () => pos(),
      report: (kind, e) => {
        if (kind === "frag-stall") stats.fragStalls++;
        report(kind, e);
      },
      // گیر کردن تصویر با داده‌ی بافرشده مشکل رسانه است، نه شبکه (پیام قطع کامل)
      refresh: (reason) => {
        cause = reason === "stall-buffered" ? "media" : "net";
        refresh(reason);
      },
      recoverMedia: (h, why) => recoverMedia(h, why),
      demoteToAuto: (why) => demoteToAuto(why),
      giveUp: (why) => {
        cause = why === "stall-buffered" ? "media" : "net";
        giveUp(why);
      },
      sourceEnds: () => sourceEnds(),
    });
    /** بازیابی که هیچ‌وقت به canplay نرسید (پلیر بی‌صدا در حالت «در حال بازیابی» مانده)؛ همه‌ی موتورها */
    const checkRecoveryStuck = (now: number) => {
      if (!recoveringRef.current || !recoverSince || refreshing || gaveUp || pendingGiveUp || netRetryPending) return;
      if (!wantPlayRef.current || document.hidden || !navigator.onLine || now - recoverSince < 30_000) return;
      // hls.js: بازسازیِ کند ولی در حال دانلود (اینترنت ضعیف) قطع نشود؛ مهلت ۱۲۰ ثانیه‌ای خود hls.js کافی است
      const noBytes = mode === "hls" ? wd.lastByteAgeMs() : Infinity;
      if (noBytes < 20_000) return;
      report("recover-stuck", { detail: `${Math.round((now - recoverSince) / 1000)}s rs=${v.readyState}${Number.isFinite(noBytes) ? ` noBytes=${Math.round(noBytes / 1000)}s` : ""}` });
      recoverSince = now;
      refresh("recover-stuck");
    };

    // دکمه‌ی «تلاش دوباره» و انتخاب کیفیت
    ctl.current = {
      retry: () => {
        gaveUp = false;
        finalGiveUp = false;
        pendingGiveUp = null;
        quietRetry = false;
        overlayUp = false;
        retrying = "manual";
        autoTries = 0;
        resetBudgets();
        setOverlay(null);
        refresh("manual");
      },
      setQuality: (h: number) => {
        qualityRef.current = h;
        savePref(h);
        setSelected(h);
        prefDecided = true; // انتخاب خود دانش‌آموز بر ترجیح قبلی مقدم است
        stallWin = [];
        manualAt = performance.now();
        if (!hls) return;
        if (!h) hls.loadLevel = -1; // خودکار، بدون خالی کردن بافر
        else {
          const i = levelIndex(h);
          if (i >= 0) hls.nextLevel = i; // تعویض نرم بدون توقف طولانی
        }
      },
    };

    // ─── توقف‌ها (waiting تا playing): آمار، کیفیت دستی و گزارش توقف طولانی ───
    const beginWait = () => {
      if (waitAt) return;
      const now = performance.now();
      waitAt = now;
      waitSeek = v.seeking || now - lastSeekAt < 2000;
      waitAfterStart = !!firstPlayingAt;
      // فقط توقف واقعی وسط پخش (نه شروع، جابه‌جایی، تعویض کیفیت، بازیابی یا آفلاین) کیفیت دستی را پایین می‌آورد
      waitEligible = !!firstPlayingAt && !waitSeek && now - manualAt > 10_000 && !recoveringRef.current && !refreshing && navigator.onLine;
      if (waitEligible) checkDemote();
    };
    const endWait = (how: string) => {
      if (!waitAt) return;
      const now = performance.now();
      const ms = now - waitAt;
      waitAt = 0;
      // انتظار پیش از اولین تصویر (شروع پخش) توقف نیست؛ در startupMs خلاصه‌ی تماشا دیده می‌شود
      if (waitAfterStart && !waitSeek) {
        stats.stalls++;
        stats.stallMsTotal += ms;
        stats.maxStallMs = Math.max(stats.maxStallMs, ms);
      }
      if (waitEligible) {
        stallWin.push({ at: now, ms });
        checkDemote();
      }
      if (ms >= 15_000) report("long-stall", { detail: `${Math.round(ms / 1000)}s ${how}${waitAfterStart ? "" : " startup"}`, x: { durMs: Math.round(ms), seek: waitSeek, startup: !waitAfterStart || undefined, aheadAt15 } });
      aheadAt15 = undefined;
    };

    // ─── رویدادهای عمومی ───
    const onPlay = () => {
      wantPlayRef.current = true;
      if (!firstPlayAt) firstPlayAt = performance.now();
      setTapToPlay(false);
      wake.keep(); // رویداد play درست پس از لمس دکمه‌ی پخش است (iOS برای اولین درخواست، لمس کاربر می‌خواهد)
      markerOn = true;
      holdLock();
      mark(true);
      // ادامه بعد از مکث طولانی: اگر لینک نزدیک انقضاست، اول لینک تازه (نه وقتی خود پلیر دارد ادامه می‌دهد)
      if (!recoveringRef.current && expiresAt && Date.now() - lastRefreshAt > 60_000 && expiresAt - Date.now() < 3 * 60_000) refresh("expiring");
    };
    const onPlaying = () => {
      if (!firstPlayingAt) firstPlayingAt = performance.now();
      endWait("playing");
      clearStall();
      wake.keep();
    };
    const onPause = () => {
      clearStall();
      if (ignorePause) {
        ignorePause = false;
        return;
      }
      // توقف ناشی از خطای رسانه (پخش داخلی Chromium) کار دانش‌آموز نیست؛ بعد از لینک تازه باید ادامه دهد
      if (v.error) return;
      // توقفِ ناشی از بارگذاری دوباره‌ی رسانه حساب نمی‌شود؛ توقفِ دانش‌آموز (رسانه آماده، یا درست بعد از لمس) حساب می‌شود
      const touched = performance.now() - lastInteract < 1000;
      if ((!recoveringRef.current || v.readyState >= 2 || touched) && !v.seeking) {
        wantPlayRef.current = false;
        playingAtRecovery = false;
        endWait("pause");
        wake.release();
        // توقف سیستم هنگام پنهان شدن صفحه (قفل/پس‌زمینه): نشانگر «در حال پخش» می‌ماند تا بسته شدن بعدی درست گزارش شود
        if (markerOn) mark(document.hidden && hidPlaying);
      }
    };
    const onEnded = () => {
      wantPlayRef.current = false;
      wake.release();
      if (markerOn) mark(false, true);
      markerOn = false; // تماشا تمام شد؛ پنهان شدن/بسته شدن بعدی دیگر «ناتمام» نیست (onPlay دوباره روشنش می‌کند)
      dropLock();
    };
    const onTime = () => {
      if (!v.paused) lastTimeAt = performance.now();
      if (pendingGiveUp && !v.paused && aheadOf(v) < 1 && !bufferedToEnd()) return runPendingGiveUp();
      if (recoveringRef.current || v.currentTime <= 0) return;
      const t = v.currentTime;
      lastGood = t;
      if (lastPlayT >= 0 && !v.paused && !v.seeking) {
        const d = t - lastPlayT;
        if (d > 0 && d < 2.5) stats.playedSec += d;
      }
      lastPlayT = t;
      const a = aheadOf(v, t);
      if (a > stats.maxAhead) stats.maxAhead = a;
      // لینک تازه ۲۰ ثانیه درست پخش شد: تلاش‌های قبلی دیگر به سقف «تلاش دوباره» حساب نشوند
      if (refreshTimes.length && refreshedAt >= 0 && t - refreshedAt > 20) {
        refreshTimes = [];
        refreshedAt = -1;
      }
    };
    // ویدیو بیش از ۴ ثانیه منتظر داده ماند: نشان «در حال اتصال دوباره»؛
    // اگر کیفیت دستی انتخاب شده و ۱۵ ثانیه گیر کرد، روی خودکار برو و دانلود سنگین فعلی را هم رها کن
    const onWaiting = () => {
      if (pendingGiveUp && !nearEnd(v)) return runPendingGiveUp(); // بافر تمام شد: حالا پیام قطع کامل
      if (!wantPlayRef.current || gaveUp) return;
      beginWait();
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (disposed || v.paused || gaveUp) return;
        setStalled(true);
        stallTimer = setTimeout(() => {
          if (disposed || v.paused || gaveUp) return;
          if (waitAt) aheadAt15 = round1(aheadOf(v));
          if (!hls || hls.autoLevelEnabled || v.readyState >= 3) return;
          demoteToAuto("waiting-15s");
          hls.startLoad(pos()); // رفتن به خودکار به‌تنهایی دانلودِ در حال انجام را لغو نمی‌کند
        }, 11000);
      }, 4000);
    };
    const onSeeking = () => {
      lastSeekAt = performance.now();
      lastPlayT = v.currentTime;
      if (!recoveringRef.current) lastGood = v.currentTime; // مقصد جابه‌جایی، حتی اگر هنوز بارگذاری نشده
    };
    const onOnline = () => {
      if (gaveUp) autoRetry("online");
    };
    // برگشت از قفل صفحه / برنامه‌ی دیگر، یا رفتن به پس‌زمینه
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // بستن/بارگذاری دوباره/رفتن به صفحه‌ی دیگر (pagehide پیش از این آمد): نه «خاموش شدن صفحه» است نه نشانگر ناتمام
        if (unloading) return;
        // صفحه وسط پخش پنهان شد (قفل خودکار گوشی؟ idleSec و wakeLock در ctx)؛
        // با lastTimeAt (نه v.paused) تا توقفی که سیستم درست پیش از این رویداد کرد هم «وسط پخش» حساب شود
        hidPlaying = performance.now() - lastTimeAt < 3000;
        if (hidPlaying) report("hidden-playing");
        if (markerOn) markNow();
        clearTimeout(hiddenTimer);
        hiddenTimer = setTimeout(() => {
          if (!disposed && document.visibilityState === "hidden") sendSummary(false); // شاید دیگر برنگردد (iOS اپ را می‌بندد)
        }, 30_000);
        return;
      }
      clearTimeout(hiddenTimer);
      unloading = false;
      hidPlaying = false;
      if (markerOn) {
        holdLock();
        markNow(); // «در حال پخش» کهنه‌ی دوره‌ی پنهان نماند
      }
      if (wantPlayRef.current) wake.keep();
      if (gaveUp) autoRetry("visible");
    };
    const onPageHide = () => {
      sendSummary(true);
      if (markerOn) mark(!v.paused, true);
      unloading = true; // بعد از نوشتن نشانگر تمیز
      dropLock(); // قفل مانع bfcache است؛ نشانگر تمیز کافی است
    };
    // برگشت از bfcache: صفحه دوباره زنده است
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      unloading = false;
      if (markerOn) {
        holdLock();
        markNow();
      }
    };
    const onInteract = () => {
      lastInteract = performance.now();
    };
    // خروج از تمام‌صفحه وسط مشکل پخش (بازسازی پلیر در آیفون تمام‌صفحه را می‌بندد؛ «بیرونم انداخت»)
    let wasFs = false;
    const onFsChange = () => {
      const fs = isFullscreen(v);
      if (fs && !wasFs) stats.fsEnters++;
      const trouble = gaveUp ? "giveup" : refreshing ? "refresh" : recoveringRef.current ? "recover" : waitAt ? "stall" : "";
      if (!fs && wasFs && trouble && performance.now() - selfExitAt > 2000) report("fs-exit", { detail: `${trouble} rs=${v.readyState}` });
      wasFs = fs;
    };
    const fsDocEvents = ["fullscreenchange", "webkitfullscreenchange"] as const;
    const fsVideoEvents = ["webkitbeginfullscreen", "webkitendfullscreen"] as const; // تمام‌صفحه‌ی داخلی آیفون
    const interactEvents = ["pointerdown", "keydown", "touchstart"] as const;
    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("error", onNativeError);
    v.addEventListener("waiting", onWaiting);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    for (const ev of interactEvents) window.addEventListener(ev, onInteract, { capture: true, passive: true });
    for (const ev of fsDocEvents) document.addEventListener(ev, onFsChange);
    for (const ev of fsVideoEvents) v.addEventListener(ev, onFsChange);

    // هر ثانیه: بازیابی بی‌نتیجه (همه‌ی موتورها)، نگهبان hls.js، قطع کامل معوق، کیفیت دستی در توقف طولانی و نشانگر تماشا (هر ۵ ثانیه)
    const beat = setInterval(() => {
      const now = performance.now();
      checkPending(now);
      checkRecoveryStuck(now);
      if (mode === "hls") {
        wd.tick();
        if (waitAt && waitEligible) checkDemote();
      }
      // پلیر زنده (حتی متوقف) نشانگر را تازه نگه می‌دارد تا زبانه/اپ دیگر آن را «بسته شدن ناگهانی» نداند
      if (markerOn && !unloading && now - lastMarkAt >= 5000) markNow();
    }, 1000);

    // نگهبان پخش داخلی: اگر با وجود اینترنت ۴۰ ثانیه جلو نرفت (یا جابه‌جایی تمام نشد)، لینک تازه
    let lastT = -1;
    let lastBuf = 0;
    let stuckSince = 0;
    const nativeWatchdog = setInterval(() => {
      if (mode === "hls" || refreshing || gaveUp || pendingGiveUp || !wantPlayRef.current || v.paused || v.ended || nearEnd(v) || document.hidden || !navigator.onLine) {
        stuckSince = 0;
        lastT = v.currentTime;
        return;
      }
      // کل ثانیه‌های بافرشده (نه فقط بازه‌ی آخر): جابه‌جایی به عقب هم بازه‌ی تازه‌ای می‌سازد
      let buf = 0;
      for (let i = 0; i < v.buffered.length; i++) buf += v.buffered.end(i) - v.buffered.start(i);
      const arriving = buf > lastBuf + 0.5; // اینترنت کند است ولی داده می‌رسد: لینک سالم است
      lastBuf = buf;
      if (v.currentTime !== lastT || arriving) {
        lastT = v.currentTime;
        stuckSince = 0;
      } else if (!stuckSince) stuckSince = Date.now();
      else if (Date.now() - stuckSince > 40000) {
        stuckSince = 0;
        report("native-stall", { code: v.networkState, detail: `${v.seeking ? "seeking " : ""}readyState=${v.readyState}` });
        refresh("stall");
      }
    }, 4000);

    // ─── انتخاب موتور پخش ───
    const begin = (m: Engine, why: string) => {
      mode = m;
      engineWhy = why;
      if (m === "hls") hls = createHls(start);
      else loadNative(start);
      setEngine(m);
      report("engine", { detail: `${m} ${why}` });
      resumeAfter(); // اگر دانش‌آموز پیش از آماده شدن پلیر روی پخش زده بود
    };
    const override = readEngine();
    const canNative = !!data.hls && !!v.canPlayType("application/vnd.apple.mpegurl");
    // آیفونِ «افزوده به صفحه‌ی اصلی»: با hls.js (ManagedMediaSource) صفحه روشن نمی‌ماند و گوشی وسط درس قفل می‌شود؛
    // پخش داخلی (AVPlayer) صفحه را روشن نگه می‌دارد. navigator.standalone فقط در iOS تعریف شده است.
    const iosApp = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (canNative && (override === "native" || (iosApp && override !== "hls"))) begin("native", override === "native" ? "override" : "ios-app");
    else
      import("hls.js")
        .then(({ default: H }) => {
          if (disposed) return;
          Hls = H;
          if (data.hls && H.isSupported()) begin("hls", override === "hls" ? "override" : "mse");
          else if (canNative) begin("native", "no-mse");
          else if (data.mp4) begin("file", "mp4");
          else {
            report("engine", { detail: "none" });
            setLoadErr({ msg: "مرورگر شما از پخش این ویدیو پشتیبانی نمی‌کند", retry: false });
          }
        })
        .catch(() => {
          if (disposed) return;
          if (canNative) begin("native", "import-failed");
          else if (data.mp4) begin("file", "import-failed");
          else setLoadErr({ msg: "بارگذاری پلیر ناموفق بود", retry: true });
        });

    return () => {
      endWait("unmount");
      sendSummary(false);
      if (markerOn) mark(false, true);
      dropLock();
      disposed = true;
      rep.bind(null);
      clearInterval(beat);
      clearInterval(nativeWatchdog);
      timers.forEach(clearTimeout);
      clearTimeout(stallTimer);
      clearTimeout(hiddenTimer);
      wake.dispose();
      hls?.destroy();
      ctl.current = null;
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("error", onNativeError);
      v.removeEventListener("waiting", onWaiting);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const ev of interactEvents) window.removeEventListener(ev, onInteract, { capture: true });
      for (const ev of fsDocEvents) document.removeEventListener(ev, onFsChange);
      for (const ev of fsVideoEvents) v.removeEventListener(ev, onFsChange);
      onlineWaiters.forEach((fn) => window.removeEventListener("online", fn));
    };
  }, [data, videoId]);

  useEffect(() => {
    if (overlay) retryBtn.current?.focus();
  }, [overlay]);

  // جابه‌جایی واترمارک
  useEffect(() => {
    if (!data?.watermark) return;
    const t = setInterval(() => setWm({ x: 5 + Math.random() * 70, y: 5 + Math.random() * 80 }), 7000);
    return () => clearInterval(t);
  }, [data?.watermark]);

  const supportLine = supportCode && (
    <p className="mt-3 text-[11px] text-white/45">
      کد پیگیری: <span dir="ltr" className="font-mono">{supportCode}</span>
    </p>
  );

  if (loadErr)
    return (
      <div className="on-dark grid aspect-video place-items-center rounded-3xl border border-white/10 bg-black/60 p-6 text-center" role="alert">
        <div>
          {loadErr.msg.includes("تهیه") ? <Lock className="mx-auto mb-3 size-10 text-amber" /> : <AlertTriangle className="mx-auto mb-3 size-10 text-rose" />}
          <p className="text-sm text-white/75">{loadErr.msg}</p>
          {loadErr.login ? (
            <button type="button" onClick={goLogin} className="btn-primary btn-sm mt-4">
              <LogIn className="size-4" /> ورود دوباره
            </button>
          ) : (
            loadErr.retry && (
              <button
                type="button"
                onClick={() => {
                  if (loadErr.reload) return location.reload(); // صفحه‌ی HTML به‌جای پاسخ: شاید چالش CDN باید از نو حل شود
                  setLoadErr(null);
                  setData(null);
                  setReloadKey((k) => k + 1);
                }}
                className="btn-primary btn-sm mt-4"
              >
                <RotateCw className="size-4" /> تلاش دوباره
              </button>
            )
          )}
          {supportLine}
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="on-dark grid aspect-video place-items-center rounded-3xl border border-white/10 bg-black/60">
        <Loader2 className="size-10 animate-spin text-cyan" />
      </div>
    );

  if (data.playerUrl)
    return (
      <div className="on-dark relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-black">
        <iframe src={data.playerUrl} className="size-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    );

  const playingLabel = playingH ? ` (${faNum(playingH)}p)` : "";
  return (
    <div>
      <div className="on-dark relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_30px_80px_-30px_rgba(139,92,246,.6)]" onContextMenu={(e) => e.preventDefault()}>
        <video ref={ref} poster={data.poster ?? undefined} controls playsInline controlsList="nodownload noremoteplayback" className="aspect-video w-full bg-black" />
        {data.watermark && (
          <span className="pointer-events-none absolute select-none text-xs font-bold text-white/25 transition-all duration-[2000ms]" style={{ left: `${wm.x}%`, top: `${wm.y}%` }} dir="ltr">
            {data.watermark}
          </span>
        )}
        <span role="status" aria-live="polite" className="sr-only">
          {(busy || stalled) && !overlay ? "در حال اتصال دوباره" : ""}
        </span>
        {(busy || stalled) && !overlay && (
          <span aria-hidden className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-amber">
            <Loader2 className="size-3.5 animate-spin" /> در حال اتصال دوباره…
          </span>
        )}
        {tapToPlay && !overlay && (
          <button
            type="button"
            onClick={() => {
              setTapToPlay(false);
              ref.current?.play().catch(() => setTapToPlay(true));
            }}
            className="absolute inset-0 z-10 grid place-items-center bg-black/50 text-white"
          >
            <span className="flex flex-col items-center gap-2 font-bold">
              <PlayCircle className="size-16 text-cyan" /> ادامه‌ی پخش
            </span>
          </button>
        )}
        {overlay && (
          <div role="alert" className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4 text-center sm:p-6">
            <div>
              <AlertTriangle className="mx-auto mb-2 size-8 text-amber sm:mb-3 sm:size-10" />
              <p className="mx-auto max-w-sm text-sm leading-6 text-white/85 sm:leading-7">{overlay.msg}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:mt-4">
                {overlay.login ? (
                  <button ref={retryBtn} type="button" onClick={goLogin} className="btn-primary btn-sm">
                    <LogIn className="size-4" /> ورود دوباره
                  </button>
                ) : (
                  <button ref={retryBtn} type="button" onClick={() => ctl.current?.retry()} className="btn-primary btn-sm">
                    <RotateCw className="size-4" /> تلاش دوباره
                  </button>
                )}
                {supportCode && (
                  <span className="text-[11px] text-white/45">
                    کد پیگیری: <span dir="ltr" className="font-mono">{supportCode}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {done && <span className="chip absolute right-3 top-3 !border-lime/40 !bg-black/60 !text-lime"><CheckCircle2 className="size-3.5" /> دیده شد</span>}
      </div>

      {engine === "hls" && levels.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <label className="flex items-center gap-2">
            <Settings2 className="size-4 text-cyan" /> کیفیت:
            <select value={levels.some((l) => l.height === selected) ? selected : 0} onChange={(e) => ctl.current?.setQuality(Number(e.target.value))} className="input !w-auto !py-1.5 !pl-9 !text-xs">
              <option value={0}>خودکار{selected === 0 ? playingLabel : ""}</option>
              {levels.map((l) => (
                <option key={l.height} value={l.height}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          {selected !== 0 && <span className="text-white/55">کیفیت پایین‌تر = مصرف اینترنت کمتر</span>}
        </div>
      )}
      {engine === "native" && <p className="mt-3 text-xs text-white/55">کیفیت به‌طور خودکار با سرعت اینترنت تنظیم می‌شود.</p>}
    </div>
  );
}
