import "server-only";
import { isIPv4, isIPv6 } from "node:net";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { IN_APP_RE } from "./playback-log";

/**
 * ذخیره‌ی گزارش‌های پخش ویدیو (سمت سرور) برای صفحه‌ی «گزارش پخش ویدیو» در پنل مدیریت.
 * هم مسیر جدید /api/playback-log و هم مسیر قدیمی /api/videos/[id]/error از اینجا ذخیره می‌کنند.
 */

/** رخدادهای پایانی (خلاصه‌ی تماشا، قطع کامل، بسته شدن ناگهانی) سهمیه‌ی جدا دارند تا پشت رخدادهای عادی گم نشوند */
export const TERMINAL_KINDS: ReadonlySet<string> = new Set(["giveup", "session-end", "abnormal-exit"]);
/** این رخدادها در لاگ pm2 هم یک خط می‌نویسند (pm2 logs doping | grep video-error) */
const LOUD_KINDS: ReadonlySet<string> = new Set(["giveup", "abnormal-exit", "frag-stall", "link-suspect", "refresh-bad", "js-error", "fatal", "native-error", "refresh-loop"]);

const HOUR = 3600_000;
const LIMIT = { normal: 60, terminal: 30 };
const CTX_MAX = 2000;
const INT_MAX = 2147483647;

/** یک رخداد معتبرشده (مطابق PlaybackEvent در playback-log.ts) */
export interface PlaybackInput {
  kind: string;
  sessionId: string;
  videoId?: string | null;
  engine?: string | null;
  build?: string | null;
  position?: number | null;
  sinceLoadSec?: number | null;
  code?: number | null;
  detail?: string | null;
  fatal?: boolean | null;
  ctx?: Record<string, unknown> | null;
  queued?: boolean | null;
  /** زمان رخداد به ساعت دستگاه (میلی‌ثانیه) */
  at?: number | null;
  /** شناسه‌ی یکتای رخداد از مرورگر؛ شناسه‌ی ردیف می‌شود تا ارسال دوباره (پاسخ گم‌شده) تکراری ذخیره نشود */
  eid?: string | null;
}

// ─── سهمیه‌ی هر کاربر (در حافظه؛ با ری‌استارت صفر می‌شود) ───

type Bucket = { since: number; normal: number; terminal: number };
const quotas = new Map<string, Bucket>();

function pruneQuotas(now: number) {
  for (const [k, q] of quotas) if (now - q.since > HOUR) quotas.delete(k);
  if (quotas.size > 5000) quotas.clear();
}

/**
 * رخدادهایی که در سهمیه‌ی ساعتی کاربر جا می‌شوند؛ بقیه دور ریخته می‌شوند.
 * release() سهمیه را برمی‌گرداند (وقتی ذخیره ناموفق بود و کلاینت دوباره می‌فرستد).
 */
export function admitEvents<T extends { kind: string }>(userId: string, events: T[]) {
  const now = Date.now();
  if (quotas.size > 5000) pruneQuotas(now);
  let q = quotas.get(userId);
  if (!q || now - q.since > HOUR) {
    q = { since: now, normal: 0, terminal: 0 };
    quotas.set(userId, q);
  }
  const bucket = q;
  const admitted: T[] = [];
  let normal = 0;
  let terminal = 0;
  for (const e of events) {
    if (TERMINAL_KINDS.has(e.kind)) {
      if (bucket.terminal >= LIMIT.terminal) continue;
      bucket.terminal++;
      terminal++;
    } else {
      if (bucket.normal >= LIMIT.normal) continue;
      bucket.normal++;
      normal++;
    }
    admitted.push(e);
  }
  const release = () => {
    bucket.normal = Math.max(0, bucket.normal - normal);
    bucket.terminal = Math.max(0, bucket.terminal - terminal);
  };
  return { admitted, release };
}

// ─── IP (فقط پیشوند /24 یا /48؛ برای تشخیص VPN خارجی یا اپراتور، نه شناسایی فرد) ───

function expandV6(ip: string) {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : Math.max(0, 8 - h.length - t.length); // فقط وقتی «::» دارد
  return [...h, ...Array<string>(fill).fill("0"), ...t];
}

/** 1.2.3.4 → 1.2.3.0 ؛ 2a01:5ec0:12:34::1 → 2a01:5ec0:12::/48 */
export function ipPrefix(raw?: string | null): string | undefined {
  let ip = (raw || "").trim();
  if (!ip) return undefined;
  if (ip.startsWith("[")) ip = ip.slice(1, ip.indexOf("]") > 0 ? ip.indexOf("]") : undefined); // [v6]:port
  ip = ip.replace(/%.*$/, ""); // zone id
  const v4 = ip.match(/^(?:::ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}(?::\d+)?$/i);
  if (v4 && isIPv4(`${v4[1]}.0`)) return `${v4[1]}.0`;
  if (!isIPv6(ip)) return undefined;
  const g = expandV6(ip.toLowerCase())
    .slice(0, 3)
    .map((x) => parseInt(x || "0", 16).toString(16));
  return `${g.join(":")}::/48`;
}

/** IP کاربر برای گزارش: پشت CDN آروان هدر ar-real-ip، بعد X-Real-IP از nginx (clientIp() لینک امن عمداً دست نخورده) */
export function telemetryIp(req: Request) {
  const h = req.headers;
  return ipPrefix(h.get("ar-real-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]);
}

// ─── پلتفرم (از ctx و User-Agent) ───

export type Platform = "ios-app" | "ios-safari" | "android-app" | "android-browser" | "in-app" | "desktop";
export const PLATFORMS: Platform[] = ["ios-app", "ios-safari", "android-app", "android-browser", "in-app", "desktop"];
export const PLATFORM_LABEL: Record<Platform, string> = {
  "ios-app": "آیفون · اپ صفحه‌ی اصلی",
  "ios-safari": "آیفون · سافاری",
  "android-app": "اندروید · اپ نصب‌شده",
  "android-browser": "اندروید · مرورگر",
  "in-app": "مرورگر داخلی پیام‌رسان",
  desktop: "کامپیوتر",
};

const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function platformOf(ctx: unknown, ua?: string | null): Platform {
  const c = asObj(ctx);
  const u = ua || "";
  if (c.inApp === true || IN_APP_RE.test(u)) return "in-app";
  const standalone = c.standalone === true;
  if (typeof c.ios === "string" || /iPhone|iPad|iPod/.test(u)) return standalone ? "ios-app" : "ios-safari";
  if (/Android/i.test(u)) return standalone ? "android-app" : "android-browser";
  return "desktop";
}

// ─── ذخیره ───

const toInt = (n: number | null | undefined, min = 0) => (typeof n === "number" && Number.isFinite(n) ? Math.min(INT_MAX, Math.max(min, Math.round(n))) : undefined);

/**
 * Postgres نویسه‌ی NUL (و در jsonb نیم‌جفت‌های UTF-16، مثلاً ایموجیِ نصفه‌بریده) را نمی‌پذیرد؛
 * یک رخداد این‌چنینی کل دسته را رد می‌کرد و کلاینت آن را بی‌پایان دوباره می‌فرستاد.
 */
const BAD_CHARS = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const clean = (v: string) => v.replace(BAD_CHARS, "");
const cleanStr = (v: string | null | undefined, max: number) => (v ? clean(v).slice(0, max) || undefined : undefined);
function cleanJson(v: unknown): unknown {
  if (typeof v === "string") return clean(v);
  if (Array.isArray(v)) return v.map(cleanJson);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [clean(k), cleanJson(x)]));
  return v;
}

/** کلیدهای کوچکی که برای جدول «دستگاه» و «نسخه» لازم‌اند؛ از ctx بیش از حد بزرگ فقط همین‌ها می‌مانند */
const CTX_KEEP = ["standalone", "inApp", "ios", "build", "vis", "online"];

/** ctx بزرگ‌تر از ۲۰۰۰ نویسه دور ریخته می‌شود (خود رخداد و چند کلید کوچک دستگاه می‌مانند) */
function cleanCtx(e: PlaybackInput, now: number): Prisma.InputJsonValue | undefined {
  let ctx: Record<string, unknown> | undefined;
  if (e.ctx) {
    const s = JSON.stringify(e.ctx);
    if (s.length <= CTX_MAX) ctx = cleanJson(JSON.parse(s)) as Record<string, unknown>;
    else {
      ctx = { _tooBig: s.length };
      for (const k of CTX_KEEP) {
        const v = e.ctx[k];
        if (typeof v === "boolean" || typeof v === "number" || (typeof v === "string" && v.length <= 40)) ctx[k] = cleanJson(v);
      }
    }
  }
  // رخداد صف‌شده (آفلاین): چند ثانیه بعد از وقوع رسید
  if (e.queued && typeof e.at === "number" && Number.isFinite(e.at)) ctx = { ...ctx, _lagSec: Math.round((now - e.at) / 1000) };
  return ctx as Prisma.InputJsonValue | undefined;
}

let dbErrorAt = 0;
let dbErrorsHidden = 0;
/** خطای پایگاه داده در گزارش‌گیری: حداکثر هر ۱۰ دقیقه یک خط لاگ (کلاینت خودش دوباره می‌فرستد) */
export function logTelemetryError(e: unknown) {
  const now = Date.now();
  if (now - dbErrorAt < 600_000) {
    dbErrorsHidden++;
    return;
  }
  console.error(`[playback-log] db error${dbErrorsHidden ? ` (+${dbErrorsHidden} more)` : ""}:`, e instanceof Error ? e.message.slice(0, 300) : e);
  dbErrorAt = now;
  dbErrorsHidden = 0;
}

/**
 * ذخیره‌ی رخدادها؛ در صورت خطای پایگاه داده false (بدون پرتاب خطا).
 * log=false برای مسیر قدیمی که خودش خط لاگ را می‌نویسد.
 */
export async function storePlaybackEvents(userId: string | null, req: Request, events: PlaybackInput[], opts: { log?: boolean } = {}): Promise<boolean> {
  if (!events.length) return true;
  const now = Date.now();
  const ua = cleanStr(req.headers.get("user-agent"), 200);
  const ip = telemetryIp(req);
  const rows: Prisma.PlaybackEventCreateManyInput[] = events.map((e) => ({
    ...(e.eid && /^[A-Za-z0-9-]{8,40}$/.test(e.eid) ? { id: e.eid } : {}),
    userId,
    videoId: cleanStr(e.videoId, 40),
    sessionId: cleanStr(e.sessionId, 40) || "-",
    kind: e.kind,
    engine: cleanStr(e.engine, 10),
    build: cleanStr(e.build, 20),
    position: toInt(e.position),
    sinceLoadSec: toInt(e.sinceLoadSec),
    code: toInt(e.code, -INT_MAX),
    fatal: e.fatal ?? undefined,
    detail: cleanStr(e.detail, 300),
    ctx: cleanCtx(e, now),
    ua,
    ip,
    queued: !!e.queued,
  }));

  if (opts.log !== false) {
    for (const r of rows) {
      if (!LOUD_KINDS.has(r.kind)) continue;
      const line = {
        user: userId,
        video: r.videoId,
        sid: r.sessionId.slice(0, 8),
        kind: r.kind,
        engine: r.engine,
        build: r.build,
        pos: r.position,
        since: r.sinceLoadSec,
        code: r.code,
        fatal: r.fatal,
        detail: r.detail?.slice(0, 160),
        plat: platformOf(r.ctx, ua),
        ip,
        queued: r.queued || undefined,
      };
      console.warn(`[video-error] ${JSON.stringify(line)}`);
    }
  }

  try {
    // تکراری (همان eid) بی‌صدا رد می‌شود: تحویل «دست‌کم یک بار» است و جمع دقیقه‌ها نباید دو برابر شود
    await db.playbackEvent.createMany({ data: rows, skipDuplicates: true });
    return true;
  } catch (e) {
    logTelemetryError(e);
  }
  // شاید فقط داده‌ی یک رخداد ایراد داشت: یک بار بدون ctx و توضیح؛ اگر این هم نشد، پایگاه داده در دسترس نیست (کلاینت دوباره می‌فرستد)
  try {
    await db.playbackEvent.createMany({ data: rows.map((r) => ({ ...r, ctx: { _dropped: true }, detail: undefined })), skipDuplicates: true });
    return true;
  } catch {
    return false;
  }
}
