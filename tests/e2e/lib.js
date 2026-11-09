// ابزار مشترک سناریوهای E2E پخش ویدیو (Playwright + شبیه‌سازهای servers.js + پایگاه داده‌ی محلی).
// Scenario helpers: each scenario n (1..20) gets its own student (e2eu..n), video (e2evidns..n) and mock-CDN
// namespace (nsNN), so scenarios can run in parallel without sharing hang/403 state, telemetry quota or progress rows.
// Everything is resolved relative to this folder / the repo root; secrets are read from the repo .env at runtime
// and never printed.
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const DIR = __dirname;
const REPO = path.resolve(DIR, "..", "..");
const RUN = path.join(DIR, ".run"); // pid files, server logs, minted JWTs (gitignored)
const RESULTS = path.join(DIR, "results"); // result-*.json, console logs, screenshots (gitignored)
const JWT_DIR = path.join(RUN, "jwt");
const APP_PORT = Number(process.env.E2E_APP_PORT || 3310);
const HLS_PORT = Number(process.env.E2E_HLS_PORT || 3600);
const APP = `http://127.0.0.1:${APP_PORT}`;
const HLS = `http://127.0.0.1:${HLS_PORT}`;
const LEGACY_VIDEO_ID = "e2evid0000000000000000001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n, w) => String(n).padStart(w, "0");
const ids = (n) => ({ userId: `e2eu${pad(n, 21)}`, videoId: `e2evidns${pad(n, 17)}`, ns: `ns${pad(n, 2)}` });

// ─── هرگز روی سرور اصلی اجرا نشود: دیتابیس production هم روی 127.0.0.1 است و بررسی «دیتابیس محلی» پایین را رد نمی‌کند ───
// Never on the production server: its DB is also on 127.0.0.1 (the local-DB check below would pass), setup.mjs would
// write test rows into the live DB and a second app would duplicate the hourly cron/SMS.
const PROD_MARKER = ["/opt/doping", "/var/lib/doping", "/etc/nginx/sites-enabled/doping"].find((p) => fs.existsSync(p));
if (PROD_MARKER) throw new Error(`refusing to run the E2E harness: ${PROD_MARKER} exists, this looks like the production server`);

// ─── playwright (in Claude cloud containers it is global and Chromium lives in /opt/pw-browsers) ───
let pw = null;
function playwright() {
  if (pw) return pw;
  try {
    pw = require("playwright");
  } catch {
    throw new Error("playwright not found: run `npm install` inside tests/e2e (and `npx playwright install chromium` outside Claude containers)");
  }
  return pw;
}
const CHROMIUM = process.env.E2E_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : null);
function launch(args = []) {
  return playwright().chromium.launch({ ...(CHROMIUM ? { executablePath: CHROMIUM } : {}), args: ["--no-sandbox", ...args] });
}

// ─── repo .env / database (local only) ───
function readEnv() {
  const out = {};
  const f = path.join(REPO, ".env");
  if (!fs.existsSync(f)) return out;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
let pgEnvCache = null;
/** libpq environment parsed from DATABASE_URL, so the URL (password) never appears in argv or error messages */
function pgEnv() {
  if (pgEnvCache) return pgEnvCache;
  const raw = process.env.DATABASE_URL || readEnv().DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL not found (repo .env or environment)");
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  const host = u.hostname || u.searchParams.get("host") || "localhost";
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) || host.startsWith("/");
  if (!local && process.env.E2E_ALLOW_REMOTE_DB !== "1") throw new Error(`refusing to touch a non-local database (${host}); the E2E harness writes test rows`);
  pgEnvCache = {
    PGHOST: host.replace(/^\[|\]$/g, ""),
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")),
    ...(u.searchParams.get("sslmode") ? { PGSSLMODE: u.searchParams.get("sslmode") } : {}),
  };
  return pgEnvCache;
}
/** run SQL with psql, return trimmed stdout (fields separated by "|") */
function db(sql) {
  try {
    return cp.execFileSync("psql", ["-X", "-At", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", env: { ...process.env, ...pgEnv() }, stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    // rethrow without the command line / environment
    throw new Error(`psql failed: ${String(e.stderr || e.message).trim().slice(0, 400)} — SQL: ${sql.slice(0, 200)}`);
  }
}

// ─── build info (for telemetry `build` checks and the iOS engine scenario) ───
const CHUNKS = path.join(REPO, ".next", "static", "chunks");
function chunkFiles() {
  if (!fs.existsSync(CHUNKS)) return [];
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".js")) out.push(p); } };
  walk(CHUNKS);
  return out;
}
let buildCache;
/** commit id baked into the running build (NEXT_PUBLIC_BUILD_SHA); E2E_BUILD overrides */
function expectedBuild() {
  if (process.env.E2E_BUILD) return process.env.E2E_BUILD;
  if (buildCache !== undefined) return buildCache;
  for (const f of chunkFiles()) {
    const m = fs.readFileSync(f, "utf8").match(/"BUILD",\d+,"([0-9a-z]+)"/);
    if (m) return (buildCache = m[1]);
  }
  try {
    buildCache = cp.execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    buildCache = "dev";
  }
  return buildCache;
}
let hlsChunkCache;
/** file name of the lazily loaded hls.js chunk in .next/static/chunks (biggest chunk mentioning ManagedMediaSource) */
function hlsChunkName() {
  if (process.env.E2E_HLS_CHUNK) return process.env.E2E_HLS_CHUNK;
  if (hlsChunkCache !== undefined) return hlsChunkCache;
  let best = null;
  for (const f of chunkFiles()) {
    const st = fs.statSync(f);
    if (st.size < 150000 || (best && st.size <= best.size)) continue;
    const txt = fs.readFileSync(f, "utf8");
    if (txt.includes("ManagedMediaSource") && txt.includes("abrEwmaDefaultEstimate")) best = { f, size: st.size };
  }
  return (hlsChunkCache = best ? path.basename(best.f, ".js") : null);
}

// ─── results / logs ───
let OUT = path.join(RESULTS, "misc");
function useOut(name) {
  OUT = path.join(RESULTS, name);
  fs.mkdirSync(OUT, { recursive: true });
  return OUT;
}
const outDir = () => (fs.mkdirSync(OUT, { recursive: true }), OUT);
const readLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
const hlsLog = () => readLines(path.join(RUN, "hls.log")).map((l) => JSON.parse(l));
const arvanLog = () => readLines(path.join(RUN, "arvan.log")).map((l) => JSON.parse(l));
const appLog = () => readLines(path.join(RUN, "app.log"));
const jwtFile = (who) => path.join(who === "admin" ? RUN : JWT_DIR, `${who}.jwt`);
function readJwt(who) {
  const f = jwtFile(who);
  if (!fs.existsSync(f)) throw new Error(`missing ${path.relative(REPO, f)} — run: node tests/e2e/setup.mjs`);
  return fs.readFileSync(f, "utf8").trim();
}
function ctl(what) {
  cp.execFileSync(path.join(DIR, "ctl.sh"), [what], { stdio: "ignore" });
}

// ─── mock CDN control ───
async function control(n, q) {
  const r = await fetch(`${HLS}/control?${new URLSearchParams({ ns: ids(n).ns, ...q })}`);
  return r.json();
}
async function stats(n) {
  return (await fetch(`${HLS}/stats?ns=${ids(n).ns}`)).json();
}

// ─── DB helpers per scenario ───
function resetProgress(n) {
  const { userId, videoId } = ids(n);
  db(`delete from "VideoProgress" where "userId"='${userId}' and "videoId"='${videoId}'`);
}
function progress(n) {
  const { userId, videoId } = ids(n);
  const r = db(`select "watchedSeconds","lastPosition",completed from "VideoProgress" where "userId"='${userId}' and "videoId"='${videoId}'`);
  if (!r) return null;
  const [w, p, c] = r.split("|");
  return { watchedSeconds: +w, lastPosition: +p, completed: c === "t" };
}
/** telemetry rows (PlaybackEvent) for this scenario's user since `since` (ms); createdAt is UTC without time zone */
function telemetry(n, since) {
  const { userId } = ids(n);
  const iso = new Date(since).toISOString();
  const out = db(
    `select json_agg(json_build_object('at',"createdAt",'kind',kind,'sid',left("sessionId",8),'engine',engine,'pos',position,'code',code,'fatal',fatal,'detail',detail,'queued',queued,'ctx',ctx) order by "createdAt") from "PlaybackEvent" where "userId"='${userId}' and "createdAt" >= '${iso}'::timestamptz at time zone 'UTC'`,
  );
  return out ? JSON.parse(out) : [];
}
const kindCounts = (rows) => rows.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + 1), m), {});

// records media events, online/offline and toasts inside the page
const INIT = `(() => {
  const ev = (window.__ev = []);
  const push = (k, x) => { ev.push([Date.now(), k, x]); if (ev.length > 8000) ev.shift(); };
  const ME = ['loadstart','loadedmetadata','canplay','playing','waiting','pause','play','seeking','seeked','ended','error','emptied'];
  for (const e of ME) document.addEventListener(e, (x) => { const v = x.target; if (!v || v.tagName !== 'VIDEO') return;
    push('v:' + e, { t: +v.currentTime.toFixed(2), rs: v.readyState, err: v.error ? v.error.code : undefined }); }, true);
  window.addEventListener('online', () => push('online'));
  window.addEventListener('offline', () => push('offline'));
  window.addEventListener('pagehide', () => push('pagehide'));
  const seen = (window.__toasts = []);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.textContent || '').trim(); if (t && t.length < 200 && /کیفیت|آفرین|خودکار/.test(t)) { if (!seen.includes(t)) seen.push(t); } } })
    .observe(document, { childList: true, subtree: true });
})();`;

/** open a (mobile-emulated, throttled) browser context logged in as scenario n's student */
async function open(n, name, { device = "Pixel 7", down = 2e6, up = 0.75e6, latency = 150, cpu = 4, landscape = false, pref = 0, blockSW = false, init = "", ua = "" } = {}) {
  const { userId } = ids(n);
  const jwt = readJwt(userId);
  const { devices } = playwright();
  const browser = await launch(["--autoplay-policy=document-user-activation-required", "--enable-precise-memory-info"]);
  const d = device ? { ...devices[device] } : { viewport: { width: 1280, height: 900 } };
  delete d.defaultBrowserType;
  if (landscape && d.viewport) d.viewport = { width: d.viewport.height, height: d.viewport.width };
  const ctx = await browser.newContext({ ...d, ...(ua ? { userAgent: ua } : {}), locale: "fa-IR", serviceWorkers: blockSW ? "block" : "allow" });
  await ctx.addCookies([{ name: "ds_session", value: jwt, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
  await ctx.addInitScript(INIT);
  await ctx.addInitScript(`try{ if(!sessionStorage.getItem('__prefset')){ localStorage.setItem('ds-quality','${pref || 0}'); sessionStorage.setItem('__prefset','1'); } }catch(e){}`);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const rel = (ms) => +((ms - t0) / 1000).toFixed(1);
  const clog = fs.createWriteStream(path.join(outDir(), `console-${name}.log`), { flags: "w" });
  const o = { n, name, ...ids(n), browser, ctx, page, t0, rel, clog, api: [], segs: [], navs: [], pageErrors: [], consoleErrors: [], plays: [], tlmPosts: [] };
  page.on("console", (m) => {
    clog.write(`${rel(Date.now())}s [${m.type()}] ${m.text()}\n`);
    if (m.type() === "error") o.consoleErrors.push(`${rel(Date.now())}s ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => {
    clog.write(`${rel(Date.now())}s [pageerror] ${e.message}\n`);
    o.pageErrors.push(`${rel(Date.now())}s ${e.message.slice(0, 200)}`);
  });
  page.on("crash", () => o.pageErrors.push(`${rel(Date.now())}s CRASH`));
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) o.navs.push(`${rel(Date.now())}s ${f.url().replace(APP, "")}`);
  });
  const cdnRe = new RegExp(`^http://127\\.0\\.0\\.1:${HLS_PORT}/t/(\\d+)/(n/\\w+/)?`);
  const short = (u) => u.replace(cdnRe, (_m, tk) => `[tk${rel(Number(tk))}]/`);
  const isCdn = (u) => u.includes(`:${HLS_PORT}/t/`);
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/api/")) {
      o.api.push(`${rel(Date.now())}s > ${r.method()} ${u.replace(APP, "")}`);
      if (u.includes("/play")) o.plays.push({ at: Date.now(), url: u.replace(APP, "") });
    }
    if (isCdn(u)) r.__start = Date.now();
  });
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/api/")) o.api.push(`${rel(Date.now())}s < ${r.status()} ${u.replace(APP, "")}`);
  });
  page.on("requestfinished", async (r) => {
    const u = r.url();
    if (!isCdn(u)) return;
    let status = "?";
    try {
      status = (await r.response())?.status();
    } catch {}
    o.segs.push(`${rel(r.__start || Date.now())}-${rel(Date.now())}s ${status} ${short(u)}`);
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (isCdn(u)) o.segs.push(`${rel(r.__start || Date.now())}-${rel(Date.now())}s FAIL(${r.failure()?.errorText}) ${short(u)}`);
    else if (u.includes("/api/")) o.api.push(`${rel(Date.now())}s FAIL(${r.failure()?.errorText}) ${u.replace(APP, "")}`);
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  o.cdp = cdp;
  o.netCond = { offline: false, latency, downloadThroughput: down ? down / 8 : -1, uploadThroughput: down ? up / 8 : -1 };
  o.setNet = async (q) => {
    o.netCond = { ...o.netCond, ...q };
    await cdp.send("Network.emulateNetworkConditions", o.netCond);
  };
  o.setOffline = async (off) => {
    await o.setNet({ offline: off }); // navigator.onLine follows offline emulation in Chromium
  };
  if (down) await cdp.send("Network.emulateNetworkConditions", o.netCond);
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  return o;
}

/** snapshot of the player + page state */
const snap = (page) =>
  page.evaluate(() => {
    const v = document.querySelector("video");
    const txt = document.body ? document.body.innerText : "";
    const sel = document.querySelector("select");
    const ranges = [];
    let behind = 0;
    let ahead = 0;
    if (v)
      for (let i = 0; i < v.buffered.length; i++) {
        const s = v.buffered.start(i), e = v.buffered.end(i);
        ranges.push(`${s.toFixed(1)}-${e.toFixed(1)}`);
        if (s <= v.currentTime + 0.3 && e >= v.currentTime - 0.3) {
          behind = v.currentTime - s;
          ahead = e - v.currentTime;
        } else if (e < v.currentTime) behind += e - s;
      }
    return {
      wall: Date.now(),
      href: location.pathname + location.search,
      vis: document.visibilityState,
      inDom: !!v,
      t: v ? +v.currentTime.toFixed(2) : null,
      paused: v ? v.paused : null,
      rs: v ? v.readyState : null,
      h: v ? v.videoHeight : null,
      ranges: ranges.join(","),
      behind: +behind.toFixed(1),
      ahead: +ahead.toFixed(1),
      err: v && v.error ? v.error.code : null,
      overlay: txt.includes("تلاش دوباره"),
      overlayMsg: (document.querySelector('[role="alert"] p') || {}).textContent || null,
      support: (txt.match(/کد پیگیری:\s*([0-9a-f]{6})/) || [])[1] || null,
      busy: txt.includes("در حال اتصال دوباره"),
      tap: txt.includes("ادامه‌ی پخش"),
      sel: sel ? sel.value : null,
      online: navigator.onLine,
      heap: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null,
      toasts: (window.__toasts || []).length,
    };
  });

const fmt = (rel) => (s) =>
  s.evalError
    ? `${rel(s.wall)}s EVALERR ${s.evalError}`
    : `${rel(s.wall)}s t=${s.t} p=${s.paused ? 1 : 0} rs=${s.rs} h=${s.h} sel=${s.sel} buf=[${s.ranges}] fwd=${s.ahead} back=${s.behind}${s.err ? " ERR=" + s.err : ""}${s.busy ? " BUSY" : ""}${s.overlay ? " OVERLAY" : ""}${s.tap ? " TAP" : ""}${s.inDom ? "" : " NOVIDEO"}${s.online ? "" : " OFFLINE"} heap=${s.heap}${s.href && !s.href.startsWith("/panel/videos/") ? " URL=" + s.href : ""}`;

/** sample snap() every `every` ms for `ms`; onTick may return true to stop early */
async function monitor(o, ms, every = 1000, onTick) {
  const tl = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    let s;
    try {
      s = await snap(o.page);
    } catch (e) {
      s = { wall: Date.now(), evalError: String(e.message).slice(0, 120) };
    }
    tl.push(s);
    if (onTick) {
      const stop = await onTick(s, tl);
      if (stop === true) break;
    }
    await sleep(every);
  }
  return tl;
}

/** freezes = runs where t did not advance; jumpsBack = t went back > 2 s.
 *  A sample taken in the middle of a source swap (readyState 0, t 0 — the player re-attaching a fresh link)
 *  counts as "picture frozen at the previous t" instead of a jump back to 0: a swap lasts a few ms and used to
 *  show up as a false jump, while a long rs=0 period still shows up as a stall. */
function analyze(tl, rel) {
  const ok = [];
  let swapSamples = 0;
  for (const x of tl) {
    if (x.t == null) continue;
    if (x.rs === 0 && x.t === 0 && !x.overlay && ok.length) {
      swapSamples++;
      ok.push({ ...x, t: ok[ok.length - 1].t });
    } else ok.push(x);
  }
  const jumpsBack = [];
  let maxStall = 0, stallStart = null;
  const stalls = [];
  for (let i = 1; i < ok.length; i++) {
    const a = ok[i - 1], b = ok[i];
    if (b.t < a.t - 2) jumpsBack.push({ at: rel ? rel(b.wall) : b.wall, from: a.t, to: b.t });
    if (b.t <= a.t + 0.05) {
      if (stallStart == null) stallStart = a.wall;
      maxStall = Math.max(maxStall, b.wall - stallStart);
    } else {
      if (stallStart != null && b.wall - stallStart > 2500) stalls.push({ at: rel ? rel(stallStart) : stallStart, ms: b.wall - stallStart });
      stallStart = null;
    }
  }
  if (stallStart != null && ok.length && ok[ok.length - 1].wall - stallStart > 2500) stalls.push({ at: rel ? rel(stallStart) : stallStart, ms: ok[ok.length - 1].wall - stallStart, open: true });
  return {
    samples: tl.length,
    firstT: ok[0]?.t,
    lastT: ok[ok.length - 1]?.t,
    jumpsBack,
    maxStallMs: maxStall,
    stalls,
    swapSamples,
    overlaySamples: tl.filter((x) => x.overlay).length,
    busySamples: tl.filter((x) => x.busy).length,
    tapSamples: tl.filter((x) => x.tap).length,
    pausedSamples: tl.filter((x) => x.paused).length,
    errSamples: tl.filter((x) => x.err).length,
    evalErrors: tl.filter((x) => x.evalError).length,
    hrefs: [...new Set(tl.map((x) => x.href).filter(Boolean))],
    maxAhead: Math.max(0, ...ok.map((x) => x.ahead || 0)),
    maxBehind: Math.max(0, ...ok.map((x) => x.behind || 0)),
    heapFirst: ok.find((x) => x.heap)?.heap,
    heapLast: ok[ok.length - 1]?.heap,
    heapMax: Math.max(0, ...ok.map((x) => x.heap || 0)),
  };
}

async function gotoWatch(o) {
  await o.page.goto(`${APP}/panel/videos/${o.videoId}`, { waitUntil: "domcontentloaded" });
  await o.page.waitForSelector("video", { timeout: 60000 });
}
/** like gotoWatch, but also waits until the engine attached a source (avoids the play()-before-attach race) */
async function gotoWatchReady(o) {
  await gotoWatch(o);
  await o.page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.currentSrc && v.readyState >= 1; }, null, { timeout: 90000 });
}
/** user-gesture play via CDP (like a real tap) */
async function tapPlay(o) {
  const r = await o.cdp.send("Runtime.evaluate", { expression: `document.querySelector('video').play().then(()=>'ok',e=>'err:'+e.name+':'+e.message)`, awaitPromise: true, userGesture: true });
  return r.result?.value;
}
async function gesture(o, expr) {
  const r = await o.cdp.send("Runtime.evaluate", { expression: expr, awaitPromise: true, userGesture: true });
  return r.result?.value ?? r.exceptionDetails?.text;
}
/** pick a quality in the select (user action) */
async function pickQuality(o, h) {
  await o.page.selectOption("select", String(h));
}

/** common verdict pieces */
function common(o, tl) {
  const watchPath = `/panel/videos/${o.videoId}`;
  const navsOff = o.navs.filter((x) => !x.endsWith(watchPath));
  return {
    urlUnchanged: tl.every((s) => !s.href || s.href.startsWith(watchPath)) && navsOff.length === 0,
    navs: o.navs,
    pageErrors: o.pageErrors,
    consoleErrors: o.consoleErrors.slice(0, 15),
    consoleErrorCount: o.consoleErrors.length,
  };
}

async function finish(o, res) {
  try {
    res.final = fmt(o.rel)(await snap(o.page));
  } catch (e) {
    res.final = "snap failed: " + e.message;
  }
  try {
    res.toasts = await o.page.evaluate(() => window.__toasts || []);
  } catch {}
  res.events = (await o.page.evaluate(() => window.__ev || []).catch(() => [])).map((e) => `${o.rel(e[0])}s ${e[1]} ${e[2] === undefined ? "" : JSON.stringify(e[2])}`);
  res.api = o.api;
  res.segs = o.segs;
  // leave the page like a student closing the tab (pagehide -> session-end beacon), then close
  try { await o.page.goto("about:blank", { timeout: 10000 }); } catch {}
  await sleep(1500);
  await o.browser.close().catch(() => {});
  return res;
}
function save(name, res) {
  const f = path.join(outDir(), `result-${name}.json`);
  fs.writeFileSync(f, JSON.stringify(res, null, 2));
  return f;
}
/** one machine-readable line per scenario for run.mjs */
function report(name, pass, file) {
  console.log(`E2E-RESULT ${JSON.stringify({ name, pass: pass === true, file: file ? path.relative(REPO, file) : null })}`);
}
/** compact telemetry for the summary */
const telBrief = (rows, t0) =>
  rows.map((r) => `${((Date.parse(r.at + "Z") - t0) / 1000).toFixed(0)}s ${r.kind}${r.code != null ? " c=" + r.code : ""}${r.queued ? " QUEUED" : ""} pos=${r.pos} ${r.detail || ""}`.slice(0, 220));

module.exports = {
  DIR, REPO, RUN, RESULTS, APP, HLS, APP_PORT, HLS_PORT, LEGACY_VIDEO_ID, CHROMIUM,
  playwright, launch, readEnv, pgEnv, db, expectedBuild, hlsChunkName, useOut, outDir, hlsLog, arvanLog, appLog, jwtFile, readJwt, ctl,
  ids, control, stats, resetProgress, progress, telemetry, kindCounts, open, snap, fmt, monitor, analyze,
  gotoWatch, gotoWatchReady, tapPlay, gesture, pickQuality, common, finish, save, report, telBrief, sleep,
};
