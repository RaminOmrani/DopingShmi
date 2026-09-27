import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, mustUser, ok, route } from "@/lib/api";
import { getAccess, canWatch } from "@/lib/access";
import { award } from "@/lib/points";
import { getSetting } from "@/lib/settings";
import { tehranDay } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

/** گزارش پیشرفت تماشا: هر ~۱۵ ثانیه، delta = ثانیه‌های واقعاً پخش‌شده از گزارش قبلی */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await mustUser();
  const { id } = await params;
  const b = await body(req, z.object({ position: z.number().min(0), delta: z.number().min(0), duration: z.number().min(0).optional() }));
  const video = await db.video.findUnique({ where: { id } });
  if (!video) throw new HttpError(404, "ویدیو یافت نشد");
  if (!canWatch(await getAccess(user), video)) throw new HttpError(403, "دسترسی ندارید");

  // اگر مدت ویدیو ثبت نشده، از پلیر می‌گیریم
  let duration = video.durationSec;
  if (!duration && b.duration && b.duration > 10) {
    duration = Math.round(b.duration);
    await db.video.update({ where: { id }, data: { durationSec: duration } });
  }
  const delta = Math.min(Math.round(b.delta), 40);
  const prev = await db.videoProgress.findUnique({ where: { userId_videoId: { userId: user.id, videoId: id } } });
  const cap = Math.max(duration * 3, 600);
  const watched = Math.min((prev?.watchedSeconds ?? 0) + delta, cap);
  const position = Math.round(b.position);
  const completed = prev?.completed || (duration > 0 && watched >= duration * 0.8 && position >= duration * 0.75);

  await db.videoProgress.upsert({
    where: { userId_videoId: { userId: user.id, videoId: id } },
    create: { userId: user.id, videoId: id, watchedSeconds: watched, lastPosition: position, completed },
    update: { watchedSeconds: watched, lastPosition: position, completed },
  });
  if (delta > 0) {
    const day = tehranDay();
    await db.activity.upsert({ where: { userId_day: { userId: user.id, day } }, create: { userId: user.id, day, videoSec: delta }, update: { videoSec: { increment: delta } } });
  }
  const p = await getSetting("points");
  const blocks = Math.floor(Math.min(watched, duration || watched) / 300);
  for (let k = 1; k <= blocks; k++) await award(user.id, "VIDEO_TIME", `${id}:${k}`, p.videoPer5Min);
  let justCompleted = false;
  if (completed && !prev?.completed) justCompleted = await award(user.id, "VIDEO_DONE", id, p.videoDone);
  return ok({ ok: true, completed, justCompleted, bonus: justCompleted ? p.videoDone : 0 });
});
