"use client";
import { useState } from "react";
import { ShoppingBag, Loader2 } from "lucide-react";
import { toast } from "./ui/Toast";

export function BuyButton({ type, id, label = "خرید و دسترسی", loggedIn, className = "" }: { type: "TOPIC" | "BUNDLE"; id: string; label?: string; loggedIn: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!loggedIn) {
      location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
      return;
    }
    setBusy(true);
    const r = await fetch("/api/pay/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id }) });
    const d = await r.json().catch(() => ({}));
    if (d.url) location.href = d.url;
    else {
      toast.err(d.error || "خطا در اتصال به درگاه");
      setBusy(false);
    }
  };
  return (
    <button onClick={go} disabled={busy} className={`btn-primary ${className}`}>
      {busy ? <Loader2 className="size-5 animate-spin" /> : <ShoppingBag className="size-5" />} {label}
    </button>
  );
}
