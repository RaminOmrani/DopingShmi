"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, Loader2, Copy, CreditCard, X, CheckCircle2, Clock } from "lucide-react";
import { toast } from "./ui/Toast";

interface CardInfo { cards: { number: string; owner: string; bank: string }[]; note: string; amount: number; title: string; pending: boolean }

const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (s: string | number) => String(s).replace(/\d/g, (d) => FA[Number(d)]);
const groupCard = (n: string) => n.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1-");

export function BuyButton({ type, id, label = "خرید و دسترسی", loggedIn, className = "" }: { type: "TOPIC" | "BUNDLE"; id: string; label?: string; loggedIn: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<CardInfo | null>(null);
  const [sent, setSent] = useState(false);

  const go = async () => {
    if (!loggedIn) {
      location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
      return;
    }
    setBusy(true);
    const r = await fetch("/api/pay/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (d.url) {
      setBusy(true);
      location.href = d.url;
    } else if (d.card) {
      setSent(d.card.pending);
      setCard(d.card);
    } else toast.err(d.error || "خطا در اتصال به درگاه");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    fd.set("id", id);
    setBusy(true);
    const r = await fetch("/api/pay/card", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast.err(d.error || "خطا در ثبت رسید");
    setSent(true);
    toast.ok("رسید ثبت شد؛ پس از تأیید، دسترسی فعال می‌شود");
  };

  return (
    <>
      <button onClick={go} disabled={busy} className={`btn-primary ${className}`}>
        {busy && !card ? <Loader2 className="size-5 animate-spin" /> : <ShoppingBag className="size-5" />} {label}
      </button>
      <AnimatePresence>
        {card && (
          <motion.div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCard(null)}>
            <motion.div className="card glow-border w-full max-w-md p-6" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <p className="flex items-center gap-2 font-black"><CreditCard className="size-5 text-cyan" /> پرداخت کارت‌به‌کارت</p>
                <button onClick={() => setCard(null)} className="btn-ghost btn-sm !p-2" aria-label="بستن"><X className="size-4" /></button>
              </div>
              <p className="mb-1 text-sm text-white/60">{card.title}</p>
              <p className="mb-4 text-2xl font-black text-gradient">{Number(card.amount).toLocaleString("fa-IR")} تومان</p>

              {sent ? (
                <div className="rounded-2xl border border-amber/30 bg-amber/10 p-4 text-center">
                  <Clock className="mx-auto mb-2 size-8 text-amber" />
                  <p className="font-bold">رسید شما در حال بررسی است</p>
                  <p className="mt-1 text-xs leading-6 text-white/60">بعد از تأیید، دسترسی فعال می‌شود و پیامک تأیید برایتان ارسال خواهد شد. اگر اطلاعات را اشتباه وارد کرده‌اید، می‌توانید دوباره ثبت کنید.</p>
                  <button onClick={() => setSent(false)} className="btn-ghost btn-sm mt-3">ثبت دوباره‌ی رسید</button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs leading-6 text-white/60">{card.note}</p>
                  <div className="mb-4 grid gap-2">
                    {card.cards.map((c) => (
                      <div key={c.number} className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet/20 to-cyan/10 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-lg font-black tracking-wider" dir="ltr">{fa(groupCard(c.number))}</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(c.number.replace(/\D/g, "")).then(() => toast.ok("شماره کارت کپی شد"))} className="btn-ghost btn-sm"><Copy className="size-4" /> کپی</button>
                        </div>
                        {(c.owner || c.bank) && <p className="mt-1 text-xs text-white/60">{c.owner}{c.owner && c.bank ? " · " : ""}{c.bank ? `بانک ${c.bank}` : ""}</p>}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={submit} className="space-y-3">
                    <input name="tracking" className="input" inputMode="numeric" placeholder="شماره پیگیری یا ۴ رقم آخر کارت خودتان *" required />
                    <label className="block">
                      <span className="label">تصویر رسید (اختیاری)</span>
                      <input name="receipt" type="file" accept="image/*" className="input !py-2 text-xs" />
                    </label>
                    <button disabled={busy} className="btn-primary w-full">{busy ? <Loader2 className="size-5 animate-spin" /> : <><CheckCircle2 className="size-5" /> واریز کردم، ثبت رسید</>}</button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
