/**
 * بررسی سئوی صفحه‌ها روی یک سرور محلیِ در حال اجرا (مثلاً «pnpm exec next start -p 3341»). هرگز روی سایت اصلی اجرا نکنید.
 *
 *   pnpm seo:check                                   همه‌ی نشانی‌های sitemap.xml روی http://127.0.0.1:3341
 *   pnpm seo:check http://127.0.0.1:3341 --paths /shimi-dahom/fasl-1,/azmoon-shimi
 *   pnpm seo:check --planned                         همه‌ی مسیرهای SEO_ROUTES (live و برنامه‌ریزی‌شده)
 *
 * گزینه‌ها:
 *   --site <origin>        دامنه‌ی canonical (پیش‌فرض: دامنه‌ی نشانی‌های sitemap، وگرنه https://dopingshimi.ir)
 *   --links all|content|none   بررسی لینک‌های داخلی؛ content یعنی بدون لینک‌های <header>/<footer> سایت (پیش‌فرض all)
 *   --json                 خروجی JSON برای اسکریپت‌ها
 *   --concurrency <n>      درخواست هم‌زمان (پیش‌فرض ۴)
 *   --allow-remote         اجازه‌ی نشانی غیرمحلی (پیش‌فرض فقط localhost/127.0.0.1)
 *
 * خطا (کد خروج ۱): وضعیت غیر ۲۰۰، canonical نادرست، تعداد H1 ≠ ۱، عنوان بیش از ۶۰ نویسه یا تکراری، توضیح متا
 * خارج از ۱۰۰ تا ۱۷۰، نبود og:image، og:url ≠ canonical، og:locale ≠ fa_IR، twitter:title ≠ عنوان، JSON-LD خراب یا
 * @id آویزان، noindex ناخواسته (صفحه‌ی live بیرون از sitemap، مثل /articles خالی، فقط هشدار)، «ی/ک» عربی (U+064A/U+0643) در متن دیدنی، «لیسانس»، لینک به صفحه‌ی برنامه‌ریزی‌شده‌ی غیر live، لینک داخلی غیر ۲۰۰.
 * هشدار: کمتر از ۳۰۰ کلمه در <main>، فرمول خام (مثل H2O) بیرون از کلاس chem، پیکان خام، نبود BreadcrumbList، تصویر بدون alt،
 * لینک بدون nofollow به مسیرهای بسته‌شده در robots.txt، ناهمخوانی dateModified/lastmod با SEO_ROUTES.
 */
import { SEO_ROUTES, isLive, normalizePath, route } from "../src/lib/site-routes";

type Level = "error" | "warn";
interface Issue {
  level: Level;
  code: string;
  msg: string;
}
interface PageReport {
  path: string;
  url: string;
  status: number;
  title?: string;
  words?: number;
  issues: Issue[];
}

// ───────────── آرگومان‌ها ─────────────
const argv = process.argv.slice(2);
function opt(name: string): string | undefined {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const a = argv[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[i + 1];
}
const flag = (name: string) => argv.includes(`--${name}`);
const VALUE_FLAGS = new Set(["--paths", "--site", "--links", "--concurrency"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(argv[i - 1] ?? ""));

const BASE = (positional[0] || "http://127.0.0.1:3341").replace(/\/+$/, "");
const LINKS = (opt("links") || "all") as "all" | "content" | "none";
const JSON_OUT = flag("json");
const CONCURRENCY = Math.max(1, Number(opt("concurrency") || 4));
const UA = "Mozilla/5.0 (compatible; Bingbot/2.0; doping-seo-check)"; // ربات «HTML-limited»: متادیتا در <head> می‌آید

if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(BASE) && !flag("allow-remote")) {
  console.error(`نشانی ${BASE} محلی نیست. این بررسی فقط برای سرور محلی است (برای استثنا: --allow-remote).`);
  process.exit(2);
}

// ───────────── ابزار HTML (بدون وابستگی) ─────────────
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", zwnj: "\u200c", zwj: "\u200d", rlm: "\u200f", lrm: "\u200e" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = tag.replace(/^<[^\s>]+/, "").replace(/\/?>$/, "");
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (let m = re.exec(body); m; m = re.exec(body)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}
const tags = (html: string, name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) => attrs(m[0]));
const stripBlocks = (html: string, names: string[]) =>
  names.reduce((h, n) => h.replace(new RegExp(`<${n}\\b[^>]*>[\\s\\S]*?<\\/${n}>`, "gi"), " "), html);
/** HTML → متن؛ تگ‌های قالب‌بندی درون‌خطی (sub، sup، strong…) فاصله نمی‌سازند تا H<sub>2</sub>O یک واژه بماند */
const INLINE = /^\/?(abbr|b|bdi|bdo|code|em|i|kbd|mark|q|s|small|strong|sub|sup|u|var)\b/i;
const toText = (html: string) =>
  decode(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<([^>]+)>/g, (_m, inner: string) => (INLINE.test(inner) ? "" : " ")))
    .replace(/\s+/g, " ")
    .trim();
const len = (s: string) => [...s].length;
const snippet = (text: string, idx: number) => text.slice(Math.max(0, idx - 25), idx + 25).trim();

/** HTML بدون اسکریپت/استایل (برای متاها و لینک‌ها) */
const noScripts = (html: string) => stripBlocks(html.replace(/<!--[\s\S]*?-->/g, ""), ["script", "style", "template"]);
/** متن دیدنی بدنه */
function visibleText(html: string, opts: { dropChem?: boolean } = {}) {
  let h = noScripts(html).replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, " ");
  h = stripBlocks(h, ["svg", "noscript"]);
  if (opts.dropChem) {
    h = h.replace(/<bdi\b[^>]*class="[^"]*\bchem\b[^"]*"[^>]*>[\s\S]*?<\/bdi>/gi, " ");
    h = stripBlocks(h, ["code", "pre"]);
  }
  return toText(h);
}

// ───────────── شبکه ─────────────
async function get(url: string): Promise<{ status: number; body: string; headers: Headers }> {
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": UA, accept: "text/html,application/xml;q=0.9,*/*;q=0.8" }, signal: AbortSignal.timeout(30_000) });
    const ct = res.headers.get("content-type") || "";
    const body = /text|xml|json|javascript/.test(ct) ? await res.text() : (await res.arrayBuffer(), "");
    return { status: res.status, body, headers: res.headers };
  } catch (e) {
    return { status: 0, body: String((e as Error).message || e), headers: new Headers() };
  }
}
const statusCache = new Map<string, Promise<number>>();
const statusOf = (url: string) => {
  if (!statusCache.has(url)) statusCache.set(url, get(url).then((r) => r.status));
  return statusCache.get(url)!;
};

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const normUrl = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.origin}${decodeURI(x.pathname).replace(/\/+$/, "")}${x.search}`;
  } catch {
    return u.replace(/\/+$/, "");
  }
};

// ───────────── JSON-LD ─────────────
function checkJsonLd(html: string, issues: Issue[], isHome: boolean) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const defined = new Set<string>();
  const refs = new Set<string>();
  const types = new Set<string>();
  const nodes: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (typeof o["@id"] === "string") {
      if (keys.length === 1) refs.add(o["@id"]);
      else {
        defined.add(o["@id"]);
        nodes.push(o);
      }
    }
    const t = o["@type"];
    (Array.isArray(t) ? t : t ? [t] : []).forEach((x) => typeof x === "string" && types.add(x));
    keys.forEach((k) => k !== "@id" && walk(o[k]));
  };
  blocks.forEach((b, i) => {
    try {
      walk(JSON.parse(b));
    } catch (e) {
      issues.push({ level: "error", code: "jsonld", msg: `JSON-LD شماره‌ی ${i + 1} قابل تجزیه نیست: ${(e as Error).message}` });
    }
  });
  for (const r of refs) if (!defined.has(r)) issues.push({ level: "error", code: "jsonld-id", msg: `@id آویزان (گره‌اش در graph نیست): ${r}` });
  if (!blocks.length) issues.push({ level: "warn", code: "jsonld", msg: "JSON-LD ندارد" });
  else if (!types.has("BreadcrumbList") && !isHome) issues.push({ level: "warn", code: "breadcrumb", msg: "BreadcrumbList در JSON-LD نیست" });
  return { types, nodes };
}

// ───────────── بررسی یک صفحه ─────────────
const ARABIC = /[\u064A\u0643]/g; // «ی» و «ک» عربی
const RAW_FORMULA = /(?<![A-Za-z0-9_/.:#=-])[A-Z][a-z]?\d/g;
const RAW_ARROW = /(->|<=>|=>)/g;

interface Ctx {
  site: string;
  disallow: string[];
  titles: Map<string, string[]>;
  linkErrors: Map<string, { status: number; pages: Set<string> }>;
  /** مسیرهای نقشه‌ی سایت (null اگر sitemap خوانده نشد) */
  inSitemap: Set<string> | null;
}

async function checkPage(path: string, ctx: Ctx): Promise<PageReport> {
  const url = BASE + encodeURI(normalizePath(path));
  const r = route(path);
  const expectNoindex = !!r && !r.live;
  const issues: Issue[] = [];
  const add = (level: Level, code: string, msg: string) => issues.push({ level, code, msg });
  const res = await get(url);
  const rep: PageReport = { path, url, status: res.status, issues };
  if (res.status !== 200) {
    const loc = res.headers.get("location");
    add("error", "status", `وضعیت ${res.status || "بدون پاسخ"}${loc ? ` → ${loc}` : ""}${res.status === 0 ? ` (${res.body})` : ""}`);
    return rep;
  }
  const html = res.body;
  const doc = noScripts(html);

  // html lang/dir
  const htmlTag = tags(doc, "html")[0] || {};
  if (htmlTag.lang !== "fa" || htmlTag.dir !== "rtl") add("error", "lang", `تگ html باید lang="fa" و dir="rtl" داشته باشد (lang="${htmlTag.lang ?? ""}"، dir="${htmlTag.dir ?? ""}")`);

  // عنوان
  const titleM = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(doc);
  const title = titleM ? decode(titleM[1]).trim() : "";
  rep.title = title;
  if (!title) add("error", "title", "عنوان ندارد");
  else {
    if (len(title) > 60) add("error", "title", `عنوان ${len(title)} نویسه است (حداکثر ۶۰): ${title}`);
    ctx.titles.set(title, [...(ctx.titles.get(title) ?? []), path]);
  }

  // متاها
  const metas = tags(doc, "meta");
  const meta = (k: string) => metas.filter((m) => m.name === k || m.property === k).map((m) => m.content ?? "");
  const desc = meta("description")[0];
  if (!desc) add("error", "description", "توضیح متا ندارد");
  else if (len(desc) < 100 || len(desc) > 170) add("error", "description", `توضیح متا ${len(desc)} نویسه است (باید ۱۰۰ تا ۱۷۰)`);

  const expected = normUrl(ctx.site + encodeURI(normalizePath(path)));
  const canon = tags(doc, "link").filter((l) => (l.rel || "").toLowerCase().split(/\s+/).includes("canonical"));
  const canonical = canon[0]?.href ?? "";
  if (canon.length !== 1) add("error", "canonical", `تعداد canonical: ${canon.length}`);
  if (canonical && (!/^https?:\/\//.test(canonical) || normUrl(canonical) !== expected)) add("error", "canonical", `canonical «${canonical}» ≠ «${expected}»`);

  const ogUrl = meta("og:url")[0];
  if (!ogUrl) add("error", "og", "og:url ندارد");
  else if (canonical && normUrl(ogUrl) !== normUrl(canonical)) add("error", "og", `og:url «${ogUrl}» ≠ canonical`);
  const ogImage = meta("og:image")[0];
  if (!ogImage) add("error", "og", "og:image ندارد");
  else if (!/^https?:\/\//.test(ogImage)) add("error", "og", `og:image مطلق نیست: ${ogImage}`);
  else {
    const local = BASE + new URL(ogImage).pathname;
    const st = await statusOf(local);
    if (st !== 200) add("error", "og", `og:image وضعیت ${st} دارد: ${new URL(ogImage).pathname}`);
  }
  if (meta("og:locale")[0] !== "fa_IR") add("error", "og", `og:locale باید fa_IR باشد (${meta("og:locale")[0] ?? "ندارد"})`);
  if (!meta("og:title")[0]) add("error", "og", "og:title ندارد");
  const tw = meta("twitter:title")[0];
  if (tw !== title) add("error", "twitter", `twitter:title «${tw ?? ""}» ≠ عنوان صفحه`);
  if (!meta("twitter:card")[0]) add("warn", "twitter", "twitter:card ندارد");

  // robots
  const robots = [...meta("robots"), ...meta("googlebot"), res.headers.get("x-robots-tag") || ""].join(",").toLowerCase();
  const noindex = robots.includes("noindex");
  // صفحه‌ی live که عمداً بیرون از sitemap است (مثل /articles و /gallery وقتی خالی‌اند) فقط هشدار می‌گیرد
  if (noindex && !expectNoindex) {
    if (ctx.inSitemap && !ctx.inSitemap.has(normalizePath(path))) add("warn", "noindex", `noindex و بیرون از sitemap (احتمالاً عمدی، مثلاً صفحه‌ی خالی): ${robots}`);
    else add("error", "noindex", `noindex ناخواسته: ${robots}`);
  }
  if (!noindex && expectNoindex) add("warn", "noindex", "صفحه در SEO_ROUTES هنوز live نیست ولی noindex ندارد");

  // H1
  const h1 = (doc.match(/<h1\b/gi) || []).length;
  if (h1 !== 1) add("error", "h1", `تعداد H1: ${h1} (باید ۱)`);

  // متن دیدنی
  const text = visibleText(html);
  // شمار کلمه فقط در <main> (بدون منو و پانویس)؛ اگر main نباشد کل بدنه
  const mainHtml = /<main\b[^>]*>[\s\S]*<\/main>/i.exec(doc)?.[0];
  const countWords = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const words = countWords(mainHtml ? visibleText(mainHtml) : text);
  rep.words = words;
  if (words < 300) add("warn", "words", `متن دیدنی ${mainHtml ? "<main>" : "صفحه"} ${words} کلمه است (کمتر از ۳۰۰)`);
  const visibleAll = `${title} ${desc ?? ""} ${text}`;
  const arabic = [...visibleAll.matchAll(ARABIC)];
  if (arabic.length) add("error", "arabic", `${arabic.length} نویسه‌ی «ی/ک» عربی (U+064A/U+0643)؛ نمونه: «${snippet(visibleAll, arabic[0].index!)}»`);
  if (html.includes("لیسانس")) add("error", "degree", "واژه‌ی «لیسانس» در صفحه آمده است (مدرک: کارشناسی ارشد)");
  const textNoChem = visibleText(html, { dropChem: true });
  const raw = [...new Set([...textNoChem.matchAll(RAW_FORMULA)].map((m) => snippet(textNoChem, m.index!)))];
  if (raw.length) add("warn", "formula", `${raw.length} فرمول خام بیرون از <Chem>؛ نمونه: ${raw.slice(0, 4).map((x) => `«${x}»`).join("، ")}`);
  const arrows = [...textNoChem.matchAll(RAW_ARROW)];
  if (arrows.length) add("warn", "formula", `پیکان خام بیرون از <Eq>: «${snippet(textNoChem, arrows[0].index!)}»`);

  // تصویر بدون alt
  const noAlt = tags(doc, "img").filter((im) => !("alt" in im)).length;
  if (noAlt) add("warn", "img", `${noAlt} تصویر بدون alt`);

  // JSON-LD
  const { nodes } = checkJsonLd(html, issues, normalizePath(path) === "/");
  if (r) {
    const main = nodes.find((n) => typeof n["@id"] === "string" && normUrl(String(n["@id"]).replace(/#main$/, "")) === expected && String(n["@id"]).endsWith("#main"));
    if (main && main.dateModified && main.dateModified !== r.updated) add("warn", "date", `dateModified (${main.dateModified}) ≠ updated در SEO_ROUTES (${r.updated})`);
  }

  // لینک‌های داخلی
  if (LINKS !== "none") {
    const linkHtml = LINKS === "content" ? stripBlocks(doc.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, " "), ["header", "footer"]) : doc;
    const anchors = tags(linkHtml, "a").filter((a) => a.href);
    const hrefs = new Set(anchors.map((a) => a.href));
    // لینک‌هایی که همه‌جا rel=nofollow دارند (مثل «ورود / ثبت‌نام») هشدار robots نمی‌گیرند
    const followed = new Set(anchors.filter((a) => !/\bnofollow\b/i.test(a.rel || "")).map((a) => a.href));
    const siteOrigin = new URL(ctx.site).origin;
    const seenPaths = new Set<string>();
    const seenTargets = new Set<string>();
    const blocked = new Set<string>();
    for (const href of hrefs) {
      if (/^(mailto:|tel:|sms:|javascript:|#)/i.test(href)) continue;
      let u: URL;
      try {
        u = new URL(href, url);
      } catch {
        add("error", "link", `لینک نامعتبر: ${href}`);
        continue;
      }
      const internal = u.origin === new URL(BASE).origin || u.origin === siteOrigin;
      if (!internal) continue;
      const p = normalizePath(u.pathname);
      if (!seenPaths.has(p)) {
        seenPaths.add(p);
        const lr = route(p);
        if (lr && !lr.live) add("error", "link-planned", `لینک به صفحه‌ی برنامه‌ریزی‌شده‌ی غیر live: ${p} (از RouteLink استفاده کنید)`);
        else if (!lr && !isLive(p)) add("error", "link-planned", `لینک به مسیری که وجود ندارد: ${p}`);
        if (followed.has(href) && ctx.disallow.some((d) => (d.endsWith("/") ? p.startsWith(d) || `${p}/` === d : p === d || p.startsWith(`${d}/`)))) blocked.add(p);
      }
      // هر نشانی (با کوئری) یک بار؛ وضعیت‌ها بین صفحه‌ها کش می‌شوند
      const key = u.pathname + u.search;
      if (seenTargets.has(key)) continue;
      seenTargets.add(key);
      const st = await statusOf(BASE + key);
      if (st !== 200) {
        const e = ctx.linkErrors.get(key) ?? { status: st, pages: new Set<string>() };
        e.pages.add(path);
        ctx.linkErrors.set(key, e);
      }
    }
    if (blocked.size) add("warn", "link-robots", `لینک به مسیرهای بسته در robots.txt: ${[...blocked].join("، ")}`);
  }
  return rep;
}

// ───────────── اجرا ─────────────
async function main() {
  // نقشه‌ی سایت: فهرست نشانی‌ها و دامنه‌ی canonical
  const sm = await get(`${BASE}/sitemap.xml`);
  const locs = sm.status === 200 ? [...sm.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1])) : [];
  const lastmods = new Map<string, string>();
  for (const m of sm.body.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>\s*([^<\s]+)/.exec(m[1])?.[1];
    const lm = /<lastmod>\s*([^<\s]+)/.exec(m[1])?.[1];
    if (loc && lm) lastmods.set(normalizePath(new URL(decode(loc)).pathname), lm);
  }
  const site = (opt("site") || (locs[0] ? new URL(locs[0]).origin : "https://dopingshimi.ir")).replace(/\/+$/, "");

  const global: Issue[] = [];
  if (sm.status !== 200) global.push({ level: opt("paths") || flag("planned") ? "warn" : "error", code: "sitemap", msg: `sitemap.xml وضعیت ${sm.status} دارد` });

  let paths: string[];
  if (opt("paths")) paths = opt("paths")!.split(",").map((s) => s.trim()).filter(Boolean).map((p) => normalizePath(p));
  else if (flag("planned")) paths = SEO_ROUTES.map((r) => r.path);
  else {
    paths = locs.map((l) => normalizePath(new URL(l).pathname));
    const inMap = new Set(paths);
    for (const p of paths) {
      const r = route(p);
      if (r && !r.live) global.push({ level: "error", code: "sitemap", msg: `صفحه‌ی غیر live در sitemap: ${p}` });
      if (r && lastmods.has(p) && !lastmods.get(p)!.startsWith(r.updated)) global.push({ level: "warn", code: "sitemap", msg: `lastmod ${p} (${lastmods.get(p)}) ≠ updated در SEO_ROUTES (${r.updated})` });
    }
    if (sm.status === 200) for (const r of SEO_ROUTES) if (r.live && !inMap.has(r.path)) global.push({ level: "warn", code: "sitemap", msg: `صفحه‌ی live در sitemap نیست: ${r.path}` });
  }
  paths = [...new Set(paths)];

  // robots.txt: مسیرهای بسته برای همه‌ی ربات‌ها
  const rb = await get(`${BASE}/robots.txt`);
  const disallow: string[] = [];
  if (rb.status === 200) {
    let star = false;
    for (const line of rb.body.split(/\r?\n/)) {
      const [k, ...v] = line.split(":");
      const key = k.trim().toLowerCase();
      const val = v.join(":").trim();
      if (key === "user-agent") star = val === "*";
      else if (star && key === "disallow" && val) disallow.push(val);
    }
  }

  const inSitemap = sm.status === 200 ? new Set(locs.map((l) => normalizePath(new URL(l).pathname))) : null;
  const ctx: Ctx = { site, disallow, titles: new Map(), linkErrors: new Map(), inSitemap };
  const reports = await pool(paths, CONCURRENCY, (p) => checkPage(p, ctx));

  for (const [t, ps] of ctx.titles) if (ps.length > 1) global.push({ level: "error", code: "title-dup", msg: `عنوان تکراری «${t}» در: ${ps.join("، ")}` });
  for (const [href, e] of ctx.linkErrors)
    global.push({ level: "error", code: "link", msg: `لینک داخلی ${href} وضعیت ${e.status || "بدون پاسخ"} دارد (در ${e.pages.size} صفحه: ${[...e.pages].slice(0, 3).join("، ")}${e.pages.size > 3 ? "، …" : ""})` });

  const errors = global.filter((i) => i.level === "error").length + reports.reduce((n, r) => n + r.issues.filter((i) => i.level === "error").length, 0);
  const warns = global.filter((i) => i.level === "warn").length + reports.reduce((n, r) => n + r.issues.filter((i) => i.level === "warn").length, 0);

  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, site, errors, warnings: warns, global, pages: reports }, null, 2));
  } else {
    console.log(`seo-check: ${BASE} (canonical: ${site}) — ${paths.length} صفحه`);
    for (const r of reports) {
      const e = r.issues.filter((i) => i.level === "error");
      const w = r.issues.filter((i) => i.level === "warn");
      console.log(`\n${e.length ? "✖" : "✔"} ${r.path}  [${r.status}]${r.words !== undefined ? `  ${r.words} کلمه` : ""}${r.title ? `  «${r.title}»` : ""}`);
      for (const i of e) console.log(`   ✖ [${i.code}] ${i.msg}`);
      for (const i of w) console.log(`   ⚠ [${i.code}] ${i.msg}`);
    }
    if (global.length) {
      console.log("\nکلی:");
      for (const i of global) console.log(`   ${i.level === "error" ? "✖" : "⚠"} [${i.code}] ${i.msg}`);
    }
    console.log(`\nنتیجه: ${errors} خطا، ${warns} هشدار`);
  }
  process.exit(errors ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
