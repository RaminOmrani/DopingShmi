"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { faNum } from "@/lib/utils";

interface Play { hls?: string | null; mp4?: string | null; playerUrl?: string | null; poster?: string | null; lastPosition: number; watermark: string | null; duration: number }

export function VideoPlayer({ videoId }: { videoId: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<Play | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wm, setWm] = useState({ x: 10, y: 10 });
  const [done, setDone] = useState(false);
  const acc = useRef({ delta: 0, lastT: -1, sentAt: 0 });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/${videoId}/play`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) setErr(d.error || "خطا در بارگذاری ویدیو");
        else setData(d);
      })
      .catch(() => !cancelled && setErr("اتصال برقرار نشد"));
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // اتصال HLS
  useEffect(() => {
    const v = ref.current;
    if (!v || !data) return;
    let hls: import("hls.js").default | null = null;
    const src = data.hls || data.mp4;
    if (!src) return;
    if (data.hls && !v.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) return setErr("مرورگر شما از پخش این ویدیو پشتیبانی نمی‌کند");
        hls = new Hls({ capLevelToPlayerSize: true, startLevel: -1 });
        hls.loadSource(data.hls!);
        hls.attachMedia(v);
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (d.fatal) setErr("پخش ویدیو با خطا مواجه شد؛ صفحه را دوباره باز کنید (ممکن است لینک منقضی شده باشد)");
        });
      });
    } else v.src = src;
    const onMeta = () => {
      if (data.lastPosition > 5 && data.lastPosition < v.duration - 10) v.currentTime = data.lastPosition;
    };
    v.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => {
      hls?.destroy();
    };
  }, [data]);

  // ارسال پیشرفت
  useEffect(() => {
    const v = ref.current;
    if (!v || !data) return;
    const send = (force = false) => {
      const a = acc.current;
      if (!force && Date.now() - a.sentAt < 15000) return;
      if (a.delta < 1 && !force) return;
      const delta = Math.round(a.delta);
      a.delta = 0;
      a.sentAt = Date.now();
      const payload = JSON.stringify({ position: v.currentTime || 0, delta, duration: v.duration || 0 });
      if (force && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/videos/${videoId}/progress`, new Blob([payload], { type: "application/json" }));
        return;
      }
      fetch(`/api/videos/${videoId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
        .then((r) => r.json())
        .then((d) => {
          if (d.justCompleted) {
            setDone(true);
            toast.ok(`آفرین! ویدیو کامل شد و ${faNum(d.bonus)} امتیاز گرفتی 🎉`);
          }
        })
        .catch(() => {});
    };
    const onTime = () => {
      const a = acc.current;
      const t = v.currentTime;
      if (a.lastT >= 0 && !v.paused && !v.seeking) {
        const d = t - a.lastT;
        if (d > 0 && d < 2.5) a.delta += d;
      }
      a.lastT = t;
      send();
    };
    const onSeek = () => (acc.current.lastT = v.currentTime);
    const onPause = () => send(true);
    const onHide = () => document.visibilityState === "hidden" && send(true);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeek);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      send(true);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeek);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [data, videoId]);

  // جابه‌جایی واترمارک
  useEffect(() => {
    if (!data?.watermark) return;
    const t = setInterval(() => setWm({ x: 5 + Math.random() * 70, y: 5 + Math.random() * 80 }), 7000);
    return () => clearInterval(t);
  }, [data?.watermark]);

  if (err)
    return (
      <div className="grid aspect-video place-items-center rounded-3xl border border-white/10 bg-black/60 p-6 text-center">
        <div>
          {err.includes("تهیه") ? <Lock className="mx-auto mb-3 size-10 text-amber" /> : <AlertTriangle className="mx-auto mb-3 size-10 text-rose" />}
          <p className="text-sm text-white/75">{err}</p>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="grid aspect-video place-items-center rounded-3xl border border-white/10 bg-black/60">
        <Loader2 className="size-10 animate-spin text-cyan" />
      </div>
    );

  if (data.playerUrl)
    return (
      <div className="relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-black">
        <iframe src={data.playerUrl} className="size-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_30px_80px_-30px_rgba(139,92,246,.6)]" onContextMenu={(e) => e.preventDefault()}>
      <video ref={ref} poster={data.poster ?? undefined} controls playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture={false} className="aspect-video w-full bg-black" />
      {data.watermark && (
        <span className="pointer-events-none absolute select-none text-xs font-bold text-white/25 transition-all duration-[2000ms]" style={{ left: `${wm.x}%`, top: `${wm.y}%` }} dir="ltr">
          {data.watermark}
        </span>
      )}
      {done && <span className="chip absolute right-3 top-3 !border-lime/40 !bg-black/60 !text-lime"><CheckCircle2 className="size-3.5" /> دیده شد</span>}
    </div>
  );
}
