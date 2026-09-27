"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/Toast";

export type ActionResult = { ok?: boolean; error?: string; message?: string; data?: unknown } | null;
type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/** فرم با server action + اعلان نتیجه */
export function Form({ action, children, className = "", reset = false, confirm: confirmText, onDone }: { action: Action; children: React.ReactNode; className?: string; reset?: boolean; confirm?: string; onDone?: (r: ActionResult) => void }) {
  // اعلان داخل خود action نمایش داده می‌شود تا اگر فرم بعد از ذخیره از صفحه حذف شد (مثل تأیید رسید)، پیام گم نشود
  const [state, run] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await action(prev, fd);
    if (r?.error) toast.err(r.error);
    else if (r?.ok) toast.ok(r.message || "ذخیره شد");
    return r;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    if (state.ok && reset) ref.current?.reset();
    onDone?.(state);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form
      ref={ref}
      action={run}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function Submit({ children, className = "btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? <><Loader2 className="size-4 animate-spin" /> {pendingText ?? ""}</> : children}
    </button>
  );
}
