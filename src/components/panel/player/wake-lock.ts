/**
 * روشن نگه داشتن صفحه در تمام مدتی که دانش‌آموز می‌خواهد ویدیو پخش شود (Screen Wake Lock)، حتی هنگام کندی اینترنت و بازیابی.
 * مرورگرها فقط وقتی تصویر واقعاً جلو می‌رود صفحه را روشن نگه می‌دارند و با «قفل خودکار» گوشی صفحه سیاه می‌شود؛
 * در آیفونِ PWA با hls.js (ManagedMediaSource) حتی پخش عادی هم صفحه را روشن نگه نمی‌دارد (WebKit FB17984089 · hls.js #6725).
 * نبودِ API یا رد شدن درخواست (صفحه پنهان، حالت صرفه‌جویی باتری، iOS قدیمی) بی‌صدا نادیده گرفته می‌شود.
 */
export function createWakeLock(shouldHold: () => boolean) {
  let sentinel: WakeLockSentinel | null = null;
  let pending = false;
  let disposed = false;
  let acquiredAt = 0;

  /** درخواست قفل؛ اولین بار باید در مهلت لمس کاربر باشد (رویداد play) */
  const keep = () => {
    if (sentinel || pending || disposed || document.visibilityState !== "visible" || !shouldHold()) return;
    const api = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
    if (!api?.request) return;
    pending = true;
    let req: Promise<WakeLockSentinel>;
    try {
      req = api.request("screen");
    } catch {
      pending = false;
      return;
    }
    req.then(
      (s) => {
        pending = false;
        if (disposed || !shouldHold()) return void s.release().catch(() => {});
        sentinel = s;
        acquiredAt = Date.now();
        s.addEventListener("release", () => {
          if (sentinel !== s) return; // خودمان رها کردیم
          sentinel = null;
          // مرورگر خودش رها کرد (پنهان شدن صفحه یا صرفه‌جویی باتری): اگر هنوز پیداست دوباره، ولی نه پشت‌سرهم
          if (Date.now() - acquiredAt > 5000) keep();
        });
      },
      () => {
        pending = false;
      },
    );
  };

  const release = () => {
    const s = sentinel;
    sentinel = null;
    s?.release().catch(() => {});
  };

  return {
    keep,
    release,
    /** قفل در دست ماست (تا رویداد release مرورگر پردازش شود) */
    held: () => !!sentinel,
    dispose: () => {
      disposed = true;
      release();
    },
  };
}
