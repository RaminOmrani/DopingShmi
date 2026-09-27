import Link from "next/link";
import { ExternalLink, FileCheck2, EyeOff } from "lucide-react";
import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/ui";
import { ExamForm } from "@/components/admin/ExamForm";
import { groupLabel } from "@/lib/constants";
import { faNum, fmtDate } from "@/lib/utils";

export const metadata = { title: "آزمون‌ها" };

export default async function AdminExams() {
  const [exams, groups] = await Promise.all([
    db.exam.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { questions: true, results: { where: { status: "SUBMITTED" } } } } } }),
    db.classGroup.findMany({ orderBy: { order: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="آزمون‌ها" desc="دو نوع آزمون: (۱) آزمون تستی داخل سایت با تصحیح خودکار، (۲) آزمون پلکان که دانش‌آموز از سایت وارد آن می‌شود و نتیجه‌اش با فایل اکسل یا دستی ثبت می‌شود." />
      <div className="mb-6 grid gap-2">
        {exams.map((e) => (
          <Link key={e.id} href={`/admin/exams/${e.id}`} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-cyan/30">
            {e.kind === "EXTERNAL" ? <ExternalLink className="size-5 text-violet" /> : <FileCheck2 className="size-5 text-cyan" />}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{e.title} {!e.published && <EyeOff className="inline size-4 text-white/40" />}</p>
              <p className="text-xs text-white/50">{e.kind === "EXTERNAL" ? "پلکان" : `${faNum(e._count.questions)} سؤال`} · {groupLabel(e.grade, e.major)} · {faNum(e._count.results)} نتیجه · {fmtDate(e.createdAt)}</p>
            </div>
          </Link>
        ))}
        {exams.length === 0 && <p className="text-sm text-white/45">آزمونی ساخته نشده.</p>}
      </div>
      <section className="card glow-border p-5">
        <h2 className="mb-4 font-black">آزمون جدید</h2>
        <ExamForm groups={groups.map((g) => ({ id: g.id, name: g.name }))} init={{ title: "", description: "", kind: "INTERNAL", externalUrl: "", openMode: "TAB", grade: "", major: "", audience: "STUDENTS", classGroupId: "", durationMin: 30, startAt: "", endAt: "", negative: true, showAnswers: true, maxScore: 100, published: false }} />
      </section>
    </div>
  );
}
