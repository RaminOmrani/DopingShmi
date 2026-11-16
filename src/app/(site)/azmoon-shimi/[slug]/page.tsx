import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, CheckCircle2, Clock, ListChecks, LogIn, UserX } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { eduGraph, pageMeta } from "@/lib/page-meta";
import { GRADE_PAGES } from "@/lib/syllabus";
import { QUIZ_HUB, chapterLabel, chapterPath, chapterTitle, crumbsFor, gradeName, parseQuizSlug, quizLabel, quizPath } from "@/lib/site-routes";
import { faNum } from "@/lib/utils";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Byline, Callout, RelatedLinks, SoftCta, type RelatedLink } from "@/components/seo/EduChrome";
import { QuizAnswerKey, QuizQuestions } from "@/components/quiz/QuizQuestions";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { QuizText } from "@/components/quiz/QuizText";
import { quizStorageKey } from "@/components/quiz/score";
import { getQuiz, isQuizReady, nextQuiz, quizHeading, quizLinkable, quizMinutes, quizSlug, quizTitle, readyQuizParams } from "@/content/quizzes";

export const revalidate = 300;
// فقط آزمون‌های نوشته‌شده ساخته می‌شوند؛ بقیه‌ی اسلاگ‌ها (و آزمون‌های هنوز خالی) ۴۰۴
export const dynamicParams = false;
export const generateStaticParams = () => readyQuizParams();

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props["params"]) {
  const p = parseQuizSlug((await params).slug);
  const quiz = p ? getQuiz(p.g, p.n) : undefined;
  if (!p || !isQuizReady(quiz)) notFound();
  return { ...p, quiz };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { g, n, quiz } = await load(params);
  return pageMeta({ title: quizTitle(quiz), description: quiz.description, path: quizPath(g, n) });
}

export default async function QuizPage({ params }: Props) {
  const { g, n, quiz } = await load(params);
  const s = await getSetting("site");
  const path = quizPath(g, n);
  const crumbs = crumbsFor(path);
  const chapter = GRADE_PAGES[g].chapters[n - 1];
  const minutes = quizMinutes(quiz);
  const calcCount = quiz.questions.filter((q) => q.calc).length;
  const next = nextQuiz(g, n);

  const after: (string | RelatedLink)[] = [
    { path: chapterPath(g, n), label: `درسنامه و نمونه سوال ${chapterLabel(g, n)}`, desc: "خلاصه‌ی درس، نکته‌های مهم و نمونه سوال بیشتر" },
    ...(next && quizLinkable(next.g, next.n) ? [{ path: quizPath(next.g, next.n), label: quizLabel(next.g, next.n), desc: "آزمون بعدی" }] : []),
    { path: GRADE_PAGES[g].path, label: `آموزش شیمی ${gradeName(g)}`, desc: "سرفصل‌ها و روش مطالعه‌ی همه‌ی فصل‌ها" },
    ...(quiz.related ?? []),
    { path: QUIZ_HUB, label: "همه‌ی آزمون‌های آنلاین شیمی", desc: "آزمون فصل‌های دیگر دهم، یازدهم و دوازدهم" },
  ];

  const ld = eduGraph(s, {
    path,
    title: quizHeading(g, n),
    description: quiz.description,
    type: "Quiz",
    breadcrumb: crumbs,
    educationalLevel: `پایه‌ی ${gradeName(g)}`,
    about: `${chapterLabel(g, n)}: ${chapterTitle(g, n)}`,
    extra: {
      assesses: chapter.topics,
      educationalUse: "خودسنجی",
      learningResourceType: "آزمون چهارگزینه‌ای",
      interactivityType: "active",
      timeRequired: `PT${minutes}M`,
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-5 pb-10 pt-32 print:max-w-none print:px-0 print:pt-0 print:text-black print:**:text-black">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mb-4 text-2xl font-black leading-tight tracking-tight md:text-4xl">
        {quizLabel(g, n)}: <span className="text-gradient">{chapterTitle(g, n)}</span>
      </h1>
      <Byline s={s} path={path} />

      <div className="mb-6 space-y-4 leading-9 text-white/75">
        {quiz.intro.map((p, i) => (
          <p key={i}>
            <QuizText text={p} />
          </p>
        ))}
      </div>

      <ul className="mb-10 flex flex-wrap gap-2 print:hidden">
        <li className="chip"><ListChecks aria-hidden className="size-3.5 text-cyan" /> {faNum(quiz.questions.length)} سؤال چهارگزینه‌ای</li>
        <li className="chip"><Clock aria-hidden className="size-3.5 text-cyan" /> زمان پیشنهادی {faNum(minutes)} دقیقه</li>
        {calcCount > 0 && <li className="chip"><Calculator aria-hidden className="size-3.5 text-cyan" /> {faNum(calcCount)} سؤال محاسباتی</li>}
        <li className="chip"><CheckCircle2 aria-hidden className="size-3.5 text-cyan" /> پاسخ تشریحی همه‌ی سؤال‌ها</li>
        <li className="chip"><UserX aria-hidden className="size-3.5 text-cyan" /> رایگان و بدون ثبت‌نام</li>
      </ul>

      <section className="mb-10 print:hidden" aria-labelledby="quiz-topics">
        <h2 id="quiz-topics" className="mb-3 text-xl font-black">مباحث این آزمون</h2>
        <ul className="grid gap-2 text-sm text-white/75 sm:grid-cols-2">
          {chapter.topics.map((t) => (
            <li key={t} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-2.5">
              <span>{t}</span>
              <span className="shrink-0 text-xs text-white/50">{faNum(quiz.questions.filter((q) => q.subtopic === t).length)} سؤال</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12" aria-labelledby="quiz-questions">
        <h2 id="quiz-questions" className="mb-4 text-2xl font-black">سؤال‌های آزمون</h2>
        <QuizRunner storageKey={quizStorageKey(quizSlug(g, n))} answerKey={quiz.questions.map((q) => q.correct)}>
          <QuizQuestions quiz={quiz} />
        </QuizRunner>
        <QuizAnswerKey quiz={quiz} />
      </section>

      <Callout kind="teacher">{quiz.teacherNote ? <QuizText text={quiz.teacherNote} /> : null}</Callout>

      <RelatedLinks title="بعد از آزمون" links={after} />

      <aside className="card my-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="text-lg font-black">آزمون‌های زمان‌دار در پنل دانش‌آموزی</p>
          <p className="mt-1 text-sm leading-7 text-white/65">
            در پنل {s.brand}، آزمون‌هایی که استاد {s.teacherName} منتشر می‌کند (برای همه یا ویژه‌ی شاگردان کلاس) با زمان‌سنج برگزار می‌شوند و نتیجه‌ی هر آزمون در کارنامه و نمودار پیشرفت شما ثبت می‌شود.
          </p>
        </div>
        <Link href="/login?next=/panel/exams" rel="nofollow" prefetch={false} className="btn-ghost shrink-0">
          <LogIn aria-hidden className="size-4" /> ورود و آزمون‌های پنل
        </Link>
      </aside>

      <SoftCta s={s} />
    </main>
  );
}
