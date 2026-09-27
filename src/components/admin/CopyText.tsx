"use client";
import { Copy } from "lucide-react";
import { toast } from "@/components/ui/Toast";

export function CopyText({ text }: { text: string }) {
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(text).then(() => toast.ok("کپی شد"))} className="btn-ghost btn-sm !px-2" title="کپی">
      <Copy className="size-3.5" />
    </button>
  );
}
