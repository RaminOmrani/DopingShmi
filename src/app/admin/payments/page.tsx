import Link from "next/link";
import { db } from "@/lib/db";
import { PageHead, Kpi } from "@/components/admin/ui";
import { faNum, fmtDate, fmtInt, fmtToman } from "@/lib/utils";

export const metadata = { title: "پرداخت‌ها" };
const ST: Record<string, [string, string]> = { PAID: ["موفق", "text-lime"], PENDING: ["نیمه‌کاره", "text-amber"], FAILED: ["ناموفق", "text-rose"] };

export default async function Payments({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (await searchParams).status;
  const [payments, total, month] = await Promise.all([
    db.payment.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { id: true, name: true, phone: true } } } }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    db.payment.aggregate({ where: { status: "PAID", paidAt: { gte: new Date(Date.now() - 30 * 86400000) } }, _sum: { amount: true }, _count: true }),
  ]);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="پرداخت‌ها" desc="تراکنش‌های درگاه زرین‌پال. برای دادن دسترسی رایگان یا دستی، از صفحه‌ی هر دانش‌آموز اقدام کنید." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="فروش کل" value={<span className="text-lg">{fmtToman(total._sum.amount ?? 0)}</span>} sub={`${fmtInt(total._count)} تراکنش`} />
        <Kpi label="فروش ۳۰ روز" value={<span className="text-lg">{fmtToman(month._sum.amount ?? 0)}</span>} sub={`${fmtInt(month._count)} تراکنش`} />
      </div>
      <div className="mb-4 flex gap-2">{[["", "همه"], ["PAID", "موفق"], ["FAILED", "ناموفق"], ["PENDING", "نیمه‌کاره"]].map(([k, l]) => <Link key={k} href={`?status=${k}`} className={`btn btn-sm ${(status ?? "") === k ? "btn-primary" : "btn-ghost"}`}>{l}</Link>)}</div>
      <div className="table-wrap card"><table className="table">
        <thead><tr><th>کاربر</th><th>بابت</th><th>مبلغ</th><th>وضعیت</th><th>کد پیگیری</th><th>زمان</th></tr></thead>
        <tbody>{payments.map((p) => (
          <tr key={p.id}><td><Link href={`/admin/users/${p.user.id}`} className="font-bold hover:text-cyan">{p.user.name || p.user.phone}</Link></td><td className="text-xs">{p.description}</td><td className="font-bold">{fmtToman(p.amount)}</td><td className={`text-xs ${ST[p.status]?.[1]}`}>{ST[p.status]?.[0]}{p.error ? ` — ${p.error}` : ""}</td><td className="text-xs">{p.refId ? faNum(p.refId) : "—"}</td><td className="text-xs text-white/50">{fmtDate(p.createdAt, true)}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
