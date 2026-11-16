import { Target } from "lucide-react";
import { Chem, ChemText, Eq, chemTextPlain } from "@/components/seo/Chem";
import { Callout } from "@/components/seo/EduChrome";
import { faNum } from "@/lib/utils";
import type { ChapterContent, ChapterFormula, ChapterSection } from "@/content/chapters/types";
import { SampleExam } from "./SampleExam";

/**
 * بدنه‌ی آموزشی صفحه‌ی فصل (بدون داده‌ی سرور): مقدمه، «در یک نگاه»، بخش‌ها با رابطه، مثال و اشتباه رایج،
 * نکته‌های تستی، «نکته استاد» (فقط با متن خود استاد) و نمونه سؤال‌ها. خالص است و در آزمون‌ها هم رندر می‌شود.
 */
export const TIPS_ID = "nokat-testi";
export const EXAM_ID = "nemoone-soal";

function FormulaBox({ f }: { f: ChapterFormula }) {
  return (
    <figure className="card my-5 p-5 print:break-inside-avoid">
      <figcaption className="mb-3 text-sm font-black text-cyan">رابطه‌ی کلیدی</figcaption>
      <div dir="ltr" className="overflow-x-auto py-1 text-center text-lg sm:text-xl">
        <Chem f={f.f} />
      </div>
      <dl className="mt-4 grid gap-1.5 text-sm leading-7 text-white/75">
        {f.vars.map((v) => (
          <div key={v.sym} className="flex gap-2">
            <dt className="shrink-0 font-bold">
              <Chem f={v.sym} />:
            </dt>
            <dd>
              <ChemText text={v.desc} />
            </dd>
          </div>
        ))}
      </dl>
      {f.note && (
        <p className="mt-3 text-sm leading-7 text-white/65">
          <ChemText text={f.note} />
        </p>
      )}
    </figure>
  );
}

function SectionBlock({ s, index }: { s: ChapterSection; index: number }) {
  return (
    <section id={s.id} className="mb-12 scroll-mt-28">
      <h2 className="mb-4 text-2xl font-black leading-10">
        <span className="text-cyan">{faNum(index + 1)}. </span>
        <ChemText text={s.heading} />
      </h2>
      {s.paragraphs.map((p, i) => (
        <p key={i} className="mb-4 leading-9 text-white/75">
          <ChemText text={p} />
        </p>
      ))}
      {s.bullets && (
        <ul className="mb-4 list-disc space-y-1.5 pr-6 leading-8 text-white/75 marker:text-cyan">
          {s.bullets.map((b, i) => (
            <li key={i}>
              <ChemText text={b} />
            </li>
          ))}
        </ul>
      )}
      {s.equations?.map((e) => (
        <Eq key={e} f={e} />
      ))}
      {s.formula && <FormulaBox f={s.formula} />}
      {s.example && (
        <Callout kind="example" title="مثال حل‌شده">
          <p className="mb-2">
            <ChemText text={s.example.question} />
          </p>
          <ol className="mb-2 list-[persian] space-y-1 pr-5 marker:text-teal">
            {s.example.steps.map((st, i) => (
              <li key={i}>
                <ChemText text={st} />
              </li>
            ))}
          </ol>
          <p className="font-bold">
            پاسخ: <ChemText text={s.example.answer} />
          </p>
        </Callout>
      )}
      {s.mistake && (
        <Callout kind="mistake">
          <p>
            <ChemText text={s.mistake} />
          </p>
        </Callout>
      )}
    </section>
  );
}

/** label مثل «فصل اول شیمی دهم» (chapterLabel) */
export function ChapterBody({ c, label }: { c: ChapterContent; label: string }) {
  const topicOf = (id: string) => {
    const s = c.sections.find((x) => x.id === id);
    return s ? chemTextPlain(s.heading) : undefined;
  };
  return (
    <>
      <p className="mb-8 leading-9 text-white/80">
        <ChemText text={c.intro} />
      </p>

      <nav aria-labelledby="dar-yek-negah" className="card mb-12 p-5 print:hidden">
        <h2 id="dar-yek-negah" className="mb-3 text-lg font-black">در یک نگاه</h2>
        <ol className="grid list-[persian] gap-1.5 pr-5 text-sm leading-7 text-white/75 marker:text-cyan sm:grid-cols-2">
          {c.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:text-cyan">
                <ChemText text={s.heading} />
              </a>
            </li>
          ))}
          <li>
            <a href={`#${TIPS_ID}`} className="hover:text-cyan">نکته‌های تستی</a>
          </li>
          <li>
            <a href={`#${EXAM_ID}`} className="hover:text-cyan">نمونه سوال امتحانی با جواب</a>
          </li>
        </ol>
      </nav>

      {c.sections.map((s, i) => (
        <SectionBlock key={s.id} s={s} index={i} />
      ))}

      <section id={TIPS_ID} className="mb-12 scroll-mt-28 print:break-inside-avoid">
        <h2 className="mb-5 text-2xl font-black leading-10">نکته‌های تستی {label}</h2>
        <ul className="grid gap-3">
          {c.konkurTips.map((t, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-violet/30 bg-violet/10 px-4 py-3 text-sm leading-8 text-white/80">
              <Target aria-hidden className="mt-2 size-4 shrink-0 text-violet" />
              <span>
                <ChemText text={t} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Callout kind="teacher">
        {c.teacherNotes.length
          ? c.teacherNotes.map((t, i) => (
              <p key={i}>
                <ChemText text={t} />
              </p>
            ))
          : null}
      </Callout>

      <SampleExam id={EXAM_ID} title={`نمونه سوال امتحانی ${label} با جواب`} questions={c.sampleQuestions} topicOf={topicOf} />
    </>
  );
}
