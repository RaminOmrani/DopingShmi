import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { userStats } from "@/lib/stats";
import { PageHead, Kpi, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { ExamTrend, DailyBars } from "@/components/charts/Charts";
import { LevelBadge } from "@/components/panel/LevelBadge";
import { ApproveButtons } from "../ApproveButtons";
import { updateUser, givePoints, grantAccess, revokeAccess, smsUser } from "../actions";
import { CLASS_STATUS_LABEL, GRADES, MAJORS, gradeLabel } from "@/lib/constants";
import { faNum, fmtDate, fmtDayShort, fmtDuration, fmtInt, fmtPct, fmtToman } from "@/lib/utils";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getUser();
  const u = await db.user.findUnique({ where: { id }, include: { classGroup: true, purchases: { include: { topic: true, bundle: true }, orderBy: { createdAt: "desc" } } } });
  if (!u) notFound();
  const [s, groups, topics, bundles] = await Promise.all([
    userStats(u),
    db.classGroup.findMany({ orderBy: { order: "asc" } }),
    db.topic.findMany({ orderBy: [{ grade: "asc" }, { order: "asc" }] }),
    db.bundle.findMany(),
  ]);
  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-cyan"><ArrowRight className="size-4" /> دانش‌آموزان</Link>
      <PageHead title={u.name || "بدون نام"} desc={`${faNum(u.phone)} · عضویت ${fmtDate(u.createdAt)}`}>
        {u.classStatus === "PENDING" && <ApproveButtons id={u.id} />}
      </PageHead>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="card flex items-center gap-3 p-4"><LevelBadge points={u.points} /><div><p className="text-xs text-white/50">امتیاز</p><p className="text-xl font-black">{fmtInt(u.points)}</p></div></div>
        <Kpi label="میانگین آزمون‌ها" value={fmtPct(s.avgPercent)} sub={s.trend !== null ? `${s.trend >= 0 ? "پیشرفت" : "پسرفت"} ${fmtPct(Math.abs(s.trend))}` : `${faNum(s.examCount)} آزمون`} />
        <Kpi label="ویدیوی کامل‌شده" value={faNum(s.completedVideos)} sub={`از ${faNum(s.startedVideos)} شروع‌شده`} />
        <Kpi label="زمان تماشا" value={<span className="text-base">{fmtDuration(s.totalVideoSec)}</span>} />
        <Kpi label="رتبه در گروه" value={s.rankInGroup ? `${faNum(s.rankInGroup)} / ${faNum(s.groupSize)}` : "—"} sub={`${faNum(s.streak)} روز پیاپی`} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 font-black">روند آزمون‌ها</h2>{s.exams.length ? <ExamTrend data={s.exams.map((e) => ({ name: e.title, you: e.percent, group: e.groupAvg }))} height={220} /> : <p className="text-sm text-white/45">آزمونی ثبت نشده</p>}</section>
        <section className="card p-5"><h2 className="mb-3 font-black">تماشای ویدیو (۳۰ روز)</h2><DailyBars data={s.days.map((d) => ({ label: fmtDayShort(d.day), v: d.videoMin }))} dataKey="v" name="تماشا" unit=" دقیقه" height={220} /></section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-black">ویرایش اطلاعات</h2>
          <Form action={updateUser} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={u.id} />
            <Field label="نام"><input name="name" defaultValue={u.name} className="input" /></Field>
            <Field label="پایه"><select name="grade" defaultValue={u.grade ?? ""} className="input"><option value="">—</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
            <Field label="رشته"><select name="major" defaultValue={u.major ?? ""} className="input"><option value="">—</option>{MAJORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
            <Field label="شهر"><input name="city" defaultValue={u.city ?? ""} className="input" /></Field>
            <Field label="وضعیت کلاس"><select name="classStatus" defaultValue={u.classStatus} className="input">{Object.entries(CLASS_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="کلاس"><select name="classGroupId" defaultValue={u.classGroupId ?? ""} className="input"><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
            {me?.role === "ADMIN" && (
              <>
                <Field label="نقش"><select name="role" defaultValue={u.role} className="input"><option value="USER">دانش‌آموز</option><option value="STAFF">پشتیبان (دسترسی پنل)</option><option value="ADMIN">مدیر کامل</option></select></Field>
                <Field label="رمز ورود پنل (برای مدیر/پشتیبان)"><input name="password" type="password" className="input" placeholder="خالی = بدون تغییر" dir="ltr" /></Field>
              </>
            )}
            <label className="flex items-center gap-2 self-end pb-3 text-sm text-rose"><input type="checkbox" name="blocked" defaultChecked={u.blocked} className="size-4 accent-rose-500" /> مسدود</label>
            <div className="text-xs leading-6 text-white/50 sm:col-span-3">
              مدرسه: {u.school ?? "—"} · استان: {u.province ?? "—"} · آدرس: {u.address ?? "—"} · ولی: {u.parentPhone ? `${faNum(u.parentPhone)} ${u.parentSms ? "(پیامک فعال)" : ""}` : "—"}
            </div>
            <Submit className="btn-primary sm:col-span-3">ذخیره</Submit>
          </Form>
        </section>
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 font-black">پیامک به این دانش‌آموز</h2>
            <Form action={smsUser} reset className="space-y-3">
              <input type="hidden" name="id" value={u.id} />
              <textarea name="text" rows={3} className="input" placeholder="متن پیام" required />
              {u.parentPhone && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="parent" className="size-4" /> ارسال به ولی</label>}
              <Submit className="btn-primary w-full">ارسال</Submit>
            </Form>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-black">امتیاز هدیه / کسر</h2>
            <Form action={givePoints} reset className="flex gap-2">
              <input type="hidden" name="id" value={u.id} />
              <input name="points" className="input w-24" placeholder="۲۰" inputMode="numeric" required />
              <input name="reason" className="input" placeholder="دلیل (اختیاری)" />
              <Submit className="btn-primary">ثبت</Submit>
            </Form>
          </section>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-black">دسترسی‌ها و خریدها</h2>
          {u.purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
              <div><p className="font-bold">{p.topic?.title ?? p.bundle?.title}</p><p className="text-xs text-white/45">{p.amount ? fmtToman(p.amount) : "هدیه"} · {fmtDate(p.createdAt)}{p.expiresAt ? ` · تا ${fmtDate(p.expiresAt)}` : ""}</p></div>
              <Form action={revokeAccess} confirm="این دسترسی حذف شود؟"><input type="hidden" name="id" value={u.id} /><input type="hidden" name="purchaseId" value={p.id} /><Submit className="btn-danger btn-sm">حذف</Submit></Form>
            </div>
          ))}
          <Form action={grantAccess} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={u.id} />
            <select name="item" className="input flex-1" required>
              <option value="">دسترسی رایگان به…</option>
              {bundles.map((b) => <option key={b.id} value={`bundle:${b.id}`}>بسته: {b.title}</option>)}
              {topics.map((t) => <option key={t.id} value={`topic:${t.id}`}>{gradeLabel(t.grade)} — {t.title}</option>)}
            </select>
            <input name="days" className="input w-28" placeholder="روز (خالی=دائم)" inputMode="numeric" />
            <Submit className="btn-primary">اعطا</Submit>
          </Form>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-black">نتایج آزمون‌ها</h2>
          <div className="table-wrap"><table className="table"><thead><tr><th>آزمون</th><th>درصد</th><th>میانگین گروه</th><th>تراز</th><th>تاریخ</th></tr></thead>
            <tbody>{[...s.exams].reverse().map((e) => <tr key={e.id}><td><Link className="hover:text-cyan" href={`/admin/exams/${e.id}`}>{e.title}</Link></td><td className="font-bold">{fmtPct(e.percent)}</td><td>{fmtPct(e.groupAvg)}</td><td>{e.taraz ? faNum(e.taraz) : "—"}</td><td className="text-xs">{fmtDate(e.date)}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </div>
  );
}
