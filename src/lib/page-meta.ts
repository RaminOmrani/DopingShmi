import "server-only";
import type { Metadata } from "next";
import type { SiteContent } from "./settings";
import { LD_ID, abs, breadcrumbLd, ldGraph, ldRef, orgLd, personLd, websiteLd } from "./seo";
import { BRAND, normalizePath, route, type Crumb } from "./site-routes";

/**
 * متادیتا و JSON-LD یکدست برای صفحه‌های عمومی (قرارداد مشترک سئو، بخش ۴ برنامه).
 * - pageMeta: عنوان مطلق، توضیح، canonical مطلق، Open Graph کامل و توییتر؛ صفحه‌ی ثبت‌شده‌ی غیر live خودکار noindex.
 * - eduGraph: یک @graph کامل که گره‌های WebSite، سازمان و استاد را هم دارد تا هیچ @id ارجاعی آویزان نماند.
 */

/** تصویر پیش‌فرض اشتراک‌گذاری (۱۲۰۰×۶۳۰، JPEG حدود ۸۰ کیلوبایت؛ og.png قدیمی ۴۳۵ کیلوبایت بود) */
export const DEFAULT_OG_IMAGE = "/og.jpg";
const DEFAULT_OG_SIZE = { width: 1200, height: 630 };
const dev = process.env.NODE_ENV !== "production";

/** مسیر canonical: یکدست‌شده و رمزگذاری‌شده (اسلاگ فارسی هم درست می‌شود) */
export const canonicalPath = (path: string) => encodeURI(normalizePath(path));
/** نشانی مطلق canonical یک مسیر */
export const canonicalUrl = (path: string) => abs(canonicalPath(path));

const iso = (d?: string | Date) => {
  if (!d) return undefined;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
};

export interface PageMetaInput {
  /** عنوان کامل صفحه (حداکثر ۶۰ نویسه، یکتا)؛ قالب «%s | برند» روی آن اعمال نمی‌شود */
  title: string;
  /** توضیح متا، ۱۰۰ تا ۱۷۰ نویسه */
  description: string;
  /** مسیر صفحه، مثل /shimi-dahom/fasl-1 */
  path: string;
  type?: "website" | "article" | "profile";
  /** تصویر اشتراک‌گذاری (مسیر یا نشانی مطلق)؛ پیش‌فرض DEFAULT_OG_IMAGE */
  image?: string;
  imageAlt?: string;
  /** ابعاد تصویر سفارشی (برای تصویر پیش‌فرض خودکار ۱۲۰۰×۶۳۰) */
  imageSize?: { width: number; height: number };
  /** پیش‌فرض: true فقط برای مسیر ثبت‌شده در SEO_ROUTES که هنوز live نیست */
  noindex?: boolean;
  /** فقط برای type: "article"؛ پیش‌فرض از SEO_ROUTES */
  published?: string | Date;
  modified?: string | Date;
  siteName?: string;
}

/** متادیتای کامل یک صفحه‌ی عمومی */
export function pageMeta(i: PageMetaInput): Metadata {
  const r = route(i.path);
  const url = canonicalUrl(i.path);
  const image = abs(i.image ?? DEFAULT_OG_IMAGE);
  const size = i.image ? i.imageSize : DEFAULT_OG_SIZE;
  const noindex = i.noindex ?? (r ? !r.live : false);
  if (dev) {
    const tl = [...i.title].length;
    const dl = [...i.description].length;
    if (tl > 60) console.warn(`[pageMeta] عنوان ${i.path} بلند است (${tl} > ۶۰): ${i.title}`);
    if (dl < 100 || dl > 170) console.warn(`[pageMeta] طول توضیح ${i.path} خارج از ۱۰۰ تا ۱۷۰ است (${dl})`);
  }
  const common = {
    locale: "fa_IR",
    siteName: i.siteName ?? BRAND,
    url,
    title: i.title,
    description: i.description,
    images: [{ url: image, ...(size ?? {}), alt: i.imageAlt ?? i.title }],
  };
  const openGraph: Metadata["openGraph"] =
    i.type === "article"
      ? { ...common, type: "article", publishedTime: iso(i.published ?? r?.published), modifiedTime: iso(i.modified ?? r?.updated) }
      : { ...common, type: i.type ?? "website" };
  return {
    title: { absolute: i.title },
    description: i.description,
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph,
    twitter: { card: "summary_large_image", title: i.title, description: i.description, images: [image] },
  };
}

/** نوع‌هایی که خودشان صفحه‌ی وب‌اند (reviewedBy و breadcrumb روی خودشان می‌نشیند) */
const PAGE_TYPES = new Set(["WebPage", "CollectionPage", "ProfilePage", "AboutPage", "ContactPage", "FAQPage", "ItemPage", "QAPage", "SearchResultsPage"]);

type Json = Record<string, unknown>;

export interface EduGraphInput {
  path: string;
  title: string;
  description: string;
  /** مثل "Article"، ["Article", "LearningResource"]، "Quiz"، "WebApplication"، "CollectionPage" */
  type: string | string[];
  /** پیش‌فرض: updated همین مسیر در SEO_ROUTES (dateModified) */
  updated?: string;
  /** پیش‌فرض: published در SEO_ROUTES، وگرنه updated */
  published?: string;
  /** پیش‌فرض: teacherReviewed در SEO_ROUTES؛ false → نویسنده سازمان، true → استاد + reviewedBy */
  teacherReviewed?: boolean;
  /** همان آرایه‌ی Breadcrumbs (مثلاً crumbsFor(path)) */
  breadcrumb: Crumb[];
  /** مثل «پایه‌ی دهم» */
  educationalLevel?: string | string[];
  /** موضوع: متن (به Thing تبدیل می‌شود) یا گره‌ی آماده */
  about?: string | Json | (string | Json)[];
  /** مفاهیمی که صفحه آموزش می‌دهد (زیرفصل‌ها) */
  teaches?: string | string[];
  /** تصویر گره‌ی اصلی؛ پیش‌فرض DEFAULT_OG_IMAGE */
  image?: string;
  /** عکس استاد برای گره‌ی Person (اختیاری) */
  personImage?: string;
  /** فیلدهای اضافه‌ی گره‌ی اصلی (آخر از همه ادغام می‌شود؛ مثلاً applicationCategory یا isPartOf) */
  extra?: Json;
  /** گره‌های اضافه‌ی graph (ItemList، VideoObject…)؛ گره‌های WebSite/سازمان/استاد را تکرار نکنید */
  nodes?: object[];
}

const thing = (x: string | Json) => (typeof x === "string" ? { "@type": "Thing", name: x } : x);

/**
 * JSON-LD آموزشی: ldGraph(WebSite، سازمان، استاد، گره‌ی اصلی، [WebPage]، BreadcrumbList، ...nodes).
 * گره‌ی اصلی @id = «نشانی#main» دارد. اگر نوع اصلی صفحه‌ی وب نباشد (مثلاً Article یا Quiz)، یک گره‌ی WebPage
 * با @id = نشانی صفحه هم ساخته می‌شود تا reviewedBy و breadcrumb جای درست schema.org بنشینند.
 */
export function eduGraph(s: SiteContent, i: EduGraphInput): string {
  const r = route(i.path);
  const url = canonicalUrl(i.path);
  const mainId = `${url}#main`;
  const bcId = `${url}#breadcrumb`;
  const reviewed = i.teacherReviewed ?? r?.teacherReviewed ?? false;
  const updated = i.updated ?? r?.updated;
  const published = i.published ?? r?.published ?? updated;
  const types = Array.isArray(i.type) ? i.type : [i.type];
  const isPage = types.some((t) => PAGE_TYPES.has(t));
  const review = reviewed ? { reviewedBy: ldRef(LD_ID.teacher), lastReviewed: updated } : {};
  if (dev && !r) console.warn(`[eduGraph] مسیر ${i.path} در SEO_ROUTES ثبت نشده است`);

  const main: Json = {
    "@type": types.length === 1 ? types[0] : types,
    "@id": mainId,
    url,
    name: i.title,
    headline: [...i.title].slice(0, 110).join(""),
    description: i.description,
    inLanguage: "fa-IR",
    image: abs(i.image ?? DEFAULT_OG_IMAGE),
    isPartOf: ldRef(LD_ID.website),
    publisher: ldRef(LD_ID.org),
    author: ldRef(reviewed ? LD_ID.teacher : LD_ID.org),
    datePublished: published,
    dateModified: updated,
    isAccessibleForFree: true,
    ...(i.educationalLevel ? { educationalLevel: i.educationalLevel } : {}),
    ...(i.about ? { about: Array.isArray(i.about) ? i.about.map(thing) : thing(i.about) } : {}),
    ...(i.teaches ? { teaches: i.teaches } : {}),
    ...(isPage ? { breadcrumb: ldRef(bcId), ...review } : { mainEntityOfPage: ldRef(url) }),
    ...i.extra,
  };
  const webPage: Json | null = isPage
    ? null
    : {
        "@type": "WebPage",
        "@id": url,
        url,
        name: i.title,
        inLanguage: "fa-IR",
        isPartOf: ldRef(LD_ID.website),
        breadcrumb: ldRef(bcId),
        mainEntity: ldRef(mainId),
        datePublished: published,
        dateModified: updated,
        ...review,
      };
  return ldGraph(
    websiteLd(s),
    orgLd(s),
    personLd(s, i.personImage),
    main,
    ...(webPage ? [webPage] : []),
    breadcrumbLd(i.breadcrumb, bcId),
    ...(i.nodes ?? []),
  );
}

/**
 * ارجاع امن به صفحه‌ی دیگر (بدون @id تا آویزان نشود)، مثلاً isPartOf صفحه‌ی فصل → صفحه‌ی پایه:
 * extra: { isPartOf: [ldRef(LD_ID.website), pageRef("/shimi-dahom", "شیمی دهم", "CollectionPage")] }
 */
export const pageRef = (path: string, name: string, type = "WebPage") => ({ "@type": type, url: canonicalUrl(path), name });

/** ItemList برای هاب‌ها (CollectionPage)؛ فقط صفحه‌های live را بدهید (isLive) */
export function itemListLd(name: string, items: Crumb[], id?: string) {
  return {
    "@type": "ItemList",
    ...(id ? { "@id": id } : {}),
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, idx) => ({ "@type": "ListItem", position: idx + 1, url: canonicalUrl(it.path), name: it.name })),
  };
}
