import { getSettings } from "@/lib/settings";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { saveSms, testSms, saveArvan, savePayment, savePoints, saveAccess, changePassword } from "./actions";

export const metadata = { title: "تنظیمات" };
const mask = (s: string) => (s ? `••••${s.slice(-4)}` : "");

export default async function Settings() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHead title="تنظیمات" desc="همه‌ی تنظیمات در دیتابیس ذخیره می‌شوند؛ نیازی به ویرایش فایل روی سرور نیست." />

      <section className="card p-5">
        <h2 className="mb-1 font-black">پیامک — ملی‌پیامک</h2>
        <p className="mb-4 text-xs leading-6 text-white/50">روش «کنسول» فقط کلید API می‌خواهد (console.melipayamak.com ← تنظیمات ← کلید API). روش «REST» نام کاربری و رمز وب‌سرویس. IP سرور را در پنل ملی‌پیامک به‌عنوان IP مجاز ثبت کنید.</p>
        <Form action={saveSms} className="grid gap-3 sm:grid-cols-3">
          <Field label="روش اتصال"><select name="provider" defaultValue={s.sms.provider} className="input"><option value="mock">آزمایشی (بدون ارسال)</option><option value="melipayamak-console">ملی‌پیامک — کلید API کنسول</option><option value="melipayamak-rest">ملی‌پیامک — REST (نام کاربری/رمز)</option></select></Field>
          <Field label="کلید API کنسول"><input name="apiKey" className="input" dir="ltr" placeholder={mask(s.sms.apiKey) || "—"} /></Field>
          <Field label="شماره خط فرستنده"><input name="from" defaultValue={s.sms.from} className="input" dir="ltr" placeholder="5000..." /></Field>
          <Field label="نام کاربری (REST)"><input name="username" defaultValue={s.sms.username} className="input" dir="ltr" /></Field>
          <Field label="رمز / ApiKey وب‌سرویس (REST)"><input name="password" type="password" className="input" dir="ltr" placeholder={mask(s.sms.password) || "—"} /></Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="usePatterns" defaultChecked={s.sms.usePatterns} className="size-4" /> استفاده از الگوها (خدماتی)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="parentSms" defaultChecked={s.sms.parentSms} className="size-4" /> امکان پیامک به والدین</label>
          </div>
          <Submit className="btn-primary sm:col-span-3">ذخیره و بررسی اعتبار</Submit>
        </Form>
        <Form action={testSms} className="mt-3 flex gap-2"><input name="phone" className="input" dir="ltr" placeholder="شماره برای پیامک آزمایشی" /><Submit className="btn-ghost">ارسال آزمایشی</Submit></Form>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-black">ویدیو — ابر آروان (VOD)</h2>
        <p className="mb-4 text-xs leading-6 text-white/50">در پنل آروان ← پلتفرم ویدیو، یک کانال بسازید و «لینک امن» (Secure Link) را روشن کنید. کلید API را از «پنل کاربری ← کلیدهای API» بسازید (دسترسی ویدیو). ویدیوها را در کانال آپلود و شناسه‌ی هر ویدیو را در «مباحث و ویدیوها» ثبت کنید.</p>
        <Form action={saveArvan} className="grid gap-3 sm:grid-cols-3">
          <Field label="کلید API آروان" className="sm:col-span-2"><input name="apiKey" className="input" dir="ltr" placeholder={mask(s.arvan.apiKey) || "Apikey xxxxxxxx-xxxx-..."} /></Field>
          <Field label="اعتبار لینک پخش (دقیقه)"><input name="expireMinutes" defaultValue={s.arvan.expireMinutes} className="input" inputMode="numeric" /></Field>
          <div className="flex flex-wrap gap-4 text-sm sm:col-span-3">
            <label className="flex items-center gap-2"><input type="checkbox" name="secureLink" defaultChecked={s.arvan.secureLink} className="size-4" /> لینک امن (انقضادار)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="bindIp" defaultChecked={s.arvan.bindIp} className="size-4" /> قفل لینک روی IP کاربر (امن‌تر؛ با اینترنت موبایل ممکن است قطع شود)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="watermark" defaultChecked={s.arvan.watermark} className="size-4" /> واترمارک شماره موبایل کاربر روی ویدیو</label>
          </div>
          <Submit className="btn-primary sm:col-span-3">ذخیره و تست اتصال</Submit>
        </Form>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-black">درگاه پرداخت — زرین‌پال</h2>
        <Form action={savePayment} className="grid gap-3 sm:grid-cols-3">
          <Field label="مرچنت کد" className="sm:col-span-2"><input name="merchantId" defaultValue={s.payment.merchantId} className="input" dir="ltr" /></Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={s.payment.enabled} className="size-4" /> پرداخت فعال</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="sandbox" defaultChecked={s.payment.sandbox} className="size-4" /> حالت آزمایشی (sandbox)</label>
          </div>
          <Submit className="btn-primary sm:col-span-3">ذخیره</Submit>
        </Form>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-black">امتیازدهی</h2>
        <Form action={savePoints} className="grid gap-3 sm:grid-cols-4">
          {([["examBase", "شرکت در آزمون"], ["examBonusMax", "حداکثر جایزه‌ی درصد آزمون"], ["videoDone", "کامل دیدن هر ویدیو"], ["videoPer5Min", "هر ۵ دقیقه تماشا"], ["onlinePer10Min", "هر ۱۰ دقیقه آنلاین"], ["onlineDailyCap", "سقف روزانه‌ی امتیاز آنلاین"], ["daily", "ورود روزانه"], ["streak7", "هر ۷ روز پیاپی"]] as const).map(([k, l]) => (
            <Field key={k} label={l}><input name={k} defaultValue={s.points[k]} className="input" inputMode="numeric" /></Field>
          ))}
          <Submit className="btn-primary sm:col-span-4">ذخیره</Submit>
        </Form>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-black">دسترسی شاگردان</h2>
        <Form action={saveAccess} className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="studentsAllGrades" defaultChecked={s.access.studentsAllGrades} className="size-4" /> شاگردان تأییدشده به ویدیوهای همه‌ی پایه‌ها دسترسی داشته باشند (خاموش = فقط پایه‌ی خودشان)</label>
          <Submit className="btn-primary btn-sm">ذخیره</Submit>
        </Form>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-black">تغییر رمز ورود مدیر</h2>
        <Form action={changePassword} reset className="grid gap-3 sm:grid-cols-3">
          <input name="current" type="password" className="input" placeholder="رمز فعلی" dir="ltr" />
          <input name="next" type="password" className="input" placeholder="رمز جدید (حداقل ۸ کاراکتر)" dir="ltr" required />
          <Submit className="btn-primary">تغییر رمز</Submit>
        </Form>
      </section>
    </div>
  );
}
