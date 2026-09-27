import "server-only";
import { db } from "./db";
import { isAdmin } from "./auth";
import type { Prisma } from "@/generated/prisma/client";

type U = { id: string; role: string; classStatus: string; classGroupId: string | null; grade: string | null; major: string | null };

/** شرط Prisma برای آزمون‌هایی که کاربر می‌تواند ببیند */
export function examWhere(u: U): Prisma.ExamWhereInput {
  if (isAdmin(u)) return {};
  const approved = u.classStatus === "APPROVED";
  const audience: Prisma.ExamWhereInput[] = [{ audience: "ALL" }];
  if (approved) audience.push({ audience: "STUDENTS" });
  if (approved && u.classGroupId) audience.push({ audience: "GROUP", classGroupId: u.classGroupId });
  return {
    published: true,
    AND: [
      { OR: audience },
      { OR: [{ grade: null }, { grade: u.grade ?? "" }] },
      { OR: [{ major: null }, { major: u.major ?? "" }] },
    ],
  };
}

export async function canSeeExam(u: U, examId: string) {
  return !!(await db.exam.findFirst({ where: { id: examId, ...examWhere(u) }, select: { id: true } }));
}

export const examState = (e: { startAt: Date | null; endAt: Date | null }, now = new Date()) =>
  e.startAt && e.startAt > now ? "UPCOMING" : e.endAt && e.endAt < now ? "CLOSED" : "OPEN";

/** نمره‌دهی کنکوری: هر غلط یک‌سوم نمره منفی */
export function grade(questions: { id: string; correct: number }[], answers: Record<string, number | null>, negative: boolean) {
  let correct = 0, wrong = 0, blank = 0;
  for (const q of questions) {
    const a = answers[q.id];
    if (a === null || a === undefined) blank++;
    else if (a === q.correct) correct++;
    else wrong++;
  }
  const n = questions.length || 1;
  const percent = negative ? ((3 * correct - wrong) / (3 * n)) * 100 : (correct / n) * 100;
  return { correct, wrong, blank, percent: Math.round(percent * 10) / 10 };
}
