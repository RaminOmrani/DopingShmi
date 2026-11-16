"use server";
import { revalidatePath } from "next/cache";
import { adminAction, must, str } from "@/lib/action";
import { saveSetting } from "@/lib/settings";

/** فقط نشانی کامل http(s) یا خالی */
const url = (fd: FormData, k: string) => {
  const v = str(fd, k);
  must(!v || /^https?:\/\/[^\s]+$/i.test(v), "نشانی صفحه باید با https:// شروع شود");
  return v;
};

/**
 * صفحه‌های رسمی آپارات و یوتیوب: در فوتر و در sameAs داده‌ی ساختاریافته‌ی استاد و مجموعه می‌آیند
 * (به گوگل کمک می‌کند «استاد جواد پرتویی» را یک شخص واحد بشناسد). جدا از فرم اصلی متن‌ها ذخیره می‌شود.
 */
export const saveProfiles = adminAction(async (fd) => {
  await saveSetting("site", { aparat: url(fd, "aparat"), youtube: url(fd, "youtube") });
  revalidatePath("/", "layout");
  return { ok: true };
});
