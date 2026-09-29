import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SITE_URL, breadcrumbLd, ldGraph } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { readMinutes } from "@/components/Markdown";
import { faNum, fmtDate } from "@/lib/utils";
import { Newspaper, Clock } from "lucide-react";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetting("site");
  const title = `مقالات آموزش شیمی | ${s.brand}`;
  const description = `مقاله‌ها و نکته‌های آموزشی شیمی دهم، یازدهم، دوازدهم و کنکور از استاد ${s.teacherName}؛ روش مطالعه، نکات تستی و برنامه‌ریزی.`;
  return { title: { absolute: title }, description, alternates: { canonical: "/articles" }, openGraph: { title, description, url: `${SITE_URL}/articles` } };
}

export default async function ArticlesPage() {
  const s = await getSetting("site");
  const list = await db.article.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, select: { slug: true, title: true, excerpt: true, cover: true, category: true, publishedAt: true, body: true } });
  return (
    <main className="mx-auto max-w-6xl px-5 pb-10 pt-32">
      <JsonLd data={ldGraph(breadcrumbLd([{ name: s.brand, path: "/" }, { name: "مقالات", path: "/articles" }]))} />
      <p className="mb-2 text-sm font-bold text-cyan">مقالات</p>
      <h1 className="section-title mb-4">آموزش و نکته‌های <span className="text-gradient">شیمی</span></h1>
      <p className="mb-10 max-w-2xl leading-8 text-white/60">نوشته‌های استاد {s.teacherName} درباره‌ی مطالعه‌ی شیمی، نکات تستی کنکور و برنامه‌ریزی درسی.</p>
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
