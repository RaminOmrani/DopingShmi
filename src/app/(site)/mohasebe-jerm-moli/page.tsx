import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { pageMeta } from "@/lib/page-meta";
import { chapterPath, TOOL_PATHS } from "@/lib/site-routes";
import { faDigits } from "@/lib/chem/common";
import { molarMass } from "@/lib/chem/molar-mass";
import { Chem } from "@/components/seo/Chem";
import { AverageMassTool } from "@/components/tools/AverageMassTool";
import { MolarMassTool } from "@/components/tools/MolarMassTool";
import { ToolPage } from "@/components/tools/ToolPage";
import { COMPOUNDS, MOLAR_MASS, MOLAR_MASS_DEFAULT, MOLAR_MASS_EXAMPLES } from "@/content/tools/molar-mass";

/**
 * ابزار «محاسبه جرم مولی» (/mohasebe-jerm-moli): ماشین‌حساب (جزیره‌ی کلاینت) + راهنما + جدول ترکیب‌ها.
 * صفحه ایستاست (searchParams خوانده نمی‌شود)؛ تا live نشدن مسیر در site-routes، pageMeta آن را noindex می‌کند.
 */
export const revalidate = 300;

const PATH = TOOL_PATHS.molarMass;

export const metadata: Metadata = pageMeta({ title: MOLAR_MASS.title, description: MOLAR_MASS.description, path: PATH });

/** مقدار جرم مولی برای جدول (در زمان build؛ فرمول نامعتبر = خطای build) */
function mm(f: string, mode: "precise" | "exam") {
  const r = molarMass(f, { mode });
  if (!r.ok) throw new Error(`جرم مولی ${f} حساب نشد: ${r.error}`);
  return r.valueText;
}

export default async function MolarMassPage() {
  const s = await getSetting("site");
  const rows = COMPOUNDS.map((c) => ({ ...c, precise: mm(c.f, "precise"), exam: mm(c.f, "exam") }));

  return (
    <ToolPage
      s={s}
      content={MOLAR_MASS}
      path={PATH}
      widget={<MolarMassTool examples={MOLAR_MASS_EXAMPLES} initial={MOLAR_MASS_DEFAULT} />}
      slots={{ "jerm-atomi-miangin": <AverageMassTool /> }}
      afterGuide={
        <section id="jadval-jerm-moli" aria-labelledby="jadval-jerm-moli-h" className="mb-14 scroll-mt-28">
          <h2 id="jadval-jerm-moli-h" className="mb-4 text-2xl font-black md:text-3xl">
            جدول جرم مولی ترکیب‌های پرکاربرد
          </h2>
          <p className="mb-5 max-w-3xl leading-9 text-white/75">
            جرم مولی ترکیب‌هایی که در کتاب‌های شیمی دبیرستان و مسئله‌ها زیاد دیده می‌شوند، با همان روش ماشین‌حساب بالا. ستون «دقیق» با
            جرم‌های استاندارد جدول دوره‌ای و ستون «امتحانی» با جرم‌های گردشده (مثل <Chem f="Cl = 35.5" /> و <Chem f="Cu = 64" />) حساب
            شده است؛ در مسئله همیشه جرم‌های داده‌شده در سؤال را به کار ببرید.
          </p>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">جرم مولی ترکیب‌های پرکاربرد بر حسب گرم بر مول</caption>
              <thead>
                <tr>
                  <th scope="col">ماده</th>
                  <th scope="col">فرمول</th>
                  <th scope="col">جرم مولی دقیق</th>
                  <th scope="col">جرم مولی امتحانی</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.f}>
                    <td>{r.fa}</td>
                    <td className="font-bold">
                      <Chem f={r.f} />
                    </td>
                    <td>{faDigits(r.precise)}</td>
                    <td>{faDigits(r.exam)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-6 text-white/50">همه‌ی مقدارها بر حسب گرم بر مول‌اند.</p>
        </section>
      }
      related={[
        { path: chapterPath("G10", 1), desc: "مول، جرم اتمی میانگین و جرم مولی" },
        { path: chapterPath("G10", 2), desc: "استوکیومتری و حجم مولی گازها" },
        { path: chapterPath("G10", 3), desc: "غلظت مولار و محلول‌ها" },
        { path: TOOL_PATHS.balance, desc: "موازنه‌ی معادله پیش از محاسبه‌ی استوکیومتری" },
        { path: TOOL_PATHS.periodic, desc: "جرم اتمی و نام فارسی همه‌ی عنصرها" },
        { path: TOOL_PATHS.ph, desc: "pH محلول اسیدها و بازها" },
        { path: TOOL_PATHS.formulas, desc: "رابطه‌های مول و غلظت در یک برگه" },
      ]}
    />
  );
}
