import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, mustUser, ok, route } from "@/lib/api";
import { grade } from "@/lib/exams";
import { examPoints } from "@/lib/points";
import { tehranDay } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await mustUser();
  const { id } = await params;
  const b = await body(req, z.object({ answers: z.record(z.string(), z.number().int().min(0).max(3).nullable()) }));
  const exam = await db.exam.findUnique({ where: { id }, include: { questions: true } });
  const r = await db.examResult.findUnique({ where: { examId_userId: { examId: id, userId: user.id } } });
  if (!exam || !r) throw new HttpError(404, "آزمون یافت نشد");
  if (r.status === "SUBMITTED") return ok({ ok: true });
  let deadline = r.startedAt.getTime() + exam.durationMin * 60_000;
  if (exam.endAt) deadline = Math.min(deadline, exam.endAt.getTime());
  // پس از مهلت (+۹۰ ثانیه فرصت شبکه) فقط پاسخ‌های ذخیره‌شده پذیرفته می‌شود
  const answers = Date.now() > deadline + 90_000 ? ((r.answers ?? {}) as Record<string, number | null>) : b.answers;
  const g = grade(exam.questions, answers, exam.negative);
  await db.examResult.update({ where: { id: r.id }, data: { ...g, answers, status: "SUBMITTED", submittedAt: new Date(), source: "INTERNAL" } });
  const day = tehranDay();
  await db.activity.upsert({ where: { userId_day: { userId: user.id, day } }, create: { userId: user.id, day, exams: 1 }, update: { exams: { increment: 1 } } });
  await examPoints(user.id, id, g.percent);
  return ok({ ok: true, ...g });
});
