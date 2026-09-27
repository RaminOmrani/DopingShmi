"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { approveUser } from "./actions";
import { toast } from "@/components/ui/Toast";

export function ApproveButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (ok: boolean) =>
    start(async () => {
      await approveUser(id, ok);
      toast.ok(ok ? "تأیید شد و پیامک خوش‌آمد ارسال شد" : "رد شد");
      router.refresh();
    });
  return (
    <div className="flex gap-1.5">
      <button disabled={pending} onClick={() => act(true)} className="btn btn-sm border border-lime/30 bg-lime/10 text-lime hover:bg-lime/20">{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} تأیید</button>
      <button disabled={pending} onClick={() => act(false)} className="btn btn-sm border border-rose/30 bg-rose/10 text-rose hover:bg-rose/20"><X className="size-4" /></button>
    </div>
  );
}
