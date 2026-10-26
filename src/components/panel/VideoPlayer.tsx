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
  /** انقضای لینک امن (میلی‌ثانیه) */
  expiresAt?: number | null;
}
type Engine = "hls" | "native" | "file";
interface Quality {
  height: number;
  label: string;
}

const QUALITY_KEY = "ds-quality"; // کیفیت انتخابی دانش‌آموز (ارتفاع تصویر؛ ۰ = خودکار)
/** لینک امن منقضی/نامعتبر: باید لینک تازه گرفت (تلاش دوباره با همان لینک بی‌فایده است) */
const NEW_URL_CODES = new Set([401, 403, 410]);

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
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tapToPlay, setTapToPlay] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [levels, setLevels] = useState<Quality[]>([]);
  const [quality, setQuality] = useState(0);
  const [playingH, setPlayingH] = useState(0);
  const [wm, setWm] = useState({ x: 10, y: 10 });
  const [done, setDone] = useState(false);
  const acc = useRef({ delta: 0, lastT: -1, sentAt: 0 });
  const recoveringRef = useRef(false); // در حین بازیابی، پیشرفت (موقعیت ۰) ثبت نشود
  const wantPlayRef = useRef(false); // آیا دانش‌آموز می‌خواهد ویدیو پخش شود
  const qualityRef = useRef(0);
  const ctl = useRef<{ retry: () => void; setQuality: (h: number) => void } | null>(null);

  useEffect(() => {
    qualityRef.current = readPref();
    setQuality(qualityRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/${videoId}/play`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) setLoadErr(d.error || "خطا در بارگذاری ویدیو");
        else setData(d);
      })
      .catch(() => !cancelled && setLoadErr("اتصال برقرار نشد"));
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // راه‌اندازی پخش و بازیابی خطا
  useEffect(() => {
    const v = ref.current;
    if (!v || !data || data.playerUrl) return;
    let disposed = false;
    let Hls: typeof HlsType | null = null;
    let hls: HlsType | null = null;
    let mode: Engine | null = null;
    let url = data.hls || data.mp4 || "";
    let expiresAt = data.expiresAt ?? 0;
    let refreshing = false;
    let refreshTimes: number[] = [];
    let netTries = 0;
    let lastMediaRecover = 0;
    let lastGood = 0;
    let reports = 0;
    let gaveUp = false;
    const loadedAt = Date.now();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (!disposed) fn();
      }, ms);
      timers.add(t);
    };
    const start = data.lastPosition > 5 && (!data.duration || data.lastPosition < data.duration - 10) ? data.lastPosition : 0;

    /** گزارش خطا برای عیب‌یابی (حداکثر ۸ بار در هر بار باز شدن صفحه) */
    const report = (kind: string, extra: Record<string, unknown> = {}) => {
      if (reports++ >= 8) return;
      const payload = JSON.stringify({ kind, engine: mode ?? undefined, position: Math.round(v.currentTime || lastGood), sinceLoadSec: Math.round((Date.now() - loadedAt) / 1000), ...extra });
      try {
        const blob = new Blob([payload], { type: "application/json" });
        if (!navigator.sendBeacon?.(`/api/videos/${videoId}/error`, blob)) fetch(`/api/videos/${videoId}/error`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
      } catch {
        /* گزارش اختیاری است */
      }
    };

    const finishRecovery = () => {
      recoveringRef.current = false;
      if (!disposed) setBusy(false);
    };
    /** بعد از بارگذاری دوباره، اگر دانش‌آموز در حال تماشا بود، پخش ادامه پیدا کند */
    const resumeAfter = () => {
      v.addEventListener(
        "canplay",
        () => {
          if (disposed) return;
          if (!wantPlayRef.current) return finishRecovery();
          v.play().then(finishRecovery, () => {
            finishRecovery();
            setTapToPlay(true); // مرورگر پخش خودکار را اجازه نداد
          });
        },
        { once: true },
      );
    };
    const giveUp = (msg = "اتصال به سرور ویدیو قطع شد. اینترنت خود را بررسی کنید و «تلاش دوباره» را بزنید.") => {
      gaveUp = true;
      recoveringRef.current = false;
      setBusy(false);
      setOverlay(msg);
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
      const byH = new Map<number, number>();
      hls.levels.forEach((l) => l.height && byH.set(l.height, l.height));
      setLevels([...byH.keys()].sort((a, b) => b - a).map((h) => ({ height: h, label: `${faNum(h)}p` })));
    };
    /** بالاترین کیفیت با ارتفاع داده‌شده (چند نسخه ممکن است ارتفاع یکسان داشته باشند) */
    const levelIndex = (h: number) => {
      let best = -1;
      hls?.levels.forEach((l, i) => {
        if (l.height === h && (best < 0 || l.bitrate > hls!.levels[best].bitrate)) best = i;
      });
      return best;
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
        preserveManualLevelOnError: true,
        errorPenaltyExpireMs: 30000,
        manifestLoadPolicy: policy(15000, 30000, rc(3, 500, 4000), rc(3, 1000, 8000)),
        playlistLoadPolicy: policy(15000, 30000, rc(4, 500, 4000), rc(4, 1000, 8000)),
        fragLoadPolicy: policy(20000, 120000, rc(6, 1000, 8000), rc(8, 1000, 16000)),
      });
      h.on(H.Events.MANIFEST_PARSED, () => {
        syncLevels();
        const i = qualityRef.current ? levelIndex(qualityRef.current) : -1;
        if (i >= 0) h.loadLevel = i; // کیفیت انتخابی از اول
      });
      h.on(H.Events.LEVELS_UPDATED, syncLevels);
      h.on(H.Events.LEVEL_SWITCHED, (_e, d) => setPlayingH(h.levels[d.level]?.height ?? 0));
      h.on(H.Events.FRAG_BUFFERED, () => {
        netTries = 0;
      });
      h.on(H.Events.ERROR, (_e, d) => onHlsError(d));
      h.attachMedia(v);
      h.loadSource(url);
      return h;
    };

    const onHlsError = (d: ErrorData) => {
      if (disposed || !hls || !Hls) return;
      const code = d.response?.code;
      // لینک منقضی: همان اولین خطا (حتی غیرکشنده) لینک تازه بگیر، وگرنه hls.js همه‌ی کیفیت‌ها را امتحان می‌کند
      if (code && NEW_URL_CODES.has(code)) {
        report("expired-link", { code, detail: d.details, fatal: d.fatal });
        refresh("expired");
        return;
      }
      if (!d.fatal) return;
      report("fatal", { code, detail: d.details, fatal: true });
      const E = Hls.ErrorDetails;
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
        if (d.details === E.MANIFEST_LOAD_ERROR || d.details === E.MANIFEST_LOAD_TIMEOUT || d.details === E.MANIFEST_PARSING_ERROR) return refresh("manifest");
        if (++netTries > 6) return giveUp();
        setBusy(true);
        const retry = () => later(() => hls?.startLoad(), Math.min(1000 * 2 ** netTries, 15000));
        if (navigator.onLine) retry();
        else window.addEventListener("online", retry, { once: true });
      } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
        recoveringRef.current = true;
        const now = performance.now();
        if (now - lastMediaRecover < 3000) hls.swapAudioCodec();
        lastMediaRecover = now;
        hls.recoverMediaError();
        resumeAfter();
      } else refresh("other");
    };

    // ─── پخش داخلی مرورگر (آیفون‌های قدیمی و مرورگرهای بدون MSE) ───
    const loadNative = (t: number) => {
      v.src = url;
      v.addEventListener("loadedmetadata", () => t > 0 && (v.currentTime = t), { once: true });
      v.addEventListener("canplay", () => t > 0 && Math.abs(v.currentTime - t) > 2 && (v.currentTime = t), { once: true });
    };
    const onNativeError = () => {
      if (mode === "hls" || recoveringRef.current) return;
      report("native-error", { code: v.error?.code, detail: v.error?.message?.slice(0, 200) });
      refresh("native");
    };

    /** لینک تازه از سرور و ادامه از همان ثانیه */
    const refresh = async (reason: string) => {
      if (refreshing || disposed) return;
      const now = Date.now();
      refreshTimes = refreshTimes.filter((x) => now - x < 120000);
      if (refreshTimes.length >= 3) {
        report("refresh-loop", { detail: reason });
        return giveUp();
      }
      refreshTimes.push(now);
      refreshing = true;
      recoveringRef.current = true;
      setBusy(true);
      const t = v.currentTime > 0 ? v.currentTime : lastGood || start;
      try {
        const r = await fetch(`/api/videos/${videoId}/play?fresh=1`, { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as Play & { error?: string };
        if (disposed) return;
        if (!r.ok) return giveUp(d.error || undefined);
        url = d.hls || d.mp4 || url;
        expiresAt = d.expiresAt ?? 0;
        if (mode === "hls") {
          hls?.destroy();
          hls = createHls(t);
        } else loadNative(t);
        resumeAfter();
      } catch {
        if (!disposed) giveUp();
      } finally {
        refreshing = false;
      }
    };

    // دکمه‌ی «تلاش دوباره» و انتخاب کیفیت
    ctl.current = {
      retry: () => {
        gaveUp = false;
        refreshTimes = [];
        netTries = 0;
        setOverlay(null);
        refresh("manual");
      },
      setQuality: (h: number) => {
        qualityRef.current = h;
        setQuality(h);
        savePref(h);
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
      // ادامه بعد از مکث طولانی: اگر لینک نزدیک انقضاست، اول لینک تازه
      if (expiresAt && expiresAt - Date.now() < 3 * 60_000) refresh("expiring");
    };
    const onPause = () => {
      if (!recoveringRef.current && !v.seeking) wantPlayRef.current = false;
    };
    const onEnded = () => (wantPlayRef.current = false);
    const onTime = () => {
      if (!recoveringRef.current && v.currentTime > 0) lastGood = v.currentTime;
    };
    const onOnline = () => gaveUp && ctl.current?.retry();
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("error", onNativeError);
    window.addEventListener("online", onOnline);

    // نگهبان پخش داخلی: اگر با وجود اینترنت ۲۰ ثانیه جلو نرفت، لینک تازه
    let lastT = -1;
    let stuckSince = 0;
    const watchdog = setInterval(() => {
      if (mode === "hls" || refreshing || gaveUp || !wantPlayRef.current || v.paused || v.ended || !navigator.onLine) {
        stuckSince = 0;
        lastT = v.currentTime;
        return;
      }
      if (v.currentTime !== lastT) {
        lastT = v.currentTime;
        stuckSince = 0;
      } else if (!stuckSince) stuckSince = Date.now();
      else if (Date.now() - stuckSince > 20000) {
        stuckSince = 0;
        report("native-stall");
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
        } else return setLoadErr("مرورگر شما از پخش این ویدیو پشتیبانی نمی‌کند");
        setEngine(mode);
      })
      .catch(() => {
        if (disposed) return;
        if (url && (data.mp4 || v.canPlayType("application/vnd.apple.mpegurl"))) {
          mode = data.hls ? "native" : "file";
          loadNative(start);
          setEngine(mode);
        } else setLoadErr("بارگذاری پلیر ناموفق بود؛ صفحه را دوباره باز کنید");
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
      v.removeEventListener("error", onNativeError);
      window.removeEventListener("online", onOnline);
    };
  }, [data, videoId]);

  // ارسال پیشرفت
  useEffect(() => {
    const v = ref.current;
    if (!v || !data || data.playerUrl) return;
    const send = (force = false) => {
      if (recoveringRef.current) return; // موقعیت موقت ۰ در حین بازیابی ثبت نشود
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

  // جابه‌جایی واترمارک
  useEffect(() => {
    if (!data?.watermark) return;
    const t = setInterval(() => setWm({ x: 5 + Math.random() * 70, y: 5 + Math.random() * 80 }), 7000);
    return () => clearInterval(t);
  }, [data?.watermark]);

  if (loadErr)
    return (
      <div className="on-dark grid aspect-video place-items-center rounded-3xl border border-white/10 bg-black/60 p-6 text-center">
        <div>
          {loadErr.includes("تهیه") ? <Lock className="mx-auto mb-3 size-10 text-amber" /> : <AlertTriangle className="mx-auto mb-3 size-10 text-rose" />}
          <p className="text-sm text-white/75">{loadErr}</p>
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
        {busy && !overlay && (
          <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-amber">
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
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/80 p-6 text-center">
            <div>
              <AlertTriangle className="mx-auto mb-3 size-10 text-amber" />
              <p className="mx-auto max-w-sm text-sm leading-7 text-white/80">{overlay}</p>
              <button type="button" onClick={() => ctl.current?.retry()} className="btn-primary btn-sm mt-4">
                <RotateCw className="size-4" /> تلاش دوباره
              </button>
            </div>
          </div>
        )}
        {done && <span className="chip absolute right-3 top-3 !border-lime/40 !bg-black/60 !text-lime"><CheckCircle2 className="size-3.5" /> دیده شد</span>}
      </div>

      {engine === "hls" && levels.length > 1 && (
        <label className="mt-3 flex w-max items-center gap-2 text-xs text-white/60">
          <Settings2 className="size-4 text-cyan" /> کیفیت:
          <select value={quality} onChange={(e) => ctl.current?.setQuality(Number(e.target.value))} className="input !w-auto !py-1.5 !text-xs">
            <option value={0}>خودکار{quality === 0 ? playingLabel : ""}</option>
            {levels.map((l) => (
              <option key={l.height} value={l.height}>
                {l.label}
              </option>
            ))}
          </select>
          {quality !== 0 && <span className="text-white/40">کیفیت پایین‌تر = مصرف اینترنت کمتر</span>}
        </label>
      )}
      {engine === "native" && <p className="mt-3 text-xs text-white/45">کیفیت به‌طور خودکار با سرعت اینترنت تنظیم می‌شود.</p>}
    </div>
  );
}
