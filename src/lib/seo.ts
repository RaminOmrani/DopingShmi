import "server-only";
import type { SiteContent } from "./settings";

export const SITE_URL = (process.env.SITE_URL || "https://dopingshimi.ir").replace(/\/$/, "");
export const abs = (path = "/") => (/^https?:/.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

/** شناسه‌های ثابت گره‌های مشترک JSON-LD؛ هر ارجاع {"@id"} باید گره‌اش در همان graph باشد (eduGraph در page-meta.ts) */
export const LD_ID = {
  website: `${SITE_URL}/#website`,
  org: `${SITE_URL}/#org`,
  teacher: `${SITE_URL}/#teacher`,
} as const;
/** ارجاع به گره‌ای که در همان graph تعریف شده است */
export const ldRef = (id: string) => ({ "@id": id });

/** شرط عکس‌های صفحه‌ی گالری؛ هم خود صفحه و هم نقشه‌ی سایت (گالری بی‌عکس noindex است و در نقشه نمی‌آید) */
export const GALLERY_PHOTOS = { visible: true, section: { in: ["CONFERENCE", "GALLERY"] } };
/** مبحثی که ویدیوی منتشرشده ندارد و توضیحش از این تعداد نویسه کوتاه‌تر است کم‌محتواست: noindex و بیرون از نقشه‌ی سایت */
export const THIN_TOPIC_DESC = 80;

/** کلمات کلیدی اصلی که باید در متن‌ها و عنوان‌ها بیایند */
export const KEYWORDS = [
  "دوپینگ شیمی", "جواد پرتویی", "استاد جواد پرتویی", "شیمی کنکور", "آموزش شیمی کنکور", "تدریس شیمی", "تدریس شیمی کنکور", "معلم شیمی مشهد",
  "دبیر شیمی مشهد", "کلاس خصوصی شیمی", "کلاس شیمی کنکور مشهد", "همایش شیمی", "آموزش شیمی دوازدهم", "آموزش شیمی دهم", "آموزش شیمی یازدهم",
];

/** صفحه‌های رسمی (sameAs)؛ فقط نشانی کامل http(s). aparat و youtube از تنظیمات «متن‌های سایت» */
const socials = (s: SiteContent) => [s.instagram, s.telegram, s.bale, s.aparat, s.youtube].filter((x) => x && /^https?:/.test(x));

/** شخص: استاد جواد پرتویی */
export function personLd(s: SiteContent, image?: string) {
  return {
    "@type": "Person",
    "@id": LD_ID.teacher,
    name: s.teacherName,
    alternateName: [`استاد ${s.teacherName}`, "Javad Partovi"],
    jobTitle: "دبیر شیمی و مدرس شیمی کنکور",
    description: s.aboutText,
    url: `${SITE_URL}/javad-partovi`,
    image: image ? abs(image) : undefined,
    telephone: s.phone || undefined,
    alumniOf: { "@type": "CollegeOrUniversity", name: "دانشگاه فردوسی مشهد" },
    // مدرک دقیقاً «کارشناسی ارشد مهندسی شیمی، دانشگاه فردوسی مشهد» (هرگز «لیسانس»)
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "degree",
      name: "کارشناسی ارشد مهندسی شیمی",
      educationalLevel: "کارشناسی ارشد",
      recognizedBy: { "@type": "CollegeOrUniversity", name: "دانشگاه فردوسی مشهد" },
    },
    memberOf: { "@type": "Organization", name: "بنیاد ملی نخبگان" },
    worksFor: ldRef(LD_ID.org),
    knowsAbout: ["شیمی", "شیمی کنکور", "شیمی دبیرستان", "شیمی دهم", "شیمی یازدهم", "شیمی دوازدهم", "تست شیمی", "استوکیومتری", "شیمی آلی", "مهندسی شیمی"],
    address: { "@type": "PostalAddress", addressLocality: s.city || "مشهد", addressCountry: "IR" },
    sameAs: socials(s),
  };
}

/** مؤسسه آموزشی: دوپینگ شیمی */
export function orgLd(s: SiteContent) {
  return {
    "@type": "EducationalOrganization",
    "@id": LD_ID.org,
    name: s.brand,
    alternateName: ["Doping Shimi", "دوپینگ شیمی جواد پرتویی"],
    url: SITE_URL,
    // لوگوی PNG مربعی (گوگل SVG را برای لوگو نمی‌پذیرد)
    logo: abs("/icons/icon-512.png"),
    image: abs("/og.jpg"),
    description: s.seoDescription,
    founder: ldRef(LD_ID.teacher),
    telephone: s.phone || undefined,
    address: { "@type": "PostalAddress", streetAddress: s.address || undefined, addressLocality: s.city || "مشهد", addressCountry: "IR" },
    areaServed: [s.city || "مشهد", "ایران"],
    sameAs: socials(s),
  };
}

export function websiteLd(s: SiteContent) {
  return { "@type": "WebSite", "@id": LD_ID.website, url: SITE_URL, name: s.brand, alternateName: ["Doping Shimi", "dopingshimi.ir"], inLanguage: "fa-IR", publisher: ldRef(LD_ID.org) };
}

/** مسیر راهنما؛ id اختیاری برای ارجاع از گره WebPage (پارامتر دوم اختیاری است و فراخوان‌های قبلی تغییری نمی‌کنند) */
export function breadcrumbLd(items: { name: string; path: string }[], id?: string) {
  return {
    "@type": "BreadcrumbList",
    ...(id ? { "@id": id } : {}),
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

/** خروجی نهایی: یک graph با چند نوع */
export const ldGraph = (...nodes: object[]) => JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
