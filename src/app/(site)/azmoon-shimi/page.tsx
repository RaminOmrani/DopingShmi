import type { Metadata } from "next";
import { ChevronLeft, ListChecks } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { canonicalUrl, eduGraph, itemListLd, pageMeta } from "@/lib/page-meta";
import { ldRef } from "@/lib/seo";
import { GRADE_PAGES } from "@/lib/syllabus";
import { GRADE_KEYS, QUIZ_HUB, chapterCount, chapterTitle, crumbsFor, faslWord, gradeName, quizLabel, quizPath, type Crumb } from "@/lib/site-routes";
import { faNum } from "@/lib/utils";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Byline, RouteLink, SoftCta } from "@/components/seo/EduChrome";
import { QuizText } from "@/components/quiz/QuizText";
import { getQuiz, quizLinkable } from "@/content/quizzes";

export const revalidate = 300;

// حداکثر ۶۰ نویسه (عنوان پیشنهادی برنامه با «و» ۶۱ نویسه بود)
const TITLE = "آزمون آنلاین شیمی رایگان؛ دهم، یازدهم، دوازدهم | دوپینگ شیمی";
const H1 = "آزمون آنلاین شیمی رایگان";
const DESCRIPTION =
  "آزمون آنلاین رایگان شیمی دهم، یازدهم و دوازدهم، فصل‌به‌فصل: تست چهارگزینه‌ای با پاسخ تشریحی، درصد با و بدون نمره‌ی منفی و بدون ثبت‌نام.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: QUIZ_HUB });

/** فصل‌های هر پایه با وضعیت قابل لینک بودن آزمونشان */
const chaptersOf = (g: (typeof GRADE_KEYS)[number]) =>
  Array.from({ length: chapterCount(g) }, (_, i) => {
    const n = i + 1;
    return { n, path: quizPath(g, n), title: chapterTitle(g, n), count: getQuiz(g, n)?.questions.length ?? 0, linkable: quizLinkable(g, n) };
  });

export default async function QuizHub() {
  const s = await getSetting("site");
  const crumbs = crumbsFor(QUIZ_HUB);
  const live: Crumb[] = GRADE_KEYS.flatMap((g) => chaptersOf(g).filter((c) => c.linkable).map((c) => ({ name: quizLabel(g, c.n), path: c.path })));
  const listId = `${canonicalUrl(QUIZ_HUB)}#list`;
  const ld = eduGraph(s, {
    path: QUIZ_HUB,
    title: H1,
    description: DESCRIPTION,
    type: "CollectionPage",
    breadcrumb: crumbs,
    educationalLevel: GRADE_KEYS.map((g) => `پایه‌ی ${gradeName(g)}`),
    about: "شیمی دبیرستان",
    extra: live.length ? { mainEntity: ldRef(listId) } : undefined,
    nodes: live.length ? [itemListLd("آزمون‌های آنلاین فصل‌به‌فصل شیمی", live, listId)] : [],
  });

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <h1 className="section-title mb-4">
        آزمون آنلاین شیمی <span className="text-gradient">رایگان</span>
      </h1>
      <Byline s={s} path={QUIZ_HUB} />
      <div className="mb-10 max-w-3xl space-y-4 leading-9 text-white/75">
        <p>
          در این صفحه برای هر فصل از کتاب‌های شیمی دهم، یازدهم و دوازدهم یک آزمون آنلاین رایگان پیدا می‌کنید. هر آزمون ۱۲ تا ۱۵ تست چهارگزینه‌ای تألیفی دارد که همه‌ی
          زیرفصل‌های همان فصل را پوشش می‌دهد و برای تک‌تک سؤال‌ها پاسخ تشریحی نوشته شده است. برای شرکت در آزمون‌ها لازم نیست ثبت‌نام کنید یا شماره‌ی تلفن بدهید.
        </p>
      </div>

      {GRADE_KEYS.map((g) => (
        <section key={g} className="mb-10" aria-labelledby={`grade-${g}`}>
          <h2 id={`grade-${g}`} className="mb-4 text-2xl font-black">
            آزمون آنلاین شیمی {gradeName(g)}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chaptersOf(g).map((c) => {
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="block font-bold">فصل {faslWord(c.n)}: {c.title}</span>
                    {c.linkable && <span className="mt-1 block text-xs leading-6 text-white/55">{faNum(c.count)} سؤال · پاسخ تشریحی</span>}
                  </span>
                  {c.linkable ? <ChevronLeft aria-hidden className="size-4 shrink-0 text-white/40" /> : <span className="chip shrink-0">به‌زودی</span>}
                </>
              );
              return c.linkable ? (
                <RouteLink key={c.n} path={c.path} title={quizLabel(g, c.n)} className="card flex items-center justify-between gap-3 p-4 hover:border-cyan/30">
                  {body}
                </RouteLink>
              ) : (
                <div key={c.n} className="card flex items-center justify-between gap-3 p-4 opacity-60">
                  {body}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-white/60">
            <RouteLink path={GRADE_PAGES[g].path} className="text-cyan hover:underline">
              سرفصل‌ها و آموزش شیمی {gradeName(g)}
            </RouteLink>
          </p>
        </section>
      ))}

      <section className="mb-10 max-w-3xl leading-9 text-white/75" aria-labelledby="how">
        <h2 id="how" className="mb-4 flex items-center gap-2 text-2xl font-black text-white">
          <ListChecks aria-hidden className="size-6 text-cyan" /> این آزمون‌ها چطور کار می‌کنند؟
        </h2>
        <ul className="list-disc space-y-2 pr-6 marker:text-cyan">
          <li>سؤال‌ها را در همان صفحه جواب می‌دهید و با دکمه‌ی «تصحیح آزمون» نتیجه را می‌بینید: شمار پاسخ‌های درست، نادرست و بی‌پاسخ و درصد شما.</li>
          <li>زمان‌سنج اختیاری است و برای هر سؤال یک دقیقه در نظر می‌گیرد؛ اگر روشنش کنید، با پایان زمان پاسخ‌نامه خودکار تصحیح می‌شود.</li>
          <li>بعد از تصحیح، پاسخ درست هر سؤال مشخص می‌شود و پاسخ تشریحی سؤال‌هایی که اشتباه زده‌اید یا بی‌پاسخ گذاشته‌اید باز می‌شود.</li>
          <li>آخرین نتیجه فقط در مرورگر خودتان ذخیره می‌شود و چیزی به سایت فرستاده نمی‌شود؛ هر چند بار که بخواهید می‌توانید آزمون را تکرار کنید.</li>
        </ul>
      </section>

      <section className="mb-10 max-w-3xl leading-9 text-white/75" aria-labelledby="negative">
        <h2 id="negative" className="mb-4 text-2xl font-black text-white">نمره‌ی منفی چیست و چطور حساب می‌شود؟</h2>
        <p className="mb-4">
          در آزمون‌های چهارگزینه‌ای مثل کنکور و آزمون‌های آزمایشی، معمولاً هر پاسخ نادرست یک‌سوم نمره‌ی یک پاسخ درست را کم می‌کند تا حدس زدن بی‌حساب به سود داوطلب نباشد.
          درصد با نمره‌ی منفی این‌طور حساب می‌شود: سه برابر شمار پاسخ‌های درست را منهای شمار پاسخ‌های نادرست می‌کنیم و حاصل را بر سه برابر شمار کل سؤال‌ها تقسیم می‌کنیم.
        </p>
        <p>
          <QuizText text="برای نمونه، در آزمونی با ۱۵ سؤال که ۹ پاسخ درست و ۳ پاسخ نادرست دارد، درصد با نمره‌ی منفی [[(۲۷ − ۳) ÷ ۴۵]] یعنی حدود ۵۳٫۳ درصد است، ولی بدون نمره‌ی منفی ۶۰ درصد می‌شود. سؤال بی‌پاسخ نمره‌ای کم نمی‌کند. نتیجه‌ی آزمون‌های این صفحه همیشه هر دو درصد را نشان می‌دهد." />
        </p>
      </section>

      <section className="mb-10 max-w-3xl leading-9 text-white/75" aria-labelledby="nobat">
        <h2 id="nobat" className="mb-4 text-2xl font-black text-white">آزمون آنلاین برای امتحان نوبت اول</h2>
        <p>
          بعد از خواندن هر فصل و حل تمرین‌های کتاب درسی، آزمون همان فصل را بزنید. سؤال‌هایی را که اشتباه زده‌اید یادداشت کنید و چند روز بعد آزمون را تکرار کنید؛ اگر درصدتان بالا
          رفت، مبحث جا افتاده است. امتحان‌های مدرسه معمولاً تشریحی‌اند، پس پاسخ تشریحی سؤال‌ها را دقیق بخوانید و روش حل مسئله‌ها را با واحد روی کاغذ بنویسید.
        </p>
      </section>

      <section className="mb-10 max-w-3xl leading-9 text-white/75" aria-labelledby="konkur">
        <h2 id="konkur" className="mb-4 text-2xl font-black text-white">آزمون آنلاین برای کنکور</h2>
        <p>
          برای آمادگی کنکور، آزمون‌ها را با زمان‌سنج روشن و نمره‌ی منفی بزنید تا به مدیریت زمان و پرهیز از حدس بی‌پشتوانه عادت کنید. هر آزمون یک فصل را می‌سنجد؛ در دوره‌ی
          جمع‌بندی، آزمون چند فصل را پشت سر هم بزنید و درصد هر فصل را جدا یادداشت کنید تا فصل‌های ضعیف‌تر معلوم شوند. برنامه‌ی مطالعه را در صفحه‌ی{" "}
          <RouteLink path="/shimi-konkur" className="font-bold text-cyan hover:underline">
            شیمی کنکور
          </RouteLink>{" "}
          ببینید.
        </p>
      </section>

      <SoftCta s={s} />
    </main>
  );
}
