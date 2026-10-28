import "server-only";
import { getSetting, type ArvanSettings } from "./settings";
import { ARVAN_API as API, arvanApi, authHeader } from "./arvan-api";

/**
 * پلتفرم ویدیوی ابر آروان (VOD 2.0).
 * ویدیوها در پنل آروان آپلود می‌شوند و شناسه ویدیو (Video ID) در پنل مدیریت سایت ثبت می‌شود.
 * با فعال بودن «لینک امن» روی کانال، لینک پخش با تاریخ انقضا (و در صورت تمایل IP کاربر) از API گرفته می‌شود
 * تا لینک قابل اشتراک‌گذاری نباشد.
 */

export interface ArvanVideo {
  id: string;
  title?: string;
  status?: string;
  duration?: number;
  hls?: string;
  dash?: string;
  playerUrl?: string;
  thumbnail?: string;
  /** زمان انقضای لینک امن (میلی‌ثانیه)؛ برای تازه‌سازی به‌موقع در پلیر */
  expiresAt?: number;
}

/** هر ورودی زمان انقضای واقعی لینک خودش را نگه می‌دارد (نه بر اساس تنظیم فعلی) */
const cache = new Map<string, { exp: number; minted: number; secure: boolean; v: ArvanVideo }>();

/** بعد از تغییر تنظیمات آروان، لینک‌های ساخته‌شده با تنظیمات قبلی دیگر داده نشوند */
export function clearPlaybackCache() {
  cache.clear();
}
/** درخواست‌های هم‌زمان برای یک ویدیو (مثلاً چند دانش‌آموز بعد از قطعی) فقط یک بار به آروان می‌روند */
const inflight = new Map<string, Promise<ArvanVideo>>();

/** درخواست به API آروان؛ clock = ساعت سرور آروان (هدر Date) و ساعت ما در همان لحظه، برای سنجش اختلاف ساعت */
async function arvanFetch(path: string, init: RequestInit = {}) {
  const s = await getSetting("arvan");
  if (!s.apiKey) throw new Error("کلید API آروان در تنظیمات ثبت نشده است");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: authHeader(s.apiKey), Accept: "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const arvanNow = Date.parse(res.headers.get("date") || "");
  const clock = Number.isFinite(arvanNow) ? { arvan: arvanNow, local: Date.now() } : undefined;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `خطای آروان (${res.status})`);
  return { data, clock };
}

export async function arvanRequest(path: string, init: RequestInit = {}) {
  return (await arvanFetch(path, init)).data;
}

// ─── عیب‌یابی عمر لینک امن (فقط لاگ؛ رفتار را تغییر نمی‌دهد) ───

const WARN_EVERY = 10 * 60_000;
const warnedAt = { skew: 0, expiry: 0 };
function warnSometimes(kind: keyof typeof warnedAt, msg: string) {
  if (Date.now() - warnedAt[kind] < WARN_EVERY) return;
  warnedAt[kind] = Date.now();
  console.warn(msg);
}

/**
 * زمان انقضای امضاشده داخل لینک HLS (مثلاً …/<hash>/<unix-seconds>/…) — فقط وقتی دقیقاً یک بخش ۱۰ رقمی
 * از مسیر یا پارامترها در بازه‌ی معقولِ اطراف انقضای درخواستی پیدا شود؛ وگرنه undefined.
 */
export function signedExpirySec(url: string, requestedSec: number): number | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const nowSec = Date.now() / 1000;
  const parts = [...u.pathname.split("/"), ...u.searchParams.values()];
  const near = parts
    .filter((p) => /^\d{10}$/.test(p))
    .map(Number)
    .filter((n) => n > nowSec - 300 && n < Math.max(requestedSec, nowSec) + 7 * 86400); // زمان‌های گذشته (مثل تاریخ آپلود) کنار گذاشته می‌شوند
  return near.length === 1 ? near[0] : undefined;
}

/** ساعت سرور با آروان اختلاف دارد؟ (لینک امن با ساعت سرور ساخته می‌شود؛ اختلاف زیاد = انقضای زودهنگام) */
function checkLinkTiming(clock: { arvan: number; local: number } | undefined, hls: string | undefined, requestedMs: number | undefined) {
  if (clock) {
    const skew = Math.round((clock.arvan - clock.local) / 1000);
    if (Math.abs(skew) > 60) warnSometimes("skew", `[arvan] clock skew ${skew}s (arvan minus server; check: timedatectl)`);
  }
  if (!hls || !requestedMs) return;
  const requested = Math.floor(requestedMs / 1000);
  const signed = signedExpirySec(hls, requested);
  if (signed !== undefined && Math.abs(signed - requested) > 300) {
    warnSometimes("expiry", `[arvan] signed expiry differs by ${signed - requested}s (requested ${new Date(requested * 1000).toISOString()}, in link ${new Date(signed * 1000).toISOString()})`);
  }
}

/**
 * دریافت لینک پخش (امن) یک ویدیو برای یک کاربر.
 * لینک کش‌شده فقط وقتی دوباره داده می‌شود که دست‌کم نیمی از عمرش (و حداقل ۲ ساعت) مانده باشد؛
 * fresh = لینک تازه (وقتی پلیر خطای انقضا گرفته).
 */
export async function getPlayback(videoId: string, ip?: string, opts: { fresh?: boolean } = {}): Promise<ArvanVideo> {
  const s = await getSetting("arvan");
  const ttl = Math.max(60, s.expireMinutes) * 60;
  const key = `${videoId}|${s.bindIp ? ip : ""}`;
  const hit = cache.get(key);
  const now = Date.now();
  const minLeft = Math.min(ttl * 1000 * 0.9, Math.max((ttl * 1000) / 2, 2 * 3600_000));
  if (hit && hit.secure === s.secureLink) {
    if (!opts.fresh && hit.exp - now >= minLeft) return hit.v;
    // درخواست لینک تازه از چند دانش‌آموز هم‌زمان (مثلاً هنگام قطعی): حداکثر یک لینک جدید در هر ۱۰ ثانیه برای هر ویدیو
    if (opts.fresh && now - hit.minted < 10_000 && hit.exp - now > 60_000) return hit.v;
  }

  const pending = inflight.get(key);
  if (pending) return pending;
  const p = mint(s, videoId, key, ttl, ip).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function mint(s: ArvanSettings, videoId: string, key: string, ttl: number, ip?: string): Promise<ArvanVideo> {
  const now = Date.now();
  const exp = s.secureLink ? now + ttl * 1000 : now + Math.max(6 * 3600_000, ttl * 1000); // بدون لینک امن، فقط برای کش
  const q = new URLSearchParams();
  if (s.secureLink) {
    q.set("secure_expire_time", String(Math.floor(exp / 1000)));
    if (s.bindIp && ip) q.set("secure_ip", ip);
  }
  const { data: r, clock } = await arvanFetch(`/videos/${encodeURIComponent(videoId)}${q.size ? `?${q}` : ""}`);
  const d = r?.data ?? r;
  const v: ArvanVideo = {
    id: d.id,
    title: d.title,
    status: d.status,
    duration: d.file_info?.general?.duration ?? d.duration,
    hls: d.hls_playlist,
    dash: d.dash_playlist,
    playerUrl: d.player_url,
    thumbnail: d.thumbnail_url,
    expiresAt: s.secureLink ? exp : undefined,
  };
  checkLinkTiming(clock, v.hls, v.expiresAt);
  if (v.hls) cache.set(key, { exp, minted: now, secure: s.secureLink, v }); // ویدیوی هنوز آماده‌نشده کش نشود
  if (cache.size > 2000) cache.clear();
  return v;
}

/** بررسی اتصال: فهرست کانال‌ها */
export async function arvanChannels() {
  const r = await arvanRequest("/channels");
  return (r?.data ?? []) as { id: string; title: string; secure_link_enabled?: boolean }[];
}

/** کلاینت API با کلید ذخیره‌شده در تنظیمات */
export async function arvanClient() {
  const s = await getSetting("arvan");
  if (!s.apiKey) throw new Error("کلید API آروان در تنظیمات ثبت نشده است");
  return arvanApi(s.apiKey);
}
