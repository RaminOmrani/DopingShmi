"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser, isAdmin } from "@/lib/auth";
import { adminAction, bool, file, must, num, optStr, str } from "@/lib/action";
import { saveImage, removeUpload } from "@/lib/upload";

const refresh = () => {
  revalidatePath("/admin/photos");
  revalidatePath("/");
  revalidatePath("/gallery");
};

/** آپلود یک عکس (کلاینت عکس‌ها را یکی‌یکی می‌فرستد) */
export async function uploadPhoto(fd: FormData) {
  if (!isAdmin(await getUser())) return { error: "دسترسی ندارید" };
  const f = file(fd, "file");
  if (!f) return { error: "فایل نامعتبر" };
  try {
    const section = str(fd, "section") || "CONFERENCE";
    const img = await saveImage(f, section === "TEACHER" ? "teacher" : "photos", section === "TEACHER" ? 1600 : 2200);
    const max = await db.photo.aggregate({ where: { section }, _max: { order: true } });
    await db.photo.create({ data: { ...img, section, eventName: optStr(fd, "eventName"), title: optStr(fd, "title"), order: (max._max.order ?? 0) + 1 } });
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message || "خطا در ذخیره عکس" };
  }
}

export const updatePhoto = adminAction(async (fd) => {
  await db.photo.update({
    where: { id: str(fd, "id") },
    data: { title: optStr(fd, "title"), caption: optStr(fd, "caption"), eventName: optStr(fd, "eventName"), order: num(fd, "order"), visible: bool(fd, "visible"), section: str(fd, "section") || "CONFERENCE" },
  });
  refresh();
  return { ok: true };
});

export const deletePhoto = adminAction(async (fd) => {
  const p = await db.photo.delete({ where: { id: str(fd, "id") } });
  await removeUpload(p.url);
  refresh();
  return { ok: true, message: "حذف شد" };
});

export const saveRank = adminAction(async (fd) => {
  const id = str(fd, "id");
  const data: Record<string, unknown> = { name: str(fd, "name"), rank: Math.round(num(fd, "rank")), year: str(fd, "year"), field: optStr(fd, "field"), note: optStr(fd, "note"), order: num(fd, "order") };
  must(data.name && data.rank && data.year, "نام، رتبه و سال را وارد کنید");
  const f = file(fd, "photo");
  if (f) data.photo = (await saveImage(f, "ranks", 800)).url;
  if (id) await db.topRank.update({ where: { id }, data });
  else await db.topRank.create({ data: data as never });
  revalidatePath("/admin/ranks");
  revalidatePath("/");
  return { ok: true };
});

export const deleteRank = adminAction(async (fd) => {
  const r = await db.topRank.delete({ where: { id: str(fd, "id") } });
  await removeUpload(r.photo);
  revalidatePath("/admin/ranks");
  revalidatePath("/");
  return { ok: true, message: "حذف شد" };
});
