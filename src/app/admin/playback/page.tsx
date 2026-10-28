import Link from "next/link";
import { X } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { PageHead, Kpi } from "@/components/admin/ui";
import { PLATFORMS, PLATFORM_LABEL, platformOf, type Platform } from "@/lib/playback-store";
import { isInfoKind, KINDS, kindLabel, kindTone, TONE_CLASS } from "./kinds";
import { faNum, fmtClock, fmtDate, fmtInt, fmtPct, normalizePhone, toEnDigits } from "@/lib/utils";

export const metadata = { title: "گزارش پخش ویدیو" };

const RANGES = {
  "24h": { label: "۲۴ ساعت اخیر", ms: 86400000 },
  "7d": { label: "۷ روز اخیر", ms: 7 * 86400000 },
  "30d": { label: "۳۰ روز اخیر", ms: 30 * 86400000 },
} as const;
type Range = keyof typeof RANGES;
/** سقف ردیف‌هایی که برای جدول دستگاه‌ها و دقیقه‌های تماشا خوانده می‌شود */
const SAMPLE = 5000;
const ENGINE_LABEL: Record<string, string> = { hls: "hls.js", native: "پخش‌کننده‌ی گوشی", file: "فایل مستقیم" };

type SP = { range?: string; kind?: string; video?: string; user?: string; sid?: string };
/** پارامتر تکراری در آدرس (?kind=a&kind=b) آرایه می‌آید؛ فقط اولی */
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
/** این رخدادها در هر بار تماشا یک بار می‌آیند و مشکل نیستند؛ در نمونه‌ی مشکلات خوانده نمی‌شوند تا سقف نمونه پر نشود */
const NOT_ISSUES = ["session-end", "engine", "retry-ok"];
/** رخدادهایی که در جدول «ویدیوها و شبکه‌های پرمشکل» شمرده می‌شوند */
const TROUBLE = ["giveup", "frag-stall", "hls-stall", "abnormal-exit", "link-suspect", "refresh-loop", "load-fail", "recover-stuck", "long-stall"];

const ctxNum = (ctx: unknown, key: string) => {
  const v = ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>)[key] : undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

/** بازه‌ی زمان رخداد پس از باز شدن صفحه (برای دیدن این‌که مشکل‌ها واقعاً حوالی دقیقه‌ی ۲ تا ۳ جمع‌اند یا نه) */
const MINUTE_BUCKETS = ["۰–۱", "۱–۲", "۲–۳", "۳+"];
const minuteBucket = (sec: number | null) => (sec === null ? -1 : Math.min(3, Math.floor(sec / 60)));

type Cell = { platform: Platform; engine: string; sessions: Set<string>; playedSec: number; giveupSessions: Set<string>; giveups: number; fragStalls: number; abnormal: number; hidden: number; other: number };

export default async function PlaybackReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // بررسی خود صفحه، پیش از هر کوئری: layout در ناوبری RSC دوباره اجرا نمی‌شود و جلوی رندر صفحه را نمی‌گیرد
  await requireAdmin();
  const q = await searchParams;
  const sp: SP = { range: first(q.range), kind: first(q.kind), video: first(q.video), user: first(q.user), sid: first(q.sid) };
  const range: Range = sp.range && sp.range in RANGES ? (sp.range as Range) : "24h";
  const since = new Date(Date.now() - RANGES[range].ms);
  const sid = (sp.sid ?? "").trim().toLowerCase();

  // فیلتر دانش‌آموز: شماره موبایل (از فرم) یا شناسه (از لینک‌های جدول)؛
  // رقم‌های بعضی شناسه‌ها شبیه شماره موبایل‌اند، پس شناسه همیشه هم امتحان می‌شود
  const userQ = toEnDigits(sp.user ?? "").trim();
  const phone = normalizePhone(userQ);
  const filterUser = userQ
    ? await db.user.findFirst({ where: phone ? { OR: [{ phone }, { id: userQ }] } : { id: userQ }, select: { id: true, name: true, phone: true } })
    : null;

  const scope: Prisma.PlaybackEventWhereInput = {
    createdAt: { gte: since },
    ...(sp.video ? { videoId: sp.video } : {}),
    ...(userQ ? { userId: filterUser?.id ?? "—" } : {}),
    ...(sid ? { sessionId: { startsWith: sid } } : {}),
  };

  const trouble: Prisma.PlaybackEventWhereInput = { ...scope, kind: { in: TROUBLE } };
  const [byKind, byBuild, endRows, issueRows, recent, topVideos, topNets] = await Promise.all([
    db.playbackEvent.groupBy({ by: ["kind"], where: scope, _count: { _all: true } }),
    db.playbackEvent.groupBy({ by: ["build"], where: scope, _count: { _all: true }, _max: { createdAt: true } }),
    db.playbackEvent.findMany({ where: { ...scope, kind: "session-end" }, orderBy: { createdAt: "desc" }, take: SAMPLE, select: { sessionId: true, engine: true, ctx: true, ua: true, createdAt: true } }),
    db.playbackEvent.findMany({ where: { ...scope, kind: { notIn: NOT_ISSUES } }, orderBy: { createdAt: "desc" }, take: SAMPLE, select: { sessionId: true, kind: true, engine: true, sinceLoadSec: true, ctx: true, ua: true, createdAt: true } }),
    db.playbackEvent.findMany({ where: { ...scope, ...(sp.kind ? { kind: sp.kind } : {}) }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.playbackEvent.groupBy({ by: ["videoId"], where: { ...trouble, videoId: { not: null } }, _count: { _all: true }, orderBy: { _count: { videoId: "desc" } }, take: 8 }),
    db.playbackEvent.groupBy({ by: ["ip"], where: { ...trouble, ip: { not: null } }, _count: { _all: true }, orderBy: { _count: { ip: "desc" } }, take: 8 }),
  ]);

  const userIds = [...new Set(recent.map((e) => e.userId).filter((x): x is string => !!x))];
  const videoIds = [...new Set([...recent.map((e) => e.videoId), ...topVideos.map((r) => r.videoId), sp.video].filter((x): x is string => !!x))];
  const [users, videos] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, phone: true } }),
    db.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, title: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const videoById = new Map(videos.map((v) => [v.id, v.title]));

  // دو نمونه‌ی جدا (خلاصه‌ها و مشکلات) با سقف، بازه‌های زمانی متفاوتی را می‌پوشانند؛ هر دو به بازه‌ی مشترک بریده می‌شوند
  // تا شاخص‌ها و درصدها از یک بازه باشند
  const oldest = (rows: { createdAt: Date }[]) => (rows.length >= SAMPLE ? rows[rows.length - 1].createdAt.getTime() : 0);
  const clipAt = Math.max(oldest(endRows), oldest(issueRows));
  const sampled = clipAt > 0;
  const inWindow = (e: { createdAt: Date }) => e.createdAt.getTime() >= clipAt;
  // خلاصه‌ای که دوباره فرستاده شد (پاسخ در راه گم شد) یک بار شمرده شود: هر sessionId+seq فقط یک ردیف
  const seenSeq = new Set<string>();
  const ends = endRows.filter((e) => {
    if (!inWindow(e)) return false;
    const seq = ctxNum(e.ctx, "seq");
    if (!seq) return true;
    const k = `${e.sessionId}|${seq}`;
    if (seenSeq.has(k)) return false;
    seenSeq.add(k);
    return true;
  });
  const issues = issueRows.filter(inWindow);

  // ─── خلاصه ───
  const count = (k: string) => byKind.find((r) => r.kind === k)?._count._all ?? 0;
  const total = byKind.reduce((a, r) => a + r._count._all, 0);
  const endSids = new Set(ends.map((e) => e.sessionId));
  const sessions = endSids.size;
  const playedSec = ends.reduce((a, e) => a + ctxNum(e.ctx, "playedSec"), 0);
  const giveupSids = new Set(issues.filter((e) => e.kind === "giveup").map((e) => e.sessionId));
  const giveupSessions = giveupSids.size;
  // خلاصه‌ی تماشای بعضی جلسه‌های قطع‌شده نمی‌رسد (صفحه بسته شد)؛ مخرج درصد = همه‌ی جلسه‌های دیده‌شده، تا از ۱۰۰٪ بیشتر نشود
  const seenSessions = new Set([...endSids, ...giveupSids]).size;

  // ─── دستگاه × موتور پخش ───
  // «بسته شدن ناگهانی» و بعضی خطاها موتور پخش ندارند؛ از رخدادهای دیگرِ همان بار تماشا پیدا می‌شود
  const engineOfSession = new Map<string, string>();
  for (const e of [...ends, ...issues]) if (e.engine) engineOfSession.set(e.sessionId, e.engine);
  const cells = new Map<string, Cell>();
  const cellOf = (ctx: unknown, ua: string | null, eng: string | null, sessionId: string) => {
    const platform = platformOf(ctx, ua);
    const engine = eng || engineOfSession.get(sessionId) || null;
    const key = `${platform}|${engine || "-"}`;
    let c = cells.get(key);
    if (!c) {
      c = { platform, engine: engine || "-", sessions: new Set(), playedSec: 0, giveupSessions: new Set(), giveups: 0, fragStalls: 0, abnormal: 0, hidden: 0, other: 0 };
      cells.set(key, c);
    }
    return c;
  };
  for (const e of ends) {
    const c = cellOf(e.ctx, e.ua, e.engine, e.sessionId);
    c.sessions.add(e.sessionId);
    c.playedSec += ctxNum(e.ctx, "playedSec");
  }
  for (const e of issues) {
    const c = cellOf(e.ctx, e.ua, e.engine, e.sessionId);
    if (e.kind === "giveup") {
      c.giveups++;
      c.giveupSessions.add(e.sessionId);
    } else if (e.kind === "frag-stall") c.fragStalls++;
    else if (e.kind === "abnormal-exit") c.abnormal++;
    else if (e.kind === "hidden-playing") c.hidden++;
    else if (!isInfoKind(e.kind)) c.other++;
  }
  const matrix = [...cells.values()].sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform) || a.engine.localeCompare(b.engine));

  // ─── رخدادها به تفکیک نوع + زمانشان پس از باز شدن صفحه ───
  const minutes = new Map<string, number[]>();
  for (const e of issues) {
    const b = minuteBucket(e.sinceLoadSec);
    if (b < 0) continue;
    const row = minutes.get(e.kind) ?? [0, 0, 0, 0];
    row[b]++;
    minutes.set(e.kind, row);
  }
  const kinds = [...byKind].sort((a, b) => b._count._all - a._count._all);
  const builds = [...byBuild].sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0));

  const qs = (o: Partial<Record<keyof SP, string | undefined>>) =>
    "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => typeof v === "string" && v !== "") as [string, string][]).toString();
  const pct = (part: number, whole: number) => (whole ? fmtPct((part / whole) * 100) : "—");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHead title="گزارش پخش ویدیو" desc="مشکلاتی که پلیر روی گوشی دانش‌آموزان دیده و گزارش داده؛ برای پیدا کردن علت قطع شدن یا سیاه شدن ویدیو">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Link key={r} href={qs({ range: r })} className={`btn-sm ${r === range ? "btn-primary" : "btn-ghost"}`}>{RANGES[r].label}</Link>
        ))}
      </PageHead>

      <form className="card mb-3 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input type="hidden" name="range" value={range} />
        {sp.video && <input type="hidden" name="video" value={sp.video} />}
        <select name="kind" defaultValue={sp.kind ?? ""} className="input">
          <option value="">همه‌ی رخدادها</option>
          {[...new Set([...kinds.map((k) => k.kind), ...Object.keys(KINDS)])].map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
        </select>
        <input name="user" defaultValue={filterUser?.phone ?? sp.user ?? ""} className="input" placeholder="موبایل دانش‌آموز" dir="ltr" />
        <input name="sid" defaultValue={sp.sid ?? ""} className="input" placeholder="کد پیگیری (۶ حرف اول)" dir="ltr" />
        <button className="btn-primary">نمایش</button>
        <Link href={`?range=${range}`} className="btn-ghost text-center">پاک کردن فیلترها</Link>
      </form>
      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        {userQ && <FilterChip href={qs({ user: undefined })} label={`دانش‌آموز: ${filterUser ? `${filterUser.name || "بی‌نام"} (${faNum(filterUser.phone)})` : "پیدا نشد"}`} />}
        {sp.video && <FilterChip href={qs({ video: undefined })} label={`ویدیو: ${videoById.get(sp.video) ?? sp.video}`} />}
        {sp.kind && <FilterChip href={qs({ kind: undefined })} label={`رخداد: ${kindLabel(sp.kind)}`} />}
        {sid && <FilterChip href={qs({ sid: undefined })} label={`کد پیگیری: ${sid}`} />}
      </div>

      {total === 0 ? (
        <div className="card p-10 text-center text-sm leading-7 text-white/55">
          در این بازه گزارشی ثبت نشده است.
          <br />
          گزارش‌ها از نسخه‌ی جدید پلیر فرستاده می‌شوند؛ اگر تازه به‌روزرسانی کرده‌اید کمی بعد دوباره سر بزنید.
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="دفعات تماشا" value={fmtInt(sessions)} sub="هر بار باز کردن ویدیو" />
            <Kpi label="دقیقه‌ی تماشا" value={fmtInt(playedSec / 60)} sub={sessions ? `میانگین ${faNum(Math.round(playedSec / 60 / sessions))} دقیقه` : undefined} />
            <Kpi label="قطع کامل پخش" value={<span className="text-rose">{fmtInt(count("giveup"))}</span>} sub="پیام «تلاش دوباره»" />
            <Kpi label="تماشاهای قطع‌شده" value={pct(giveupSessions, seenSessions)} sub={`${faNum(giveupSessions)} از ${faNum(seenSessions)} بار تماشا`} />
            <Kpi label="گیر کردن دانلود" value={<span className="text-amber">{fmtInt(count("frag-stall"))}</span>} sub="پلیر خودش دوباره وصل شد" />
            <Kpi label="بسته شدن ناگهانی" value={<span className="text-rose">{fmtInt(count("abnormal-exit"))}</span>} sub="کرش یا باز شدن دوباره‌ی اپ" />
          </div>
          {sampled && <p className="mb-3 text-xs text-amber">رخدادها زیادند؛ «دفعات تماشا»، «دقیقه‌ی تماشا»، «تماشاهای قطع‌شده» و جدول‌های دستگاه و زمان رخداد فقط از {fmtDate(new Date(clipAt), true)} به بعد حساب شده‌اند.</p>}

          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="card p-5">
              <h2 className="mb-1 font-black">به تفکیک دستگاه و نوع پخش‌کننده</h2>
              <p className="mb-3 text-xs text-white/45">«تماشا» و «دقیقه» از خلاصه‌ی هر بار تماشا می‌آید؛ بقیه تعداد رخداد است («سایر» = مشکلات دیگر، بدون رخدادهای آماری).</p>
              <div className="table-wrap">
                <table className="table text-xs">
                  <thead><tr><th>دستگاه</th><th>پخش‌کننده</th><th>تماشا</th><th>دقیقه</th><th>قطع کامل</th><th>٪ قطع‌شده</th><th>گیر دانلود</th><th>بسته شدن ناگهانی</th><th>خاموش شدن صفحه</th><th>سایر</th></tr></thead>
                  <tbody>
                    {matrix.map((c) => (
                      <tr key={`${c.platform}|${c.engine}`}>
                        <td className="whitespace-nowrap font-bold">{PLATFORM_LABEL[c.platform]}</td>
                        <td className="whitespace-nowrap">{ENGINE_LABEL[c.engine] ?? (c.engine === "-" ? "نامشخص" : c.engine)}</td>
                        <td>{fmtInt(c.sessions.size)}</td>
                        <td>{fmtInt(c.playedSec / 60)}</td>
                        <td className={c.giveups ? "font-bold text-rose" : ""}>{fmtInt(c.giveups)}</td>
                        <td>{pct(c.giveupSessions.size, new Set([...c.sessions, ...c.giveupSessions]).size)}</td>
                        <td className={c.fragStalls ? "text-amber" : ""}>{fmtInt(c.fragStalls)}</td>
                        <td className={c.abnormal ? "text-rose" : ""}>{fmtInt(c.abnormal)}</td>
                        <td>{fmtInt(c.hidden)}</td>
                        <td>{fmtInt(c.other)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card p-5">
              <h2 className="mb-1 font-black">نسخه‌ی کد روی گوشی‌ها</h2>
              <p className="mb-3 text-xs text-white/45">اگر نسخه‌ی قدیمی هنوز گزارش می‌دهد، آن دانش‌آموز صفحه را از قبل باز نگه داشته است.</p>
              <div className="table-wrap">
                <table className="table text-xs">
                  <thead><tr><th>نسخه</th><th>رخداد</th><th>آخرین گزارش</th></tr></thead>
                  <tbody>
                    {builds.map((b) => (
                      <tr key={b.build ?? "-"}>
                        <td dir="ltr" className="text-right font-mono">{b.build ?? "قدیمی/نامشخص"}</td>
                        <td>{fmtInt(b._count._all)}</td>
                        <td className="text-white/55">{fmtDate(b._max.createdAt, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="card mb-5 p-5">
            <h2 className="mb-1 font-black">رخدادها به تفکیک نوع</h2>
            <p className="mb-3 text-xs text-white/45">ستون‌های دقیقه: چند دقیقه بعد از باز شدن صفحه رخ داده (اگر مشکل‌ها در «۲–۳» جمع شوند، همان شکایت «بعد از ۲-۳ دقیقه» است).</p>
            <div className="table-wrap">
              <table className="table text-xs">
                <thead><tr><th>رخداد</th><th>کد</th><th>تعداد</th>{MINUTE_BUCKETS.map((m) => <th key={m}>دقیقه‌ی {m}</th>)}</tr></thead>
                <tbody>
                  {kinds.map((k) => {
                    const m = minutes.get(k.kind);
                    return (
                      <tr key={k.kind}>
                        <td><Link href={qs({ kind: k.kind })} className={`font-bold hover:underline ${kindTone(k.kind)}`}>{kindLabel(k.kind)}</Link></td>
                        <td dir="ltr" className="text-right font-mono text-white/45">{k.kind}</td>
                        <td className="font-bold">{fmtInt(k._count._all)}</td>
                        {MINUTE_BUCKETS.map((b, i) => <td key={b} className="text-white/60">{m ? fmtInt(m[i]) : "—"}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {(topVideos.length > 0 || topNets.length > 0) && (
            <section className="card mb-5 p-5">
              <h2 className="mb-1 font-black">ویدیوها و شبکه‌های پرمشکل</h2>
              <p className="mb-3 text-xs text-white/45">
                تعداد رخدادهای مشکل‌دار (قطع کامل، گیر دانلود، بسته شدن ناگهانی، رد شدن لینک، انتظار طولانی و …). اگر مشکل فقط روی یک ویدیو جمع شده، احتمالاً خود فایل ویدیو مشکل دارد؛ اگر روی یک شبکه، اینترنت یا VPN همان گروه از دانش‌آموزان.
              </p>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="table-wrap">
                  <table className="table text-xs">
                    <thead><tr><th>ویدیو</th><th>مشکل</th></tr></thead>
                    <tbody>
                      {topVideos.map((r) => (
                        <tr key={r.videoId}>
                          <td><Link href={qs({ video: r.videoId ?? undefined })} className="line-clamp-1 hover:text-cyan">{videoById.get(r.videoId ?? "") ?? r.videoId}</Link></td>
                          <td className="font-bold">{fmtInt(r._count._all)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-wrap">
                  <table className="table text-xs">
                    <thead><tr><th>شبکه (بخش اول IP)</th><th>مشکل</th></tr></thead>
                    <tbody>
                      {topNets.map((r) => (
                        <tr key={r.ip}>
                          <td dir="ltr" className="text-right font-mono">{r.ip}</td>
                          <td className="font-bold">{fmtInt(r._count._all)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section className="card mb-5 p-5">
            <h2 className="mb-3 font-black">آخرین رخدادها {sp.kind ? `(${kindLabel(sp.kind)})` : ""}</h2>
            <div className="table-wrap">
              <table className="table text-xs">
                <thead><tr><th>زمان</th><th>دانش‌آموز</th><th>ویدیو</th><th>رخداد</th><th>توضیح</th><th>موقعیت</th><th>پخش‌کننده</th><th>دستگاه</th><th>نسخه</th><th>جزئیات</th></tr></thead>
                <tbody>
                  {recent.map((e) => {
                    const u = e.userId ? userById.get(e.userId) : undefined;
                    const code = e.sessionId === "legacy" ? null : e.sessionId.slice(0, 6);
                    return (
                      <tr key={e.id} className="align-top">
                        <td className="whitespace-nowrap">
                          {fmtDate(e.createdAt, true)}
                          {code && <Link href={qs({ sid: code })} className="block font-mono text-[10px] text-white/40 hover:text-cyan" dir="ltr">{code}</Link>}
                          {e.queued && <span className="chip mt-1 !px-1.5 !py-0 !text-[10px]" title="در حالت آفلاین ذخیره و بعداً فرستاده شد">صف‌شده</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          {u ? (
                            <Link href={qs({ user: u.id })} className="hover:text-cyan">
                              <span className="font-bold">{u.name || "بی‌نام"}</span>
                              <span dir="ltr" className="block text-[10px] text-white/45">{faNum(u.phone)}</span>
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="max-w-48">{e.videoId ? <Link href={qs({ video: e.videoId })} className="line-clamp-2 hover:text-cyan">{videoById.get(e.videoId) ?? e.videoId}</Link> : "—"}</td>
                        <td className="whitespace-nowrap">
                          <span className={`font-bold ${kindTone(e.kind)}`}>{kindLabel(e.kind)}</span>
                          {e.fatal && <span className="mr-1 text-rose">●</span>}
                        </td>
                        <td className="max-w-64">
                          {e.detail && <span dir="auto" className="block break-words font-mono text-[11px] text-white/70">{e.detail}</span>}
                          <span className="block text-[10px] text-white/45">
                            {[e.code !== null ? `کد ${faNum(e.code)}` : "", e.sinceLoadSec !== null ? `${fmtClock(e.sinceLoadSec)} پس از باز شدن صفحه` : ""].filter(Boolean).join(" · ")}
                          </span>
                        </td>
                        <td>{e.position !== null ? fmtClock(e.position) : "—"}</td>
                        <td>{e.engine ? ENGINE_LABEL[e.engine] ?? e.engine : "—"}</td>
                        <td className="whitespace-nowrap">{PLATFORM_LABEL[platformOf(e.ctx, e.ua)]}</td>
                        <td dir="ltr" className="text-right font-mono text-[10px] text-white/55">{e.build ?? "—"}</td>
                        <td>
                          <details>
                            <summary className="cursor-pointer text-cyan">نمایش</summary>
                            <pre dir="ltr" className="mt-2 max-h-80 max-w-md overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-2 text-left text-[10px] leading-4">
                              {JSON.stringify({ ...((e.ctx as object | null) ?? {}), ua: e.ua, ip: e.ip, sessionId: e.sessionId }, null, 1)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="card p-5">
        <h2 className="mb-1 font-black">راهنمای رخدادها</h2>
        <p className="mb-4 text-xs text-white/45">
          <span className={TONE_CLASS.bad}>قرمز</span>: دانش‌آموز واقعاً اذیت شد · <span className={TONE_CLASS.warn}>زرد</span>: مشکل پیش آمد ولی پلیر خودش درستش کرد · <span className={TONE_CLASS.info}>خاکستری</span>: فقط برای آمار
        </p>
        <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
          {Object.entries(KINDS).map(([k, v]) => (
            <div key={k}>
              <dt className={`font-bold ${TONE_CLASS[v.tone]}`}>{v.label} <span dir="ltr" className="font-mono text-[10px] text-white/35">{k}</span></dt>
              <dd className="mt-0.5 text-xs leading-6 text-white/60">{v.desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function FilterChip({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="chip hover:!border-rose/40">
      {label} <X className="size-3" />
    </Link>
  );
}
