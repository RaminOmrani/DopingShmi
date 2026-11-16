import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { canonicalUrl, pageMeta } from "@/lib/page-meta";
import { chapterPath, isLive, TOOL_PATHS } from "@/lib/site-routes";
import { ElementList } from "@/components/tools/ElementList";
import { PeriodicTable } from "@/components/tools/PeriodicTable";
import { ToolPage } from "@/components/tools/ToolPage";
import { PERIODIC } from "@/content/tools/periodic";

/**
 * «جدول تناوبی فارسی» (/jadval-tanavobi، موج ۲): جدول تعاملی (جزیره‌ی کلاینت)، فهرست نام فارسی عنصرها و راهنما.
 * داده‌ی کامل عنصرها فقط در همین صفحه بارگیری می‌شود. چاپ: فقط جدول (و در حالت کامل، فهرست نام‌ها) در صفحه‌ی افقی.
 * صفحه ایستاست؛ تا live نشدن مسیر در site-routes، pageMeta آن را noindex می‌کند.
 */
export const revalidate = 300;

const PATH = TOOL_PATHS.periodic;

export const metadata: Metadata = pageMeta({ title: PERIODIC.title, description: PERIODIC.description, path: PATH });

/** تنظیم صفحه‌ی چاپ (افقی)؛ با تیلویند ممکن نیست و globals.css مال بسته‌ی دیگری است، پس با <style> قابل‌انتقال React */
const PRINT_PAGE_CSS = "@media print{@page{size:A4 landscape;margin:8mm}}";

export default async function PeriodicTablePage() {
  const s = await getSetting("site");
  return (
    <ToolPage
      s={s}
      content={PERIODIC}
      path={PATH}
      wide
      howToClassName="print:hidden"
      guideClassName="print:hidden"
      widget={
        <>
          <style href="jadval-tanavobi-print" precedence="default">
            {PRINT_PAGE_CSS}
          </style>
          <p className="mb-2 hidden text-[9px] print:block">
            {s.brand} · <bdi dir="ltr">{canonicalUrl(PATH).replace(/^https?:\/\//, "")}</bdi>
          </p>
          <PeriodicTable molarMassPath={isLive(TOOL_PATHS.molarMass) ? TOOL_PATHS.molarMass : null} />
        </>
      }
      beforeGuide={
        <section
          id="nam-anasor"
          aria-labelledby="nam-anasor-h"
          className="mb-14 scroll-mt-28 print:break-before-page [html[data-pt-print=blank]_&]:print:hidden"
        >
          <h2 id="nam-anasor-h" className="mb-4 text-2xl font-black md:text-3xl print:text-base">
            نام عناصر جدول تناوبی به فارسی
          </h2>
          <p className="mb-5 max-w-3xl leading-9 text-white/75 print:hidden">
            فهرست کامل ۱۱۸ عنصر با نام فارسی، نام انگلیسی، نماد و جرم اتمی. با زدن روی سر هر ستون، فهرست بر اساس همان ستون مرتب می‌شود؛ مثلاً
            برای پیدا کردن عنصرها به ترتیب الفبای فارسی، روی «نام فارسی» بزنید. نام‌ها به املای رایج کتاب‌های درسی نوشته شده‌اند و برای
            عنصرهای پرتوزای بدون جرم استاندارد، عدد جرمی پایدارترین ایزوتوپ در کروشه آمده است.
          </p>
          <ElementList />
        </section>
      }
      related={[
        { path: chapterPath("G10", 1), desc: "عدد اتمی، ایزوتوپ و آرایش الکترونی" },
        { path: chapterPath("G11", 1), desc: "روندهای تناوبی و عنصرهای دسته‌ی d" },
        { path: TOOL_PATHS.molarMass, desc: "جرم مولی ترکیب‌ها از روی جرم اتمی" },
        { path: TOOL_PATHS.balance, desc: "موازنه‌ی معادله‌ی واکنش" },
        { path: TOOL_PATHS.formulas, desc: "فرمول‌های مهم هر فصل" },
      ]}
    />
  );
}
