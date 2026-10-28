/* Service Worker دوپینگ شیمی — کش فایل‌های ثابت + صفحه آفلاین */
const VERSION = "ds-v3";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
// صفحه‌ی آفلاین ایستا و بدون Next (public/offline.html): بی‌نیاز از chunk های JS، و آدرس صفحه‌ی درخواستی را عوض نمی‌کند
const OFFLINE = "/offline.html";
// صفحه‌های شخصی (پنل، مدیریت، ورود): هیچ‌وقت HTML قدیمی‌شان از کش داده نمی‌شود
const PRIVATE = /^\/(panel|admin|login|register|offline)(\/|$)/;

/** ذخیره‌ی صفحه‌ی آفلاین (اگر هنوز نیست). cache: "reload" تا نسخه‌ی کش‌شده‌ی مرورگر/CDN جای نسخه‌ی تازه را نگیرد */
const ensureOffline = () =>
  caches.open(STATIC).then(async (c) => {
    if (await c.match(OFFLINE)) return;
    const res = await fetch(new Request(OFFLINE, { cache: "reload" }));
    if (res.ok && res.type === "basic" && !res.redirected) await c.put(OFFLINE, res);
  });

self.addEventListener("install", (e) => {
  // شکست پیش‌ذخیره (مثلاً چالش CDN) نصب را متوقف نمی‌کند؛ وگرنه نسخه‌ی قبلی سرویس‌ورکر با کش HTML پنل می‌ماند
  e.waitUntil(
    Promise.all([ensureOffline(), caches.open(STATIC).then((c) => c.addAll(["/logo.svg", "/icons/icon-192.png"]))])
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

/** فقط پاسخ سالم و هم‌مبدأ کش می‌شود؛ صفحه‌ی HTML (چالش CDN یا خطا) هرگز جای فایل ثابت ذخیره نمی‌شود */
const cacheableStatic = (res) => res.ok && res.type === "basic" && !(res.headers.get("content-type") || "").includes("text/html");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ویدیو و درگاه و ... کش نمی‌شوند
  if (url.pathname.startsWith("/api/")) return;

  // فایل‌های ثابت Next و فونت‌ها و آپلودها: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/uploads/") || /\.(woff2?|svg|png|webp|jpg)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (cacheableStatic(res)) c.put(req, res.clone()).catch(() => {});
        return res;
      }),
    );
    return;
  }

  // صفحات: network-first
  if (req.mode === "navigate") {
    const priv = PRIVATE.test(url.pathname);
    // اگر صفحه‌ی آفلاین هنگام نصب ذخیره نشده بود، دوباره (فقط وقتی نیست؛ معمولاً یک جست‌وجوی سریع در کش)
    e.waitUntil(ensureOffline().catch(() => {}));
    e.respondWith(
      fetch(req)
        .then((res) => {
          // فقط صفحه‌های عمومی سایت برای حالت آفلاین نگه داشته می‌شوند
          if (!priv && res.ok && res.type === "basic" && !res.redirected) {
            const copy = res.clone(); // همین‌جا و پیش از تحویل پاسخ؛ بعداً بدنه ممکن است خوانده شده باشد
            caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          // پنل و مدیریت: هرگز HTML قدیمی (ممکن است مال نسخه‌ی قبلی یا کاربر دیگری باشد)؛ فقط صفحه‌ی آفلاین
          const cached = priv ? undefined : await caches.match(req, { cacheName: PAGES });
          return cached || (await caches.match(OFFLINE)) || Response.error();
        }),
    );
  }
});
