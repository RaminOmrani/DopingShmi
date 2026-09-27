import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { saveContent } from "../settings/actions";

export const metadata = { title: "متن‌های سایت" };

export default async function Content() {
  const s = await getSetting("site");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title="متن‌ها و اطلاعات تماس" desc="همه‌ی متن‌های صفحه‌ی اصلی از اینجا قابل تغییر است. عکس‌ها از بخش «عکس‌ها» مدیریت می‌شوند.">
        <Link href="/" target="_blank" className="btn-ghost btn-sm">مشاهده سایت</Link>
      </PageHead>
      <Form action={saveContent} className="space-y-5">
        <section className="card grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-black sm:col-span-2">بخش اول (هیرو)</h2>
          <Field label="نام برند"><input name="brand" defaultValue={s.brand} className="input" /></Field>
          <Field label="نام استاد"><input name="teacherName" defaultValue={s.teacherName} className="input" /></Field>
          <Field label="تیتر اصلی" className="sm:col-span-2"><input name="heroTitle" defaultValue={s.heroTitle} className="input text-lg font-bold" /></Field>
          <Field label="زیرتیتر" className="sm:col-span-2"><textarea name="heroSubtitle" defaultValue={s.heroSubtitle} rows={2} className="input" /></Field>
          <Field label="شعار (فوتر)" className="sm:col-span-2"><input name="tagline" defaultValue={s.tagline} className="input" /></Field>
          <Field label="آمار برجسته — هر خط: مقدار|توضیح" className="sm:col-span-2"><textarea name="highlights" defaultValue={s.highlights.map((h) => `${h.value}|${h.label}`).join("\n")} rows={3} className="input" dir="auto" /></Field>
        </section>
        <section className="card grid gap-3 p-5">
          <h2 className="font-black">معرفی استاد</h2>
          <Field label="عنوان"><input name="aboutTitle" defaultValue={s.aboutTitle} className="input" /></Field>
          <Field label="متن معرفی"><textarea name="aboutText" defaultValue={s.aboutText} rows={5} className="input leading-7" /></Field>
          <Field label="سوابق — هر خط یک مورد"><textarea name="credentials" defaultValue={s.credentials.join("\n")} rows={6} className="input leading-7" /></Field>
        </section>
        <section className="card grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-black sm:col-span-2">تماس</h2>
          <Field label="تلفن"><input name="phone" defaultValue={s.phone} className="input" dir="ltr" /></Field>
          <Field label="لینک تلگرام"><input name="telegram" defaultValue={s.telegram} className="input" dir="ltr" placeholder="https://t.me/username" /></Field>
          <Field label="لینک بله"><input name="bale" defaultValue={s.bale} className="input" dir="ltr" placeholder="https://ble.ir/username" /></Field>
          <Field label="لینک اینستاگرام"><input name="instagram" defaultValue={s.instagram} className="input" dir="ltr" /></Field>
          <Field label="آدرس" className="sm:col-span-2"><input name="address" defaultValue={s.address} className="input" /></Field>
          <Field label="لینک نقشه (نشان / گوگل)"><input name="mapUrl" defaultValue={s.mapUrl} className="input" dir="ltr" /></Field>
          <Field label="متن کپی‌رایت"><input name="footerText" defaultValue={s.footerText} className="input" /></Field>
        </section>
        <Submit className="btn-primary w-full !py-4">ذخیره همه</Submit>
      </Form>
    </div>
  );
}
