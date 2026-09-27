import { db } from "@/lib/db";
import { HttpError, mustUser, ok, route } from "@/lib/api";
import { canSeeExam, examState } from "@/lib/exams";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await mustUser();
  const { id } = await params;
  if (!(await canSeeExam(user, id))) throw new HttpError(404, "آزمون یافت نشد");
  const exam = await db.exam.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } } } });
  if (!exam || exam.kind !== "INTERNAL") throw new HttpError(404, "آزمون یافت نشد");
  let result = await db.examResult.findUnique({ where: { examId_userId: { examId: id, userId: user.id } } });
  if (result?.status === "SUBMITTED") throw new HttpError(409, "این آزمون را قبلاً داده‌اید");
  const state = examState(exam);
  if (state !== "OPEN") throw new HttpError(409, state === "UPCOMING" ? "آزمون هنوز شروع نشده است" : "مهلت آزمون تمام شده است");
  if (!result) result = await db.examResult.create({ data: { examId: id, userId: user.id, status: "IN_PROGRESS", answers: {} } });
  else if (result.status === "LAUNCHED") result = await db.examResult.update({ where: { id: result.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  let deadline = result.startedAt.getTime() + exam.durationMin * 60_000;
  if (exam.endAt) deadline = Math.min(deadline, exam.endAt.getTime());
  return ok({
    deadline,
    now: Date.now(),
    answers: result.answers ?? {},
    questions: exam.questions.map((q) => ({ id: q.id, text: q.text, image: q.image, options: q.options as string[] })),
  });
});
