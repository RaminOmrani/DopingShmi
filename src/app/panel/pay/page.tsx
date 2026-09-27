import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { faNum, fmtToman } from "@/lib/utils";

export default async function PayResult({ searchParams }: { searchParams: Promise<{ ok?: string; pid?: string; msg?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const p = sp.pid ? await db.payment.findFirst({ where: { id: sp.pid, userId: user.id } }) : null;
  const ok = sp.ok === "1" && p?.status === "PAID";
  return (
    <div className="mx-auto max-w-md pt-10">
      <div className="card glow-border p-8 text-center">
        {ok ? <CheckCircle2 className="mx-auto mb-4 size-16 text-lime" /> : <XCircle className="mx-auto mb-4 size-16 text-rose" />}
        <h1 className="mb-2 text-xl font-black">{ok ? "پرداخت موفق" : "پرداخت ناموفق"}</h1>
        {p && <p className="mb-1 text-white/70">{p.description} · {fmtToman(p.amount)}</p>}
        {ok && p?.refId && <p className="mb-4 text-sm text-white/50">کد پیگیری: {faNum(p.refId)}</p>}
        {!ok && <p className="mb-4 text-sm text-white/55">{sp.msg || "در صورت کسر وجه، مبلغ ظرف ۷۲ ساعت به حساب شما برمی‌گردد."}</p>}
        <Link href={ok && p?.itemType === "TOPIC" ? `/panel/videos/topic/${p.itemId}` : "/panel/videos"} className="btn-primary w-full">{ok ? "رفتن به ویدیوها" : "بازگشت"}</Link>
      </div>
    </div>
  );
}
