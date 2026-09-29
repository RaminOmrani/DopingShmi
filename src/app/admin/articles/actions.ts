"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { adminAction, bool, file, must, optStr, str } from "@/lib/action";
import { saveImage, removeUpload } from "@/lib/upload";

/** نامک فارسی/انگلیسی: فاصله‌ها خط تیره، علائم حذف */
const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[‌\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);

export const saveArticle = adminAction(async (fd) => {
  const id = str(fd, "id");
  const title = str(fd, "title");
  const body = str(fd, "body");
  must(title, "عنوان مقاله را وارد کنید");
  must(body.length > 50, "متن مقاله خیلی کوتاه است");
  const slug = slugify(str(fd, "slug") || title);
  must(slug, "نامک (آدرس) معتبر نیست");
  const dup = await db.article.findUnique({ where: { slug } });
  must(!dup || dup.id === id, "مقاله‌ی دیگری با همین آدرس وجود دارد");
  const published = bool(fd, "published");
  const prev = id ? await db.article.findUnique({ where: { id } }) : null;
  const data: Record<string, unknown> = {
    title,
    slug,
    body,
    excerpt: optStr(fd, "excerpt"),
    category: optStr(fd, "category"),
    keywords: optStr(fd, "keywords"),
    published,
    publishedAt: published ? (prev?.publishedAt ?? new Date()) : prev?.publishedAt ?? null,
  };
  const cover = file(fd, "cover");
  if (cover) {
    data.cover = (await saveImage(cover, "articles", 1600)).url;
    if (prev?.cover) await removeUpload(prev.cover);
  }
  const saved = id ? await db.article.update({ where: { id }, data }) : await db.article.create({ data: data as never });
  revalidatePath("/admin/articles", "layout");
  revalidatePath("/articles", "layout");
  revalidatePath("/sitemap.xml");
  if (!id) redirect(`/admin/articles/${saved.id}`);
  return { ok: true };
});

export const deleteArticle = adminAction(async (fd) => {
  const a = await db.article.delete({ where: { id: str(fd, "id") } });
  await removeUpload(a.cover);
  revalidatePath("/admin/articles", "layout");
  revalidatePath("/articles", "layout");
  redirect("/admin/articles");
});
