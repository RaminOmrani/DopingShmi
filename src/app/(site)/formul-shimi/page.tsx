import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { GRADE_PAGES } from "@/lib/syllabus";
import { canonicalUrl, eduGraph, pageMeta } from "@/lib/page-meta";
import { GRADE_KEYS, QUIZ_HUB, TOOL_PATHS, crumbsFor, gradeName } from "@/lib/site-routes";
import { JsonLd } from "@/components/JsonLd";
import { chemTextPlain } from "@/components/seo/Chem";
import { Breadcrumbs, Byline, RelatedLinks, SoftCta } from "@/components/seo/EduChrome";
import { FORMULA_PAGE, allFormulas } from "@/content/formulas";
import { FormulaSheet } from "./FormulaSheet";
import { PrintButton } from "./PrintButton";

/**
 * برگه‌ی فرمول‌های شیمی دبیرستان و کنکور (/formul-shimi): رابطه‌های هر فصل با متغیر، یکا، کاربرد و مثال.
 * تا وقتی مسیر در site-routes live نشده، pageMeta آن را خودکار noindex می‌کند.
 */
export const revalidate = 300;

const PATH = TOOL_PATHS.formulas;

export const metadata: Metadata = pageMeta({
  title: FORMULA_PAGE.title,
  description: FORMULA_PAGE.description,
  path: PATH,
  type: "article",
});

export default async function FormulaSheetPage() {
  const s = await getSetting("site");
  const crumbs = crumbsFor(PATH);
  const ld = eduGraph(s, {
    path: PATH,
    title: FORMULA_PAGE.h1,
    description: FORMULA_PAGE.description,
    type: ["Article", "LearningResource"],
    breadcrumb: crumbs,
    educationalLevel: GRADE_KEYS.map((g) => `پایه‌ی ${gradeName(g)}`),
    about: "فرمول‌های شیمی دبیرستان",
    teaches: allFormulas().map((f) => chemTextPlain(f.name)),
    extra: { learningResourceType: "برگه‌ی فرمول و خلاصه‌ی رابطه‌ها" },
  });

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32 print:max-w-none print:px-0 print:pt-0">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <p className="mb-1 hidden text-xs print:block">
        {s.brand} · <bdi dir="ltr">{canonicalUrl(PATH).replace(/^https?:\/\//, "")}</bdi>
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="section-title leading-tight print:text-2xl">{FORMULA_PAGE.h1}</h1>
        <PrintButton />
      </div>
      <Byline s={s} path={PATH} className="print:mb-3" />

      <FormulaSheet />

      <RelatedLinks
        title="صفحه‌های مرتبط"
        links={[
          { path: TOOL_PATHS.molarMass, desc: "جرم مولی هر ترکیب با جزئیات محاسبه" },
          { path: TOOL_PATHS.balance, desc: "موازنه‌ی معادله و تمرین روش وارسی" },
          { path: TOOL_PATHS.ph, desc: "pH محلول اسیدها و بازهای قوی و ضعیف" },
          { path: TOOL_PATHS.periodic, desc: "نام فارسی عنصرها و جرم اتمی" },
          { path: QUIZ_HUB, desc: "آزمون آنلاین و رایگان هر فصل" },
          ...GRADE_KEYS.map((g) => ({ path: GRADE_PAGES[g].path, desc: `فصل‌به‌فصل شیمی ${gradeName(g)}` })),
          { path: "/shimi-konkur", desc: "نقشه‌ی راه شیمی کنکور" },
        ]}
      />

      <SoftCta s={s} />
    </main>
  );
}
