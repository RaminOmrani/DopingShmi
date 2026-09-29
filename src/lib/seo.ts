import "server-only";
import type { SiteContent } from "./settings";

export const SITE_URL = (process.env.SITE_URL || "https://dopingshimi.ir").replace(/\/$/, "");
export const abs = (path = "/") => (/^https?:/.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

/** کلمات کلیدی اصلی که باید در متن‌ها و عنوان‌ها بیایند */
export const KEYWORDS = [
  "دوپینگ شیمی", "جواد پرتویی", "استاد جواد پرتویی", "تدریس شیمی", "تدریس شیمی کنکور", "معلم شیمی مشهد",
  "دبیر شیمی مشهد", "کلاس خصوصی شیمی", "کلاس شیمی کنکور مشهد", "همایش شیمی", "آموزش شیمی دوازدهم", "آموزش شیمی دهم", "آموزش شیمی یازدهم",
];

const socials = (s: SiteContent) => [s.instagram, s.telegram, s.bale].filter((x) => x && /^https?:/.test(x));

/** شخص: استاد جواد پرتویی */
export function personLd(s: SiteContent, image?: string) {
  return {
    "@type": "Person",
    "@id": `${SITE_URL}/#teacher`,
    name: s.teacherName,
    alternateName: [`استاد ${s.teacherName}`, "Javad Partovi"],
    jobTitle: "دبیر شیمی و مدرس شیمی کنکور",
    description: s.aboutText,
    url: `${SITE_URL}/javad-partovi`,
    image: image ? abs(image) : undefined,
    telephone: s.phone || undefined,
    alumniOf: { "@type": "CollegeOrUniversity", name: "دانشگاه فردوسی مشهد" },
    memberOf: { "@type": "Organization", name: "بنیاد ملی نخبگان" },
    worksFor: { "@id": `${SITE_URL}/#org` },
    knowsAbout: ["شیمی", "شیمی کنکور", "شیمی دبیرستان", "تست شیمی"],
    address: { "@type": "PostalAddress", addressLocality: s.city || "مشهد", addressCountry: "IR" },
    sameAs: socials(s),
  };
}

/** مؤسسه آموزشی: دوپینگ شیمی */
export function orgLd(s: SiteContent) {
  return {
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#org`,
    name: s.brand,
    alternateName: ["Doping Shimi", "دوپینگ شیمی جواد پرتویی"],
    url: SITE_URL,
    logo: abs("/brand/dp-logo-light.svg"),
    image: abs("/og.png"),
    description: s.seoDescription,
    founder: { "@id": `${SITE_URL}/#teacher` },
    telephone: s.phone || undefined,
    address: { "@type": "PostalAddress", streetAddress: s.address || undefined, addressLocality: s.city || "مشهد", addressCountry: "IR" },
    areaServed: [s.city || "مشهد", "ایران"],
    sameAs: socials(s),
  };
}

export function websiteLd(s: SiteContent) {
  return { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: s.brand, alternateName: ["Doping Shimi", "dopingshimi.ir"], inLanguage: "fa-IR", publisher: { "@id": `${SITE_URL}/#org` } };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

/** خروجی نهایی: یک graph با چند نوع */
export const ldGraph = (...nodes: object[]) => JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
