import { ChemText } from "@/components/seo/Chem";
import { faNum } from "@/lib/utils";
import type { SampleQuestion } from "@/content/chapters/types";
import { PrintButton } from "./PrintButton";

/**
 * نمونه سؤال‌های امتحانی با پاسخ‌نامه: اول همه‌ی سؤال‌ها، بعد پاسخ هر سؤال در یک <details> که در HTML سرور هست.
 * در چاپ، پاسخ‌ها باز می‌شوند (کلاس print و PrintButton) و ترتیب «سؤال‌ها، سپس پاسخ‌نامه» حفظ می‌شود.
 */
export function SampleExam({
  id,
  title,
  questions,
  topicOf,
}: {
  id: string;
  title: string;
  questions: SampleQuestion[];
  /** عنوان زیرفصل هر سؤال (از روی subtopic) */
  topicOf?: (subtopic: string) => string | undefined;
}) {
  if (!questions.length) return null;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mb-12 scroll-mt-28 print:break-before-page">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="text-2xl font-black leading-10">{title}</h2>
        <PrintButton targetId={id} />
      </div>
      <p className="mb-5 text-sm leading-7 text-white/60 print:hidden">
        اول خودتان روی کاغذ پاسخ دهید، بعد پاسخ‌نامه‌ی پایین صفحه را باز کنید. این سؤال‌ها را تیم دوپینگ شیمی برای تمرین نوشته است.
      </p>
      <ol className="grid gap-3">
        {questions.map((q, i) => {
          const topic = topicOf?.(q.subtopic);
          return (
            <li key={i} id={`${id}-q${i + 1}`} className="card scroll-mt-28 p-5 print:break-inside-avoid print:p-3">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-white/50 print:hidden">
                <span className="chip">{q.kind}</span>
                {topic && <span>{topic}</span>}
              </p>
              <p className="leading-8">
                <span className="font-black text-cyan">{faNum(i + 1)}. </span>
                <ChemText text={q.q} />
              </p>
              <a href={`#${id}-a${i + 1}`} className="mt-2 inline-block text-xs text-cyan hover:underline print:hidden">
                پاسخ سؤال {faNum(i + 1)}
              </a>
            </li>
          );
        })}
      </ol>
      <h3 className="mb-4 mt-8 text-xl font-black print:break-before-page">پاسخ‌نامه</h3>
      <ol className="grid gap-2">
        {questions.map((q, i) => {
          const parts = Array.isArray(q.answer) ? q.answer : [q.answer];
          return (
            <li key={i} id={`${id}-a${i + 1}`} className="scroll-mt-28 print:break-inside-avoid">
              <details className="card p-4 print:p-3 print:details-content:[content-visibility:visible]">
                <summary className="cursor-pointer font-bold">پاسخ سؤال {faNum(i + 1)}</summary>
                <div className="mt-3 space-y-2 leading-8 text-white/75">
                  {parts.map((a, j) => (
                    <p key={j}>
                      <ChemText text={a} />
                    </p>
                  ))}
                  <a href={`#${id}-q${i + 1}`} className="inline-block text-xs text-cyan hover:underline print:hidden">
                    بازگشت به سؤال {faNum(i + 1)}
                  </a>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
