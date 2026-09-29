import { Form, Submit } from "./Form";
import { Field } from "./ui";
import { saveArticle } from "@/app/admin/articles/actions";

type A = { id: string; title: string; slug: string; excerpt: string | null; body: string; category: string | null; keywords: string | null; published: boolean; cover: string | null };

const HELP = "قالب‌بندی: «## » تیتر · «### » زیرتیتر · «- » فهرست · «1. » فهرست شماره‌دار · «> » نکته · **پررنگ** · [متن لینک](/tadris-shimi) · ![توضیح](آدرس عکس) — بین پاراگراف‌ها یک خط خالی بگذارید.";

export function ArticleForm({ a }: { a?: A }) {
  return (
    <Form action={saveArticle} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="id" value={a?.id ?? ""} />
      <Field label="عنوان (کلمه‌ی کلیدی اصلی را اول بیاورید)" className="sm:col-span-4"><input name="title" defaultValue={a?.title} className="input" required maxLength={120} /></Field>
      <Field label="آدرس (نامک) — خالی بگذارید تا از عنوان ساخته شود" className="sm:col-span-2"><input name="slug" defaultValue={a?.slug} className="input" dir="auto" /></Field>
      <Field label="دسته"><input name="category" defaultValue={a?.category ?? ""} className="input" placeholder="مثلاً: شیمی دوازدهم" /></Field>
      <Field label="تصویر کاور"><input name="cover" type="file" accept="image/*" className="input !py-2 text-xs" /></Field>
      <Field label="خلاصه (توضیح گوگل، حدود ۱۵۰ حرف)" className="sm:col-span-4"><textarea name="excerpt" defaultValue={a?.excerpt ?? ""} rows={2} maxLength={300} className="input" /></Field>
      <Field label="کلمات کلیدی (با ویرگول جدا کنید)" className="sm:col-span-4"><input name="keywords" defaultValue={a?.keywords ?? ""} className="input" placeholder="تدریس شیمی، شیمی کنکور، جواد پرتویی" /></Field>
      <Field label="متن مقاله" className="sm:col-span-4">
        <textarea name="body" defaultValue={a?.body ?? ""} rows={22} className="input font-mono !text-sm !leading-7" required />
        <span className="mt-1 block text-[11px] leading-6 text-white/45">{HELP}</span>
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="published" defaultChecked={a?.published ?? false} className="size-4" /> منتشر شود (در سایت و نقشه‌ی سایت گوگل)</label>
      <Submit className="btn-primary sm:col-span-2">{a ? "ذخیره مقاله" : "ساخت مقاله"}</Submit>
    </Form>
  );
}
