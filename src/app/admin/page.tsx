import Link from "next/link";
import { Users, GraduationCap, UserCheck, Activity, Wallet, PlayCircle, ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHead, Kpi } from "@/components/admin/ui";
import { DailyBars } from "@/components/charts/Charts";
import { addDays, faNum, fmtDate, fmtDayShort, fmtDuration, fmtInt, fmtToman, tehranDay } from "@/lib/utils";
import { groupLabel } from "@/lib/constants";
import { ApproveButtons } from "./users/ApproveButtons";

export default async function AdminHome() {
  const today = tehranDay();
  const from = addDays(today, -29);
  const monthStart = new Date(Date.now() - 30 * 86400000);
  const payReview = await db.payment.count({ where: { status: "REVIEW" } });
  const [users, students, pending, todayAct, acts, revenue, payments, pendingList, videoToday] = await Promise.all([
    db.user.count({ where: { role: "USER" } }),
    db.user.count({ where: { classStatus: "APPROVED" } }),
    db.user.count({ where: { classStatus: "PENDING" } }),
    db.activity.count({ where: { day: today } }),
    db.activity.groupBy({ by: ["day"], where: { day: { gte: from } }, _count: { userId: true }, _sum: { videoSec: true } }),
    db.payment.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    db.payment.findMany({ where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 6, include: { user: { select: { name: true, phone: true } } } }),
    db.user.findMany({ where: { classStatus: "PENDING" }, orderBy: { updatedAt: "desc" }, take: 8, include: { classGroup: true } }),
    db.activity.aggregate({ where: { day: today }, _sum: { videoSec: true } }),
  ]);
  const map = new Map(acts.map((a) => [a.day, a]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(from, i);
    return { label: fmtDayShort(d), active: map.get(d)?._count.userId ?? 0, video: Math.round((map.get(d)?._sum.videoSec ?? 0) / 60) };
  });
  return (
    <div className="mx-auto max-w-7xl">
      <PageHead title="داشبورد مدیریت" desc={`امروز ${fmtDate(new Date())}`} />
      {payReview > 0 && (
        <Link href="/admin/payments" className="card glow-border mb-5 flex items-center justify-between p-4 text-sm">
          <span>💳 <b>{faNum(payReview)}</b> رسید کارت‌به‌کارت منتظر تأیید شماست</span>
          <ChevronLeft className="size-4 text-cyan" />
        </Link>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="کاربران" value={fmtInt(users)} icon={<Users className="size-4" />} />
        <Kpi label="شاگردان کلاس" value={fmtInt(students)} icon={<GraduationCap className="size-4" />} />
        <Kpi label="در انتظار تأیید" value={<span className={pending ? "text-amber" : ""}>{fmtInt(pending)}</span>} icon={<UserCheck className="size-4" />} />
        <Kpi label="فعال امروز" value={fmtInt(todayAct)} icon={<Activity className="size-4" />} />
        <Kpi label="تماشای امروز" value={<span className="text-lg">{fmtDuration(videoToday._sum.videoSec ?? 0)}</span>} icon={<PlayCircle className="size-4" />} />
        <Kpi label="فروش ۳۰ روز" value={<span className="text-lg">{fmtToman(revenue._sum.amount ?? 0)}</span>} sub={`${faNum(revenue._count)} تراکنش`} icon={<Wallet className="size-4" />} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-black">کاربران فعال در هر روز</h2>
          <DailyBars data={daily} dataKey="active" name="کاربر فعال" />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-black">دقیقه‌های تماشای ویدیو در هر روز</h2>
          <DailyBars data={daily} dataKey="video" name="تماشا" unit=" دقیقه" color="#a855f7" />
        </section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-black">درخواست‌های شاگرد کلاس</h2>
            <Link href="/admin/users?status=PENDING" className="text-xs text-cyan">همه <ChevronLeft className="inline size-3" /></Link>
          </div>
          {pendingList.map((u) => (
            <div key={u.id} className="mb-2 flex flex-wrap items-center gap-3 rounded-2xl bg-white/[.04] px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/users/${u.id}`} className="font-bold hover:text-cyan">{u.name || "بدون نام"}</Link>
                <p className="text-xs text-white/50"><span dir="ltr">{faNum(u.phone)}</span> · {groupLabel(u.grade, u.major)} · {u.city ?? ""}{u.classGroup ? ` · ${u.classGroup.name}` : ""}</p>
              </div>
              <ApproveButtons id={u.id} />
            </div>
          ))}
          {pendingList.length === 0 && <p className="text-sm text-white/45">درخواستی در انتظار نیست ✅</p>}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-black">آخرین فروش‌ها</h2>
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-white/5 py-2.5 text-sm last:border-0">
              <div><p className="font-bold">{p.description}</p><p className="text-xs text-white/45">{p.user.name} · {fmtDate(p.paidAt, true)}</p></div>
              <span className="font-black text-lime">{fmtToman(p.amount)}</span>
            </div>
          ))}
          {payments.length === 0 && <p className="text-sm text-white/45">هنوز فروشی ثبت نشده است.</p>}
        </section>
      </div>
    </div>
  );
}
