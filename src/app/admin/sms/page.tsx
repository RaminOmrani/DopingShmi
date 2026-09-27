import Link from "next/link";
import { db } from "@/lib/db";
import { ensureTemplates, smsCredit } from "@/lib/sms";
import { SMS_TEMPLATES } from "@/lib/sms/templates";
import { getSetting } from "@/lib/settings";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { CopyText } from "@/components/admin/CopyText";
import { sendGeneral, saveTemplate } from "./actions";
import { GRADES, MAJORS } from "@/lib/constants";
import { faNum, fmtDate } from "@/lib/utils";

export const metadata = { title: "پیامک" };

export default async function Sms({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "send";
  await ensureTemplates();
  const [cfg, templates, groups, campaigns, logs] = await Promise.all([
    getSetting("sms"),
    db.smsTemplate.findMany(),
    db.classGroup.findMany({ orderBy: { order: "asc" } }),
    db.smsCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  const credit = cfg.provider === "mock" ? null : await smsCredit();
  const tmap = new Map(templates.map((t) => [t.key, t]));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="پیامک" desc={cfg.provider === "mock" ? "⚠️ حالت آزمایشی: پیامک واقعی ارسال نمی‌شود. از «تنظیمات ← پیامک» ملی‌پیامک را وصل کنید." : `ملی‌پیامک · ${credit?.ok ? `اعتبار: ${faNum(credit.credit ?? 0)}` : `خطا در دریافت اعتبار: ${credit?.error ?? ""}`}`} />
      <div className="mb-5 flex gap-2">
        {[["send", "ارسال گروهی"], ["templates", "الگوها"], ["logs", "گزارش ارسال"]].map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={`btn btn-sm ${tab === k ? "btn-primary" : "btn-ghost"}`}>{l}</Link>)}
      </div>

      {tab === "send" && (
        <section className="card p-5">
          <Form action={sendGeneral} reset className="grid gap-3 sm:grid-cols-4">
            <Field label="گیرندگان"><select name="audience" className="input"><option value="STUDENTS">همه‌ی شاگردان کلاس</option><option value="GROUP">یک کلاس خاص</option><option value="ALL">همه‌ی کاربران</option><option value="FREE">کاربران آزاد (غیرشاگرد)</option><option value="PENDING">در انتظار تأیید</option></select></Field>
            <Field label="کلاس (برای «یک کلاس خاص»)"><select name="groupId" className="input"><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
            <Field label="پایه"><select name="grade" className="input"><option value="">همه</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
            <Field label="رشته"><select name="major" className="input"><option value="">همه</option>{MAJORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
            <Field label="عنوان (برای اطلاعیه‌ی اپ و گزارش)" className="sm:col-span-4"><input name="title" className="input" placeholder="مثلاً: تعطیلی کلاس‌ها" /></Field>
            <Field label="متن پیام — {{name}} با نام هر نفر جایگزین می‌شود" className="sm:col-span-4"><textarea name="text" rows={4} className="input" required /></Field>
            <div className="flex flex-wrap gap-4 text-sm sm:col-span-4">
              <label className="flex items-center gap-2"><input type="checkbox" name="sms" defaultChecked className="size-4" /> ارسال پیامک</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="inapp" defaultChecked className="size-4" /> نمایش در اطلاعیه‌های اپ</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="parents" className="size-4" /> ارسال به والدین (فقط کسانی که فعال کرده‌اند)</label>
            </div>
            <Submit className="btn-primary sm:col-span-4">ارسال</Submit>
          </Form>
          <p className="mt-3 text-xs leading-6 text-white/45">پیام‌های عمومی با خط اختصاصی و به‌صورت ارسال معمولی فرستاده می‌شوند. برای پیامک‌های کلاس (فیکس/لغو) به بخش «کلاس‌ها» بروید.</p>
        </section>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          <div className="card p-4 text-sm leading-7 text-white/65">
            برای ارسال سریع و بدون فیلتر (خدماتی)، متن ستون «متن ثبت در ملی‌پیامک» را در پنل ملی‌پیامک ← <b>وب‌سرویس خدماتی ← الگوها</b> ثبت کنید. بعد از تأیید، «کد الگو» (bodyId) را در همان ردیف وارد کنید. تا وقتی کد الگو خالی است، پیام با ارسال معمولی فرستاده می‌شود.
          </div>
          {SMS_TEMPLATES.map((d) => {
            const t = tmap.get(d.key);
            if (!t) return null;
            return (
              <details key={d.key} className="card p-4">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-bold">{d.name}</span>
                  <code className="text-[11px] text-white/40">{d.key}</code>
                  {t.bodyId ? <span className="chip !text-lime">کد الگو: {t.bodyId}</span> : d.patternArgs.length ? <span className="chip !text-amber">بدون کد الگو</span> : null}
                  {!t.enabled && <span className="chip !text-rose">غیرفعال</span>}
                  <span className="text-xs text-white/40">— {d.description}</span>
                </summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white/[.03] p-3">
                    <div className="mb-2 flex items-center justify-between"><span className="label !mb-0">متن ثبت در ملی‌پیامک</span><CopyText text={d.melipayamak} /></div>
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-cyan/90">{d.melipayamak}</pre>
                    {d.patternArgs.length > 0 && <p className="mt-2 text-xs text-white/45">متغیرها به ترتیب: {d.patternArgs.map((a, i) => `{${i}}=${a}`).join("  ")}</p>}
                  </div>
                  <Form action={saveTemplate} className="grid gap-2">
                    <input type="hidden" name="key" value={d.key} />
                    <Field label="متن ارسال معمولی (بدون الگو)"><textarea name="body" defaultValue={t.body} rows={4} className="input text-sm" /></Field>
                    {d.patternArgs.length > 0 && <Field label="کد الگو (bodyId)"><input name="bodyId" defaultValue={t.bodyId ?? ""} className="input" dir="ltr" inputMode="numeric" /></Field>}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={t.enabled} className="size-4" /> فعال</label>
                    <Submit className="btn-primary btn-sm">ذخیره</Submit>
                  </Form>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 font-black">ارسال‌های گروهی</h2>
            <div className="table-wrap"><table className="table"><thead><tr><th>عنوان</th><th>کل</th><th>موفق</th><th>ناموفق</th><th>وضعیت</th><th>زمان</th></tr></thead>
              <tbody>{campaigns.map((c) => <tr key={c.id}><td>{c.title}</td><td>{faNum(c.total)}</td><td className="text-lime">{faNum(c.sent)}</td><td className="text-rose">{faNum(c.failed)}</td><td className="text-xs">{c.status === "DONE" ? "پایان" : "در حال ارسال…"}</td><td className="text-xs text-white/50">{fmtDate(c.createdAt, true)}</td></tr>)}</tbody></table></div>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-black">آخرین پیامک‌ها</h2>
            <div className="table-wrap"><table className="table"><thead><tr><th>گیرنده</th><th>متن</th><th>وضعیت</th><th>زمان</th></tr></thead>
              <tbody>{logs.map((l) => <tr key={l.id}><td dir="ltr" className="text-right text-xs">{faNum(l.to)}</td><td className="max-w-md truncate text-xs text-white/70" title={l.text}>{l.text}</td><td className={`text-xs ${l.status === "FAILED" ? "text-rose" : l.status === "MOCK" ? "text-amber" : "text-lime"}`}>{l.status === "FAILED" ? `ناموفق: ${l.error}` : l.status === "MOCK" ? "آزمایشی" : "ارسال شد"}</td><td className="whitespace-nowrap text-xs text-white/50">{fmtDate(l.createdAt, true)}</td></tr>)}</tbody></table></div>
          </section>
        </div>
      )}
    </div>
  );
}
