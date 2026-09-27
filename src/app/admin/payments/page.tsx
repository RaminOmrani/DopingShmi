import Link from "next/link";
import { db } from "@/lib/db";
import { PageHead, Kpi } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { approveCard, rejectCard } from "./actions";
import { faNum, fmtDate, fmtInt, fmtToman } from "@/lib/utils";

export const metadata = { title: "پرداخت‌ها" };
const ST: Record<string, [string, string]> = { PAID: ["موفق", "text-lime"], PENDING: ["نیمه‌کاره", "text-amber"], REVIEW: ["در انتظار تأیید", "text-cyan"], FAILED: ["ناموفق", "text-rose"] };

export default async function Payments({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (await searchParams).status;
  const [review, payments, total, month] = await Promise.all([
    db.payment.findMany({ where: { status: "REVIEW" }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, phone: true } } } }),
    db.payment.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { id: true, name: true, phone: true } } } }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    db.payment.aggregate({ where: { status: "PAID", paidAt: { gte: new Date(Date.now() - 30 * 86400000) } }, _sum: { amount: true }, _count: true }),
  ]);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="پرداخت‌ها" desc="رسیدهای کارت‌به‌کارت و تراکنش‌های درگاه. برای دادن دسترسی رایگان یا دستی، از صفحه‌ی هر دانش‌آموز اقدام کنید." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="فروش کل" value={<span className="text-lg">{fmtToman(total._sum.amount ?? 0)}</span>} sub={`${fmtInt(total._count)} تراکنش`} />
        <Kpi label="فروش ۳۰ روز" value={<span className="text-lg">{fmtToman(month._sum.amount ?? 0)}</span>} sub={`${fmtInt(month._count)} تراکنش`} />
      </div>
      {review.length > 0 && (
        <section className="card glow-border mb-6 p-5">
          <h2 className="mb-4 font-black">رسیدهای کارت‌به‌کارت در انتظار تأیید ({faNum(review.length)})</h2>
          <div className="grid gap-3">
            {review.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/[.04] p-4">
                {p.receiptUrl && (
                  <a href={p.receiptUrl} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.receiptUrl} alt="رسید" className="size-20 rounded-xl object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <Link href={`/admin/users/${p.user.id}`} className="font-bold hover:text-cyan">{p.user.name || p.user.phone}</Link> <span dir="ltr" className="text-xs text-white/45">{faNum(p.user.phone)}</span>
                  <p className="text-white/70">{p.description} · <b className="text-white">{fmtToman(p.amount)}</b></p>
                  <p className="text-xs text-white/55">پیگیری / ۴ رقم کارت: <b dir="ltr" className="text-cyan">{p.tracking}</b> · {fmtDate(p.createdAt, true)}</p>
                </div>
                <Form action={approveCard}><input type="hidden" name="id" value={p.id} /><Submit className="btn btn-sm border border-lime/30 bg-lime/10 text-lime">تأیید و فعال‌سازی</Submit></Form>
                <Form action={rejectCard} confirm="این رسید رد شود؟" className="flex gap-1.5"><input type="hidden" name="id" value={p.id} /><input name="reason" className="input !w-40 !py-1.5 text-xs" placeholder="دلیل رد (اختیاری)" /><Submit className="btn-danger btn-sm">رد</Submit></Form>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="mb-4 flex gap-2">{[["", "همه"], ["REVIEW", "در انتظار تأیید"], ["PAID", "موفق"], ["FAILED", "ناموفق"], ["PENDING", "نیمه‌کاره"]].map(([k, l]) => <Link key={k} href={`?status=${k}`} className={`btn btn-sm ${(status ?? "") === k ? "btn-primary" : "btn-ghost"}`}>{l}</Link>)}</div>
      <div className="table-wrap card"><table className="table">
        <thead><tr><th>کاربر</th><th>بابت</th><th>مبلغ</th><th>روش</th><th>وضعیت</th><th>کد پیگیری</th><th>زمان</th></tr></thead>
        <tbody>{payments.map((p) => (
          <tr key={p.id}><td><Link href={`/admin/users/${p.user.id}`} className="font-bold hover:text-cyan">{p.user.name || p.user.phone}</Link></td><td className="text-xs">{p.description}</td><td className="font-bold">{fmtToman(p.amount)}</td><td className="text-xs">{p.method === "CARD" ? "کارت‌به‌کارت" : "درگاه"}</td><td className={`text-xs ${ST[p.status]?.[1]}`}>{ST[p.status]?.[0]}{p.error ? ` — ${p.error}` : ""}</td><td className="text-xs" dir="ltr">{p.refId ? faNum(p.refId) : p.tracking ? faNum(p.tracking) : "—"}</td><td className="text-xs text-white/50">{fmtDate(p.createdAt, true)}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
