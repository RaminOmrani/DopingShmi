import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";
import { LevelBadge } from "@/components/panel/LevelBadge";
import { LogoutButton } from "@/components/panel/LogoutButton";
import { PasswordForm } from "@/components/panel/PasswordForm";
import { faNum, fmtDate, fmtInt, fmtToman } from "@/lib/utils";
import { levelOf } from "@/lib/constants";

export const metadata = { title: "پروفایل" };

const REASON: Record<string, string> = { EXAM: "شرکت در آزمون", VIDEO_DONE: "تکمیل ویدیو", VIDEO_TIME: "تماشای ویدیو", ONLINE: "حضور آنلاین", DAILY: "ورود روزانه", STREAK: "۷ روز پیاپی", ADMIN: "هدیه استاد" };

export default async function Profile() {
  const user = await requireUser();
  const [groups, purchases, logs, reviews] = await Promise.all([
    db.classGroup.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    db.purchase.findMany({ where: { userId: user.id }, include: { topic: true, bundle: true }, orderBy: { createdAt: "desc" } }),
    db.pointLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.payment.findMany({ where: { userId: user.id, status: "REVIEW" }, orderBy: { createdAt: "desc" } }),
  ]);
  const l = levelOf(user.points);
  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_340px]">
      <section className="card p-6">
        <h1 className="mb-5 text-xl font-black">اطلاعات من</h1>
        <p className="mb-4 text-sm text-white/55">شماره موبایل: <span dir="ltr" className="font-bold text-white">{faNum(user.phone)}</span></p>
        <ProfileForm
          mode="edit"
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          initial={{
            name: user.name, grade: user.grade ?? "", major: user.major ?? "", province: user.province ?? "خراسان رضوی", city: user.city ?? "", address: user.address ?? "",
            school: user.school ?? "", parentPhone: user.parentPhone ?? "", parentSms: user.parentSms,
            classStudent: user.classStatus === "PENDING" || user.classStatus === "APPROVED", classGroupId: user.classGroupId ?? "", classStatus: user.classStatus,
          }}
        />
      </section>
      <div className="space-y-5">
        <section className="card p-5 text-center">
          <div className="mb-3 flex justify-center"><LevelBadge points={user.points} size="lg" /></div>
          <p className="font-black">سطح {faNum(l.level)} · {l.name}</p>
          <p className="text-sm text-white/55">{fmtInt(user.points)} امتیاز</p>
        </section>
        <section className="card p-5">
          <p className="mb-3 font-black">آخرین امتیازها</p>
          {logs.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-white/65">{REASON[g.reason] ?? g.reason}</span>
              <span className="font-bold text-lime">+{faNum(g.amount)}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-white/45">هنوز امتیازی نگرفته‌ای.</p>}
        </section>
        <section className="card p-5">
          <p className="mb-3 font-black">خریدهای من</p>
          {purchases.map((p) => (
            <div key={p.id} className="mb-2 rounded-xl bg-white/[.04] px-3 py-2 text-sm">
              <p className="font-bold">{p.topic?.title ?? p.bundle?.title ?? "—"}</p>
              <p className="text-xs text-white/50">{fmtToman(p.amount)} · {fmtDate(p.createdAt)}{p.expiresAt ? ` · تا ${fmtDate(p.expiresAt)}` : ""}</p>
            </div>
          ))}
          {reviews.map((p) => (
            <div key={p.id} className="mb-2 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-sm">
              <p className="font-bold">{p.description}</p>
              <p className="text-xs text-amber">رسید در حال بررسی · {fmtToman(p.amount)}</p>
            </div>
          ))}
          {purchases.length === 0 && reviews.length === 0 && <p className="text-sm text-white/45">خریدی ندارید.</p>}
        </section>
        <section className="card p-5"><PasswordForm hasPassword={!!user.passwordHash} /></section>
        <LogoutButton />
      </div>
    </div>
  );
}
