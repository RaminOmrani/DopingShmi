import Link from "next/link";
import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/ui";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { faNum, fmtDate } from "@/lib/utils";
import { EyeOff, ChevronLeft } from "lucide-react";

export const metadata = { title: "مقالات" };

export default async function Articles() {
  const list = await db.article.findMany({ orderBy: [{ published: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, slug: true, published: true, views: true, publishedAt: true, category: true } });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title="مقالات" desc="مقاله‌های آموزشی منظم (مثلاً هفته‌ای یکی) مهم‌ترین عامل بالا آمدن سایت در گوگل برای «تدریس شیمی» و جستجوهای عمومی است." />
      <div className="mb-6 grid gap-2">
        {list.length === 0 && <div className="card p-8 text-center text-white/50">هنوز مقاله‌ای ننوشته‌اید.</div>}
        {list.map((a) => (
          <Link key={a.id} href={`/admin/articles/${a.id}`} className="card flex items-center gap-3 p-4 hover:border-cyan/30">
            <div className="min-w-0 flex-1">
              <p className="font-bold">{a.title} {!a.published && <span className="chip !text-amber"><EyeOff className="size-3" /> پیش‌نویس</span>}</p>
              <p className="text-xs text-white/50">{a.category || "بدون دسته"} · {faNum(a.views)} بازدید{a.publishedAt ? ` · ${fmtDate(a.publishedAt)}` : ""}</p>
            </div>
            <ChevronLeft className="size-4 text-white/40" />
          </Link>
        ))}
      </div>
      <section className="card p-5">
        <h2 className="mb-4 font-black">مقاله‌ی جدید</h2>
        <ArticleForm />
      </section>
    </div>
  );
}
