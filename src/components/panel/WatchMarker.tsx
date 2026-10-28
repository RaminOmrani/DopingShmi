"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayCircle, X } from "lucide-react";
import { BUILD, flushPlaybackQueue, logPlayback, platformCtx, readWatchMarker, WATCH_LOCK, writeWatchMarker, type WatchMarker as Marker } from "@/lib/playback-log";
import { WATCH_RE } from "./PanelNav";

/**
 * تشخیص بسته شدن ناگهانی صفحه‌ی تماشا (کرش مرورگر، بستن اپ توسط سیستم، اجرای دوباره‌ی PWA).
 * پلیرِ زنده (حتی متوقف) هر ۵ ثانیه نشانگر «ds-watch» را با clean:false می‌نویسد، قفل Web Lock نشستش را نگه می‌دارد
 * و هنگام خروج عادی clean:true می‌کند؛ اگر با باز شدن پنل نشانگرِ ناتمامِ تازه‌ای پیدا شود و قفلش آزاد باشد،
 * یعنی صفحه‌ی قبلی بی‌خبر بسته شده است.
 * همچنین گزارش‌های صف‌شده‌ی پخش را هنگام باز شدن پنل و وصل شدن اینترنت می‌فرستد.
 */

/** نشانگر قدیمی‌تر از این دیگر به این بار باز شدن ربطی ندارد */
const MAX_AGE = 15 * 60_000;
/** پلیرِ زنده (مثلاً در زبانه‌ی دیگر) هر ۵ ثانیه نشانگر را تازه می‌کند؛ برای نشانگر تازه کمی صبر و دوباره‌خوانی */
const LIVE_WINDOW = 15_000;
const RECHECK_MS = 7_000;

type Prev = { m: Marker; sameTab: boolean; navType?: string; relaunch: boolean; discarded?: boolean };

/** گزارش هر نشست فقط یک بار (StrictMode و سوار شدن دوباره‌ی layout) */
const reported = new Set<string>();

/**
 * پلیر آن نشست هنوز زنده است (زبانه‌ی دیگر، اپ نصب‌شده، یا زبانه‌ی پنهانِ منجمد که نمی‌تواند نشانگر را تازه کند)؛
 * قفل فقط با بسته شدن/کرش صفحه آزاد می‌شود. بدون Web Locks: null (فقط همان سنجش زمان نشانگر)
 */
async function sessionAlive(sid: string): Promise<boolean | null> {
  try {
    if (!("locks" in navigator) || typeof navigator.locks?.query !== "function") return null;
    const s = await navigator.locks.query();
    const name = `${WATCH_LOCK}${sid}`;
    return [...(s.held ?? []), ...(s.pending ?? [])].some((l) => l.name === name);
  } catch {
    return null;
  }
}

/**
 * خواندن همزمان در اولین رندر، پیش از اجرای effectهای پلیر:
 * پلیر صفحه‌ی جدید ممکن است بعداً نشانگر نشست تازه‌ی خودش را روی همین کلید بنویسد.
 */
function snapshot(): Prev | null {
  if (typeof window === "undefined") return null;
  const { local, session } = readWatchMarker();
  if (!local || local.clean !== false || typeof local.at !== "number") return null;
  const age = Date.now() - local.at;
  if (age < -60_000 || age >= MAX_AGE || reported.has(local.sid)) return null;
  let navType: string | undefined;
  try {
    navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
  } catch {
    /* مرورگر قدیمی */
  }
  return {
    m: local,
    sameTab: session?.sid === local.sid, // همین زبانه دوباره بارگذاری شده (نه اپ/زبانه‌ی تازه)
    navType,
    relaunch: new URLSearchParams(location.search).get("source") === "pwa", // اجرای دوباره‌ی اپ نصب‌شده از start_url
    discarded: (document as Document & { wasDiscarded?: boolean }).wasDiscarded,
  };
}

export function WatchMarker() {
  const path = usePathname();
  const [prev] = useState(snapshot);
  const [resume, setResume] = useState<Marker | null>(null);

  // ارسال گزارش‌های صف‌شده: هنگام باز شدن پنل، وصل شدن اینترنت و برگشت به صفحه
  useEffect(() => {
    const flush = () => flushPlaybackQueue();
    const onVis = () => document.visibilityState === "visible" && flushPlaybackQueue();
    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!prev) return;
    const { m } = prev;
    const fresh = Date.now() - m.at < LIVE_WINDOW;
    let stop = false;
    const t = setTimeout(
      async () => {
        // اگر همان نشست هنوز نشانگر را تازه می‌کند، قفلش را دارد یا درست بسته شد، صفحه‌ی دیگری زنده است؛ گزارشی نیست
        if ((await sessionAlive(m.sid)) || stop) return;
        const cur = readWatchMarker().local;
        if (cur?.sid === m.sid && (cur.clean || cur.at !== m.at)) return;
        if (reported.has(m.sid)) return;
        reported.add(m.sid);

        const gapSec = Math.round((Date.now() - m.at) / 1000);
        const flags = [prev.sameTab && "same-tab", prev.relaunch && "pwa-relaunch", prev.discarded && "discarded"].filter(Boolean).join(" ");
        logPlayback({
          kind: "abnormal-exit",
          sessionId: m.sid,
          videoId: m.videoId,
          position: Number.isFinite(m.pos) ? Math.round(m.pos) : undefined,
          detail: `${m.playing ? "playing" : "paused"} vis=${m.vis} gap=${gapSec}s nav=${prev.navType ?? "?"} ${flags}`.trim().slice(0, 300),
          ctx: {
            ...platformCtx(),
            build: BUILD,
            prevVis: m.vis,
            gapSec,
            prevPlaying: m.playing,
            prevBuild: m.build,
            prevStandalone: m.standalone,
            sameTab: prev.sameTab,
            navType: prev.navType,
            relaunch: prev.relaunch,
            discarded: prev.discarded,
            path: location.pathname,
          },
        });
        // فقط یک بار گزارش شود؛ اگر پلیر تازه نشانگر نشست خودش را نوشته، به آن دست نمی‌زنیم
        if (cur?.sid === m.sid) writeWatchMarker({ ...cur, clean: true });
        if (m.playing) setResume(m);
      },
      fresh ? RECHECK_MS : 1000,
    );
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [prev]);

  // روی صفحه‌ی تماشا (همین ویدیو یا ویدیوی دیگر) پیام لازم نیست و روی پلیر می‌افتاد؛ دانش‌آموز تماشای دیگری را انتخاب کرده است
  const watching = WATCH_RE.test(path);
  if (resume && watching) setResume(null);
  if (!resume || watching) return null;
  const href = `/panel/videos/${resume.videoId}`;

  return (
    <div role="status" className="glass !bg-ink/90 fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3 shadow-2xl lg:bottom-6">
      <PlayCircle className="size-6 shrink-0 text-cyan" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">پخش ویدیو نیمه‌کاره ماند</p>
        {resume.title && <p className="truncate text-xs text-white/50">{resume.title}</p>}
      </div>
      <Link href={href} onClick={() => setResume(null)} className="btn-primary btn-sm shrink-0">
        ادامه‌ی تماشا
      </Link>
      <button type="button" onClick={() => setResume(null)} aria-label="بستن" className="grid size-8 shrink-0 place-items-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white">
        <X className="size-4" />
      </button>
    </div>
  );
}
