/**
 * فراخوانی مستقیم API پلتفرم ویدیوی آروان (VOD 2.0) — بدون وابستگی به Next، تا اسکریپت‌های سرور هم از آن استفاده کنند.
 * آپلود فایل با پروتکل TUS (قابل ادامه): POST /channels/{id}/files ← PATCH تکه‌ها ← POST /channels/{id}/videos
 */
export const ARVAN_API = (process.env.ARVAN_API_BASE || "https://napi.arvancloud.ir/vod/2.0").replace(/\/$/, "");

export function authHeader(key: string) {
  const k = key.trim();
  return /^apikey\s/i.test(k) ? k : `Apikey ${k}`;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ArvanListVideo {
  id: string;
  title: string;
  status: string;
  duration: number;
  thumbnail?: string;
  createdAt?: string;
  channelId?: string;
}

export function arvanApi(apiKey: string) {
  const auth = authHeader(apiKey);

  async function json(pathOrUrl: string, init: RequestInit = {}, timeoutMs = 20000) {
    const url = /^https?:/.test(pathOrUrl) ? pathOrUrl : `${ARVAN_API}${pathOrUrl}`;
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: auth, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `خطای آروان (${res.status})`);
    return data;
  }

  async function offset(uploadUrl: string): Promise<number | null> {
    const res = await fetch(uploadUrl, { method: "HEAD", headers: { Authorization: auth, "tus-resumable": "1.0.0" }, signal: AbortSignal.timeout(30000) });
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) throw new Error(`بررسی آپلود ناموفق (${res.status})`);
    const v = res.headers.get("upload-offset");
    return v == null ? null : Number(v);
  }

  return {
    json,

    async channels() {
      const r = await json("/channels");
      return (r?.data ?? []) as { id: string; title: string }[];
    },

    /** ساخت فضای خالی برای آپلود؛ خروجی: آدرس TUS فایل */
    async createUpload(channelId: string, size: number, fileName: string, mime: string) {
      const res = await fetch(`${ARVAN_API}/channels/${encodeURIComponent(channelId)}/files`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "tus-resumable": "1.0.0",
          "upload-length": String(size),
          "upload-metadata": `filename ${b64(fileName)},filetype ${b64(mime)}`,
        },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`ساخت آپلود در آروان ناموفق (${res.status}): ${(await res.text()).slice(0, 200)}`);
      const loc = res.headers.get("location");
      if (!loc) throw new Error("آروان آدرس آپلود را برنگرداند");
      return new URL(loc, `${ARVAN_API}/`).toString();
    },

    offset,

    /** ارسال فایل از offset مشخص؛ در خطا offset واقعی را می‌پرسد و ادامه می‌دهد */
    async upload(uploadUrl: string, readChunk: (pos: number, len: number) => Buffer, size: number, from: number, onProgress?: (sent: number) => void) {
      const CHUNK = 32 * 1024 * 1024;
      let pos = from;
      let fails = 0;
      while (pos < size) {
        const len = Math.min(CHUNK, size - pos);
        try {
          const res = await fetch(uploadUrl, {
            method: "PATCH",
            headers: { Authorization: auth, "tus-resumable": "1.0.0", "upload-offset": String(pos), "content-type": "application/offset+octet-stream" },
            body: new Uint8Array(readChunk(pos, len)),
            signal: AbortSignal.timeout(15 * 60 * 1000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
          const next = Number(res.headers.get("upload-offset"));
          pos = Number.isFinite(next) && next > pos ? next : pos + len;
          fails = 0;
          onProgress?.(pos);
        } catch (e) {
          if (++fails > 8) throw e;
          await sleep(Math.min(60000, 2000 * 2 ** fails));
          const real = await offset(uploadUrl).catch(() => undefined);
          if (real === null) throw new Error("آپلود در آروان منقضی شد");
          if (typeof real === "number") pos = real;
        }
      }
    },

    /** تبدیل فایل آپلودشده به ویدیو؛ خروجی: شناسه‌ی ویدیو */
    async createVideo(channelId: string, o: { title: string; fileId: string; profileId?: string }) {
      const body = {
        title: o.title.slice(0, 200),
        file_id: o.fileId,
        convert_mode: o.profileId ? "profile" : "auto",
        ...(o.profileId ? { profile_id: o.profileId } : {}),
        parallel_convert: false,
        thumbnail_time: 10,
      };
      const r = await json(`/channels/${encodeURIComponent(channelId)}/videos`, { method: "POST", body: JSON.stringify(body) }, 60000);
      const id = r?.data?.id ?? r?.id;
      if (!id) throw new Error("آروان شناسه‌ی ویدیو را برنگرداند");
      return String(id);
    },

    async updateVideo(videoId: string, title: string) {
      await json(`/videos/${encodeURIComponent(videoId)}`, { method: "PATCH", body: JSON.stringify({ title: title.slice(0, 200) }) });
    },

    /** همه‌ی ویدیوهای یک کانال (همه‌ی صفحه‌ها) */
    async videos(channelId: string): Promise<ArvanListVideo[]> {
      const out: ArvanListVideo[] = [];
      for (let page = 1; page <= 40; page++) {
        const r = await json(`/channels/${encodeURIComponent(channelId)}/videos?page=${page}&per_page=100`);
        const list: Record<string, unknown>[] = r?.data ?? [];
        for (const d of list) {
          const info = d.file_info as { general?: { duration?: number } } | undefined;
          out.push({
            id: String(d.id),
            title: String(d.title ?? ""),
            status: String(d.status ?? ""),
            duration: Math.round(Number(info?.general?.duration ?? d.duration ?? 0)) || 0,
            thumbnail: (d.thumbnail_url as string) || undefined,
            createdAt: (d.created_at as string) || undefined,
            channelId,
          });
        }
        const last = Number(r?.meta?.last_page ?? 0);
        if (!list.length || (last ? page >= last : !r?.links?.next)) break;
      }
      return out;
    },
  };
}

/** شناسه‌ی فایل از آدرس TUS (آخرین بخش مسیر) */
export const fileIdFromUploadUrl = (u: string) => new URL(u).pathname.split("/").filter(Boolean).pop() || "";
