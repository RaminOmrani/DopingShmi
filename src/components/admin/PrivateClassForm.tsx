import { Form, Submit } from "./Form";
import { createPrivateEvent } from "@/app/admin/classes/actions";

/** فرم اطلاع‌رسانی کلاس خصوصی — اگر userId داده شود، انتخاب دانش‌آموز حذف می‌شود */
export function PrivateClassForm({ userId, students, hasParent = true }: { userId?: string; students?: { id: string; name: string; phone: string }[]; hasParent?: boolean }) {
  return (
    <Form action={createPrivateEvent} className="grid gap-2 sm:grid-cols-4">
      {userId ? (
        <input type="hidden" name="userId" value={userId} />
      ) : (
        <select name="userId" className="input sm:col-span-4" required defaultValue="">
          <option value="" disabled>دانش‌آموز را انتخاب کنید…</option>
          {students?.map((s) => <option key={s.id} value={s.id}>{s.name || s.phone} — {s.phone}</option>)}
        </select>
      )}
      <select name="kind" className="input" defaultValue="FIXED"><option value="FIXED">✅ کلاس فیکس شد</option><option value="CANCELLED">❌ کلاس لغو شد</option><option value="RESCHEDULED">🔁 جابه‌جایی کلاس</option></select>
      <input name="date" className="input" placeholder="تاریخ: شنبه ۱۲ مهر" required />
      <input name="time" className="input" placeholder="ساعت: ۱۷:۰۰" />
      <input name="location" className="input" placeholder="مکان (یا آنلاین)" />
      <input name="note" className="input sm:col-span-4" placeholder="توضیح (فقط در اپ نمایش داده می‌شود)" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sms" defaultChecked className="size-4 accent-cyan-400" /> پیامک به دانش‌آموز</label>
      {hasParent && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="parents" className="size-4 accent-violet-500" /> پیامک به ولی</label>}
      <Submit className="btn-primary sm:col-span-2">ثبت و اطلاع‌رسانی</Submit>
    </Form>
  );
}
