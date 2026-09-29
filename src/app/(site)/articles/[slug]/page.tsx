import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Clock, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SITE_URL, abs, breadcrumbLd, ldGraph } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { Markdown, readMinutes } from "@/components/Markdown";
import { faNum, fmtDate } from "@/lib/utils";

export const revalidate = 300;

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const load = (slug: string) => db.article.findUnique({ where: { slug: decode(slug) } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a || !a.published) return {};
  const url = `/articles/${encodeURIComponent(a.slug)}`;
  const description = a.excerpt || a.body.replace(/[#*>\[\]()!-]/g, "").slice(0, 160);
  return {
    title: a.title,
    description,
    keywords: a.keywords?.split(/[،,]/).map((k) => k.trim()).filter(Boolean),
    alternates: { canonical: url },
    openGraph: { type: "article", title: a.title, description, url: abs(url), publishedTime: a.publishedAt?.toISOString(), modifiedTime: a.updatedAt.toISOString(), images: a.cover ? [abs(a.cover)] : undefined },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const [a, s] = await Promise.all([load((await params).slug), getSetting("site")]);
  if (!a || !a.published) notFound();
  after(() => db.article.update({ where: { id: a.id }, data: { views: { increment: 1 } } }).catch(() => {}));
  const url = `/articles/${encodeURIComponent(a.slug)}`;
  const related = await db.article.findMany({ where: { published: true, id: { not: a.id } }, orderBy: { publishedAt: "desc" }, take: 3, select: { slug: true, title: true } });
  const ld = ldGraph(
    {
      "@type": "Article",
      headline: a.title,
      description: a.excerpt || undefined,
      image: abs(a.cover || "/og.png"),
      datePublished: a.publishedAt?.toISOString(),
      dateModified: a.updatedAt.toISOString(),
      inLanguage: "fa-IR",
      keywords: a.keywords || undefined,
      mainEntityOfPage: abs(url),
      author: { "@type": "Person", "@id": `${SITE_URL}/#teacher`, name: s.teacherName, url: `${SITE_URL}/javad-partovi` },
      publisher: { "@type": "EducationalOrganization", "@id": `${SITE_URL}/#org`, name: s.brand, logo: { "@type": "ImageObject", url: abs("/icons/icon-512.png") } },
    },
    breadcrumbLd([{ name: s.brand, path: "/" }, { name: "مقالات", path: "/articles" }, { name: a.title, path: url }]),
  );
  return (
    <main className="mx-auto max-w-3xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <nav aria-label="مسیر" className="mb-6 text-xs text-white/45"><Link href="/" className="hover:text-cyan">{s.brand}</Link> / <Link href="/articles" className="hover:text-cyan">مقالات</Link></nav>
      {a.category && <p className="mb-2 text-sm font-bold text-cyan">{a.category}</p>}
      <h1 className="mb-4 text-3xl font-black leading-[1.5] md:text-4xl">{a.title}</h1>
      <p className="mb-8 flex flex-wrap items-center gap-2 text-sm text-white/50">
        <Link href="/javad-partovi" className="font-bold text-white/75 hover:text-cyan">استاد {s.teacherName}</Link>
        {a.publishedAt && <span>· {fmtDate(a.publishedAt)}</span>}
        <span className="flex items-center gap-1">· <Clock className="size-3.5" /> {faNum(readMinutes(a.body))} دقیقه مطالعه</span>
      </p>
      {a.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.cover} alt={a.title} className="mb-8 w-full rounded-3xl border border-white/10" />
      )}
      <article><Markdown text={a.body} /></article>

      <aside className="card glow-border mt-12 p-6">
        <p className="mb-1 text-lg font-black">کلاس خصوصی و تدریس شیمی با استاد {s.teacherName}</p>
        <p className="mb-4 text-sm leading-7 text-white/60">شیمی دهم تا کنکور؛ کلاس خصوصی، گروهی، همایش و ویدیوهای آموزشی در اپلیکیشن {s.brand}.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/tadris-shimi" className="btn-primary btn-sm">تدریس شیمی</Link>
          {s.phone && <a href={`tel:${s.phone}`} className="btn-ghost btn-sm"><Phone className="size-4" /> <span dir="ltr">{faNum(s.phone)}</span></a>}
        </div>
      </aside>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-black">مقاله‌های دیگر</h2>
          <ul className="grid gap-2">{related.map((r) => <li key={r.slug}><Link href={`/articles/${encodeURIComponent(r.slug)}`} className="text-cyan hover:underline">{r.title}</Link></li>)}</ul>
        </section>
      )}
    </main>
  );
}
