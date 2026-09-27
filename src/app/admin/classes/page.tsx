import Link from "next/link";
import { CalendarPlus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { saveGroup, deleteGroup, createEvent } from "./actions";
import { PrivateClassForm } from "@/components/admin/PrivateClassForm";
import { GRADES, MAJORS, groupLabel } from "@/lib/constants";
import { faNum, fmtDate } from "@/lib/utils";

export const metadata = { title: "کلاس‌ها" };
const KIND_FA: Record<string, string> = { FIXED: "فیکس شد", CANCELLED: "لغو شد", RESCHEDULED: "جابه‌جا شد" };

export default async function Classes() {
  const [groups, students, privateEvents] = await Promise.all([
    db.classGroup.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { users: { where: { classStatus: "APPROVED" } } } }, events: { orderBy: { createdAt: "desc" }, take: 3 } } }),
    db.user.findMany({ where: { classStatus: "APPROVED", role: "USER" }, orderBy: [{ classGroupId: { sort: "asc", nulls: "first" } }, { name: "asc" }], select: { id: true, name: true, phone: true } }),
    db.classEvent.findMany({ where: { userId: { not: null } }, orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } } }),
  ]);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHead title="کلاس‌ها و اطلاع‌رسانی" desc="برای هر کلاس، فیکس شدن، لغو یا جابه‌جایی جلسه را ثبت کنید؛ به اعضای کلاس (و در صورت تمایل والدین) پیامک می‌رود و در اپلیکیشن هم نمایش داده می‌شود." />
      <section className="card glow-border mb-6 p-5">
        <h2 className="mb-1 text-lg font-black">کلاس خصوصی (تک‌نفره)</h2>
        <p className="mb-4 text-xs text-white/50">برای شاگردانی که کلاس خصوصی دارند؛ پیامک و اطلاعیه فقط برای همان دانش‌آموز (و در صورت انتخاب، ولی‌اش) می‌رود. از صفحه‌ی هر دانش‌آموز هم در دسترس است.</p>
        <PrivateClassForm students={students} />
        {privateEvents.length > 0 && (
          <div className="mt-3 space-y-1 text-xs text-white/60">
            {privateEvents.map((e) => <p key={e.id}>• {e.user?.name}: {e.date} {e.time ?? ""} — {KIND_FA[e.kind]} <span className="text-white/35">{fmtDate(e.createdAt, true)}</span></p>)}
          </div>
        )}
      </section>

      <h2 className="mb-3 text-lg font-black">کلاس‌های گروهی</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((g) => (
          <section key={g.id} className={`card p-5 ${g.active ? "" : "opacity-60"}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black">{g.name}</h2>
                <p className="text-xs text-white/50">{groupLabel(g.grade, g.major)} · {g.location ?? "—"} {g.schedule ? `· ${g.schedule}` : ""}</p>
              </div>
              <Link href={`/admin/users?group=${g.id}&status=APPROVED`} className="chip"><Users className="size-3" /> {faNum(g._count.users)} عضو</Link>
            </div>

            <Form action={createEvent} className="grid gap-2 rounded-2xl bg-white/[.03] p-3 sm:grid-cols-4">
              <input type="hidden" name="groupId" value={g.id} />
              <select name="kind" className="input" defaultValue="FIXED"><option value="FIXED">✅ کلاس فیکس شد</option><option value="CANCELLED">❌ کلاس لغو شد</option><option value="RESCHEDULED">🔁 جابه‌جایی کلاس</option></select>
              <input name="date" className="input" placeholder="تاریخ: ۱۴۰۵/۰۷/۱۰ یا شنبه ۱۰ مهر" required />
              <input name="time" className="input" placeholder="ساعت: ۱۶:۳۰" />
              <input name="location" className="input" placeholder={g.location ?? "مکان"} />
              <input name="note" className="input sm:col-span-4" placeholder="توضیح (فقط در اپ نمایش داده می‌شود)" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sms" defaultChecked className="size-4 accent-cyan-400" /> پیامک به اعضا</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="parents" className="size-4 accent-violet-500" /> پیامک به والدین</label>
              <Submit className="btn-primary sm:col-span-2"><CalendarPlus className="size-4" /> ثبت و اطلاع‌رسانی</Submit>
            </Form>

            {g.events.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-white/60">
                {g.events.map((e) => <p key={e.id}>• {e.date} {e.time ?? ""} — {KIND_FA[e.kind]} {e.smsSent ? `(پیامک: ${faNum(e.smsSent)})` : ""} <span className="text-white/35">{fmtDate(e.createdAt, true)}</span></p>)}
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-white/45">ویرایش کلاس</summary>
              <GroupForm g={g} />
              <Form action={deleteGroup} confirm="کلاس حذف شود؟ (دانش‌آموزان حذف نمی‌شوند)" className="mt-2"><input type="hidden" name="id" value={g.id} /><Submit className="btn-danger btn-sm">حذف کلاس</Submit></Form>
            </details>
          </section>
        ))}
      </div>
      <section className="card mt-6 p-5">
        <h2 className="mb-3 font-black">افزودن کلاس جدید</h2>
        <GroupForm />
      </section>
    </div>
  );
}

function GroupForm({ g }: { g?: { id: string; name: string; grade: string | null; major: string | null; location: string | null; schedule: string | null; order: number; active: boolean } }) {
  return (
    <Form action={saveGroup} reset={!g} className="mt-3 grid gap-2 sm:grid-cols-3">
      <input type="hidden" name="id" value={g?.id ?? ""} />
      <Field label="نام کلاس"><input name="name" defaultValue={g?.name} className="input" required /></Field>
      <Field label="پایه"><select name="grade" defaultValue={g?.grade ?? ""} className="input"><option value="">همه</option>{GRADES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
      <Field label="رشته"><select name="major" defaultValue={g?.major ?? ""} className="input"><option value="">همه</option>{MAJORS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
      <Field label="مکان"><input name="location" defaultValue={g?.location ?? ""} className="input" /></Field>
      <Field label="زمان‌بندی ثابت"><input name="schedule" defaultValue={g?.schedule ?? ""} className="input" placeholder="شنبه‌ها ساعت ۱۶" /></Field>
      <Field label="ترتیب"><input name="order" defaultValue={g?.order ?? 0} className="input" inputMode="numeric" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={g?.active ?? true} className="size-4" /> فعال (قابل انتخاب در ثبت‌نام)</label>
      <Submit className="btn-primary sm:col-span-2">{g ? "ذخیره" : "افزودن کلاس"}</Submit>
    </Form>
  );
}
