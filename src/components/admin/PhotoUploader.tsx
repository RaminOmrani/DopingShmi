"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { uploadPhoto } from "@/app/admin/photos/actions";

export function PhotoUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [section, setSection] = useState("CONFERENCE");
  const [eventName, setEventName] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const router = useRouter();

  const upload = async () => {
    if (!files.length) return toast.err("عکسی انتخاب نشده");
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress(i);
      const fd = new FormData();
      fd.set("file", files[i]);
      fd.set("section", section);
      fd.set("eventName", eventName);
      const r = await uploadPhoto(fd);
      if (r.ok) ok++;
      else toast.err(`${files[i].name}: ${r.error}`);
    }
    setProgress(null);
    setFiles([]);
    toast.ok(`${ok} عکس بارگذاری شد`);
    router.refresh();
  };

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <label className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-white/15 p-6 text-center transition hover:border-cyan/50 sm:col-span-4">
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        <ImagePlus className="mb-2 size-9 text-cyan" />
        <span className="text-sm font-bold">{files.length ? `${files.length} عکس انتخاب شد` : "انتخاب عکس‌ها (چندتایی)"}</span>
        <span className="text-xs text-white/45">عکس‌ها خودکار بهینه و به WebP تبدیل می‌شوند</span>
      </label>
      <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
        <option value="CONFERENCE">همایش (نوار بالای سایت + گالری)</option>
        <option value="GALLERY">فقط گالری</option>
        <option value="TEACHER">عکس اصلی استاد (بخش معرفی)</option>
      </select>
      <input className="input sm:col-span-2" placeholder="نام همایش (مثلاً همایش جمع‌بندی ۱۴۰۵ — مشهد)" value={eventName} onChange={(e) => setEventName(e.target.value)} />
      <button onClick={upload} disabled={progress !== null} className="btn-primary">
        {progress !== null ? <><Loader2 className="size-4 animate-spin" /> {progress + 1} از {files.length}</> : "بارگذاری"}
      </button>
    </div>
  );
}
