import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/settings";
import { eduGraph } from "@/lib/page-meta";
import { crumbsFor } from "@/lib/site-routes";
import { JsonLd } from "@/components/JsonLd";
import { chemTextPlain } from "@/components/seo/Chem";
import { Breadcrumbs, Byline, Callout, RelatedLinks, SoftCta, type RelatedLink } from "@/components/seo/EduChrome";
import type { ToolContent } from "@/content/tools/types";
import { cn, faNum } from "@/lib/utils";
import { RichText } from "./RichText";
import { ToolGuide } from "./ToolGuide";

/**
 * پوسته‌ی سروری مشترک صفحه‌های ابزار: JSON-LD (WebApplication + BreadcrumbList)، مسیر راهنما، H1، امضا،
 * معرفی، جزیره‌ی ابزار (widget)، «روش استفاده»، راهنمای آموزشی، لینک‌های مرتبط و یک دعوت ملایم به کلاس.
 * متن «روش استفاده» و راهنما در HTML سرور است؛ فقط بخش تعاملی کلاینت است.
 */
export function ToolPage({
  s,
  content: c,
  path,
  widget,
  beforeGuide,
  afterGuide,
  related,
  wide,
  guideClassName,
  howToClassName,
  slots,
}: {
  s: SiteContent;
  content: ToolContent;
  path: string;
  widget: ReactNode;
  beforeGuide?: ReactNode;
  afterGuide?: ReactNode;
  related: (string | RelatedLink)[];
  /** صفحه‌ی پهن‌تر (جدول تناوبی) */
  wide?: boolean;
  guideClassName?: string;
  howToClassName?: string;
  /** محتوای اضافه داخل بخش‌های راهنما (کلید: id بخش) */
  slots?: Record<string, ReactNode>;
}) {
  const crumbs = crumbsFor(path);
  const ld = eduGraph(s, {
    path,
    title: c.h1,
    description: c.description,
    type: "WebApplication",
    breadcrumb: crumbs,
    educationalLevel: c.educationalLevel,
    about: c.about,
    teaches: c.sections.map((x) => chemTextPlain(x.heading)),
    extra: {
      applicationCategory: "EducationalApplication",
      operatingSystem: "All",
      browserRequirements: "Requires JavaScript",
      featureList: c.features,
      offers: { "@type": "Offer", price: "0", priceCurrency: "IRR" },
    },
  });

  return (
    <main className={cn("mx-auto px-5 pb-10 pt-32 print:max-w-none print:px-0 print:pt-0", wide ? "max-w-7xl" : "max-w-5xl")}>
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <h1 className="section-title mb-4 leading-tight print:text-2xl">{c.h1}</h1>
      <Byline s={s} path={path} className="print:hidden" />
      <p className="mb-8 max-w-3xl leading-9 text-white/75 print:hidden">
        <RichText text={c.lead} />
      </p>

      {widget}

      <section aria-labelledby="how-to-h" className={cn("my-14", howToClassName)}>
        <h2 id="how-to-h" className="mb-5 text-2xl font-black md:text-3xl">
          روش استفاده
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {c.howTo.map((step, i) => (
            <li key={i} className="card flex gap-3 p-5 text-sm leading-8 text-white/75">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan/15 font-black text-cyan">
                {faNum(i + 1)}
              </span>
              <span>
                <RichText text={step} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      {beforeGuide}

      <div className={guideClassName}>
        <p className="mb-8 text-sm font-bold text-teal">{c.guideTitle}</p>
        <ToolGuide sections={c.sections} slots={slots} />
        {c.teacherNotes.map((t, i) => (
          <Callout key={i} kind="teacher" className="max-w-3xl">
            <RichText text={t} />
          </Callout>
        ))}
      </div>

      {afterGuide}

      <RelatedLinks title="ابزارها و فصل‌های مرتبط" links={related} />
      <SoftCta s={s} />
    </main>
  );
}
