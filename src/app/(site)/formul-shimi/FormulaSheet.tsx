import { Fragment } from "react";
import { ChevronLeft } from "lucide-react";
import { Chem, ChemText, Eq, hasArrow } from "@/components/seo/Chem";
import { RouteLink } from "@/components/seo/EduChrome";
import { FORMULA_PAGE, FORMULA_SHEET, chapterAnchor, type FormulaGrade, type FormulaItem } from "@/content/formulas";
import { TOOL_PATHS, chapterLabel, chapterPath, chapterTitle, faslWord, gradeName, isLive, label as routeLabel } from "@/lib/site-routes";
import type { GradeKey } from "@/lib/syllabus";
import { cn } from "@/lib/utils";

/**
 * بدنه‌ی برگه‌ی فرمول‌ها (بدون hook و بدون داده‌ی سرور؛ در آزمون هم رندر می‌شود).
 * هر رابطه یک کارت است: شکل نمادین یا کلامی، متغیرها و یکاها، کاربرد، مثال و لینک به فصل یا ابزار.
 * در چاپ: کارت‌ها دوستونه و بدون فهرست، لینک‌ها و دکمه‌ها.
 */

/** شکل نمادین: معادله با Eq؛ رابطه کنار « = » در چند تکه‌ی چپ‌به‌راست می‌شکند تا در گوشی بیرون نزند */
function FormulaLine({ f, className }: { f: string; className?: string }) {
  if (hasArrow(f)) return <Eq f={f} className={cn("!my-0", className)} />;
  const parts = f.split(" = ");
  return (
    <div dir="ltr" className={cn("flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1", className)}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span>=</span>}
          <Chem f={p} />
        </Fragment>
      ))}
    </div>
  );
}

/**
 * لینک هر رابطه: ابزار مرتبط اگر live باشد، وگرنه صفحه‌ی فصل؛ اگر هیچ‌کدام live نباشد چیزی نمایش داده نمی‌شود
 * (عنوان فصل بالای کارت‌ها هست و متن ساده‌ی تکراری فقط شلوغی است).
 */
function ItemLink({ item, g, n }: { item: FormulaItem; g: GradeKey; n: number }) {
  const cls = "inline-flex items-center gap-1 font-bold text-cyan underline-offset-4 hover:underline";
  const chapter = (
    <RouteLink path={chapterPath(g, n)} className={cls} fallback={null}>
      مرور در {chapterLabel(g, n)} <ChevronLeft aria-hidden className="size-3.5" />
    </RouteLink>
  );
  const tool = item.tool ? TOOL_PATHS[item.tool] : null;
  const link = tool ? (
    <RouteLink path={tool} className={cls} fallback={chapter}>
      {routeLabel(tool)} (ابزار آنلاین) <ChevronLeft aria-hidden className="size-3.5" />
    </RouteLink>
  ) : (
    chapter
  );
  if (!isLive(chapterPath(g, n)) && !(tool && isLive(tool))) return null;
  return <p className="mt-3 text-xs print:hidden">{link}</p>;
}

function FormulaCard({ item, g, n }: { item: FormulaItem; g: GradeKey; n: number }) {
  return (
    <article id={item.id} className="card scroll-mt-28 p-5 print:mb-3 print:break-inside-avoid print:p-3">
      <h4 className="mb-3 font-black text-white print:mb-1.5 print:text-[13px]">
        <ChemText text={item.name} />
      </h4>
      {item.f && (
        <div className="overflow-x-auto rounded-xl bg-white/5 px-3 py-3 text-base font-bold sm:text-lg print:py-1 print:text-sm">
          <FormulaLine f={item.f} />
        </div>
      )}
      {item.words && (
        <p className="rounded-xl bg-white/5 px-3 py-3 text-center text-sm font-bold leading-8 sm:text-base print:py-1 print:text-[12px] print:leading-6">
          <ChemText text={item.words} />
        </p>
      )}
      {item.alt?.map((a) => (
        <div key={a} className="mt-2 overflow-x-auto text-sm text-white/75 print:mt-1 print:text-[11px]">
          <FormulaLine f={a} />
        </div>
      ))}
      {item.table && (
        <div className="table-wrap mt-3">
          <table className="table text-xs sm:text-sm print:text-[10px]">
            <thead>
              <tr>
                {item.table.head.map((h) => (
                  <th key={h} scope="col"><ChemText text={h} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.table.rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((cell, i) => (
                    <td key={i}><ChemText text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {item.vars.length > 0 && (
        <dl className="mt-3 space-y-1 text-sm leading-7 text-white/75 print:mt-1.5 print:space-y-0 print:text-[11px] print:leading-5">
          {item.vars.map((v) => (
            <div key={v.sym} className="flex flex-wrap gap-x-1.5">
              <dt className="font-bold text-white"><ChemText text={v.sym} />:</dt>
              <dd>
                <ChemText text={v.desc} />
                {v.unit && (
                  <span className="text-white/55">
                    {" "}(<Chem f={v.unit} />)
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-sm leading-7 text-white/75 print:mt-1.5 print:text-[11px] print:leading-5">
        <span className="font-bold text-cyan">کاربرد: </span>
        <ChemText text={item.when} />
      </p>
      <p className="mt-2 text-sm leading-7 text-white/75 print:mt-1 print:text-[11px] print:leading-5">
        <span className="font-bold text-teal">مثال: </span>
        <ChemText text={item.example} />
      </p>
      {item.note && (
        <p className="mt-2 text-sm leading-7 text-white/65 print:mt-1 print:text-[11px] print:leading-5">
          <span className="font-bold text-amber">نکته: </span>
          <ChemText text={item.note} />
        </p>
      )}
      <ItemLink item={item} g={g} n={n} />
    </article>
  );
}

function GradeSection({ grade }: { grade: FormulaGrade }) {
  const g = grade.grade;
  return (
    <section id={grade.id} aria-labelledby={`${grade.id}-title`} className="mb-14 scroll-mt-28 print:mb-6">
      <h2 id={`${grade.id}-title`} className="mb-3 text-2xl font-black md:text-3xl print:text-lg">فرمول‌های شیمی {gradeName(g)}</h2>
      <p className="mb-6 leading-8 text-white/70 print:mb-2">
        <ChemText text={grade.lead} />
      </p>
      {grade.chapters.map((c) => (
        <div key={c.n} id={chapterAnchor(grade.id, c.n)} className="mb-8 scroll-mt-28 print:mb-3">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 print:mb-2">
            <h3 className="text-lg font-black text-white/90 print:text-base">
              فصل {faslWord(c.n)}: {chapterTitle(g, c.n)}
            </h3>
            <RouteLink path={chapterPath(g, c.n)} fallback={null} className="flex items-center gap-1 text-xs font-bold text-cyan hover:underline print:hidden">
              خلاصه و نمونه سوال {chapterLabel(g, c.n)} <ChevronLeft aria-hidden className="size-3.5" />
            </RouteLink>
          </div>
          <div className="grid gap-4 md:grid-cols-2 print:block print:columns-2 print:gap-x-4">
            {c.items.map((item) => (
              <FormulaCard key={item.id} item={item} g={g} n={c.n} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** فهرست پرش به پایه‌ها و فصل‌ها */
function SheetToc() {
  return (
    <nav aria-label="فهرست برگه" className="card mb-10 p-5 print:hidden">
      <p className="mb-3 font-black">فهرست</p>
      <ul className="grid gap-4 text-sm sm:grid-cols-3">
        {FORMULA_SHEET.map((gr) => (
          <li key={gr.id}>
            <a href={`#${gr.id}`} className="font-bold text-white hover:text-cyan">شیمی {gradeName(gr.grade)}</a>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-white/60">
              {gr.chapters.map((c) => (
                <li key={c.n}>
                  <a href={`#${chapterAnchor(gr.id, c.n)}`} className="hover:text-cyan">فصل {faslWord(c.n)}</a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** متن و رابطه‌های برگه (از مقدمه تا «کار با فرمول‌ها») */
export function FormulaSheet() {
  return (
    <div className="print:text-[12px] print:leading-6">
      <div className="mb-8 space-y-4 leading-9 text-white/75 print:hidden">
        {FORMULA_PAGE.intro.map((p) => (
          <p key={p}>
            <ChemText text={p} />
          </p>
        ))}
      </div>
      <SheetToc />
      {FORMULA_SHEET.map((grade) => (
        <GradeSection key={grade.id} grade={grade} />
      ))}
      <section aria-labelledby="kar-ba-formul" className="card mb-12 p-6 print:break-inside-avoid print:p-3">
        <h2 id="kar-ba-formul" className="mb-4 text-xl font-black print:text-base">کار با فرمول‌ها: سه عادت درست</h2>
        <ul className="list-disc space-y-2 pr-5 leading-8 text-white/75 marker:text-cyan">
          {FORMULA_PAGE.tips.map((t) => (
            <li key={t}>
              <ChemText text={t} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
