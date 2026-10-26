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

export async function arvanRequest(path: string, init: RequestInit = {}) {
  const s = await getSetting("arvan");
  if (!s.apiKey) throw new Error("کلید API آروان در تنظیمات ثبت نشده است");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: authHeader(s.apiKey), Accept: "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `خطای آروان (${res.status})`);
  return data;
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
  const r = await arvanRequest(`/videos/${encodeURIComponent(videoId)}${q.size ? `?${q}` : ""}`);
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
