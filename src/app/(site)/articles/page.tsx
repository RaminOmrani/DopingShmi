import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { pageMeta, eduGraph, itemListLd, canonicalUrl } from "@/lib/page-meta";
import { crumbsFor } from "@/lib/site-routes";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/seo/EduChrome";
import { readMinutes } from "@/components/Markdown";
import { faNum, fmtDate } from "@/lib/utils";
import { Newspaper, Clock } from "lucide-react";

export const revalidate = 300;

const PATH = "/articles";
const TITLE = "مقاله‌های آموزش شیمی و روش مطالعه | دوپینگ شیمی";
const desc = (teacher: string) =>
  `مقاله‌ها و نکته‌های آموزشی شیمی دهم، یازدهم، دوازدهم و کنکور از مجموعه‌ی استاد ${teacher}؛ روش مطالعه، نکات تستی و برنامه‌ریزی درسی.`;

export async function generateMetadata(): Promise<Metadata> {
  const [s, count] = await Promise.all([getSetting("site"), db.article.count({ where: { published: true } })]);
  // تا مقاله‌ای منتشر نشده صفحه فقط «به‌زودی» دارد: noindex,follow و بیرون از نقشه‌ی سایت
  return pageMeta({ title: TITLE, description: desc(s.teacherName), path: PATH, noindex: count === 0 });
}

export default async function ArticlesPage() {
  const s = await getSetting("site");
  const list = await db.article.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, select: { slug: true, title: true, excerpt: true, cover: true, category: true, publishedAt: true, body: true } });
  const crumbs = crumbsFor(PATH);
  const items = list.map((a) => ({ name: a.title, path: `/articles/${a.slug}` }));
  const listId = `${canonicalUrl(PATH)}#list`;
  return (
    <main className="mx-auto max-w-6xl px-5 pb-10 pt-32">
      <JsonLd
        data={eduGraph(s, {
          path: PATH,
          title: TITLE,
          description: desc(s.teacherName),
          type: "CollectionPage",
          breadcrumb: crumbs,
          nodes: items.length ? [itemListLd("مقاله‌های آموزشی شیمی", items, listId)] : [],
          extra: items.length ? { mainEntity: { "@id": listId } } : {},
        })}
      />
      <Breadcrumbs items={crumbs} />
      <p className="mb-2 text-sm font-bold text-cyan">مقالات</p>
      <h1 className="section-title mb-4">آموزش و نکته‌های <span className="text-gradient">شیمی</span></h1>
      <p className="mb-10 max-w-2xl leading-8 text-white/60">نوشته‌های مجموعه‌ی آموزشی استاد {s.teacherName} درباره‌ی مطالعه‌ی شیمی، نکات تستی کنکور و برنامه‌ریزی درسی.</p>
      {list.length === 0 && <div className="card p-16 text-center text-white/50">به‌زودی…</div>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <Link key={a.slug} href={`/articles/${encodeURIComponent(a.slug)}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:border-cyan/30">
            <div className="relative aspect-[16/9] bg-gradient-to-br from-cyan/15 via-violet/15 to-magenta/10">
              {a.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.cover} alt={a.title} loading="lazy" className="size-full object-cover" />
              ) : (
                <Newspaper className="absolute inset-0 m-auto size-12 text-white/25" />
              )}
            </div>
            <div className="p-5">
              {a.category && <p className="mb-1 text-xs font-bold text-cyan">{a.category}</p>}
              <h2 className="mb-2 font-black leading-8 group-hover:text-cyan">{a.title}</h2>
              {a.excerpt && <p className="line-clamp-3 text-sm leading-7 text-white/60">{a.excerpt}</p>}
              <p className="mt-3 flex items-center gap-1 text-xs text-white/40"><Clock className="size-3" /> {faNum(readMinutes(a.body))} دقیقه{a.publishedAt ? ` · ${fmtDate(a.publishedAt)}` : ""}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
