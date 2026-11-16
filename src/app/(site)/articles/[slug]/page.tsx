import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { BRAND, crumbsFor } from "@/lib/site-routes";
import { pageMeta, eduGraph } from "@/lib/page-meta";
import { JsonLd } from "@/components/JsonLd";
import { Markdown, readMinutes } from "@/components/Markdown";
import { Breadcrumbs, Byline, SoftCta } from "@/components/seo/EduChrome";
import { faNum, fmtDate } from "@/lib/utils";
import { ViewPing } from "./ViewPing";

export const revalidate = 300;

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const load = (slug: string) => db.article.findUnique({ where: { slug: decode(slug) } });

/** متن کوتاه تا max نویسه، بریده‌شده سر یک کلمه */
const clip = (t: string, max: number) => {
  const chars = [...t.replace(/\s+/g, " ").trim()];
  if (chars.length <= max) return chars.join("");
  const cut = chars.slice(0, max - 1).join("");
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trim()}…`;
};
/** عنوان صفحه: «عنوان | دوپینگ شیمی» اگر در ۶۰ نویسه جا شود، وگرنه خود عنوان */
const pageTitle = (title: string) => ([...`${title} | ${BRAND}`].length <= 60 ? `${title} | ${BRAND}` : clip(title, 60));
const description = (a: { excerpt: string | null; body: string }) => clip(a.excerpt || a.body.replace(/[#*>\[\]()!`_-]/g, " "), 165);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a || !a.published) return {};
  return {
    ...pageMeta({
      title: pageTitle(a.title),
      description: description(a),
      path: `/articles/${a.slug}`,
      type: "article",
      published: a.publishedAt ?? a.createdAt,
      modified: a.updatedAt,
      image: a.cover || undefined,
      imageAlt: a.title,
    }),
    keywords: a.keywords?.split(/[،,]/).map((k) => k.trim()).filter(Boolean),
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const [a, s] = await Promise.all([load((await params).slug), getSetting("site")]);
  if (!a || !a.published) notFound();
  const path = `/articles/${a.slug}`;
  const published = (a.publishedAt ?? a.createdAt).toISOString();
  const crumbs = [...crumbsFor("/articles"), { name: a.title, path }];
  const related = await db.article.findMany({ where: { published: true, id: { not: a.id } }, orderBy: { publishedAt: "desc" }, take: 3, select: { slug: true, title: true } });
  return (
    <main className="mx-auto max-w-3xl px-5 pb-10 pt-32">
      {/* نویسنده‌ی مقاله در داده‌ی ساختاریافته سازمان است (فیلدی برای «بازبینی استاد» در مقاله‌ها نداریم) */}
      <JsonLd
        data={eduGraph(s, {
          path,
          title: a.title,
          description: description(a),
          type: "Article",
          breadcrumb: crumbs,
          published,
          updated: a.updatedAt.toISOString(),
          teacherReviewed: false,
          image: a.cover || undefined,
          extra: { ...(a.keywords ? { keywords: a.keywords } : {}), ...(a.category ? { articleSection: a.category } : {}) },
        })}
      />
      {/* شمارش بازدید در مرورگر (صفحه ISR است)؛ مسیر view با SQL خام updatedAt را عوض نمی‌کند */}
      <ViewPing slug={a.slug} />
      <Breadcrumbs items={crumbs} />
      {a.category && <p className="mb-2 text-sm font-bold text-cyan">{a.category}</p>}
      <h1 className="mb-4 text-3xl font-black leading-[1.5] md:text-4xl">{a.title}</h1>
      <Byline s={s} path={path} className="!mb-2" />
      <p className="mb-8 flex flex-wrap items-center gap-2 text-xs text-white/50">
        <span>انتشار: <time dateTime={published}>{fmtDate(a.publishedAt ?? a.createdAt)}</time></span>
        <span className="flex items-center gap-1">· <Clock className="size-3.5" /> {faNum(readMinutes(a.body))} دقیقه مطالعه</span>
      </p>
      {a.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.cover} alt={a.title} className="mb-8 w-full rounded-3xl border border-white/10" />
      )}
      <article><Markdown text={a.body} /></article>

      <SoftCta s={s} />

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-black">مقاله‌های دیگر</h2>
          <ul className="grid gap-2">{related.map((r) => <li key={r.slug}><Link href={`/articles/${encodeURIComponent(r.slug)}`} className="text-cyan hover:underline">{r.title}</Link></li>)}</ul>
        </section>
      )}
    </main>
  );
}
