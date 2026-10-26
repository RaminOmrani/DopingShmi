import { db } from "@/lib/db";
import { clientIp, HttpError, mustUser, ok, route } from "@/lib/api";
import { getAccess, canWatch } from "@/lib/access";
import { getPlayback } from "@/lib/arvan";
import { getSetting } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

/** fresh=1 (لینک منقضی‌شده در پلیر) برای هر کاربر و ویدیو حداکثر هر ۱۵ ثانیه یک بار */
const lastFresh = new Map<string, number>();

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await mustUser();
  const { id } = await params;
  const video = await db.video.findUnique({ where: { id } });
  if (!video || !video.published) throw new HttpError(404, "ویدیو یافت نشد");
  if (!canWatch(await getAccess(user), video)) throw new HttpError(403, "برای دیدن این ویدیو باید مبحث را تهیه کنید");
  if (!video.arvanVideoId) throw new HttpError(409, "این ویدیو هنوز بارگذاری نشده است");

  const progress = await db.videoProgress.findUnique({ where: { userId_videoId: { userId: user.id, videoId: id } } });
  const arvan = await getSetting("arvan");
  const base = { lastPosition: progress?.lastPosition ?? 0, watermark: arvan.watermark ? user.phone : null, duration: video.durationSec };

  // امکان استفاده از لینک مستقیم (برای تست یا منابع دیگر)
  if (/^https?:\/\//.test(video.arvanVideoId)) {
    const u = video.arvanVideoId;
    return ok({ ...base, hls: u.includes(".m3u8") ? u : null, mp4: u.includes(".m3u8") ? null : u, poster: video.thumbnail });
  }
  try {
    const wantFresh = new URL(req.url).searchParams.get("fresh") === "1";
    const fk = `${user.id}|${id}`;
    const fresh = wantFresh && Date.now() - (lastFresh.get(fk) ?? 0) > 15_000;
    if (fresh) {
      lastFresh.set(fk, Date.now());
      if (lastFresh.size > 5000) lastFresh.clear();
    }
    const p = await getPlayback(video.arvanVideoId, clientIp(req), { fresh });
    if (!p.hls && !p.playerUrl) throw new HttpError(409, "ویدیو هنوز در آروان آماده‌ی پخش نیست");
    return ok({ ...base, hls: p.hls ?? null, playerUrl: p.hls ? null : p.playerUrl, poster: video.thumbnail || p.thumbnail || null, expiresAt: p.expiresAt ?? null, serverNow: Date.now() });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error("arvan", e);
    throw new HttpError(502, "اتصال به سرور ویدیو برقرار نشد؛ کمی بعد دوباره تلاش کنید");
  }
});
