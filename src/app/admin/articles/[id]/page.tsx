import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { deleteArticle } from "../actions";
import { faNum } from "@/lib/utils";

export const metadata = { title: "ویرایش مقاله" };

export default async function ArticleAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.article.findUnique({ where: { id } });
  if (!a) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/articles" className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-cyan"><ArrowRight className="size-4" /> مقالات</Link>
      <PageHead title={a.title} desc={`${a.published ? "منتشر شده" : "پیش‌نویس"} · ${faNum(a.views)} بازدید`}>
        {a.published && <Link href={`/articles/${encodeURIComponent(a.slug)}`} target="_blank" className="btn-ghost btn-sm">مشاهده در سایت</Link>}
      </PageHead>
      <section className="card mb-5 p-5"><ArticleForm a={a} /></section>
      <Form action={deleteArticle} confirm="این مقاله برای همیشه حذف شود؟"><input type="hidden" name="id" value={a.id} /><Submit className="btn-danger btn-sm">حذف مقاله</Submit></Form>
    </div>
  );
}
