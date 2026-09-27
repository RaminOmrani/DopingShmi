import "server-only";
import { db } from "./db";

export interface Audience { grade?: string | null; major?: string | null; classGroupId?: string | null; studentsOnly?: boolean }

export const matchAudience = (a: Audience | null | undefined, u: { grade: string | null; major: string | null; classGroupId: string | null; classStatus: string }) =>
  !a ||
  ((!a.grade || a.grade === u.grade) &&
    (!a.major || a.major === u.major) &&
    (!a.classGroupId || (a.classGroupId === u.classGroupId && u.classStatus === "APPROVED")) &&
    (!a.studentsOnly || u.classStatus === "APPROVED"));

export async function notificationsFor(u: { id: string; grade: string | null; major: string | null; classGroupId: string | null; classStatus: string }, take = 8) {
  const rows = await db.notification.findMany({ where: { OR: [{ userId: u.id }, { userId: null }] }, orderBy: { createdAt: "desc" }, take: 40 });
  return rows.filter((r) => r.userId || matchAudience(r.audience as Audience, u)).slice(0, take);
}
