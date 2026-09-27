"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminAction, bool, file, must, num, optStr, str } from "@/lib/action";
import { saveImage, removeUpload } from "@/lib/upload";
import { getPlayback } from "@/lib/arvan";
import { sendBulk } from "@/lib/sms";
import { toEnDigits } from "@/lib/utils";

const parseDuration = (s: string) => {
  const v = toEnDigits(s).trim();
  if (!v) return 0;
  const parts = v.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : Math.round(parts[0] * 60);
};

export const saveTopic = adminAction(async (fd) => {
  const id = str(fd, "id");
  const majors = fd.getAll("majors").map(String).filter(Boolean);
  const data: Record<string, unknown> = {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    grade: str(fd, "grade") || "G12",
    majors: majors.length ? majors : ["TAJROBI", "RIAZI"],
    price: Math.round(num(fd, "price")),
    order: num(fd, "order"),
    published: bool(fd, "published"),
  };
  must(data.title, "عنوان مبحث را وارد کنید");
  const cover = file(fd, "cover");
  if (cover) {
    const img = await saveImage(cover, "covers", 1400);
    data.cover = img.url;
    if (id) await removeUpload((await db.topic.findUnique({ where: { id } }))?.cover);
  }
  if (id) await db.topic.update({ where: { id }, data });
  else await db.topic.create({ data: data as never });
  revalidatePath("/admin/topics", "layout");
  revalidatePath("/courses");
  return { ok: true };
});

export const deleteTopic = adminAction(async (fd) => {
  const id = str(fd, "id");
  must((await db.purchase.count({ where: { topicId: id } })) === 0, "این مبحث خریدار دارد؛ به‌جای حذف، آن را غیرفعال کنید");
  await db.topic.delete({ where: { id } });
  revalidatePath("/admin/topics", "layout");
  return { ok: true, message: "حذف شد" };
});

export const saveVideo = adminAction(async (fd) => {
  const id = str(fd, "id");
  const topicId = str(fd, "topicId");
  const arvanVideoId = optStr(fd, "arvanVideoId");
  let durationSec = parseDuration(str(fd, "duration"));
  let thumbnail: string | null | undefined = undefined;
  if (arvanVideoId && !/^https?:/.test(arvanVideoId) && !durationSec) {
    try {
      const v = await getPlayback(arvanVideoId);
      durationSec = Math.round(Number(v.duration) || 0);
      thumbnail = v.thumbnail ?? null;
    } catch {
      /* آروان تنظیم نشده یا ویدیو آماده نیست */
    }
  }
  const data = {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    arvanVideoId,
    durationSec,
    isFree: bool(fd, "isFree"),
    order: num(fd, "order"),
    published: bool(fd, "published"),
    ...(thumbnail !== undefined ? { thumbnail } : {}),
  };
  must(data.title, "عنوان ویدیو را وارد کنید");
  const created = id ? await db.video.update({ where: { id }, data }) : await db.video.create({ data: { ...data, topicId } });
  if (!id && bool(fd, "notify") && created.published) {
    const t = await db.topic.findUniqueOrThrow({ where: { id: topicId } });
    const users = await db.user.findMany({
      where: { role: "USER", blocked: false, ...(t.grade !== "ALL" ? { grade: t.grade } : {}), classStatus: "APPROVED" },
      select: { id: true, phone: true, name: true },
    });
    await db.notification.create({ data: { title: "ویدیو جدید 🎬", body: `«${created.title}» در مبحث ${t.title} منتشر شد.`, audience: { grade: t.grade !== "ALL" ? t.grade : null, studentsOnly: true } } });
    if (users.length) await sendBulk({ title: `ویدیو جدید: ${created.title}`, templateKey: "video_new", recipients: users, vars: (r) => ({ name: r.name, video: created.title }) });
  }
  revalidatePath(`/admin/topics/${topicId}`);
  return { ok: true };
});

export const deleteVideo = adminAction(async (fd) => {
  await db.video.delete({ where: { id: str(fd, "id") } });
  revalidatePath(`/admin/topics/${str(fd, "topicId")}`);
  return { ok: true, message: "حذف شد" };
});

export const saveBundle = adminAction(async (fd) => {
  const id = str(fd, "id");
  const topicIds = fd.getAll("topics").map(String);
  const data = { title: str(fd, "title"), description: optStr(fd, "description"), price: Math.round(num(fd, "price")), durationDays: num(fd, "durationDays") || null, active: bool(fd, "active"), order: num(fd, "order") };
  must(data.title && data.price > 0, "عنوان و قیمت بسته را وارد کنید");
  must(topicIds.length, "حداقل یک مبحث انتخاب کنید");
  if (id) await db.bundle.update({ where: { id }, data: { ...data, topics: { set: topicIds.map((t) => ({ id: t })) } } });
  else await db.bundle.create({ data: { ...data, topics: { connect: topicIds.map((t) => ({ id: t })) } } });
  revalidatePath("/admin/bundles");
  return { ok: true };
});

export const deleteBundle = adminAction(async (fd) => {
  const id = str(fd, "id");
  must((await db.purchase.count({ where: { bundleId: id } })) === 0, "این بسته خریدار دارد؛ آن را غیرفعال کنید");
  await db.bundle.delete({ where: { id } });
  revalidatePath("/admin/bundles");
  return { ok: true, message: "حذف شد" };
});
