import "server-only";
import { db } from "./db";
import { getSetting } from "./settings";
import { isAdmin } from "./auth";

type U = { id: string; role: string; classStatus: string; grade: string | null } | null;

export interface Access {
  all: boolean;
  topicIds: Set<string>;
  expires: Map<string, Date | null>;
}

export async function getAccess(user: U): Promise<Access> {
  const res: Access = { all: false, topicIds: new Set(), expires: new Map() };
  if (!user) return res;
  if (isAdmin(user)) return { ...res, all: true };
  const acc = await getSetting("access");
  if (user.classStatus === "APPROVED") {
    if (acc.studentsAllGrades) return { ...res, all: true };
    const own = await db.topic.findMany({ where: { OR: [{ grade: user.grade ?? "" }, { grade: "ALL" }] }, select: { id: true } });
    own.forEach((t) => res.topicIds.add(t.id));
  }
  const now = new Date();
  const purchases = await db.purchase.findMany({
    where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    include: { bundle: { include: { topics: { select: { id: true } } } } },
  });
  for (const p of purchases) {
    const ids = p.topicId ? [p.topicId] : (p.bundle?.topics.map((t) => t.id) ?? []);
    for (const id of ids) {
      res.topicIds.add(id);
      const prev = res.expires.get(id);
      if (prev === undefined || (prev !== null && (p.expiresAt === null || p.expiresAt > prev))) res.expires.set(id, p.expiresAt);
    }
  }
  return res;
}

export const canWatch = (a: Access, v: { isFree: boolean; topicId: string }) => v.isFree || a.all || a.topicIds.has(v.topicId);
