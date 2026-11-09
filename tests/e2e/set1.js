// مجموعه‌ی سناریوی ۱: پخش اصلی و رگرسیون‌ها (گیر کردن دانلود، انقضای لینک، قطعی، کیفیت، …).
// Scenario set 1 (core playback + regressions).
//   node set1.js <scenario> [n]     e.g. node set1.js s1     (n = scenario slot 1..20, default per scenario)
//   node set1.js list
// Needs: ./ctl.sh up (app :3310 + mocks), node setup.mjs. Results: results/set1/result-<name>.json, console-<name>.log.
// Exit code 0 = every verdict true, 1 = a verdict failed, 2 = harness error. What each scenario asserts: README.md.
const S = require("./lib");
const { sleep } = S;
S.useOut("set1");
const which = process.argv[2];
const nArg = Number(process.argv[3] || 0);

const hlsOf = (n, since) => S.hlsLog().filter((x) => x.ns === S.ids(n).ns && x.ms >= since && x.path);
async function setup(n, q = {}, loop = 1) {
  await S.control(n, { reset: 1, valid: 86400000, loop, epoch: Date.now(), ...q });
  S.db(`update "Video" set "durationSec"=${Math.round(152 * loop)} where id='${S.ids(n).videoId}'`);
  S.resetProgress(n);
}
const freshReqs = (o, since = 0) => o.plays.filter((p) => p.url.includes("fresh=1") && p.at >= since);
const stallsFrom = (tl, wall, rel) => S.analyze(tl.filter((s) => s.wall >= wall), rel);
const sumSessionEnd = (rows) => {
  const s = {};
  const keys = ["playedSec", "wallSec", "stalls", "stallMsTotal", "refreshes", "giveups", "autoRetryFails", "mediaRecovers", "fragStalls", "qualityChanges", "fsEnters"];
  for (const r of rows.filter((r) => r.kind === "session-end")) for (const k of keys) if (typeof r.ctx?.[k] === "number") s[k] = (s[k] || 0) + r.ctx[k];
  for (const r of rows.filter((r) => r.kind === "session-end")) if (typeof r.ctx?.maxStallMs === "number") s.maxStallMs = Math.max(s.maxStallMs || 0, r.ctx.maxStallMs);
  return s;
};
const ctxPick = (r) => (r.ctx ? { linkLeftSec: r.ctx.linkLeftSec, refreshes: r.ctx.refreshes, hls: r.ctx.hls, frag: r.ctx.frag, lastErr: r.ctx.lastErr, x: r.ctx.x, _lagSec: r.ctx._lagSec, online: r.ctx.online } : null);

async function run(n, name, opts, body) {
  const res = { scenario: name, n, ...S.ids(n), opts };
  const since = Date.now() - 2000;
  let o;
  try {
    o = await S.open(n, name, opts);
    res.t0 = new Date(o.t0).toISOString();
    await body(o, res);
  } catch (e) {
    res.error = String(e.stack || e).slice(0, 1500);
  }
  if (o) {
    for (const k of Object.keys(res)) if (Array.isArray(res[k]) && res[k][0] && res[k][0].wall) {
      res[k + "Analysis"] = S.analyze(res[k], o.rel);
      res[k + "Common"] = S.common(o, res[k]);
      res[k] = res[k].map(S.fmt(o.rel));
    }
    res.pageErrors = o.pageErrors.filter((x) => !x.includes("e2e-probe"));
    res.consoleErrorCount = o.consoleErrors.length;
    res.consoleErrors = o.consoleErrors.slice(0, 12);
    res.navs = [...o.navs];
    await S.finish(o, res);
    await sleep(2500); // let beacons land
    const rows = S.telemetry(n, since);
    res.telemetryCounts = S.kindCounts(rows);
    res.telemetry = S.telBrief(rows, o.t0);
    res.telemetryCtx = rows.filter((r) => r.kind !== "session-end").slice(0, 25).map((r) => ({ kind: r.kind, q: r.queued, ...ctxPick(r) }));
    res.sessionEndSum = sumSessionEnd(rows);
    res.progress = S.progress(n);
    res.hlsStats = await S.stats(n).catch(() => null);
  }
  // re-verify: no false crash/auto-lock rows from reloads or leaving the page (abnormal-exit / hidden-playing)
  if (res.verdict && res.telemetryCounts && process.env.NOEXITCHK !== "1") res.verdict.noFalseExitRows = !res.telemetryCounts["abnormal-exit"] && !res.telemetryCounts["hidden-playing"];
  if (res.verdict) res.pass = Object.values(res.verdict).every(Boolean);
  const file = S.save(name, res);
  console.log(JSON.stringify({ name, pass: res.pass, verdict: res.verdict, telemetryCounts: res.telemetryCounts, error: res.error, pageErrors: res.pageErrors, consoleErrorCount: res.consoleErrorCount, progress: res.progress, sessionEndSum: res.sessionEndSum }, null, 1));
  S.report(name, res.pass, file);
  return res;
}

const hungAtFn = (o, n, armMs, level) => {
  const h = hlsOf(n, armMs).find((x) => x.status === "HANG" && (!level || x.level === level));
  return h ? { at: o.rel(h.ms), ms: h.ms, path: h.path.replace(/^\/t\/\d+\/n\/\w+\//, "") } : null;
};

const SC = {
  // 1. hung body on lowest level, auto quality, ~0.9 Mbps
  async s1(n = 1) {
    await setup(n, {}, 3);
    return run(n, "s1-hang-body-auto", { down: 0.9e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl0 = await S.monitor(o, 60000);
      const armMs = Date.now();
      await S.control(n, { hang: "v0:1", hangMode: "body" });
      res.armedAt = o.rel(armMs);
      res.tl = await S.monitor(o, 150000);
      await S.control(n, { hang: "v0:0" });
      res.hung = hungAtFn(o, n, armMs, "v0");
      const after = res.hung ? stallsFrom(res.tl, res.hung.ms - 1000, o.rel) : null;
      res.afterHang = after;
      const rows = S.telemetry(n, o.t0 - 2000);
      const tl = res.tl;
      res.verdict = {
        hangHit: !!res.hung,
        freezeLe20s: !!after && after.maxStallMs <= 20000,
        noOverlay: tl.every((s) => !s.overlay),
        fragStallRow: rows.some((r) => r.kind === "frag-stall"),
        continues: tl[tl.length - 1].t > (tl.find((s) => res.hung && s.wall >= res.hung.ms)?.t ?? 0) + 60,
        urlUnchanged: S.common(o, tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 2. hung body with manual 480p at ~1.5 Mbps
  async s2(n = 2) {
    await setup(n, {}, 3);
    const HN = Number(process.env.HANGN || 1);
    return run(n, `s2-hang-body-manual480${HN > 1 ? "-x" + HN : ""}`, { down: 1.5e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      await sleep(6000);
      await S.pickQuality(o, 480);
      res.selAfterPick = (await S.snap(o.page)).sel;
      res.tl0 = await S.monitor(o, 55000);
      const armMs = Date.now();
      await S.control(n, { hang: `v1:${HN}`, hangMode: "body" });
      res.armedAt = o.rel(armMs);
      res.tl = await S.monitor(o, 140000);
      await S.control(n, { hang: "v1:0" });
      res.hung = hungAtFn(o, n, armMs, "v1");
      res.afterHang = res.hung ? stallsFrom(res.tl, res.hung.ms - 1000, o.rel) : null;
      res.selBeforeReload = (await S.snap(o.page)).sel;
      res.prefBeforeReload = await o.page.evaluate(() => localStorage.getItem("ds-quality"));
      await o.page.reload({ waitUntil: "domcontentloaded" });
      await o.page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.currentSrc && v.readyState >= 1; }, null, { timeout: 60000 });
      await S.tapPlay(o);
      res.tlReload = await S.monitor(o, 15000);
      res.selAfterReload = (await S.snap(o.page)).sel;
      res.prefAfterReload = await o.page.evaluate(() => localStorage.getItem("ds-quality"));
      const rows = S.telemetry(n, o.t0 - 2000);
      const demotes = rows.filter((r) => r.kind === "quality-demoted").length;
      res.demotes = demotes;
      res.verdict = {
        manualApplied: res.selAfterPick === "480",
        hangHit: !!res.hung,
        recoveryLe20s: !!res.afterHang && res.afterHang.maxStallMs <= 20000,
        demotedAtMostOnce: demotes <= 1,
        staysAutoAfterReloadIfDemoted: demotes === 0 ? true : res.selAfterReload === "0" && res.prefAfterReload === "0",
        noOverlay: res.tl.every((s) => !s.overlay),
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 3. hang before headers: hls.js TTFB timeout (12 s) must handle it, watchdog must not fire first
  async s3(n = 3) {
    await setup(n, {}, 3);
    return run(n, "s3-hang-head", { down: 0.9e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl0 = await S.monitor(o, 60000);
      const armMs = Date.now();
      await S.control(n, { hang: "v0:1", hangMode: "head" });
      res.armedAt = o.rel(armMs);
      res.tl = await S.monitor(o, 120000);
      await S.control(n, { hang: "v0:0" });
      res.hung = hungAtFn(o, n, armMs, "v0");
      res.afterHang = res.hung ? stallsFrom(res.tl, res.hung.ms - 1000, o.rel) : null;
      // when did the browser give up on the hung request, and when was it re-requested?
      const seg = res.hung?.path;
      res.segLines = seg ? o.segs.filter((l) => l.includes(seg)) : [];
      const rows = S.telemetry(n, o.t0 - 2000);
      const fs1 = rows.find((r) => r.kind === "frag-stall");
      const failLine = res.segLines.find((l) => l.includes("FAIL"));
      let abortAfter = null;
      if (failLine) { const m = failLine.match(/^([\d.]+)-([\d.]+)s/); abortAfter = +(m[2] - m[1]).toFixed(1); }
      res.hungRequestAbortedAfterSec = abortAfter;
      res.verdict = {
        hangHit: !!res.hung,
        noFragStallBeforeTtfb: !fs1 || (Date.parse(fs1.at + "Z") - res.hung.ms) >= 12000,
        abortedByTtfbTimeout: abortAfter != null && abortAfter >= 11.5,
        recoveryLe25s: !!res.afterHang && res.afterHang.maxStallMs <= 25000,
        noOverlay: res.tl.every((s) => !s.overlay),
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 4. slow but progressing link (0.85x lowest bitrate) 4.5 min
  async s4(n = 4) {
    await setup(n, {}, 3);
    const down = Math.round(0.85 * 655600);
    return run(n, "s4-slow-link", { down, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl = await S.monitor(o, 270000);
      const rows = S.telemetry(n, o.t0 - 2000);
      res.verdict = {
        noFragStall: !rows.some((r) => r.kind === "frag-stall"),
        noFreshLink: freshReqs(o).length === 0,
        noRefreshOrGiveup: !rows.some((r) => ["refresh-loop", "giveup", "hls-stall", "link-suspect", "refresh-bad", "recover-stuck"].includes(r.kind)),
        noOverlay: res.tl.every((s) => !s.overlay),
        progressed: res.tl[res.tl.length - 1].t > 150,
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 5. cors403: links expire after 60 s and expired requests get 403 without CORS headers (status 0 in the browser)
  async s5(n = 5) {
    await setup(n, { valid: 60000, cors403: 1 }, 3);
    return run(n, "s5-cors403", { down: 2e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl = await S.monitor(o, 200000);
      const h = hlsOf(n, o.t0);
      const first403 = h.find((x) => x.status === 403);
      res.first403 = first403 ? { at: o.rel(first403.ms), cors: first403.cors, path: first403.path.replace(/^\/t\/\d+\/n\/\w+\//, "") } : null;
      const fr = freshReqs(o);
      res.freshAt = fr.map((p) => o.rel(p.at));
      res.n403 = h.filter((x) => x.status === 403).length;
      res.tokens = [...new Set(h.map((x) => x.path.split("/")[2]))].map((tk) => o.rel(Number(tk)));
      const firstFreshAfter = first403 ? fr.find((p) => p.at >= first403.ms) : null;
      res.freshDelaySec = firstFreshAfter ? +((firstFreshAfter.at - first403.ms) / 1000).toFixed(1) : null;
      const rows = S.telemetry(n, o.t0 - 2000);
      const MSG_NET_PART = "اینترنت خود را بررسی کنید";
      res.verdict = {
        got403WithoutCors: !!first403 && first403.cors === false,
        freshWithin60s: res.freshDelaySec != null && res.freshDelaySec <= 65,
        newTokenUsed: res.tokens.length >= 2,
        linkSuspectRow: rows.some((r) => r.kind === "link-suspect"),
        noNetOverlay: res.tl.every((s) => !(s.overlay && (s.overlayMsg || "").includes(MSG_NET_PART))),
        noOverlayAtAll: res.tl.every((s) => !s.overlay),
        keepsPlaying: res.tl[res.tl.length - 1].t > 150,
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 6. always403 (with CORS): overlay within the refresh budget, giveup row, support code, auto-retry ~30 s later, progress not zeroed
  async s6(n = 6) {
    await setup(n, {}, 1);
    return run(n, "s6-always403", { down: 2e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl0 = await S.monitor(o, 36000);
      res.rowBefore = S.progress(n);
      await S.control(n, { always403: 1 });
      const armMs = Date.now();
      await o.page.evaluate(() => (document.querySelector("video").currentTime = 120));
      let overlayAt = null;
      res.tl = await S.monitor(o, 150000, 1000, (s) => {
        if (s.overlay && !overlayAt) overlayAt = s.wall;
        if (overlayAt && Date.now() - overlayAt > 45000) return true;
      });
      res.overlayAfterSec = overlayAt ? +((overlayAt - armMs) / 1000).toFixed(1) : null;
      const ov = res.tl.find((s) => s.overlay);
      res.overlayMsg = ov?.overlayMsg;
      res.supportCode = ov?.support;
      res.freshAt = freshReqs(o).map((p) => o.rel(p.at));
      const retryReq = overlayAt ? freshReqs(o, overlayAt + 20000).find((p) => p.at <= overlayAt + 45000) : null;
      res.autoRetryAfterOverlaySec = retryReq ? +((retryReq.at - overlayAt) / 1000).toFixed(1) : null;
      await sleep(2000);
      res.rowAfterOverlay = S.progress(n);
      // leave the page (client-side link) and check the row again
      try {
        await o.page.locator('a[href^="/panel/videos/topic/"]').first().click({ timeout: 5000 });
        await o.page.waitForURL(/\/panel\/videos\/topic\//, { timeout: 20000 });
        await sleep(2500);
        res.leftPage = true;
      } catch (e) {
        res.leftPage = "failed: " + e.message.slice(0, 100);
      }
      res.rowAfterLeave = S.progress(n);
      await S.control(n, { always403: 0 });
      const rows = S.telemetry(n, o.t0 - 2000);
      res.verdict = {
        overlayShown: !!overlayAt,
        overlayWithinBudget: res.overlayAfterSec != null && res.overlayAfterSec <= 100,
        giveupRow: rows.some((r) => r.kind === "giveup"),
        supportCodeShown: !!res.supportCode && rows.some((r) => r.sid.startsWith(res.supportCode)),
        autoRetry30s: res.autoRetryAfterOverlaySec != null && res.autoRetryAfterOverlaySec >= 25 && res.autoRetryAfterOverlaySec <= 40,
        progressNotZeroed: !!res.rowAfterLeave && res.rowAfterLeave.lastPosition > 0 && !!res.rowBefore && res.rowAfterLeave.lastPosition >= res.rowBefore.lastPosition,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 7. API outage during recovery (503 or 20 s hang) + forced non-link problem
  async s7(n = 7, api = process.env.API || "503", trigger = process.env.TRIG || "corrupt") {
    await setup(n, {}, 3);
    return run(n, `s7-api-${api}-${trigger}${process.env.CCOUNT ? process.env.CCOUNT : ""}`, { down: trigger === "hang" ? 0.9e6 : 2e6, cpu: 4, blockSW: true }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl0 = await S.monitor(o, 25000);
      res.routeHits = [];
      await o.page.route(/\/api\/videos\/[^/]+\/play(\?|$)/, async (route) => {
        res.routeHits.push(`${o.rel(Date.now())}s ${route.request().url().replace(S.APP, "")}`);
        if (api === "503") return route.fulfill({ status: 503, contentType: "text/html", body: "<html><body>503 Service Temporarily Unavailable</body></html>" });
        await sleep(20000);
        try { await route.fulfill({ status: 503, contentType: "text/plain", body: "late" }); } catch {}
      });
      const armMs = Date.now();
      const s0 = await S.snap(o.page);
      if (trigger === "corrupt") {
        // a segment ~20 s ahead, garbage, served bad 6 times (more than the 3 media recoveries/min -> rebuild)
        const segNo = Math.floor(s0.t / 4) + 6;
        res.corruptSeg = `seg${String(segNo % 38).padStart(3, "0")}.ts`;
        await S.control(n, { corruptSeg: res.corruptSeg, corruptMode: "garbage", corruptCount: Number(process.env.CCOUNT || 6) });
      } else {
        await S.control(n, { hang: "v0:3", hangMode: "body" });
      }
      res.armedAt = o.rel(armMs);
      res.tl = await S.monitor(o, 130000);
      await S.control(n, { corruptCount: 0, hang: "v0:0" });
      const h = hlsOf(n, o.t0);
      res.tokens = [...new Set(h.map((x) => x.path.split("/")[2]))].map((tk) => o.rel(Number(tk)));
      res.corrupted = h.filter((x) => x.status === "CORRUPT").length;
      res.hangs = h.filter((x) => x.status === "HANG").length;
      const rows = S.telemetry(n, o.t0 - 2000);
      res.refreshBad = rows.filter((r) => r.kind === "refresh-bad").map((r) => `${r.detail} code=${r.code} linkLeft=${r.ctx?.linkLeftSec}`);
      res.verdict = {
        problemInjected: res.corrupted > 0 || res.hangs > 0,
        apiCalledDuringRecovery: res.routeHits.length > 0,
        refreshBadRow: rows.some((r) => r.kind === "refresh-bad"),
        noGiveup: !rows.some((r) => r.kind === "giveup") && res.tl.every((s) => !s.overlay),
        sameUrlKept: res.tokens.length === 1,
        keepsPlaying: res.tl[res.tl.length - 1].t > (res.tl.find((s) => s.wall >= armMs)?.t ?? 0) + 40,
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 8a. CDN challenge on /play?fresh=1 (200 text/html) during a non-link recovery
  async s8(n = 8, trigger = process.env.TRIG || "corrupt") {
    await setup(n, {}, 3);
    return run(n, `s8-html-fresh-${trigger}`, { down: trigger === "hang" ? 0.9e6 : 2e6, cpu: 4, blockSW: true }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl0 = await S.monitor(o, 25000);
      res.routeHits = [];
      await o.page.route(/\/api\/videos\/[^/]+\/play\?fresh=1/, async (route) => {
        res.routeHits.push(`${o.rel(Date.now())}s ${route.request().url().replace(S.APP, "")}`);
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><body>Checking your browser...</body></html>" });
      });
      const armMs = Date.now();
      const s0 = await S.snap(o.page);
      if (trigger === "corrupt") {
        const segNo = Math.floor(s0.t / 4) + 6;
        res.corruptSeg = `seg${String(segNo % 38).padStart(3, "0")}.ts`;
        await S.control(n, { corruptSeg: res.corruptSeg, corruptMode: "garbage", corruptCount: 6 });
      } else await S.control(n, { hang: "v0:3", hangMode: "body" });
      res.tl = await S.monitor(o, 120000);
      await S.control(n, { corruptCount: 0, hang: "v0:0" });
      const rows = S.telemetry(n, o.t0 - 2000);
      const rb = rows.filter((r) => r.kind === "refresh-bad");
      res.refreshBad = rb.map((r) => `${r.detail} code=${r.code} linkLeft=${r.ctx?.linkLeftSec}`);
      const after = rows.filter((r) => rb[0] && Date.parse(r.at) >= Date.parse(rb[0].at) && r.ctx && "linkLeftSec" in r.ctx);
      res.verdict = {
        freshCalled: res.routeHits.length > 0,
        refreshBadWithType: rb.some((r) => (r.detail || "").includes("text/html")),
        deadlineNotZeroed: rb.length > 0 && after.every((r) => typeof r.ctx.linkLeftSec === "number" && r.ctx.linkLeftSec > 300),
        noImmediateGiveup: !rows.some((r) => r.kind === "giveup") && res.tl.every((s) => !s.overlay),
        keepsPlaying: res.tl[res.tl.length - 1].t > (res.tl.find((s) => s.wall >= armMs)?.t ?? 0) + 40,
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 8c. CDN challenge on /play?fresh=1 while the link itself is expired (403 with CORS): must not give up at once
  async s8c(n = 18) {
    await setup(n, { valid: 50000 }, 3);
    return run(n, "s8c-html-fresh-expired", { down: 2e6, cpu: 4, blockSW: true }, async (o, res) => {
      res.routeHits = [];
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      await o.page.route(/\/api\/videos\/[^/]+\/play\?fresh=1/, async (route) => {
        res.routeHits.push(o.rel(Date.now()));
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><body>Checking your browser...</body></html>" });
      });
      let ovAt = null;
      res.tl = await S.monitor(o, 170000, 1000, (s) => { if (s.overlay && !ovAt) ovAt = s.wall; if (ovAt && Date.now() - ovAt > 5000) return true; });
      const rows = S.telemetry(n, o.t0 - 2000);
      const rb = rows.filter((r) => r.kind === "refresh-bad");
      const gu = rows.find((r) => r.kind === "giveup");
      res.refreshBad = rb.map((r) => `${((Date.parse(r.at + "Z") - o.t0) / 1000).toFixed(0)}s ${r.detail} code=${r.code} linkLeft=${r.ctx?.linkLeftSec}`);
      res.giveupAfterFirstBadSec = gu && rb[0] ? (Date.parse(gu.at) - Date.parse(rb[0].at)) / 1000 : null;
      res.overlayMsg = res.tl.find((s) => s.overlay)?.overlayMsg;
      res.verdict = {
        freshCalled: res.routeHits.length > 0,
        refreshBadWithType: rb.some((r) => (r.detail || "").includes("text/html")),
        deadlineNotZeroed: rb.length > 0 && rb.every((r) => typeof r.ctx?.linkLeftSec === "number" && r.ctx.linkLeftSec > 300),
        noImmediateGiveup: res.giveupAfterFirstBadSec == null || res.giveupAfterFirstBadSec >= 30,
        retriedMoreThanOnce: res.routeHits.length >= 2,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 8b. initial /play returns a CDN HTML page -> retry box (retry:true, reload)
  async s8b(n = 15) {
    await setup(n, {}, 1);
    return run(n, "s8b-html-initial", { down: 2e6, cpu: 4, blockSW: true }, async (o, res) => {
      let hits = 0;
      await o.page.route(/\/api\/videos\/[^/]+\/play(\?|$)/, async (route) => {
        hits++;
        return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body>challenge</body></html>" });
      });
      await o.page.goto(`${S.APP}/panel/videos/${o.videoId}`, { waitUntil: "domcontentloaded" });
      await o.page.waitForSelector('[role="alert"]', { timeout: 30000 });
      await sleep(1500);
      res.box = await o.page.evaluate(() => { const a = document.querySelector('[role="alert"]'); return a ? a.innerText : null; });
      res.hasRetryButton = await o.page.evaluate(() => [...document.querySelectorAll('[role="alert"] button')].some((b) => b.textContent.includes("تلاش دوباره")));
      res.routeHits = hits;
      res.tl = await S.monitor(o, 2000);
      await sleep(1500);
      const rows = S.telemetry(n, o.t0 - 2000);
      res.verdict = {
        retryBox: !!res.box && res.box.includes("اتصال برقرار نشد") && res.hasRetryButton,
        loadFailRow: rows.some((r) => r.kind === "load-fail" && (r.detail || "").includes("text/html")),
        supportCode: /کد پیگیری/.test(res.box || ""),
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 9. offline blips at ~2 Mbps, Pixel 7, CPU x4, ~5 min
  async s9(n = 9) {
    await setup(n, {}, 3);
    return run(n, "s9-offline-blips", { down: 2e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      const SHORT = process.env.SHORT === "1";
      const blips = SHORT ? [[18, 5], [42, 8], [68, 12], [98, 15], [130, 10], [155, 6], [172, 7]] : [[25, 5], [65, 8], [105, 12], [145, 15], [190, 10], [230, 6], [265, 9]];
      res.short = SHORT;
      const start = Date.now();
      res.blipLog = [];
      let i = 0, offUntil = 0, probed = false;
      res.tl = await S.monitor(o, SHORT ? 190000 : 300000, 1000, async () => {
        const el = (Date.now() - start) / 1000;
        if (offUntil && el >= offUntil) {
          await o.setOffline(false);
          res.blipLog.push(`${o.rel(Date.now())}s online`);
          offUntil = 0;
        }
        if (!offUntil && i < blips.length && el >= blips[i][0]) {
          await o.setOffline(true);
          res.blipLog.push(`${o.rel(Date.now())}s offline ${blips[i][1]}s`);
          offUntil = el + blips[i][1];
          if (i === 2 && !probed) {
            probed = true;
            await sleep(1500);
            res.onlineFlagDuringBlip = await o.page.evaluate(() => navigator.onLine);
            await o.page.evaluate(() => setTimeout(() => { throw new Error("e2e-probe offline js error"); }, 0));
          }
          i++;
        }
      });
      if (offUntil) await o.setOffline(false);
      await sleep(3000);
      res.lastSnap = await S.snap(o.page);
      await S.gesture(o, "document.querySelector('video').pause()");
      await sleep(4000);
      const rows = S.telemetry(n, o.t0 - 2000);
      const queued = rows.filter((r) => r.queued);
      res.queuedRows = queued.map((r) => `${r.kind} lag=${r.ctx?._lagSec}`);
      const p = S.progress(n);
      res.progressAtEnd = p;
      res.verdict = {
        noOverlay: res.tl.every((s) => !s.overlay),
        continues: res.lastSnap.t > (SHORT ? 120 : 200),
        watchedMatchesPosition: !!p && Math.abs(p.watchedSeconds - p.lastPosition) <= 6,
        lastPositionMatchesPlayer: !!p && Math.abs(p.lastPosition - res.lastSnap.t) <= 6,
        offlineEventQueued: queued.length > 0 && queued.some((r) => r.kind === "js-error"),
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.filter((x) => !x.includes("e2e-probe")).length === 0,
      };
    });
  },
  // 10. manual 720p at ~1.5 Mbps -> auto within ~3 stalls, toast, stays auto after reload
  async s10(n = 10) {
    await setup(n, {}, 3);
    return run(n, "s10-manual720", { down: 1.5e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      await sleep(5000);
      await S.pickQuality(o, 720);
      const pickMs = Date.now();
      res.selAfterPick = (await S.snap(o.page)).sel;
      let demotedAt = null;
      res.tl = await S.monitor(o, 150000, 1000, (s) => {
        if (!demotedAt && s.sel === "0") demotedAt = s.wall;
      });
      res.demotedAfterSec = demotedAt ? +((demotedAt - pickMs) / 1000).toFixed(1) : null;
      const before = res.tl.filter((s) => !demotedAt || s.wall <= demotedAt);
      res.stallsBeforeDemote = S.analyze(before).stalls.length;
      res.toasts = await o.page.evaluate(() => window.__toasts || []);
      await o.page.reload({ waitUntil: "domcontentloaded" });
      await o.page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.currentSrc && v.readyState >= 1; }, null, { timeout: 60000 });
      await S.tapPlay(o);
      await sleep(12000);
      res.selAfterReload = (await S.snap(o.page)).sel;
      res.prefAfterReload = await o.page.evaluate(() => localStorage.getItem("ds-quality"));
      const rows = S.telemetry(n, o.t0 - 2000);
      res.verdict = {
        manualApplied: res.selAfterPick === "720",
        demoted: !!demotedAt && rows.some((r) => r.kind === "quality-demoted"),
        demotedWithin3Stalls: !!demotedAt && res.stallsBeforeDemote <= 3,
        toast: res.toasts.some((t) => t.includes("کیفیت روی «خودکار» رفت")),
        autoAfterReload: res.selAfterReload === "0" && res.prefAfterReload === "0",
        noOverlay: res.tl.every((s) => !s.overlay),
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 11a. B-long: link valid 30 s, ~130 s play (desktop, unthrottled as before)
  async s11a(n = 11) {
    await setup(n, { valid: 30000 }, 3);
    return run(n, "s11a-Blong", { device: null, down: 0, cpu: 1 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      res.tl = await S.monitor(o, 132000);
      res.last = await S.snap(o.page);
      await S.gesture(o, "document.querySelector('video').pause()");
      await sleep(3000);
      const p = S.progress(n);
      res.progressAfterPause = p;
      res.n403 = hlsOf(n, o.t0).filter((x) => x.status === 403).length;
      res.tokens = [...new Set(hlsOf(n, o.t0).map((x) => x.path.split("/")[2]))].length;
      const a = S.analyze(res.tl);
      res.verdict = {
        noOverlay: res.tl.every((s) => !s.overlay),
        continuous: a.maxStallMs <= 5000 && a.jumpsBack.length === 0,
        reached: res.last.t >= 120,
        progressOk: !!p && Math.abs(p.lastPosition - res.last.t) <= 5 && p.watchedSeconds >= res.last.t - 10,
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 11b. N-b2: seek + 20 s 500-outage
  async s11b(n = 16) {
    await setup(n, {}, 1);
    return run(n, "s11b-Nb2", { device: null, down: 0, cpu: 1 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      await o.page.waitForFunction(() => document.querySelector("video").currentTime > 20, null, { timeout: 60000 });
      await S.control(n, { fail500: 1 });
      const outMs = Date.now();
      await o.page.evaluate(() => (document.querySelector("video").currentTime = 110));
      let firstBusy = null, resumed = null;
      res.tl = await S.monitor(o, 60000, 500, async (s) => {
        if (s.busy && !firstBusy) firstBusy = s.wall;
        if (Date.now() - outMs >= 20000 && !res.outageEnded) {
          await S.control(n, { fail500: 0 });
          res.outageEnded = o.rel(Date.now());
        }
        if (!resumed && s.t > 110.3) resumed = s;
      });
      res.firstBusyAfterSec = firstBusy ? +((firstBusy - outMs) / 1000).toFixed(1) : null;
      res.resumedAt = resumed ? `${((resumed.wall - outMs) / 1000).toFixed(1)}s t=${resumed.t}` : null;
      res.verdict = {
        badgeAbout4s: res.firstBusyAfterSec != null && res.firstBusyAfterSec >= 2 && res.firstBusyAfterSec <= 8,
        resumesSameSecond: !!resumed && resumed.t < 113,
        noOverlay: res.tl.every((s) => !s.overlay),
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 11c. D3: permanent 403 + leave page -> progress row not zeroed
  async s11c(n = 17) {
    await setup(n, {}, 1);
    return run(n, "s11c-D3", { device: null, down: 0, cpu: 1 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      await o.page.waitForFunction(() => document.querySelector("video").currentTime > 33, null, { timeout: 60000 });
      await sleep(16000);
      res.rowWhilePlaying = S.progress(n);
      await S.control(n, { always403: 1 });
      await o.page.evaluate(() => (document.querySelector("video").currentTime = 135));
      const t = Date.now();
      let ov = null;
      res.tl = await S.monitor(o, 120000, 500, (s) => { if (s.overlay) { ov = s; return true; } });
      res.overlayAfterSec = ov ? +((ov.wall - t) / 1000).toFixed(1) : null;
      res.overlayMsg = ov?.overlayMsg;
      await sleep(2000);
      res.rowAfterOverlay = S.progress(n);
      await o.page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await sleep(2000);
      res.rowAfterHidden = S.progress(n);
      await o.page.evaluate(() => {
        delete document.visibilityState;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await o.page.locator('a[href^="/panel/videos/topic/"]').first().click();
      await o.page.waitForURL(/\/panel\/videos\/topic\//, { timeout: 20000 });
      await sleep(2500);
      res.rowAfterLeave = S.progress(n);
      await S.control(n, { always403: 0 });
      const ok = (r) => !!r && r.lastPosition > 0 && r.lastPosition >= (res.rowWhilePlaying?.lastPosition ?? 1);
      res.verdict = {
        overlayShown: !!ov,
        rowAfterOverlayNotZero: ok(res.rowAfterOverlay),
        rowAfterHiddenNotZero: ok(res.rowAfterHidden),
        rowAfterLeaveNotZero: ok(res.rowAfterLeave),
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
  // 12. 8 min soak at ~2 Mbps with blips and two hangs
  async s12(n = 12) {
    await setup(n, {}, 5);
    return run(n, "s12-soak", { down: 2e6, cpu: 4 }, async (o, res) => {
      await S.gotoWatchReady(o);
      res.play = await S.tapPlay(o);
      const start = Date.now();
      const plan = [[60, "blip", 8], [120, "hang"], [200, "blip", 10], [300, "blip", 6], [360, "hang"], [420, "blip", 12]];
      let i = 0, offUntil = 0;
      res.log = [];
      res.tl = await S.monitor(o, 480000, 1000, async () => {
        const el = (Date.now() - start) / 1000;
        if (offUntil && el >= offUntil) { await o.setOffline(false); offUntil = 0; res.log.push(`${o.rel(Date.now())}s online`); }
        if (i < plan.length && el >= plan[i][0] && !offUntil) {
          const [_, kind, d] = plan[i++];
          if (kind === "blip") { await o.setOffline(true); offUntil = el + d; res.log.push(`${o.rel(Date.now())}s offline ${d}s`); }
          else { await S.control(n, { hangNext: 1, hangMode: "body" }); res.log.push(`${o.rel(Date.now())}s hang armed`); }
        }
      });
      if (offUntil) await o.setOffline(false);
      await S.control(n, { hangNext: 0 });
      res.hangsHit = hlsOf(n, o.t0).filter((x) => x.status === "HANG").map((x) => `${o.rel(x.ms)}s ${x.level}`);
      const rows = S.telemetry(n, o.t0 - 2000);
      const a = S.analyze(res.tl);
      const heaps = res.tl.filter((s) => s.heap).map((s) => s.heap);
      const q = (arr, a, b) => { const x = arr.slice(Math.floor(arr.length * a), Math.floor(arr.length * b)); return x.length ? +(x.reduce((m, y) => m + y, 0) / x.length).toFixed(1) : null; };
      res.heapAvgFirstQuarter = q(heaps, 0.05, 0.25);
      res.heapAvgLastQuarter = q(heaps, 0.75, 1);
      res.verdict = {
        noOverlay: res.tl.every((s) => !s.overlay),
        fragStallsLe2: rows.filter((r) => r.kind === "frag-stall").length <= 2,
        heapFlat: res.heapAvgLastQuarter != null && res.heapAvgLastQuarter <= res.heapAvgFirstQuarter * 1.5 + 5,
        backBufferLe35: a.maxBehind <= 36, // ~35 s (30 s backBufferLength + one 4 s segment)
        fwdBufferLe65: a.maxAhead <= 65,
        progressed: res.tl[res.tl.length - 1].t > 380,
        urlUnchanged: S.common(o, res.tl).urlUnchanged,
        noPageError: o.pageErrors.length === 0,
      };
    });
  },
};

(async () => {
  const fn = SC[which];
  if (!fn) {
    console.error(`usage: node set1.js <${Object.keys(SC).join("|")}> [n]`);
    process.exit(which === "list" ? 0 : 2);
  }
  const res = await (nArg ? fn(nArg) : fn());
  process.exit(res && res.pass === true ? 0 : res && res.error ? 2 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
