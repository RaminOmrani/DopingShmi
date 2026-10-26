"use client";
import { useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import type { ErrorData, RetryConfig } from "hls.js";
import { Loader2, Lock, AlertTriangle, CheckCircle2, RotateCw, Settings2, PlayCircle } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { faNum } from "@/lib/utils";

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
type Engine = "hls" | "native" | "file";
interface Quality {
  height: number;
  label: string;
}

const QUALITY_KEY = "ds-quality"; // کیفیت انتخابی دانش‌آموز (ارتفاع تصویر؛ ۰ = خودکار)
/** لینک امن منقضی/نامعتبر: باید لینک تازه گرفت (تلاش دوباره با همان لینک بی‌فایده است) */
const NEW_URL_CODES = new Set([401, 403, 410]);
/** فاصله‌ی تلاش‌های گرفتن لینک تازه؛ آخری بعد از پنجره‌ی ۱۵ ثانیه‌ای محدودیت سرور */
const REFRESH_DELAYS = [0, 3000, 16000];
const MSG_NET = "اتصال به سرور ویدیو قطع شد. اینترنت خود را بررسی کنید و «تلاش دوباره» را بزنید.";
const MSG_LINK = "سرور ویدیو فعلاً اجازه‌ی پخش نمی‌دهد. چند لحظه بعد «تلاش دوباره» را بزنید؛ اگر درست نشد به پشتیبانی خبر دهید.";
const MSG_MEDIA = "پخش این ویدیو در مرورگر شما با مشکل مواجه شد. «تلاش دوباره» را بزنید یا مرورگر دیگری را امتحان کنید.";
const MSG_SERVER = "سرور ویدیو موقتاً پاسخ نمی‌دهد. چند لحظه بعد «تلاش دوباره» را بزنید.";
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

/**
 * پلیر ویدیو:
 *  - hls.js هر جا پشتیبانی شود (شامل آیفون iOS 17.1+)، وگرنه پخش داخلی مرورگر
 *  - خطای شبکه/لینک منقضی ← بازیابی خودکار از همان ثانیه؛ ویدیو هیچ‌وقت از صفحه حذف نمی‌شود
 *  - انتخاب کیفیت توسط دانش‌آموز (در hls.js)
 */
export function VideoPlayer({ videoId }: { videoId: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<Play | null>(null);
  const [loadErr, setLoadErr] = useState<{ msg: string; retry: boolean } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stalled, setStalled] = useState(false); // ویدیو منتظر داده است (کندی/قطعی اینترنت)
  const [tapToPlay, setTapToPlay] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [levels, setLevels] = useState<Quality[]>([]);
  const [selected, setSelected] = useState(0); // کیفیتی که الان واقعاً انتخاب است (۰ = خودکار)
  const [playingH, setPlayingH] = useState(0);
  const [wm, setWm] = useState({ x: 10, y: 10 });
  const [done, setDone] = useState(false);
  const acc = useRef({ delta: 0, lastT: -1, sentAt: 0 });
  const recoveringRef = useRef(false); // در حین بازیابی یا بعد از قطع کامل، موقعیت (صفر موقت) ثبت نشود
  const wantPlayRef = useRef(false); // آیا دانش‌آموز می‌خواهد ویدیو پخش شود
  const qualityRef = useRef(0); // ترجیح ذخیره‌شده‌ی دانش‌آموز
  const ctl = useRef<{ retry: () => void; setQuality: (h: number) => void } | null>(null);
  const retryBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    qualityRef.current = readPref();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/${videoId}/play`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) setLoadErr({ msg: d.error || "خطا در بارگذاری ویدیو", retry: r.status !== 403 && r.status !== 404 });
        else setData(d);
      })
      .catch(() => !cancelled && setLoadErr({ msg: "اتصال برقرار نشد", retry: true }));
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
      fetch(`/api/videos/${videoId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
        .then((r) => r.json())
        .then((d) => {
          if (d.justCompleted) {
            setDone(true);
            toast.ok(`آفرین! ویدیو کامل شد و ${faNum(d.bonus)} امتیاز گرفتی 🎉`);
          }
        })
        .catch(() => {});
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
    if (!v || !data || data.playerUrl) return;
    let disposed = false;
    let Hls: typeof HlsType | null = null;
    let hls: HlsType | null = null;
    let mode: Engine | null = null;
    let url = data.hls || data.mp4 || "";
    let expiresAt = 0; // به ساعت همین دستگاه
    let refreshing = false;
    let refreshTimes: number[] = [];
    let lastRefreshAt = 0;
    let netTries = 0;
    let mediaErrors: number[] = [];
    let lastMediaRecover = 0;
    let lastGood = 0; // آخرین موقعیت معتبر (شامل مقصد جابه‌جایی)
    let anchor: number | null = null; // موقعیتی که بازیابی باید از آن ادامه دهد
    let reports = 0;
    let gaveUp = false;
    let ignorePause = false;
    let cause: Cause = "net"; // علت آخرین مشکل، برای انتخاب پیام
    let refreshedAt = -1; // موقعیتی که آخرین لینک تازه از آن شروع شد
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const loadedAt = Date.now();
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

    /** گزارش خطا برای عیب‌یابی (حداکثر ۸ بار در هر بار باز شدن صفحه) */
    const report = (kind: string, extra: Record<string, unknown> = {}) => {
      if (reports++ >= 8) return;
      const payload = JSON.stringify({ kind, engine: mode ?? undefined, position: Math.round(pos()), sinceLoadSec: Math.round((Date.now() - loadedAt) / 1000), ...extra });
      try {
        const blob = new Blob([payload], { type: "application/json" });
        if (!navigator.sendBeacon?.(`/api/videos/${videoId}/error`, blob)) fetch(`/api/videos/${videoId}/error`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
      } catch {
        /* گزارش اختیاری است */
      }
    };

    const finishRecovery = () => {
      recoveringRef.current = false;
      anchor = null;
      if (!disposed) setBusy(false);
    };
    /** fetch با مهلت؛ AbortSignal.timeout در iOS 15 و مرورگرهای قدیمی وجود ندارد */
    const fetchWithTimeout = async (input: string, ms: number) => {
      const ac = new AbortController();
      const tm = setTimeout(() => ac.abort(), ms);
      try {
        return await fetch(input, { cache: "no-store", signal: ac.signal });
      } finally {
        clearTimeout(tm);
      }
    };
    /** بعد از بارگذاری دوباره، اگر دانش‌آموز در حال تماشا بود، پخش ادامه پیدا کند */
    const resumeAfter = () => {
      v.addEventListener(
        "canplay",
        () => {
          if (disposed || gaveUp) return;
          if (!wantPlayRef.current) return finishRecovery();
          v.play().then(finishRecovery, () => {
            finishRecovery();
            setTapToPlay(true); // مرورگر پخش خودکار را اجازه نداد
          });
        },
        { once: true },
      );
    };
    const exitFullscreen = () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        const w = v as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean; webkitExitFullscreen?: () => void };
        if (w.webkitDisplayingFullscreen) w.webkitExitFullscreen?.();
      } catch {
        /* بدون تمام‌صفحه */
      }
    };
    /** قطع کامل: پیام با دکمه‌ی «تلاش دوباره»؛ ویدیو متوقف و از تمام‌صفحه خارج می‌شود تا پیام دیده شود */
    const giveUp = (msg = MSG[cause]) => {
      if (disposed) return;
      gaveUp = true;
      refreshing = false;
      recoveringRef.current = true; // موقعیت واقعی معلوم نیست؛ پیشرفت ثبت نشود
      if (anchor == null) anchor = pos();
      setBusy(false);
      setStalled(false);
      setOverlay(msg);
      if (!v.paused) {
        ignorePause = true; // این توقف کار ماست، نه دانش‌آموز
        v.pause();
      }
      exitFullscreen();
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

    const createHls = (startPosition: number) => {
      const H = Hls!;
      const h = new H({
        startPosition: startPosition > 0 ? startPosition : -1,
        capLevelToPlayerSize: true,
        maxDevicePixelRatio: 2,
        startLevel: -1,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        backBufferLength: 90,
        errorPenaltyExpireMs: 30000,
        manifestLoadPolicy: policy(15000, 30000, rc(3, 500, 4000), rc(3, 1000, 8000)),
        playlistLoadPolicy: policy(15000, 30000, rc(4, 500, 4000), rc(4, 1000, 8000)),
        fragLoadPolicy: policy(20000, 120000, rc(6, 1000, 8000), rc(8, 1000, 8000)),
      });
      h.on(H.Events.MANIFEST_PARSED, () => {
        syncLevels();
        const i = qualityRef.current ? levelIndex(qualityRef.current) : -1;
        if (i >= 0) h.loadLevel = i; // کیفیت انتخابی از اول
        syncSelected();
      });
      h.on(H.Events.LEVELS_UPDATED, syncLevels);
      h.on(H.Events.LEVEL_SWITCHING, syncSelected); // اگر hls.js به‌خاطر خطا به خودکار برگشت، منو هم نشان دهد
      h.on(H.Events.LEVEL_SWITCHED, (_e, d) => setPlayingH(h.levels[d.level]?.height ?? 0));
      h.on(H.Events.FRAG_BUFFERED, () => {
        netTries = 0;
        if (!recoveringRef.current && !refreshing) setBusy(false);
      });
      h.on(H.Events.ERROR, (_e, d) => onHlsError(h, d));
      h.attachMedia(v);
      h.loadSource(url);
      return h;
    };

    const onHlsError = (h: HlsType, d: ErrorData) => {
      if (disposed || h !== hls || !Hls || gaveUp) return;
      const code = d.response?.code;
      const E = Hls.ErrorDetails;
      // لینک منقضی: همان اولین خطا (حتی غیرکشنده) لینک تازه بگیر، وگرنه hls.js همه‌ی کیفیت‌ها را امتحان می‌کند
      if (code && NEW_URL_CODES.has(code)) {
        cause = "link";
        report("expired-link", { code, detail: d.details, fatal: d.fatal });
        refresh("expired");
        return;
      }
      // hls.js خودش رسانه را از نو وصل کرده؛ فقط پخش را ادامه بده
      if (!d.fatal && d.details === E.MEDIA_SOURCE_REQUIRES_RESET) {
        recoveringRef.current = true;
        if (anchor == null) anchor = lastGood || null;
        resumeAfter();
        return;
      }
      if (!d.fatal) return;
      report("fatal", { code, detail: d.details, fatal: true });
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
        cause = code && code >= 500 ? "server" : code && code >= 400 ? "link" : "net";
        if (d.details === E.MANIFEST_LOAD_ERROR || d.details === E.MANIFEST_LOAD_TIMEOUT || d.details === E.MANIFEST_PARSING_ERROR) return refresh("manifest");
        if (++netTries > 6) return giveUp();
        setBusy(true);
        const retry = () => later(() => hls === h && !gaveUp && h.startLoad(pos()), Math.min(1000 * 2 ** netTries, 15000));
        if (navigator.onLine) retry();
        else window.addEventListener("online", retry, { once: true });
      } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
        cause = "media";
        // این مرورگر قالب ویدیو را با hls.js پخش نمی‌کند (پیش از آماده شدن کیفیت‌ها): پخش داخلی مرورگر را امتحان کن
        if (!h.levels.length || d.details === E.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
          if (data.hls && v.canPlayType("application/vnd.apple.mpegurl")) {
            const p = pos();
            hls = null;
            h.destroy();
            mode = "native";
            setEngine("native");
            setLevels([]);
            recoveringRef.current = true;
            loadNative(p);
            resumeAfter();
            return;
          }
          return giveUp();
        }
        const now = performance.now();
        mediaErrors = mediaErrors.filter((x) => now - x < 60000);
        mediaErrors.push(now);
        if (mediaErrors.length > 3) return refresh("media"); // بازیابی جواب نداد: پلیر را از نو بساز
        recoveringRef.current = true;
        setBusy(true);
        const p = pos();
        if (anchor == null) anchor = p;
        if (now - lastMediaRecover < 3000) h.swapAudioCodec();
        lastMediaRecover = now;
        h.recoverMediaError();
        h.startLoad(p); // بعد از خطای کشنده hls.js بارگذاری را متوقف کرده؛ از همین ثانیه ادامه بده
        resumeAfter();
      } else {
        cause = "media";
        refresh("other");
      }
    };

    // ─── پخش داخلی مرورگر (آیفون‌های قدیمی و مرورگرهای بدون MSE) ───
    const loadNative = (t: number) => {
      v.src = url;
      v.addEventListener("loadedmetadata", () => t > 0 && (v.currentTime = t), { once: true });
      // iOS گاهی جابه‌جایی هنگام loadedmetadata را نادیده می‌گیرد؛ فقط اگر هنوز اول ویدیوست دوباره جابه‌جا کن
      v.addEventListener("canplay", () => t > 2 && v.currentTime < 1 && (v.currentTime = t), { once: true });
    };
    const onNativeError = () => {
      if (mode === "hls" || refreshing || gaveUp) return;
      report("native-error", { code: v.error?.code, detail: v.error?.message?.slice(0, 200) });
      cause = v.error?.code === 3 ? "media" : navigator.onLine ? "link" : "net";
      refresh("native");
    };

    /** لینک تازه از سرور و ادامه از همان ثانیه؛ تلاش‌ها با فاصله، و بعد از ۳ بار در ۲ دقیقه پیام «تلاش دوباره» */
    const refresh = (reason: string) => {
      if (refreshing || disposed || gaveUp) return;
      const now = Date.now();
      refreshTimes = refreshTimes.filter((x) => now - x < 120000);
      const attempt = refreshTimes.length;
      if (attempt >= REFRESH_DELAYS.length) {
        report("refresh-loop", { detail: `${reason}/${cause}` });
        return giveUp();
      }
      refreshTimes.push(now);
      refreshing = true;
      recoveringRef.current = true;
      if (anchor == null) anchor = pos();
      setBusy(true);
      later(() => void doRefresh(reason), REFRESH_DELAYS[attempt]);
    };
    const doRefresh = async (reason: string) => {
      try {
        const r = await fetchWithTimeout(`/api/videos/${videoId}/play?fresh=1`, 15000);
        const d = (await r.json().catch(() => ({}))) as Play & { error?: string };
        if (disposed || gaveUp) return;
        if (!r.ok) {
          refreshing = false;
          if (r.status === 401 || r.status === 403 || r.status === 404) return giveUp(d.error || MSG_LINK);
          cause = "server";
          return refresh(reason);
        }
        // در مدت گرفتن لینک، نسخه‌ی قبلی ممکن است از بافر جلو رفته باشد
        const t = v.currentTime > 0 && v.readyState > 0 ? v.currentTime : anchor ?? (lastGood || start);
        anchor = t;
        url = d.hls || d.mp4 || url;
        setDeadline(d);
        lastRefreshAt = Date.now();
        refreshedAt = t;
        if (mode === "hls") {
          hls?.destroy();
          hls = createHls(t);
        } else loadNative(t);
        refreshing = false; // خطای منبع تازه دوباره بازیابی شود
        resumeAfter();
      } catch {
        refreshing = false;
        cause = "net";
        if (!disposed && !gaveUp) refresh(reason);
      }
    };

    // دکمه‌ی «تلاش دوباره» و انتخاب کیفیت
    ctl.current = {
      retry: () => {
        gaveUp = false;
        refreshTimes = [];
        netTries = 0;
        mediaErrors = [];
        setOverlay(null);
        refresh("manual");
      },
      setQuality: (h: number) => {
        qualityRef.current = h;
        savePref(h);
        setSelected(h);
        if (!hls) return;
        if (!h) hls.loadLevel = -1; // خودکار، بدون خالی کردن بافر
        else {
          const i = levelIndex(h);
          if (i >= 0) hls.nextLevel = i; // تعویض نرم بدون توقف طولانی
        }
      },
    };

    // ─── رویدادهای عمومی ───
    const onPlay = () => {
      wantPlayRef.current = true;
      setTapToPlay(false);
      // ادامه بعد از مکث طولانی: اگر لینک نزدیک انقضاست، اول لینک تازه (نه وقتی خود پلیر دارد ادامه می‌دهد)
      if (!recoveringRef.current && expiresAt && Date.now() - lastRefreshAt > 60_000 && expiresAt - Date.now() < 3 * 60_000) refresh("expiring");
    };
    const onPause = () => {
      if (ignorePause) {
        ignorePause = false;
        return;
      }
      // توقفِ ناشی از بارگذاری دوباره‌ی رسانه حساب نمی‌شود؛ توقفِ دانش‌آموز (رسانه آماده) حساب می‌شود
      if ((!recoveringRef.current || v.readyState >= 2) && !v.seeking) wantPlayRef.current = false;
    };
    const onEnded = () => (wantPlayRef.current = false);
    const onTime = () => {
      if (recoveringRef.current || v.currentTime <= 0) return;
      lastGood = v.currentTime;
      // لینک تازه ۲۰ ثانیه درست پخش شد: تلاش‌های قبلی دیگر به سقف «تلاش دوباره» حساب نشوند
      if (refreshTimes.length && refreshedAt >= 0 && v.currentTime - refreshedAt > 20) {
        refreshTimes = [];
        refreshedAt = -1;
      }
    };
    // ویدیو بیش از ۴ ثانیه منتظر داده ماند: نشان «در حال اتصال دوباره»؛
    // اگر کیفیت دستی انتخاب شده و ۱۵ ثانیه گیر کرد، برای این جلسه روی خودکار برو
    const clearStall = () => {
      clearTimeout(stallTimer);
      stallTimer = undefined;
      if (!disposed) setStalled(false);
    };
    const onWaiting = () => {
      if (!wantPlayRef.current || gaveUp) return;
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (disposed || v.paused || gaveUp) return;
        setStalled(true);
        stallTimer = setTimeout(() => {
          if (disposed || !hls || hls.autoLevelEnabled || v.readyState >= 3) return;
          hls.loadLevel = -1;
          toast.ok("به‌خاطر کندی اینترنت، کیفیت روی «خودکار» رفت");
        }, 11000);
      }, 4000);
    };
    const onSeeking = () => {
      if (!recoveringRef.current) lastGood = v.currentTime; // مقصد جابه‌جایی، حتی اگر هنوز بارگذاری نشده
    };
    const onOnline = () => gaveUp && ctl.current?.retry();
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("error", onNativeError);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", clearStall);
    v.addEventListener("pause", clearStall);
    window.addEventListener("online", onOnline);

    // نگهبان پخش داخلی: اگر با وجود اینترنت ۴۰ ثانیه جلو نرفت، لینک تازه
    let lastT = -1;
    let lastBuf = 0;
    let stuckSince = 0;
    const watchdog = setInterval(() => {
      const nearEnd = v.duration > 0 && v.duration - v.currentTime < 2;
      if (mode === "hls" || refreshing || gaveUp || !wantPlayRef.current || v.paused || v.ended || v.seeking || nearEnd || document.hidden || !navigator.onLine) {
        stuckSince = 0;
        lastT = v.currentTime;
        return;
      }
      const buf = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
      const arriving = buf > lastBuf + 0.5; // اینترنت کند است ولی داده می‌رسد: لینک سالم است
      lastBuf = buf;
      if (v.currentTime !== lastT || arriving) {
        lastT = v.currentTime;
        stuckSince = 0;
      } else if (!stuckSince) stuckSince = Date.now();
      else if (Date.now() - stuckSince > 40000) {
        stuckSince = 0;
        report("native-stall", { code: v.networkState, detail: `readyState=${v.readyState}` });
        refresh("stall");
      }
    }, 4000);

    import("hls.js")
      .then(({ default: H }) => {
        if (disposed) return;
        Hls = H;
        if (data.hls && H.isSupported()) {
          mode = "hls";
          hls = createHls(start);
        } else if (data.hls && v.canPlayType("application/vnd.apple.mpegurl")) {
          mode = "native";
          loadNative(start);
        } else if (data.mp4) {
          mode = "file";
          loadNative(start);
        } else return setLoadErr({ msg: "مرورگر شما از پخش این ویدیو پشتیبانی نمی‌کند", retry: false });
        setEngine(mode);
        resumeAfter(); // اگر دانش‌آموز پیش از آماده شدن پلیر روی پخش زده بود
      })
      .catch(() => {
        if (disposed) return;
        if (url && (data.mp4 || v.canPlayType("application/vnd.apple.mpegurl"))) {
          mode = data.hls ? "native" : "file";
          loadNative(start);
          setEngine(mode);
        } else setLoadErr({ msg: "بارگذاری پلیر ناموفق بود", retry: true });
      });

    return () => {
      disposed = true;
      clearInterval(watchdog);
      timers.forEach(clearTimeout);
      hls?.destroy();
      ctl.current = null;
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("error", onNativeError);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", clearStall);
      v.removeEventListener("pause", clearStall);
      clearTimeout(stallTimer);
      window.removeEventListener("online", onOnline);
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

  if (loadErr)
    return (
      <div className="on-dark grid aspect-video place-items-center rounded-3xl border border-white/10 bg-black/60 p-6 text-center" role="alert">
        <div>
          {loadErr.msg.includes("تهیه") ? <Lock className="mx-auto mb-3 size-10 text-amber" /> : <AlertTriangle className="mx-auto mb-3 size-10 text-rose" />}
          <p className="text-sm text-white/75">{loadErr.msg}</p>
          {loadErr.retry && (
            <button
              type="button"
              onClick={() => {
                setLoadErr(null);
                setData(null);
                setReloadKey((k) => k + 1);
              }}
              className="btn-primary btn-sm mt-4"
            >
              <RotateCw className="size-4" /> تلاش دوباره
            </button>
          )}
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
          <div role="alert" className="absolute inset-0 z-10 grid place-items-center bg-black/80 p-6 text-center">
            <div>
              <AlertTriangle className="mx-auto mb-3 size-10 text-amber" />
              <p className="mx-auto max-w-sm text-sm leading-7 text-white/80">{overlay}</p>
              <button ref={retryBtn} type="button" onClick={() => ctl.current?.retry()} className="btn-primary btn-sm mt-4">
                <RotateCw className="size-4" /> تلاش دوباره
              </button>
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
