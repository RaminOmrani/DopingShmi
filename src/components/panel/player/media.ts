/** ابزارهای کوچک وضعیت المان ویدیو (بافر، تمام‌صفحه) برای پلیر و نگهبان پخش */

/** ثانیه‌های بافرشده‌ی جلوی نقطه‌ی پخش، فقط در بازه‌ای که نقطه‌ی پخش داخل آن است */
export function aheadOf(v: HTMLVideoElement, t = v.currentTime) {
  const b = v.buffered;
  for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.1 && t < b.end(i)) return b.end(i) - t;
  return 0;
}

/** شروع بازه‌ی بافرشده‌ی بعد از نقطه‌ی پخش (برای پریدن از روی سوراخ کوچک)؛ null اگر نیست */
export function nextRangeStart(v: HTMLVideoElement, t = v.currentTime) {
  const b = v.buffered;
  for (let i = 0; i < b.length; i++) if (b.start(i) > t + 0.1) return b.start(i);
  return null;
}

/** دو ثانیه‌ی آخر ویدیو (توقف آنجا طبیعی است) */
export const nearEnd = (v: HTMLVideoElement) => v.duration > 0 && v.duration - v.currentTime < 2;

export function isFullscreen(v: HTMLVideoElement) {
  const w = v as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean };
  return !!document.fullscreenElement || !!w.webkitDisplayingFullscreen;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
