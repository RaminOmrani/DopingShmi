"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminAction, bool, must, num, str } from "@/lib/action";
import { arvanClient, getPlayback } from "@/lib/arvan";

/** وصل کردن یک ویدیوی آروان به مبحث (ساخت ویدیو در سایت) */
export const attachArvanVideo = adminAction(async (fd) => {
  const arvanVideoId = str(fd, "arvanVideoId");
  const topicId = str(fd, "topicId");
  const title = str(fd, "title");
  const arvanTitle = str(fd, "arvanTitle");
  must(arvanVideoId, "شناسه‌ی ویدیو نامعتبر است");
  must(topicId, "مبحث را انتخاب کنید");
  must(title, "عنوان ویدیو را بنویسید");
  must(!(await db.video.findFirst({ where: { arvanVideoId } })), "این ویدیو قبلاً به یک مبحث وصل شده است");

  let durationSec = Math.round(num(fd, "duration"));
  let thumbnail = str(fd, "thumbnail") || null;
  if (!durationSec) {
    try {
      const v = await getPlayback(arvanVideoId);
      durationSec = Math.round(Number(v.duration) || 0);
      thumbnail = v.thumbnail ?? thumbnail;
    } catch {
      /* هنوز در حال تبدیل؛ مدت بعداً از ویرایش ویدیو قابل ثبت است */
    }
  }
  const last = await db.video.findFirst({ where: { topicId }, orderBy: { order: "desc" }, select: { order: true } });
  await db.video.create({
    data: { topicId, title, arvanVideoId, durationSec, thumbnail, isFree: bool(fd, "isFree"), published: bool(fd, "published"), order: (last?.order ?? 0) + 1 },
  });
  // هم‌نام کردن عنوان در آروان (اختیاری؛ خطایش مانع نمی‌شود)
  if (title !== arvanTitle) await arvanClient().then((a) => a.updateVideo(arvanVideoId, title)).catch(() => {});
  revalidatePath("/admin/arvan-videos");
  revalidatePath(`/admin/topics/${topicId}`);
  revalidatePath("/courses", "layout");
  return { ok: true, message: "به مبحث اضافه شد" };
});

/** پاک کردن ردیف‌های انتقال خطادار یا تمام‌شده از گزارش */
export const clearImports = adminAction(async () => {
  await db.videoImport.deleteMany({ where: { status: { in: ["DONE", "FAILED"] } } });
  revalidatePath("/admin/arvan-videos");
  return { ok: true, message: "گزارش پاک شد" };
});
