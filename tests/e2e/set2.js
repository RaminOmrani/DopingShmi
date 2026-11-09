// مجموعه‌ی سناریوی ۲: پلتفرم (iOS، Wake Lock، کرش/اجرای دوباره‌ی PWA)، گزارش پخش (telemetry)، پوسته‌ی برنامه و پنل مدیر.
// Scenario set 2 (platform, telemetry, shell, admin report).
//   node set2.js <scenario>[,<scenario>…]     several names run in parallel (only if their n slots differ!)
//   node set2.js list
// Needs: ./ctl.sh up, node setup.mjs. Results: results/set2/result-<name>.json (+ screenshots).
// Exit code 0 = every verdict of every scenario true, 1 = a verdict failed, 2 = harness error. Details: README.md.
const fs = require("fs");
const path = require("path");
const S = require("./lib");
const { devices } = S.playwright();
const { sleep } = S;
const which = process.argv[2];
const OUT2 = S.useOut("set2");
const APP = S.APP;
// commit id baked into the running build (NEXT_PUBLIC_BUILD_SHA) and the hashed file name of the hls.js chunk
const BUILD = S.expectedBuild();
const HLS_CHUNK = S.hlsChunkName();

const save = (name, res) => S.save(name, res);
async function setup(n, q = {}, loop = 1) {
  await S.control(n, { reset: 1, valid: 86400000, loop, epoch: Date.now(), ...q });
  S.db(`update "Video" set "durationSec"=${Math.round(152 * loop)}, published=true where id='${S.ids(n).videoId}'`);
  S.resetProgress(n);
}
/** full telemetry rows (full sessionId + build) */
function rowsOf(where) {
  const out = S.db(
    `select coalesce(json_agg(json_build_object('at',"createdAt",'kind',kind,'sid',"sessionId",'engine',engine,'build',build,'pos',position,'code',code,'detail',detail,'queued',queued,'ua',left(ua,60),'ctx',ctx) order by "createdAt"),'[]'::json) from "PlaybackEvent" where ${where}`,
  );
  return out ? JSON.parse(out) : [];
}
const rowsUser = (n, since) => rowsOf(`"userId"='${S.ids(n).userId}' and "createdAt" >= '${new Date(since).toISOString()}'::timestamptz at time zone 'UTC'`);
const brief = (rows) => rows.map((r) => `${r.at.slice(11, 19)} ${r.kind} sid=${(r.sid || "").slice(0, 8)} eng=${r.engine} build=${r.build} pos=${r.pos}${r.code != null ? " c=" + r.code : ""}${r.queued ? " Q" : ""} ${r.detail || ""}`.slice(0, 200));

async function finishRun(name, o, res) {
  if (o) {
    res.pageErrors = o.pageErrors;
    res.consoleErrorCount = o.consoleErrors.length;
    res.consoleErrors = o.consoleErrors.slice(0, 10);
    res.navs = o.navs;
    res.api = o.api.slice(-60);
    try {
      await o.browser.close();
    } catch {}
  }
  if (res.verdict) res.pass = Object.values(res.verdict).every(Boolean);
  const file = save(name, res);
  console.log(JSON.stringify({ name, pass: res.pass, verdict: res.verdict, error: res.error, notes: res.notes }, null, 1));
  S.report(name, res.pass, file);
  return res;
}
const vstate = (page) =>
  page.evaluate(() => {
    const v = document.querySelector("video");
    return v ? { t: +v.currentTime.toFixed(2), paused: v.paused, ended: v.ended, rs: v.readyState, dur: v.duration, src: (v.currentSrc || "").slice(0, 60), err: v.error && v.error.code } : null;
  });
async function waitUntil(fn, ms, every = 500) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fn();
      if (r) return r;
    } catch {}
    await sleep(every);
  }
  return null;
}
async function advancing(page, ms = 3000) {
  const a = await vstate(page);
  await sleep(ms);
  const b = await vstate(page);
  return !!(a && b && b.t > a.t + 0.5 && !b.paused);
}

const IOS_INIT = ({ standalone = true, delMSE = false, engine = "" }) => `(() => {
  ${standalone ? "Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true });" : ""}
  const o = HTMLMediaElement.prototype.canPlayType;
  HTMLMediaElement.prototype.canPlayType = function (t) { return /mpegurl/i.test(String(t)) ? 'maybe' : o.call(this, t); };
  ${delMSE ? "for (const k of ['MediaSource','ManagedMediaSource','WebKitMediaSource','SourceBuffer','ManagedSourceBuffer']) { try { delete window[k]; } catch (e) {} }" : ""}
  try { ${engine ? `localStorage.setItem('ds-engine', '${engine}');` : "localStorage.removeItem('ds-engine');"} } catch (e) {}
})();`;

const WAKE_INIT = `(() => {
  const log = (window.__wl = []);
  let id = 0;
  const mk = () => {
    const s = new EventTarget();
    s.id = ++id; s.type = 'screen'; s.released = false;
    s.release = () => { log.push([Date.now(), 'release', s.id, s.released ? 'again' : '']); if (!s.released) { s.released = true; s.dispatchEvent(new Event('release')); } return Promise.resolve(); };
    return s;
  };
  const api = { request: (type) => { const s = mk(); log.push([Date.now(), 'request', s.id, document.visibilityState]); window.__wlLast = s; return Promise.resolve(s); } };
  Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => api });
  window.__browserRelease = () => { const s = window.__wlLast; if (s && !s.released) { log.push([Date.now(), 'browser-release', s.id]); s.released = true; s.dispatchEvent(new Event('release')); } };
  window.__setVis = (st) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => st });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => st === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  window.__wlHeld = () => { const s = window.__wlLast; return !!(s && !s.released); };
})();`;

const SC = {
  // 1. iOS home-screen engine selection
  async ios(n = 13) {
    const res = { scenario: "s1-ios", variants: {} };
    const variants = [
      { key: "A-standalone-noMSE", init: { standalone: true, delMSE: true }, expect: { engine: "native", why: "ios-app", hlsChunk: false, select: false } },
      { key: "C-standalone-withMSE", init: { standalone: true, delMSE: false }, expect: { engine: "native", why: "ios-app", hlsChunk: false, select: false } },
      { key: "B-standalone-override-hls", init: { standalone: true, delMSE: false, engine: "hls" }, expect: { engine: "hls", why: "override", hlsChunk: true, select: true } },
      { key: "D-safari-tab", init: { standalone: false, delMSE: false }, expect: { engine: "hls", why: "mse", hlsChunk: true, select: true } },
    ];
    res.verdict = {};
    for (const vv of variants) {
      await setup(n);
      const since = Date.now() - 1000;
      const r = { expect: vv.expect };
      let o;
      try {
        o = await S.open(n, `set2-ios-${vv.key}`, { device: "iPhone 14", down: 0, cpu: 1, init: IOS_INIT(vv.init) });
        const chunks = [];
        o.page.on("request", (q) => q.url().includes("/_next/static/chunks/") && chunks.push(q.url().split("/").pop()));
        await S.gotoWatch(o);
        r.engineRow = await waitUntil(() => rowsUser(n, since).find((x) => x.kind === "engine"), 25000);
        await sleep(2500);
        r.probe = await o.page.evaluate(() => ({
          standalone: navigator.standalone,
          mse: !!window.MediaSource,
          ua: navigator.userAgent.slice(0, 80),
          select: !!document.querySelector("select"),
          nativeHint: document.body.innerText.includes("کیفیت به‌طور خودکار"),
          src: (document.querySelector("video") || {}).currentSrc || "",
          engineLs: localStorage.getItem("ds-engine"),
        }));
        // without a detectable hls.js chunk (unusual build output) this sub-check is skipped
        r.hlsChunkRequested = HLS_CHUNK ? chunks.some((c) => c.includes(HLS_CHUNK)) : vv.expect.hlsChunk;
        if (!HLS_CHUNK) res.notes = "hls.js chunk name not found in .next/static/chunks; hlsChunk sub-check skipped";
        r.play = await S.tapPlay(o);
        r.plays = await advancing(o.page, 4000);
        r.vstate = await vstate(o.page);
        const er = r.engineRow;
        r.ok = {
          engine: !!er && er.engine === vv.expect.engine && (er.detail || "").includes(vv.expect.why),
          hlsChunk: r.hlsChunkRequested === vv.expect.hlsChunk,
          select: r.probe.select === vv.expect.select,
          nativeSrc: vv.expect.engine === "native" ? r.probe.src.includes(":3600/") : r.probe.src.startsWith("blob:"),
          standaloneCtx: !!er && er.ctx && er.ctx.standalone === vv.init.standalone,
        };
        r.engineRowBrief = er ? { engine: er.engine, detail: er.detail, build: er.build, standalone: er.ctx && er.ctx.standalone, ios: er.ctx && er.ctx.ios, engineWhy: er.ctx && er.ctx.engineWhy } : null;
        r.pageErrors = o.pageErrors;
        for (const [k, v] of Object.entries(r.ok)) res.verdict[`${vv.key}:${k}`] = v;
      } catch (e) {
        r.error = String(e.stack || e).slice(0, 800);
        res.verdict[`${vv.key}:noError`] = false;
      }
      if (o) await o.browser.close().catch(() => {});
      res.variants[vv.key] = r;
    }
    return finishRun("s1-ios", null, res);
  },

  // 2 + 6. wake lock lifecycle + hidden-playing telemetry
  async wake(n = 14) {
    await setup(n);
    const since = Date.now() - 1000;
    const res = { scenario: "s2-wake", steps: {} };
    let o;
    const wl = () => o.page.evaluate(() => window.__wl.map((x) => [x[0], x[1], x[2], x[3]]));
    const held = () => o.page.evaluate(() => window.__wlHeld());
    const stepLog = async (k, extra = {}) => (res.steps[k] = { at: o.rel(Date.now()), wl: (await wl()).map((x) => `${o.rel(x[0])}s ${x[1]}#${x[2]}${x[3] ? " " + x[3] : ""}`), held: await held(), v: await vstate(o.page), ...extra });
    try {
      o = await S.open(n, "set2-wake", { device: "Pixel 7", down: 0, cpu: 1, init: WAKE_INIT });
      await S.gotoWatchReady(o);
      await sleep(1500);
      await stepLog("0-beforePlay");
      res.play1 = await S.tapPlay(o);
      await sleep(3000);
      await stepLog("1-afterFirstPlay");
      await sleep(5000);
      // hide (browser releases the lock when the page is hidden)
      await o.page.evaluate(() => { window.__setVis("hidden"); window.__browserRelease(); });
      await sleep(3000);
      await stepLog("2-hidden");
      await o.page.evaluate(() => window.__setVis("visible"));
      await sleep(2000);
      await stepLog("3-visibleAgain");
      await sleep(4000);
      // forced refresh: CDN starts answering 403 without CORS (status 0) -> link-suspect -> fresh link
      const wlBeforeRefresh = (await wl()).length;
      const playsBefore = o.plays.length;
      // the current link (minted ~20 s ago) is now expired and answered with a CORS-less 403; a fresh link is valid
      // for 10 s — kept that way until the player asks for a fresh link, then every link is valid again.
      // A status-0 failure is retried until the forward buffer (~60 s) runs dry, so the refresh comes ~60-70 s later.
      await S.control(n, { cors403: 1, valid: 10000 });
      const got403 = await waitUntil(async () => (await S.stats(n)).stats.s403 > 0, 40000, 200);
      res.got403 = !!got403;
      const heldSamples = [];
      const refreshed = await waitUntil(async () => {
        heldSamples.push(await held());
        return o.plays.slice(playsBefore).some((p) => p.url.includes("fresh=1"));
      }, 110000, 250);
      await S.control(n, { valid: 86400000 });
      // until playback is moving again
      const resumed = await waitUntil(async () => {
        heldSamples.push(await held());
        return advancing(o.page, 1500);
      }, 40000, 200);
      res.refreshed = !!refreshed;
      res.resumedAfterRefresh = !!resumed;
      res.heldDuringRefresh = heldSamples;
      const wlAfterRefresh = await wl();
      res.wlChangesDuringRefresh = wlAfterRefresh.slice(wlBeforeRefresh).map((x) => `${o.rel(x[0])}s ${x[1]}#${x[2]}`);
      await stepLog("4-afterRefresh");
      // student pause
      await S.gesture(o, "document.querySelector('video').pause()");
      await sleep(1500);
      await stepLog("5-paused");
      // play again, then run to the end
      await S.tapPlay(o);
      await sleep(2000);
      await stepLog("6-playAgain");
      await o.page.evaluate(() => { const v = document.querySelector("video"); v.currentTime = Math.max(0, v.duration - 5); });
      const ended = await waitUntil(() => o.page.evaluate(() => document.querySelector("video").ended), 40000);
      await sleep(1000);
      await stepLog("7-ended", { ended: !!ended });
      // giveUp: video unpublished (API 404 own JSON -> final giveUp) + CDN 403 without CORS
      await S.tapPlay(o);
      await sleep(6000);
      await stepLog("8-playForGiveup");
      S.db(`update "Video" set published=false where id='${o.videoId}'`);
      await S.control(n, { cors403: 1, valid: 1 });
      const overlay = await waitUntil(async () => (await S.snap(o.page)).overlay, 90000, 500);
      await sleep(1000);
      await stepLog("9-giveup", { overlay: !!overlay, overlayMsg: (await S.snap(o.page)).overlayMsg });
      S.db(`update "Video" set published=true where id='${o.videoId}'`);
      await S.control(n, { cors403: 0, valid: 86400000 });
      // retry button (student tap) -> plays again -> lock re-acquired
      await o.page.click('button:has-text("تلاش دوباره")').catch((e) => (res.retryClickErr = e.message));
      const back = await waitUntil(() => advancing(o.page, 1500), 45000, 200);
      await stepLog("10-afterRetry", { playing: !!back });
      // unmount: SPA link to another video in the sidebar
      const other = S.ids(n === 14 ? 13 : 14).videoId;
      const wlBeforeNav = (await wl()).length;
      await o.page.evaluate((h) => document.querySelector(`a[href="${h}"]`).click(), `/panel/videos/${other}`);
      await o.page.waitForURL(`**/panel/videos/${other}`, { timeout: 20000 }).catch(() => {});
      await sleep(2500);
      const wlNav = await wl().catch(() => null);
      res.spaNavKeptWindow = !!wlNav;
      res.wlAfterNav = wlNav ? wlNav.slice(wlBeforeNav).map((x) => `${o.rel(x[0])}s ${x[1]}#${x[2]}`) : null;
      await stepLog("11-unmounted", { url: o.page.url().replace(APP, "") });
      // telemetry
      await o.page.goto("about:blank").catch(() => {});
      await sleep(2500);
      const rows = rowsUser(n, since);
      res.telemetry = brief(rows);
      const hp = rows.find((r) => r.kind === "hidden-playing");
      res.hiddenPlayingRow = hp ? { ctxKeys: Object.keys(hp.ctx || {}), idleSec: hp.ctx.idleSec, standalone: hp.ctx.standalone, wakeLock: hp.ctx.wakeLock, vis: hp.ctx.vis, pos: hp.pos, engine: hp.engine, build: hp.build } : null;
      const ls = rows.find((r) => r.kind === "link-suspect");
      res.linkSuspectWakeLock = ls ? ls.ctx.wakeLock : undefined;
      const s = res.steps;
      const reqs = (k) => s[k].wl.filter((x) => / request#/.test(x)).length;
      const rels = (k) => s[k].wl.filter((x) => / release#/.test(x)).length;
      res.verdict = {
        noRequestBeforePlay: reqs("0-beforePlay") === 0,
        requestOnFirstPlay: reqs("1-afterFirstPlay") === 1 && s["1-afterFirstPlay"].held,
        reRequestOnVisible: reqs("3-visibleAgain") === 2 && s["3-visibleAgain"].held && /request#2 visible/.test(s["3-visibleAgain"].wl.join("|")),
        noRequestWhileHidden: reqs("2-hidden") === 1,
        refreshHappened: res.refreshed && res.got403,
        heldThroughRefresh: res.heldDuringRefresh.every(Boolean) && res.wlChangesDuringRefresh.length === 0 && s["4-afterRefresh"].held,
        resumedAfterRefresh: res.resumedAfterRefresh,
        releasedOnPause: rels("5-paused") === rels("4-afterRefresh") + 1 && !s["5-paused"].held,
        requestOnPlayAgain: s["6-playAgain"].held && reqs("6-playAgain") === reqs("5-paused") + 1,
        releasedOnEnded: s["7-ended"].ended && !s["7-ended"].held && rels("7-ended") === rels("6-playAgain") + 1,
        releasedOnGiveUp: s["9-giveup"].overlay && !s["9-giveup"].held && rels("9-giveup") === rels("8-playForGiveup") + 1,
        reacquiredAfterRetry: s["10-afterRetry"].playing && s["10-afterRetry"].held,
        releasedOnUnmount: !!res.wlAfterNav && res.wlAfterNav.some((x) => / release#/.test(x)) && !s["11-unmounted"].held,
        hiddenPlayingRow: !!hp && ["idleSec", "standalone", "wakeLock"].every((k) => k in (hp.ctx || {})),
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
      S.db(`update "Video" set published=true where id='${S.ids(n).videoId}'`);
    }
    return finishRun("s2-wake", o, res);
  },

  // 2b. wake lock held through a real link refresh (403 with CORS on the old token -> expired-link -> fresh link)
  async wake2(n = 11) {
    await setup(n, {}, 2);
    const since = Date.now() - 1000;
    const res = { scenario: "s2b-wake-refresh" };
    let o;
    try {
      o = await S.open(n, "set2-wake2", { device: "Pixel 7", down: 0, cpu: 1, init: WAKE_INIT });
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      await sleep(25000);
      const wl = () => o.page.evaluate(() => window.__wl.map((x) => `${x[1]}#${x[2]}`));
      res.wlBefore = await wl();
      const p0 = o.plays.length;
      // old token (minted >20 s ago) now expired with a normal 403 (CORS ok); a fresh link is valid for 20 s
      await S.control(n, { valid: 20000 });
      const held = [];
      const snaps = [];
      const fresh = await waitUntil(async () => { held.push(await o.page.evaluate(() => window.__wlHeld())); return o.plays.slice(p0).some((p) => p.url.includes("fresh=1")); }, 90000, 250);
      await S.control(n, { valid: 86400000 });
      res.freshAt = fresh ? o.rel(o.plays.slice(p0).find((p) => p.url.includes("fresh=1")).at) : null;
      const resumed = await waitUntil(async () => { held.push(await o.page.evaluate(() => window.__wlHeld())); const s = await S.snap(o.page); snaps.push(S.fmt(o.rel)(s)); return advancing(o.page, 1500); }, 60000, 250);
      res.resumed = !!resumed;
      res.heldSamples = held.length;
      res.heldFalse = held.filter((x) => !x).length;
      res.wlAfter = await wl();
      res.snaps = snaps.slice(-12);
      res.stats = await S.stats(n);
      await o.page.goto("about:blank").catch(() => {});
      await sleep(2500);
      res.telemetry = brief(rowsUser(n, since));
      res.verdict = { refreshHappened: !!fresh, heldThroughout: res.heldFalse === 0, noReleaseOrNewRequest: JSON.stringify(res.wlAfter) === JSON.stringify(res.wlBefore), resumed: res.resumed };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s2b-wake-refresh", o, res);
  },

  // 3. native engine (Chromium native HLS) + 8 s offline blip
  async native(n = 19) {
    await setup(n, {}, 2);
    const since = Date.now() - 1000;
    const res = { scenario: "s3-native" };
    let o;
    try {
      o = await S.open(n, "set2-native", { device: "Pixel 7", down: 4e6, up: 1e6, latency: 80, cpu: 2, init: IOS_INIT({ standalone: false, delMSE: true, engine: "native" }) });
      await S.gotoWatchReady(o);
      res.probe = await o.page.evaluate(() => ({ mse: !!window.MediaSource, cpt: document.createElement("video").canPlayType("application/vnd.apple.mpegurl"), src: document.querySelector("video").currentSrc.slice(0, 60) }));
      res.play = await S.tapPlay(o);
      res.tl0 = await S.monitor(o, 20000);
      res.nativePlays = res.tl0.length > 3 && res.tl0[res.tl0.length - 1].t > res.tl0[0].t + 5;
      if (!res.nativePlays) {
        res.notes = "Chromium native HLS did not advance currentTime; skipping blip";
      } else {
        const blipAt = Date.now();
        await o.setOffline(true);
        res.tlBlip = await S.monitor(o, 8000);
        await o.setOffline(false);
        res.tl = await S.monitor(o, 75000);
        const all = [...res.tlBlip, ...res.tl];
        // a silent paused frame: paused with no overlay/tap/busy UI, sustained
        let run = 0;
        let maxSilent = 0;
        for (const s of all) {
          if (s.paused && !s.overlay && !s.tap && !s.busy) run++;
          else run = 0;
          maxSilent = Math.max(maxSilent, run);
        }
        res.maxSilentPausedSec = maxSilent;
        const last = res.tl.slice(-6);
        res.endPlaying = last.length > 2 && last[last.length - 1].t > last[0].t + 2 && !last[last.length - 1].paused;
        res.endTap = res.tl[res.tl.length - 1].tap;
        res.blipAt = o.rel(blipAt);
        res.analysis = S.analyze(all, o.rel);
        res.verdict = { nativeEngine: true, noSilentPausedFrame: maxSilent <= 3, resumedOrTap: res.endPlaying || res.endTap };
      }
      res.engineRows = rowsUser(n, since).filter((r) => r.kind === "engine").map((r) => `${r.engine} ${r.detail}`);
      res.verdict = res.verdict || { nativeEngine: res.engineRows.some((x) => x.startsWith("native")) };
      res.verdict.nativeEngine = res.engineRows.some((x) => x.startsWith("native"));
      for (const k of ["tl0", "tlBlip", "tl"]) if (res[k]) res[k] = res[k].map(S.fmt(o.rel));
      res.events = (await o.page.evaluate(() => window.__ev || []).catch(() => [])).map((e) => `${o.rel(e[0])}s ${e[1]} ${e[2] === undefined ? "" : JSON.stringify(e[2])}`).slice(-80);
      res.segs = o.segs.slice(-60);
      await o.page.goto("about:blank").catch(() => {});
      await sleep(2500);
      res.telemetry = brief(rowsUser(n, since));
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s3-native", o, res);
  },

  // 4a. renderer crash -> abnormal-exit on next open
  async crash(n = 20) {
    await setup(n, {}, 3);
    const since = Date.now() - 1000;
    const res = { scenario: "s4a-crash" };
    let o;
    try {
      o = await S.open(n, "set2-crash", { device: "Pixel 7", down: 0, cpu: 1 });
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      await sleep(14000);
      res.before = await vstate(o.page);
      res.marker = JSON.parse(await o.page.evaluate(() => localStorage.getItem("ds-watch")));
      res.supportCode = (await S.snap(o.page)).support;
      await Promise.race([o.cdp.send("Page.crash").catch((e) => (res.crashErr = e.message)), sleep(3000)]);
      await sleep(2000);
      res.crashed = o.pageErrors.some((x) => x.includes("CRASH"));
      const p2 = await o.ctx.newPage();
      res.p2Errors = [];
      p2.on("pageerror", (e) => res.p2Errors.push(e.message.slice(0, 200)));
      await p2.goto(`${APP}/panel/videos/${o.videoId}`, { waitUntil: "domcontentloaded" });
      const row = await waitUntil(() => rowsUser(n, since).find((r) => r.kind === "abnormal-exit"), 20000, 1000);
      res.abnormalRow = row ? { sid: row.sid, pos: row.pos, detail: row.detail, ctx: row.ctx, build: row.build, videoId: undefined } : null;
      res.bannerOnSameVideo = await p2.evaluate(() => document.body.innerText.includes("نیمه‌کاره ماند"));
      await p2.reload({ waitUntil: "domcontentloaded" });
      await sleep(10000);
      const rows = rowsUser(n, since);
      res.abnormalCount = rows.filter((r) => r.kind === "abnormal-exit").length;
      res.telemetry = brief(rows);
      res.verdict = {
        crashed: res.crashed,
        rowLogged: !!row,
        prevSessionId: !!row && row.sid === res.marker.sid,
        position: !!row && Math.abs(row.pos - res.before.t) <= 7,
        prevVisVisible: !!row && row.ctx.prevVis === "visible",
        prevPlaying: !!row && row.ctx.prevPlaying === true,
        notSameTab: !!row && row.ctx.sameTab === false,
        reportedOnce: res.abnormalCount === 1,
        noBannerOnWatchPage: res.bannerOnSameVideo === false,
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s4a-crash", o, res);
  },

  // 4b. PWA relaunch: unclean marker -> banner + abnormal-exit(relaunch=true), only once
  async pwa(n = 1) {
    await setup(n);
    const since = Date.now() - 1000;
    const res = { scenario: "s4b-pwa" };
    let o;
    try {
      o = await S.open(n, "set2-pwa", { device: "iPhone 14", down: 0, cpu: 1, init: IOS_INIT({ standalone: true }) });
      await o.page.goto(`${APP}/`, { waitUntil: "domcontentloaded" });
      const sid = `pwa-${Date.now().toString(36)}-relaunch`;
      res.sid = sid;
      await o.page.evaluate(
        ([sid, vid, build]) => localStorage.setItem("ds-watch", JSON.stringify({ sid, videoId: vid, title: "E2E ns 1", pos: 77, at: Date.now() - 90000, vis: "visible", playing: true, standalone: true, build, clean: false })),
        [sid, o.videoId, BUILD],
      );
      await o.page.goto(`${APP}/panel?source=pwa`, { waitUntil: "domcontentloaded" });
      const banner = await waitUntil(() => o.page.evaluate(() => document.body.innerText.includes("پخش ویدیو نیمه‌کاره ماند")), 10000);
      res.banner = !!banner;
      res.link = await o.page.evaluate(() => {
        const a = [...document.querySelectorAll("a")].find((x) => x.textContent.includes("ادامه‌ی تماشا"));
        return a ? a.getAttribute("href") : null;
      });
      await o.page.screenshot({ path: path.join(OUT2, "pwa-banner.png") });
      const row = await waitUntil(() => rowsUser(n, since).find((r) => r.kind === "abnormal-exit" && r.sid === sid), 10000, 1000);
      res.row = row ? { pos: row.pos, detail: row.detail, relaunch: row.ctx.relaunch, prevVis: row.ctx.prevVis, gapSec: row.ctx.gapSec, standalone: row.ctx.standalone, prevStandalone: row.ctx.prevStandalone } : null;
      res.markerAfter = JSON.parse(await o.page.evaluate(() => localStorage.getItem("ds-watch")));
      await o.page.reload({ waitUntil: "domcontentloaded" });
      await sleep(6000);
      res.bannerAfterReload = await o.page.evaluate(() => document.body.innerText.includes("پخش ویدیو نیمه‌کاره ماند"));
      const rows = rowsUser(n, since);
      res.abnormalCount = rows.filter((r) => r.kind === "abnormal-exit" && r.sid === sid).length;
      // unclean marker, app reopened straight on a watch page: report yes, banner no
      const sid2 = `pwa-${Date.now().toString(36)}-watch`;
      await o.page.evaluate(
        ([sid, vid, build]) => localStorage.setItem("ds-watch", JSON.stringify({ sid, videoId: vid, title: "E2E ns 1", pos: 50, at: Date.now() - 60000, vis: "visible", playing: true, standalone: true, build, clean: false })),
        [sid2, o.videoId, BUILD],
      );
      await o.page.goto(`${APP}/panel/videos/${o.videoId}`, { waitUntil: "domcontentloaded" });
      const row2 = await waitUntil(() => rowsUser(n, since).find((r) => r.kind === "abnormal-exit" && r.sid === sid2), 15000, 1000);
      await sleep(1500);
      res.watchPageRow = !!row2;
      res.watchPageBanner = await o.page.evaluate(() => document.body.innerText.includes("پخش ویدیو نیمه‌کاره ماند"));
      // SPA from the watch page to /panel: the banner was cleared on the watch page and must not pop up afterwards
      await o.page.locator('a[href="/panel"]:visible').first().click({ timeout: 8000 }).catch(() => o.page.goto(`${APP}/panel`));
      await sleep(3000);
      res.bannerAfterLeavingWatch = await o.page.evaluate(() => document.body.innerText.includes("پخش ویدیو نیمه‌کاره ماند"));
      res.telemetry = brief(rows);
      res.verdict = {
        banner: res.banner,
        linkToVideo: res.link === `/panel/videos/${o.videoId}`,
        rowLogged: !!row,
        relaunchTrue: !!row && row.ctx.relaunch === true,
        prevVisVisible: !!row && row.ctx.prevVis === "visible",
        reportedOnce: res.abnormalCount === 1,
        noBannerAfterReload: !res.bannerAfterReload,
        watchPageRowLogged: res.watchPageRow,
        noBannerOnWatchPage: res.watchPageBanner === false,
        noBannerAfterLeavingWatch: res.bannerAfterLeavingWatch === false,
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s4b-pwa", o, res);
  },

  // 4c. clean navigation away (SPA link click / full navigation) must NOT produce abnormal-exit
  async cleannav(n = 2) {
    await setup(n, {}, 3);
    const since = Date.now() - 1000;
    const res = { scenario: "s4c-cleannav" };
    let o;
    try {
      o = await S.open(n, "set2-cleannav", { device: "Pixel 7", down: 0, cpu: 1 });
      await S.gotoWatchReady(o);
      await S.tapPlay(o);
      await sleep(12000);
      res.markerPlaying = JSON.parse(await o.page.evaluate(() => localStorage.getItem("ds-watch")));
      const other = S.ids(3).videoId;
      await o.page.click(`a[href="/panel/videos/${other}"]`);
      await o.page.waitForURL(`**/panel/videos/${other}`, { timeout: 20000 });
      await sleep(1500);
      res.markerAfterSpa = JSON.parse(await o.page.evaluate(() => localStorage.getItem("ds-watch")));
      await o.page.reload({ waitUntil: "domcontentloaded" });
      await sleep(10000);
      res.bannerAfterSpa = await o.page.evaluate(() => document.body.innerText.includes("نیمه‌کاره ماند"));
      // full navigation variant: play on the watch page then load /panel directly
      await o.page.goto(`${APP}/panel/videos/${o.videoId}`, { waitUntil: "domcontentloaded" });
      await o.page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.readyState >= 1; }, null, { timeout: 60000 });
      await S.tapPlay(o);
      await sleep(10000);
      await o.page.goto(`${APP}/panel`, { waitUntil: "domcontentloaded" });
      await sleep(10000);
      res.bannerAfterFullNav = await o.page.evaluate(() => document.body.innerText.includes("نیمه‌کاره ماند"));
      res.markerEnd = JSON.parse(await o.page.evaluate(() => localStorage.getItem("ds-watch")));
      const rows = rowsUser(n, since);
      res.telemetry = brief(rows);
      res.verdict = {
        markerCleanAfterSpa: !!res.markerAfterSpa && res.markerAfterSpa.clean === true,
        noAbnormalExit: !rows.some((r) => r.kind === "abnormal-exit"),
        noBanner: !res.bannerAfterSpa && !res.bannerAfterFullNav,
        sessionEndRows: rows.filter((r) => r.kind === "session-end").length >= 2,
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s4c-cleannav", o, res);
  },

  // 5. session summary after ~2 min then closing the tab
  async summary(n = 3) {
    await setup(n, {}, 3);
    const since = Date.now() - 1000;
    const res = { scenario: "s5-summary" };
    let o;
    try {
      o = await S.open(n, "set2-summary", { device: "Pixel 7", down: 0, cpu: 1 });
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      const tl = await S.monitor(o, 120000, 2000);
      res.analysis = S.analyze(tl, o.rel);
      res.sid = (await o.page.evaluate(() => JSON.parse(localStorage.getItem("ds-watch") || "{}").sid)) || null;
      res.mediaEvents = (await o.page.evaluate(() => (window.__ev || []).filter((e) => /waiting|playing|seek|pause|stalled/.test(e[1])))).map((e) => `${o.rel(e[0])}s ${e[1]} ${JSON.stringify(e[2])}`);
      res.closeMode = "page.close()";
      await o.page.close({ runBeforeUnload: true });
      await sleep(4000);
      let rows = rowsUser(n, since);
      let se = rows.filter((r) => r.kind === "session-end");
      if (!se.length) {
        res.notes = "page.close() delivered no session-end beacon";
      }
      res.telemetry = brief(rows);
      res.sessionEnd = se.map((r) => ({ sid: r.sid.slice(0, 8), engine: r.engine, build: r.build, x: Object.fromEntries(Object.entries(r.ctx).filter(([k]) => ["seq", "playedSec", "wallSec", "stalls", "stallMsTotal", "refreshes", "giveups", "startupMs", "firstPlayMs", "maxAhead", "fragStalls", "qualityChanges"].includes(k))) }));
      const sum = se.reduce((a, r) => ((a.playedSec += r.ctx.playedSec || 0), (a.stalls += r.ctx.stalls || 0), a), { playedSec: 0, stalls: 0 });
      res.sum = sum;
      res.watchedProgress = S.progress(n);
      res.verdict = {
        sessionEndRows: se.length >= 1,
        oneSession: new Set(se.map((r) => r.sid)).size === 1 && (!res.sid || se[0].sid === res.sid),
        playedSecAbout120: Math.abs(sum.playedSec - 120) <= 8,
        stallsZero: sum.stalls === 0,
        engineSet: se.every((r) => r.engine === "hls"),
        buildSet: se.every((r) => r.build === BUILD),
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s5-summary", o, res);
  },

  // 8. API headers, playback-log validation, progress past 50 min without failed INSERTs
  async api() {
    const res = { scenario: "s8-api", checks: {} };
    const n = 4;
    const { userId, videoId } = S.ids(n);
    const jwt = S.readJwt(userId);
    const H = { Cookie: `ds_session=${jwt}` };
    try {
      await setup(n);
      const g = await fetch(`${APP}/api/videos/${videoId}/play`, { headers: H });
      res.checks.play = { status: g.status, cacheControl: g.headers.get("cache-control"), vary: g.headers.get("vary") };
      const g2 = await fetch(`${APP}/api/videos/${videoId}/play?fresh=1`, { headers: H });
      res.checks.playFresh = { status: g2.status, cacheControl: g2.headers.get("cache-control"), vary: g2.headers.get("vary") };
      const g3 = await fetch(`${APP}/api/videos/${videoId}/play`);
      res.checks.playAnon = { status: g3.status, cacheControl: g3.headers.get("cache-control"), vary: g3.headers.get("vary") };
      const post = async (body, headers = H, raw = false) => {
        const r = await fetch(`${APP}/api/playback-log`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: raw ? body : JSON.stringify(body) });
        return { status: r.status, body: (await r.text()).slice(0, 200), cc: r.headers.get("cache-control") };
      };
      const ev = (k = "engine", extra = {}) => ({ kind: k, sessionId: `apitest-${Date.now().toString(36)}`, videoId, engine: "hls", detail: "api test", position: 3, ctx: { build: BUILD, t: 1 }, ...extra });
      res.checks.valid = await post({ events: [ev()] });
      res.checks.badKind = await post({ events: [ev("Bad Kind!")] });
      res.checks.tooMany = await post({ events: Array.from({ length: 21 }, () => ev()) });
      res.checks.tooBig = await post({ events: [ev("engine", { ctx: { pad: "x".repeat(70000) } })] });
      res.checks.unauth = await post({ events: [ev()] }, {});
      res.checks.malformed = await post("{not json", H, true);
      const sidBig = `apitest-big-${Date.now().toString(36)}`;
      res.checks.bigCtxAccepted = await post({ events: [ev("engine", { sessionId: sidBig, ctx: { pad: "y".repeat(3000) } })] });
      const bigRow = rowsOf(`"sessionId"='${sidBig}'`)[0];
      // eid: same event sent twice (lost response + queue resend) -> stored once, row id = eid; malformed eid -> 400
      const eid = `e2eeid-${Date.now().toString(36)}`;
      const sidE = `apitest-eid-${Date.now().toString(36)}`;
      res.checks.eidFirst = await post({ events: [ev("frag-stall", { sessionId: sidE, eid })] });
      res.checks.eidSecond = await post({ events: [ev("frag-stall", { sessionId: sidE, eid })] });
      res.checks.eidMixed = await post({ events: [ev("frag-stall", { sessionId: sidE, eid }), ev("frag-stall", { sessionId: sidE, eid: eid + "-b" })] });
      res.checks.eidRows = S.db(`select string_agg(id, ',') from "PlaybackEvent" where "sessionId"='${sidE}'`);
      res.checks.eidBad = await post({ events: [ev("frag-stall", { sessionId: sidE, eid: "bad eid!" })] });
      res.checks.noEid = await post({ events: [ev("frag-stall", { sessionId: sidE })] });
      res.checks.eidRowCount = Number(S.db(`select count(*) from "PlaybackEvent" where "sessionId"='${sidE}'`));
      res.checks.bigCtxStored = bigRow ? JSON.stringify(bigRow.ctx).slice(0, 200) : null;
      // progress past 50 minutes
      const pn = 5;
      const p = S.ids(pn);
      const pj = S.readJwt(p.userId);
      S.db(`update "Video" set "durationSec"=3600 where id='${p.videoId}'`);
      S.db(`delete from "VideoProgress" where "userId"='${p.userId}' and "videoId"='${p.videoId}'`);
      S.db(`delete from "PointLog" where "userId"='${p.userId}' and reason='VIDEO_TIME' and "refId" like '${p.videoId}:%'`);
      // re-verify: the progress row is reset to not-completed below, so an old VIDEO_DONE from an earlier run would collide (harness artifact)
      S.db(`delete from "PointLog" where "userId"='${p.userId}' and reason='VIDEO_DONE' and "refId"='${p.videoId}'`);
      S.db(`insert into "VideoProgress"(id,"userId","videoId","watchedSeconds","lastPosition",completed,"updatedAt") values ('e2eprog-${pn}','${p.userId}','${p.videoId}',2990,2990,false,now())`);
      // newest PostgreSQL server log (E2E_PG_LOG overrides); without a readable log only the rollback counter is checked
      const pgLog = process.env.E2E_PG_LOG || (() => {
        try {
          const d = "/var/log/postgresql";
          return fs.readdirSync(d).filter((x) => x.endsWith(".log")).map((x) => path.join(d, x)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
        } catch {
          return null;
        }
      })();
      const logOff = pgLog ? fs.statSync(pgLog).size : 0;
      const rb = () => Number(S.db(`select xact_rollback from pg_stat_database where datname=current_database()`));
      await sleep(1500);
      const rb0 = rb();
      const prog = [];
      for (let i = 0; i < 6; i++) {
        const r = await fetch(`${APP}/api/videos/${p.videoId}/progress`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `ds_session=${pj}` }, body: JSON.stringify({ position: 3000 + i * 15, delta: 15, duration: 3600 }) });
        prog.push(`${r.status} ${(await r.text()).slice(0, 80)}`);
        await sleep(300);
      }
      await sleep(1500);
      const rb1 = rb();
      const newLog = pgLog ? fs.readFileSync(pgLog).subarray(logOff).toString("utf8") : "";
      res.checks.progress = {
        responses: prog,
        xactRollbackDelta: rb1 - rb0,
        pgLog: pgLog ? path.basename(pgLog) : "not readable (only xact_rollback checked)",
        pgErrorLines: newLog.split("\n").filter((l) => /ERROR|duplicate key/.test(l)).slice(0, 10),
        pointLogs: S.db(`select count(*) from "PointLog" where "userId"='${p.userId}' and reason='VIDEO_TIME' and "refId" like '${p.videoId}:%'`),
        row: S.db(`select "watchedSeconds","lastPosition" from "VideoProgress" where "userId"='${p.userId}' and "videoId"='${p.videoId}'`),
      };
      S.db(`update "Video" set "durationSec"=152 where id='${p.videoId}'`);
      const c = res.checks;
      res.verdict = {
        playCacheControl: /private/.test(c.play.cacheControl || "") && /no-store/.test(c.play.cacheControl || ""),
        playVaryCookie: /(^|,\s*)cookie(\s*,|$)/i.test(c.play.vary || ""),
        freshAlsoNoStore: /no-store/.test(c.playFresh.cacheControl || ""),
        valid200: c.valid.status === 200,
        badKind400: c.badKind.status === 400,
        tooMany400: c.tooMany.status === 400,
        tooBig413: c.tooBig.status === 413,
        unauth401: c.unauth.status === 401,
        eidDuplicateStoredOnce: c.eidFirst.status === 200 && c.eidSecond.status === 200 && c.eidMixed.status === 200 && (c.eidRows || "").split(",").sort().join(",") === [eid, eid + "-b"].sort().join(","),
        eidRowIdIsEid: (c.eidRows || "").split(",").includes(eid),
        eidBad400: c.eidBad.status === 400,
        eidTotalRows3: c.eidRowCount === 3, // eid, eid-b, and the one without eid
        noFailedInsert: c.progress.xactRollbackDelta === 0 && c.progress.pgErrorLines.length === 0,
        progressOk: c.progress.responses.every((x) => x.startsWith("200")),
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s8-api", null, res);
  },

  // 9. app shell: overscroll, landscape BottomNav, grain, Persian error page, offline page, service worker
  async shell(n = 6) {
    await setup(n);
    const since = Date.now() - 1000;
    const res = { scenario: "s9-shell", checks: {} };
    let o;
    const c = res.checks;
    const os = () => o.page.evaluate(() => ({ html: getComputedStyle(document.documentElement).overscrollBehaviorY, body: getComputedStyle(document.body).overscrollBehaviorY }));
    const navDisplay = () => o.page.evaluate(() => { const nav = [...document.querySelectorAll("nav")].find((x) => x.className.includes("grid-cols-5")); return nav ? getComputedStyle(nav).display : "missing"; });
    const grain = () => o.page.evaluate(() => { const g = document.querySelector(".grain"); return g ? { mix: getComputedStyle(g).mixBlendMode, pos: getComputedStyle(g).position } : null; });
    try {
      o = await S.open(n, "set2-shell", { device: "Pixel 7", down: 0, cpu: 1 });
      const watch = `${APP}/panel/videos/${o.videoId}`;
      await o.page.goto(watch, { waitUntil: "load" });
      await o.page.waitForSelector("video");
      c.watchOverscroll = await os();
      c.watchPortraitNav = await navDisplay();
      c.watchGrain = await grain();
      await o.page.setViewportSize({ width: 844, height: 390 });
      await sleep(500);
      c.watchLandscapeNav = await navDisplay();
      await o.page.screenshot({ path: path.join(OUT2, "watch-landscape.png") });
      await o.page.goto(`${APP}/panel`, { waitUntil: "load" });
      c.panelLandscapeNav = await navDisplay();
      c.panelGrain = await grain();
      c.panelOverscroll = await os();
      await o.page.setViewportSize({ width: 412, height: 839 });
      await o.page.goto(`${APP}/`, { waitUntil: "load" });
      c.homeOverscroll = await os();
      c.homeGrain = await grain();
      // Persian error page: server component throws (Prisma validation on duplicated ?pid)
      const errResp = await o.page.goto(`${APP}/panel/pay?pid=a&pid=b`, { waitUntil: "load" });
      c.errorStatus = errResp && errResp.status();
      await sleep(2500);
      c.errorText = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400));
      await o.page.screenshot({ path: path.join(OUT2, "error-page.png") });
      c.errorButtons = await o.page.evaluate(() => [...document.querySelectorAll("button,a")].map((x) => x.textContent.trim()).filter((t) => /تلاش|بارگذاری|پنل/.test(t)).slice(0, 8));
      // retry button keeps the Persian page (error persists) and doesn't crash
      await o.page.click('button:has-text("تلاش دوباره")').catch((e) => (c.retryErr = e.message));
      await sleep(2500);
      c.afterRetryText = await o.page.evaluate(() => document.body.innerText.includes("مشکلی پیش آمد"));
      // SPA navigation into the throwing route (RSC request), from the videos page grade tabs
      await o.page.goto(`${APP}/panel`, { waitUntil: "load" });
      await o.page.evaluate(() => { const a = document.createElement("a"); a.href = "/panel/pay?pid=a&pid=b"; a.id = "e2e-err"; a.textContent = "x"; document.body.appendChild(a); });
      // offline page (static public/offline.html, no Next scripts)
      await o.page.goto(`${APP}/offline.html`, { waitUntil: "load" });
      c.offlinePage = await o.page.evaluate(() => ({ text: document.body.innerText.includes("اتصال اینترنت برقرار نیست"), btn: [...document.querySelectorAll("button")].some((b) => b.textContent.includes("تلاش دوباره")), nextScripts: document.querySelectorAll('script[src*="/_next/"]').length }));
      // service worker
      await o.page.goto(`${APP}/`, { waitUntil: "load" });
      c.sw = await o.page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return { supported: false };
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 15000))]);
        const txt = await (await fetch("/sw.js", { cache: "no-store" })).text();
        return { supported: true, active: reg && reg.active ? reg.active.scriptURL : null, version: (txt.match(/VERSION = "([^"]+)"/) || [])[1] };
      });
      await o.page.reload({ waitUntil: "load" }); // controlled now
      await o.page.goto(`${APP}/panel/videos`, { waitUntil: "load" });
      await o.page.goto(`${APP}/panel/videos/${o.videoId}`, { waitUntil: "load" });
      await o.page.goto(`${APP}/panel`, { waitUntil: "load" });
      await sleep(1500);
      c.controlled = await o.page.evaluate(() => !!navigator.serviceWorker.controller);
      c.caches = await o.page.evaluate(async () => {
        const out = {};
        for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname);
        return out;
      });
      // offline navigation to panel pages
      await o.ctx.setOffline(true);
      const offNav = [];
      for (const u of ["/panel/videos", `/panel/videos/${o.videoId}`, "/panel/profile"]) {
        let resp = null;
        let err = null;
        try {
          resp = await o.page.goto(`${APP}${u}`, { waitUntil: "load", timeout: 20000 });
        } catch (e) {
          err = e.message.slice(0, 120);
        }
        const txt = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 160)).catch(() => "");
        const addr = o.page.url().replace(APP, "");
        const btn = await o.page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("تلاش دوباره"))).catch(() => false);
        offNav.push({ u, addr, addressKept: addr === u, btn, status: resp && resp.status(), fromSW: resp ? resp.fromServiceWorker() : null, offlinePage: txt.includes("اتصال اینترنت برقرار نیست"), text: txt.slice(0, 100), err });
      }
      // public page offline: may be served from the pages cache
      let homeOff = null;
      try {
        const r = await o.page.goto(`${APP}/`, { waitUntil: "load", timeout: 20000 });
        homeOff = { status: r && r.status(), fromSW: r && r.fromServiceWorker(), offlinePage: await o.page.evaluate(() => document.body.innerText.includes("اتصال اینترنت برقرار نیست")) };
      } catch (e) {
        homeOff = { err: e.message.slice(0, 100) };
      }
      c.offlineNav = offNav;
      c.homeOffline = homeOff;
      await o.ctx.setOffline(false);
      await sleep(1000);
      const rows = rowsUser(n, since);
      c.jsErrorRows = rows.filter((r) => r.kind === "js-error").map((r) => `${r.detail} ${JSON.stringify({ boundary: r.ctx.boundary, path: r.ctx.path })}`);
      res.verdict = {
        watchOverscrollNone: c.watchOverscroll.html === "none" && c.watchOverscroll.body === "none",
        homeOverscrollNotNone: c.homeOverscroll.html !== "none" && c.homeOverscroll.body !== "none",
        portraitNavVisible: c.watchPortraitNav !== "none" && c.watchPortraitNav !== "missing",
        landscapeNavHiddenOnWatch: c.watchLandscapeNav === "none",
        landscapeNavVisibleElsewhere: c.panelLandscapeNav !== "none" && c.panelLandscapeNav !== "missing",
        noGrainInPanel: c.watchGrain === null && c.panelGrain === null,
        grainOnHome: !!c.homeGrain,
        persianErrorPage: c.errorText.includes("مشکلی پیش آمد") && !/Application error|This page couldn|server-side exception/i.test(c.errorText),
        errorRetryStable: c.afterRetryText === true,
        offlinePageReloadButton: c.offlinePage.text && c.offlinePage.btn && c.offlinePage.nextScripts === 0,
        swRegisteredV3: !!c.sw.active && c.sw.version === "ds-v3",
        noPanelHtmlCached: !Object.entries(c.caches).some(([k, v]) => k.includes("pages") && v.some((p) => p.startsWith("/panel"))),
        offlineShowsOfflinePage: offNav.every((x) => x.offlinePage && x.fromSW && x.btn),
        offlineAddressKept: offNav.every((x) => x.addressKept),
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s9-shell", o, res);
  },

  // 10. in-app browser hint
  async inapp(n = 7) {
    await setup(n);
    const res = { scenario: "s10-inapp", variants: {} };
    const base = devices["Pixel 7"].userAgent;
    const uas = {
      telegram: `${base} Telegram-Android/11.2.3 (Google Pixel 7; Android 14; SDK 34; HIGH)`,
      webview: base.replace(/\(Linux; Android ([^;)]+); ([^;)]+)\)/, "(Linux; Android $1; $2; wv)"),
      normal: base,
    };
    for (const [k, ua] of Object.entries(uas)) {
      let o;
      try {
        o = await S.open(n, `set2-inapp-${k}`, { device: "Pixel 7", down: 0, cpu: 1, ua });
        await S.gotoWatch(o);
        await sleep(2500);
        res.variants[k] = await o.page.evaluate(() => ({ ua: navigator.userAgent.slice(-70), hint: document.body.innerText.includes("برای پخش بهتر، سایت را در Chrome یا Safari باز کنید") }));
        if (k === "telegram") await o.page.screenshot({ path: path.join(OUT2, "inapp-telegram.png") });
      } catch (e) {
        res.variants[k] = { error: e.message.slice(0, 300) };
      }
      if (o) await o.browser.close().catch(() => {});
    }
    res.verdict = { telegramShows: res.variants.telegram.hint === true, webviewShows: res.variants.webview.hint === true, normalHidden: res.variants.normal.hint === false };
    return finishRun("s10-inapp", null, res);
  },

  // 9b. chunk load error while offline -> Persian «اتصال اینترنت برقرار نیست», no reload loop; back online -> reload; online chunk error -> one reload
  async chunkoff(n = 6) {
    const since = Date.now() - 1000;
    const res = { scenario: "s9b-chunk-offline" };
    let o;
    const CH = /\/_next\/static\/chunks\/.*\.(js|css)(\?|$)/;
    try {
      o = await S.open(n, "set2-chunkoff", { device: "Pixel 7", down: 0, cpu: 1, blockSW: true });
      await o.page.goto(`${APP}/panel`, { waitUntil: "load" }); await sleep(2500);
      await sleep(1500);
      const links = await o.page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/panel/"]')].filter((a) => a.getClientRects().length && getComputedStyle(a).visibility !== "hidden").map((a) => a.getAttribute("href")))]);
      res.links = links.slice(0, 15);
      const cands = ["/panel/profile", "/panel/exams", "/panel/leaderboard", "/panel/pay", "/panel/videos"].filter((t) => links.includes(t));
      let loads = 0;
      o.page.on("load", () => loads++);
      res.target = cands[0];
      res.target2 = cands[1];
      let mode = "abort";
      const aborted = [];
      await o.page.route(CH, (r) => {
        if (mode === "abort") { aborted.push(r.request().url().split("/").pop()); return r.abort("internetdisconnected"); }
        return r.continue();
      });
      await o.page.evaluate(() => { window.__onl = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine"); Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false }); window.dispatchEvent(new Event("offline")); });
      const navs0 = o.navs.length;
      const loads0 = loads;
      await o.page.locator(`a[href="${res.target}"]:visible`).first().click();
      const shown = await waitUntil(() => o.page.evaluate(() => document.body.innerText.includes("اتصال اینترنت برقرار نیست")), 20000, 500);
      await sleep(4000);
      res.offlineMsg = !!shown;
      res.textOffline = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 260)).catch((e) => "ERR " + e.message);
      res.abortedChunks = aborted.slice(0, 8);
      res.navsWhileOffline = o.navs.slice(navs0);
      res.loadsWhileOffline = loads - loads0;
      // back online -> the error page reloads by itself
      mode = "pass";
      const navs1 = o.navs.length;
      const loads1 = loads;
      await o.page.evaluate(() => { Object.defineProperty(Navigator.prototype, "onLine", window.__onl); window.dispatchEvent(new Event("online")); });
      const reloaded = await waitUntil(async () => o.navs.length > navs1, 15000, 300);
      await o.page.waitForLoadState("load").catch(() => {});
      await sleep(3000);
      res.reloadedOnOnline = !!reloaded && loads > loads1;
      res.loadsOnOnline = loads - loads1;
      res.navsOnOnline = o.navs.slice(navs1);
      res.textAfterOnline = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 160)).catch((e) => "ERR " + e.message);
      res.urlAfterOnline = o.page.url().replace(APP, "");
      // online chunk error (new deploy) -> exactly one automatic reload
      let navs2 = o.navs.length;
      if (res.target2) {
        await o.page.goto(`${APP}/panel`, { waitUntil: "load" }); await sleep(2500);
        await sleep(1000);
        await o.page.evaluate(() => sessionStorage.removeItem("ds-chunk-reload"));
        navs2 = o.navs.length;
        const ab2 = aborted.length;
        const loads2 = loads;
        mode = "abort";
        o.page.once("framenavigated", () => (mode = "pass"));
        await o.page.locator(`a[href="${res.target2}"]:visible`).first().click();
        await waitUntil(async () => o.navs.length > navs2, 15000, 300);
        mode = "pass";
        await o.page.waitForLoadState("load").catch(() => {});
        await sleep(4000);
        res.navsOnlineChunkErr = o.navs.slice(navs2);
        res.abortedChunks2 = aborted.slice(ab2);
        res.loadsOnlineChunkErr = loads - loads2;
        res.textOnlineChunkErr = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 160)).catch((e) => "ERR " + e.message);
      }
      await sleep(2000);
      const rows = rowsUser(n, since);
      res.jsErrors = rows.filter((r) => r.kind === "js-error").map((r) => `${r.detail} chunk=${r.ctx && r.ctx.chunk} queued=${r.queued} path=${r.ctx && r.ctx.path}`);
      res.verdict = {
        chunkActuallyBlocked: res.abortedChunks.length > 0,
        offlineMessage: res.offlineMsg && !/نسخه‌ی تازه‌ی سایت/.test(res.textOffline),
        noReloadWhileOffline: res.loadsWhileOffline === 0,
        reloadWhenOnline: res.reloadedOnOnline && !/اتصال اینترنت برقرار نیست|مشکلی پیش آمد/.test(res.textAfterOnline),
        onlineChunkErrorReloadsOnce: !res.target2 || !res.abortedChunks2.length || res.loadsOnlineChunkErr === 1,
        jsErrorReported: res.jsErrors.some((x) => /chunk=true/.test(x)),
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s9b-chunk-offline", o, res);
  },

  // EXTRA/4c re-verify: leaving a playing (or ended) watch page normally must not look like a crash
  async exits(n = 15) {
    await setup(n, {}, 2);
    const since = Date.now() - 1000;
    const res = { scenario: "s4d-exits", steps: {} };
    let o;
    const marker = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("ds-watch") || "null")).catch(() => null);
    const mk = (m) => (m ? { clean: m.clean, vis: m.vis, playing: m.playing, sid: (m.sid || "").slice(0, 8), ageSec: Math.round((Date.now() - m.at) / 1000) } : null);
    const banner = (p) => p.evaluate(() => document.body.innerText.includes("نیمه‌کاره ماند")).catch(() => null);
    const watch = `${APP}/panel/videos/${S.ids(n).videoId}`;
    const playWatch = async (p) => {
      await p.goto(watch, { waitUntil: "domcontentloaded" });
      await p.waitForFunction(() => { const v = document.querySelector("video"); return v && v.currentSrc && v.readyState >= 1; }, null, { timeout: 60000 });
      const c = await o.ctx.newCDPSession(p);
      await c.send("Runtime.evaluate", { expression: "document.querySelector('video').play()", awaitPromise: true, userGesture: true });
      await sleep(10000);
    };
    try {
      o = await S.open(n, "set2-exits", { device: "Pixel 7", down: 0, cpu: 1 });
      // A. reload while playing
      await playWatch(o.page);
      res.steps.A_before = mk(await marker(o.page));
      await o.page.reload({ waitUntil: "domcontentloaded" });
      res.steps.A_afterReload = mk(await marker(o.page));
      await sleep(12000);
      // B. full navigation while playing
      await playWatch(o.page);
      await o.page.goto(`${APP}/panel`, { waitUntil: "domcontentloaded" });
      res.steps.B_afterNav = mk(await marker(o.page));
      await sleep(12000);
      res.steps.B_banner = await banner(o.page);
      // C. tab close while playing, panel reopened in a new tab
      await playWatch(o.page);
      await o.page.close({ runBeforeUnload: true });
      await sleep(800);
      const p2 = await o.ctx.newPage();
      o.page = p2;
      await p2.goto(`${APP}/panel`, { waitUntil: "domcontentloaded" });
      res.steps.C_afterClose = mk(await marker(p2));
      await sleep(12000);
      res.steps.C_banner = await banner(p2);
      // D. video ended, then full navigation away
      await playWatch(p2);
      await p2.evaluate(() => { const v = document.querySelector("video"); v.currentTime = Math.max(0, v.duration - 4); });
      res.steps.D_ended = !!(await waitUntil(() => p2.evaluate(() => document.querySelector("video").ended), 40000));
      await sleep(1500);
      res.steps.D_markerAtEnd = mk(await marker(p2));
      await p2.goto(`${APP}/panel`, { waitUntil: "domcontentloaded" });
      res.steps.D_afterNav = mk(await marker(p2));
      await sleep(12000);
      res.steps.D_banner = await banner(p2);
      // E. SPA link away while playing
      await playWatch(p2);
      await p2.locator('a[href="/panel"]:visible').first().click();
      await sleep(1500);
      res.steps.E_afterSpa = mk(await marker(p2));
      await sleep(10000);
      res.steps.E_banner = await banner(p2);
      await p2.goto("about:blank").catch(() => {});
      await sleep(3000);
      const rows = rowsUser(n, since);
      res.telemetry = brief(rows);
      res.counts = rows.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + 1), m), {});
      const st = res.steps;
      res.verdict = {
        noAbnormalExit: !res.counts["abnormal-exit"],
        noHiddenPlaying: !res.counts["hidden-playing"],
        noBanner: [st.B_banner, st.C_banner, st.D_banner, st.E_banner].every((x) => x === false),
        markerCleanAfterNav: !!st.B_afterNav && st.B_afterNav.clean === true,
        markerCleanAfterClose: !!st.C_afterClose && st.C_afterClose.clean === true,
        endedMarkerStaysClean: st.D_ended && !!st.D_markerAtEnd && st.D_markerAtEnd.clean === true && !!st.D_afterNav && st.D_afterNav.clean === true,
        sessionEndRows: (res.counts["session-end"] || 0) >= 5,
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    return finishRun("s4d-exits", o, res);
  },

  // 7. admin playback report
  async admin() {
    const res = { scenario: "s7-admin", checks: {} };
    const c = res.checks;
    const browser = await S.launch();
    try {
      const adminJwt = S.readJwt("admin");
      const mk = async (jwt, vp) => {
        const ctx = await browser.newContext({ viewport: vp, locale: "fa-IR", deviceScaleFactor: 1 });
        await ctx.addCookies([{ name: "ds_session", value: jwt, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
        return ctx;
      };
      const ctx = await mk(adminJwt, { width: 1366, height: 900 });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
      const r = await page.goto(`${APP}/admin/playback?range=7d`, { waitUntil: "load" });
      c.status = r.status();
      const text = await page.evaluate(() => document.body.innerText);
      const need = ["گزارش پخش ویدیو", "دفعات تماشا", "به تفکیک دستگاه و نوع پخش‌کننده", "نسخه‌ی کد روی گوشی‌ها", "رخدادها به تفکیک نوع", "آخرین رخدادها", "راهنمای رخدادها", "خلاصه‌ی تماشا", "بسته شدن ناگهانی"];
      c.sections = Object.fromEntries(need.map((x) => [x, text.includes(x)]));
      c.buildShown = text.includes(BUILD);
      c.tables = await page.evaluate(() => [...document.querySelectorAll("table")].map((t) => t.querySelectorAll("tbody tr").length));
      c.navLink = await page.evaluate(() => !![...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/admin/playback"));
      await page.screenshot({ path: path.join(OUT2, "adm-playback.png"), fullPage: true });
      // filters
      const recentRows = async () => page.evaluate(() => { const ts = [...document.querySelectorAll("table")]; const t = ts[ts.length - 1]; return t ? [...t.querySelectorAll("tbody tr")].map((tr) => tr.innerText.replace(/\s+/g, " ").slice(0, 160)) : []; });
      await page.goto(`${APP}/admin/playback?range=24h&kind=abnormal-exit`, { waitUntil: "load" });
      const ab = await recentRows();
      c.kindFilter = { rows: ab.length, sample: ab.slice(0, 3), allAbnormal: ab.length > 0 && ab.every((x) => x.includes("بسته شدن ناگهانی")) };
      const sid = S.db(`select "sessionId" from "PlaybackEvent" where kind='session-end' and "createdAt" > now() - interval '2 hours' order by "createdAt" desc limit 1`);
      const sidCount = Number(S.db(`select count(*) from "PlaybackEvent" where "sessionId"='${sid}' and "createdAt" > now() - interval '24 hours'`));
      await page.goto(`${APP}/admin/playback?range=24h&sid=${sid.slice(0, 6)}`, { waitUntil: "load" });
      const sr = await recentRows();
      c.sidFilter = { sid: sid.slice(0, 6), dbCount: sidCount, rows: sr.length, sample: sr.slice(0, 2) };
      await page.goto(`${APP}/admin/playback?range=30d`, { waitUntil: "load" });
      c.range30 = await page.evaluate(() => document.body.innerText.includes("۳۰ روز اخیر"));
      await page.goto(`${APP}/admin/playback?range=bogus&kind=nonexistent-kind`, { waitUntil: "load" });
      c.bogusFilters = { status: "loaded", text: (await page.evaluate(() => document.body.innerText.includes("گزارش پخش ویدیو"))) };
      // student filter: phone, id, and an id whose digits look like a phone number
      S.db(`insert into "User"(id, phone, name, role, grade, major, "profileDone", "createdAt", "updatedAt") select 'x09159000777y', '09159000778', 'تست شناسه', 'USER', grade, major, true, now(), now() from "User" where id='e2eu000000000000000000003' on conflict (id) do nothing`);
      S.db(`insert into "PlaybackEvent"(id,"userId","sessionId",kind,detail,"createdAt") values ('e2efilt-${Date.now()}','x09159000777y','e2efilt-sess','frag-stall','filter test', now())`);
      const chip = () => page.evaluate(() => { const m = document.body.innerText.match(/دانش‌آموز: [^\n]*/); return m ? m[0] : null; });
      const uf = async (q) => { await page.goto(`${APP}/admin/playback?range=24h&user=${encodeURIComponent(q)}`, { waitUntil: "load" }); const rr = await recentRows(); return { chip: await chip(), rows: rr.length, sample: rr[0] }; };
      c.userByPhone = await uf("09159000003");
      c.userByFaPhone = await uf("۰۹۱۵۹۰۰۰۰۰۳");
      c.userById = await uf("e2eu000000000000000000003");
      c.userPhoneLikeId = await uf("x09159000777y");
      c.userUnknown = await uf("09120000001");
      c.user3Db = Number(S.db(`select count(*) from "PlaybackEvent" where "userId"='e2eu000000000000000000003' and "createdAt" > now() - interval '24 hours'`));
      S.db(`delete from "PlaybackEvent" where "sessionId"='e2efilt-sess'`);
      S.db(`delete from "User" where id='x09159000777y'`);
      // sampling notice: > 5000 session-end rows in range -> notice with the clip date; gone once the rows are removed
      S.db(`insert into "PlaybackEvent"(id,"sessionId",kind,engine,ctx,"createdAt") select 'e2esamp-'||g, 'e2esamp-'||g, 'session-end', 'hls', '{"playedSec":10,"seq":1}'::jsonb, now() - interval '20 hours' + (g||' milliseconds')::interval from generate_series(1,5050) g`);
      await page.goto(`${APP}/admin/playback?range=24h`, { waitUntil: "load" });
      c.sampleNotice = await page.evaluate(() => { const m = document.body.innerText.match(/رخدادها زیادند[^\n]*/); return m ? m[0] : null; });
      await page.screenshot({ path: path.join(OUT2, "admin-sampled.png") });
      S.db(`delete from "PlaybackEvent" where id like 'e2esamp-%'`);
      await page.goto(`${APP}/admin/playback?range=24h`, { waitUntil: "load" });
      c.noticeAfterCleanup = await page.evaluate(() => document.body.innerText.includes("رخدادها زیادند"));
      c.pageErrors = errs;
      // phone width
      const pctx = await mk(adminJwt, { width: 390, height: 844 });
      const pp = await pctx.newPage();
      await pp.goto(`${APP}/admin/playback?range=7d`, { waitUntil: "load" });
      c.phone = await pp.evaluate(() => ({ docScrollW: document.documentElement.scrollWidth, innerW: innerWidth, bodyScrollW: document.body.scrollWidth, overflowEls: [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest(".overflow-x-auto,[class*=overflow-x]"); }).slice(0, 8).map((e) => `${e.tagName}.${String(e.className).slice(0, 40)} ${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)}`) }));
      await pp.screenshot({ path: path.join(OUT2, "adm-playback-390.png"), fullPage: true });
      await pp.screenshot({ path: path.join(OUT2, "adm-playback-390-top.png") });
      // student redirected
      const sjwt = S.readJwt(S.ids(8).userId);
      const sctx = await mk(sjwt, { width: 390, height: 844 });
      const sp = await sctx.newPage();
      const sr2 = await sp.goto(`${APP}/admin/playback`, { waitUntil: "load" });
      c.student = { finalUrl: sp.url().replace(APP, ""), status: sr2.status(), showsReport: await sp.evaluate(() => document.body.innerText.includes("گزارش پخش ویدیو") && document.body.innerText.includes("دفعات تماشا")) };
      res.verdict = {
        renders: c.status === 200 && Object.values(c.sections).every(Boolean),
        buildShown: c.buildShown,
        kindFilter: c.kindFilter.allAbnormal,
        sidFilter: c.sidFilter.rows > 0 && c.sidFilter.rows <= Math.max(c.sidFilter.dbCount, 1) + 0,
        rangeFilter: c.range30,
        studentRedirected: !c.student.finalUrl.startsWith("/admin") && !c.student.showsReport,
        noPageErrors: errs.length === 0,
        phoneNoPageOverflow: c.phone.docScrollW <= c.phone.innerW + 1,
        userFilterPhone: !!c.userByPhone.chip && c.userByPhone.chip.includes("تست 3") && c.userByPhone.rows === Math.min(100, c.user3Db),
        userFilterFaDigits: !!c.userByFaPhone.chip && c.userByFaPhone.chip.includes("تست 3") && c.userByFaPhone.rows === c.userByPhone.rows,
        userFilterId: !!c.userById.chip && c.userById.chip.includes("تست 3") && c.userById.rows === c.userByPhone.rows,
        userFilterPhoneLikeId: !!c.userPhoneLikeId.chip && c.userPhoneLikeId.chip.includes("تست شناسه") && c.userPhoneLikeId.rows === 1,
        userFilterUnknown: !!c.userUnknown.chip && c.userUnknown.chip.includes("پیدا نشد") && c.userUnknown.rows === 0,
        samplingNotice: !!c.sampleNotice && /حساب شده‌اند/.test(c.sampleNotice) && /[۰-۹]/.test(c.sampleNotice),
        noNoticeWhenFew: c.noticeAfterCleanup === false,
      };
    } catch (e) {
      res.error = String(e.stack || e).slice(0, 1500);
    }
    await browser.close().catch(() => {});
    return finishRun("s7-admin", null, res);
  },
};

(async () => {
  const names = String(which || "").split(",").filter(Boolean);
  if (!names.length || names.some((k) => !SC[k])) {
    console.error(`usage: node set2.js <${Object.keys(SC).join("|")}>[,…]`);
    process.exit(which === "list" ? 0 : 2);
  }
  const out = await Promise.all(names.map((k) => SC[k]().catch((e) => (console.log(k, "FAILED", e), { error: String(e) }))));
  process.exit(out.every((r) => r && r.pass === true) ? 0 : out.some((r) => !r || r.error) ? 2 : 1);
})();
