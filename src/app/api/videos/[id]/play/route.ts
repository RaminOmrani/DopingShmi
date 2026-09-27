import { db } from "@/lib/db";
import { clientIp, HttpError, mustUser, ok, route } from "@/lib/api";
import { getAccess, canWatch } from "@/lib/access";
import { getPlayback } from "@/lib/arvan";
import { getSetting } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

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
    const p = await getPlayback(video.arvanVideoId, clientIp(req));
    if (!p.hls && !p.playerUrl) throw new HttpError(409, "ویدیو هنوز در آروان آماده‌ی پخش نیست");
    return ok({ ...base, hls: p.hls ?? null, playerUrl: p.hls ? null : p.playerUrl, poster: video.thumbnail || p.thumbnail || null });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error("arvan", e);
    throw new HttpError(502, "اتصال به سرور ویدیو برقرار نشد؛ کمی بعد دوباره تلاش کنید");
  }
});
