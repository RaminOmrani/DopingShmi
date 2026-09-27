import "server-only";
import { getSetting } from "./settings";

/**
 * پلتفرم ویدیوی ابر آروان (VOD 2.0).
 * ویدیوها در پنل آروان آپلود می‌شوند و شناسه ویدیو (Video ID) در پنل مدیریت سایت ثبت می‌شود.
 * با فعال بودن «لینک امن» روی کانال، لینک پخش با تاریخ انقضا (و در صورت تمایل IP کاربر) از API گرفته می‌شود
 * تا لینک قابل اشتراک‌گذاری نباشد.
 */
const API = "https://napi.arvancloud.ir/vod/2.0";

export interface ArvanVideo {
  id: string;
  title?: string;
  status?: string;
  duration?: number;
  hls?: string;
  dash?: string;
  playerUrl?: string;
  thumbnail?: string;
}

const cache = new Map<string, { at: number; v: ArvanVideo }>();

function authHeader(key: string) {
  const k = key.trim();
  return /^apikey\s/i.test(k) ? k : `Apikey ${k}`;
}

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

/** دریافت لینک پخش (امن) یک ویدیو برای یک کاربر */
export async function getPlayback(videoId: string, ip?: string): Promise<ArvanVideo> {
  const s = await getSetting("arvan");
  const ttl = Math.max(10, s.expireMinutes) * 60;
  const key = `${videoId}|${s.bindIp ? ip : ""}`;
  const hit = cache.get(key);
  // لینک کش‌شده را تا نیمه‌ی عمرش استفاده می‌کنیم
  if (hit && Date.now() - hit.at < (ttl * 1000) / 2) return hit.v;

  const q = new URLSearchParams();
  if (s.secureLink) {
    q.set("secure_expire_time", String(Math.floor(Date.now() / 1000) + ttl));
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
  };
  cache.set(key, { at: Date.now(), v });
  if (cache.size > 2000) cache.clear();
  return v;
}

/** بررسی اتصال: فهرست کانال‌ها */
export async function arvanChannels() {
  const r = await arvanRequest("/channels");
  return (r?.data ?? []) as { id: string; title: string; secure_link_enabled?: boolean }[];
}
