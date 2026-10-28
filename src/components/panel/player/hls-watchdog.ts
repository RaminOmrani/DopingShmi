import type HlsType from "hls.js";
import type { Report } from "./telemetry";
import { aheadOf, nearEnd, nextRangeStart, round1 } from "./media";

/** پلیر این امکانات را به نگهبان می‌دهد؛ همه‌ی اقدام‌های سنگین از بودجه‌های خود پلیر می‌گذرند */
export interface WatchdogHost {
  video: HTMLVideoElement;
  /** نمونه‌ی فعلی hls.js (null در پخش داخلی مرورگر) */
  hls: () => HlsType | null;
  /** پلیر خودش مشغول است (لینک تازه، بازیابی، قطع کامل، تلاش دوباره‌ی شبکه) یا دانش‌آموز نمی‌خواهد پخش شود */
  busy: () => boolean;
  pos: () => number;
  report: Report;
  refresh: (reason: string) => void;
  recoverMedia: (h: HlsType, why: string) => void;
  demoteToAuto: (why: string) => void;
  giveUp: (why: string) => void;
  /** انتهای بافر هر SourceBuffer (صدا/تصویر) برای گزارش */
  sourceEnds: () => Record<string, number> | undefined;
}

/** دانلود قطعه‌ای که این مدت هیچ بایتی نگرفته «گیر کرده» است (TCP/VPN معلق) */
const FRAG_IDLE_MS = 10_000;
/** فاصله‌ی حداقل بین دو بار لغو دانلود */
const KICK_GAP_MS = 20_000;
/** با بافر بیش از این، دانلود گیرکرده هنوز عجله‌ای ندارد */
const LOW_AHEAD = 20;

/**
 * نگهبان پخش در حالت hls.js (هر ثانیه یک بار):
 *  ۱) دانلود قطعه‌ای که بعد از رسیدن سرآیند بی‌صدا متوقف شده: لغو و شروع دوباره ← کیفیت خودکار ← لینک تازه
 *     (hls.js خودش تا ۱۲۰ ثانیه منتظر می‌ماند؛ تا وقتی بایت می‌رسد هیچ دانلودی لغو نمی‌شود)
 *  ۲) نقطه‌ی پخش با وجود داده جلو نمی‌رود: ادامه‌ی بارگیری (MMS آیفون)، تکان کوچک، بازیابی رسانه، پریدن از سوراخ کوچک؛
 *     اگر بعد از بازیابی همان‌جا دوباره گیر کرد: پرش از آن نقطه ← لینک تازه ← پیام «تلاش دوباره»
 *  ۳) مدت طولانی گیر و هیچ داده‌ای نمی‌رسد: لینک تازه؛ بار دوم بدون پیشرفت ← پیام «تلاش دوباره»
 */
export function createHlsWatchdog(host: WatchdogHost) {
  const v = host.video;
  // ─── وضعیت هر نمونه‌ی hls.js ───
  // byteAt = لحظه‌ی واقعی آخرین بایت (برای گزارش)؛ idleSince = همان، ولی مکث/بازیابی/پس‌زمینه از نو شروعش می‌کند (برای تصمیم)
  let frag: { key: string; sn: number | string; level: number; loaded: number; total: number; byteAt: number; idleSince: number } | null = null;
  let lastByteAt = 0;
  let kicks = 0;
  let lastKickAt = -Infinity;
  // ─── وضعیت توقف فعلی (از موقعیت شروع توقف سنجیده می‌شود، تا تکان خود نگهبان پیشرفت حساب نشود) ───
  let stallPos = -1;
  let stallSince = 0;
  let nudged = false;
  let recovered = false;
  let resumed = false;
  let holeSkips = 0;
  // ─── بین نمونه‌ها (لینک تازه نمونه را عوض می‌کند) ───
  let stallRefreshes = 0;
  let goodSince = 0;
  // گیر کردن تصویر با داده‌ی بافرشده در همان نقطه، بعد از هر بازیابی دوباره: پله‌ی بعد (نه بازیابی بی‌پایان)
  let bufRecovers = 0;
  let bufRecoverPos = -1;

  const resetStall = () => {
    stallPos = -1;
    stallSince = 0;
    nudged = recovered = resumed = false;
    holeSkips = 0;
  };

  /** پیشرفت بایتی دانلود قطعه‌ی اصلی؛ فقط بعد از رسیدن سرآیند (قبل از آن مهلت TTFB خود hls.js کار می‌کند) */
  const watchFrag = (h: HlsType, now: number) => {
    const f = h.inFlightFragments.main?.frag;
    const st = f?.stats;
    if (!f || !st || !st.loading.first || st.loading.end || st.aborted) {
      frag = null;
      return;
    }
    const key = `${f.sn}:${f.level}:${st.loading.start}`;
    if (frag?.key === key && frag.loaded === st.loaded) return;
    frag = { key, sn: f.sn, level: f.level, loaded: st.loaded, total: st.total, byteAt: now, idleSince: now };
    lastByteAt = now;
  };

  /** دانلود گیرکرده: لغو و شروع دوباره (startLoad خودش stopLoad و لغو XHR را انجام می‌دهد) */
  const kickHungFrag = (h: HlsType, now: number, ahead: number, stuck: number) => {
    if (!frag || now - frag.idleSince < FRAG_IDLE_MS) return false;
    if (ahead >= LOW_AHEAD && stuck < 2000) return false;
    if (now - lastKickAt <= KICK_GAP_MS) return false;
    kicks++;
    lastKickAt = now;
    host.report("frag-stall", {
      detail: `lvl=${frag.level} sn=${frag.sn} ${frag.loaded}/${frag.total}B idle=${Math.round((now - frag.idleSince) / 1000)}s ahead=${round1(ahead)} kick=${kicks}`,
    });
    frag = null; // درخواست بعدی ۱۰ ثانیه‌ی خودش را دارد
    if (kicks === 1) h.startLoad(host.pos());
    else if (kicks === 2) {
      host.demoteToAuto("frag-stall"); // کیفیت دستیِ سنگین را رها کن
      h.startLoad(host.pos());
    } else host.refresh("frag-stall");
    return true;
  };

  const ladder = (h: HlsType, now: number, t: number, ahead: number, stuck: number) => {
    // (الف) MMS آیفون بعد از قفل/پس‌زمینه گاهی «startstreaming» نمی‌فرستد و hls.js منتظر می‌ماند
    if (stuck >= 3000 && !resumed && !h.bufferingEnabled) {
      resumed = true;
      host.report("hls-resume-buffering", { detail: `ahead=${round1(ahead)}` });
      h.resumeBuffering();
      return;
    }
    // (ب) داده جلوی نقطه‌ی پخش هست ولی تصویر جلو نمی‌رود (گیر کردن رمزگشا): یک تکان کوچک، بعد بازیابی رسانه
    if (ahead >= 1.5) {
      if (stuck >= 6000 && !nudged) {
        nudged = true;
        host.report("stall-buffered", { detail: `nudge ahead=${round1(ahead)} seeking=${v.seeking}` });
        v.currentTime = t + 0.1;
        return;
      }
      if (stuck >= 15_000 && !recovered) {
        recovered = true;
        // جای دیگری گیر کرده: نردبان از اول (چند ثانیه فاصله برای پرش خود نگهبان و تکان کوچک)
        if (bufRecoverPos >= 0 && Math.abs(t - bufRecoverPos) > 5) bufRecovers = 0;
        bufRecoverPos = t;
        const n = bufRecovers++;
        host.report("stall-buffered", { detail: `recover#${n + 1} ahead=${round1(ahead)} seeking=${v.seeking}` });
        // بازیابی رسانه ← پرش از نقطه‌ی خراب (داخل بافر) ← لینک تازه ← پیام «تلاش دوباره»
        if (n === 0) host.recoverMedia(h, "stall-buffered");
        else if (n === 1 && ahead > 3) {
          v.currentTime = t + 2;
          stallSince = now;
        } else if (n <= 2) host.refresh("stall-buffered");
        else host.giveUp("stall-buffered");
        return;
      }
    }
    // (ج) سوراخ کوچک در بافر که hls.js از رویش نپرید
    if (ahead < 0.5 && stuck >= 3000 && holeSkips < 2) {
      const next = nextRangeStart(v, t);
      if (next !== null && next - t <= 2) {
        holeSkips++;
        host.report("hls-skip-hole", { detail: `${round1(t)}→${round1(next)}` });
        v.currentTime = next + 0.1;
        stallSince = now;
        return;
      }
    }
    // (د) مدت طولانی گیر و هیچ داده‌ای نمی‌رسد (با وجود اینترنت): لینک تازه؛ بار دوم بدون پیشرفت ← قطع کامل
    if (stuck >= 40_000 && now - lastByteAt >= 30_000 && navigator.onLine) {
      host.report("hls-stall", {
        detail: `stuck=${Math.round(stuck / 1000)}s ahead=${round1(ahead)} noBytes=${Math.round((now - lastByteAt) / 1000)}s refreshes=${stallRefreshes}`,
        x: { sb: host.sourceEnds() },
      });
      stallSince = now;
      if (stallRefreshes >= 1) return host.giveUp("stall");
      stallRefreshes++;
      host.refresh("stall");
    }
  };

  const tick = () => {
    const h = host.hls();
    if (!h) return resetStall();
    const now = performance.now();
    watchFrag(h, now);
    if (host.busy() || v.paused || v.ended || document.hidden || nearEnd(v)) {
      resetStall();
      goodSince = 0;
      if (frag) frag.idleSince = now; // مکث، بازیابی یا پس‌زمینه «گیر کردن دانلود» حساب نشود
      return;
    }
    if (v.readyState === 0) {
      // شروع پخش: هنوز هیچ قطعه‌ای نرسیده؛ فقط دانلودِ گیرکرده‌ی قطعه‌ی اول (وگرنه تا ۱۲۰ ثانیه‌ی خود hls.js چرخ‌زدن)
      resetStall();
      goodSince = 0;
      kickHungFrag(h, now, 0, 0);
      return;
    }
    const t = v.currentTime;
    const ahead = aheadOf(v, t);
    if (stallPos < 0 || Math.abs(t - stallPos) >= 0.5) {
      // پخش جلو رفت
      resetStall();
      stallPos = t;
      if (!goodSince) goodSince = now;
      else if (now - goodSince >= 20_000) {
        // ۲۰ ثانیه پخش سالم
        stallRefreshes = 0;
        bufRecovers = 0;
        bufRecoverPos = -1;
      }
    } else {
      goodSince = 0;
      if (!stallSince) stallSince = now;
    }
    const stuck = stallSince ? now - stallSince : 0;
    if (kickHungFrag(h, now, ahead, stuck)) return;
    if (stuck) ladder(h, now, t, ahead, stuck);
  };

  return {
    tick,
    /** نمونه‌ی تازه‌ی hls.js ساخته شد */
    reset: () => {
      frag = null;
      lastByteAt = performance.now();
      kicks = 0;
      lastKickAt = -Infinity;
      resetStall();
    },
    /** «تلاش دوباره»: بودجه‌ی لینک تازه‌ی ناشی از گیر کردن از نو */
    resetBudget: () => {
      stallRefreshes = 0;
      bufRecovers = 0;
      bufRecoverPos = -1;
    },
    /** قطعه‌ای کامل رسید (هر نوع) */
    bytesArrived: () => {
      lastByteAt = performance.now();
    },
    /** قطعه‌ی اصلی به بافر اضافه شد: دانلودها سالم‌اند */
    fragBuffered: () => {
      kicks = 0;
      lastByteAt = performance.now();
    },
    /** چند میلی‌ثانیه است که دانلود فعلی بایت تازه نگرفته (برای گزارش) */
    fragIdleMs: () => (frag ? Math.round(performance.now() - frag.byteAt) : undefined),
    /** چند میلی‌ثانیه از آخرین بایت هر قطعه (دانلود در جریان، قطعه‌ی کامل، یا ساخت نمونه) گذشته؛ در حین بازیابی هم به‌روز است */
    lastByteAgeMs: () => performance.now() - lastByteAt,
  };
}
