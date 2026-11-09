// تصویر ثابت با وجود داده در بافر (decoder گیر کرده): پلیر باید یا خودش درست شود (A) یا بعد از نردبان بازیابی
// به صفحه‌ی «تلاش دوباره» برسد و دکمه کار کند (B).
// Picture frozen while data is buffered (decoder stuck) -> the stall-buffered handling must escalate, not loop.
//   node scenarios/frozen.js A   transient freeze (playbackRate=0 once)  -> recovers by itself, no overlay
//   node scenarios/frozen.js B   persistent freeze                         -> escalation ends in the retry overlay
//                                (known residual: reaches it only after ~130 s); retry works once unfrozen
// Optional second argument: scenario slot n (default 20 — shared with set2 crash, don't run both at once).
const S = require("../lib");
const { sleep } = S;
S.useOut("scenarios");
const variant = (process.argv[2] || "A").toUpperCase();
const n = Number(process.argv[3] || 20);
const FREEZE = `(() => {
  window.__freeze = false;
  const force = (v) => { if (window.__freeze && v.playbackRate !== 0) { try { v.playbackRate = 0; } catch (e) {} } };
  for (const ev of ["playing", "ratechange", "loadedmetadata", "seeked", "play"]) document.addEventListener(ev, (e) => { if (e.target && e.target.tagName === "VIDEO") force(e.target); }, true);
  setInterval(() => { const v = document.querySelector("video"); if (v) force(v); }, 200);
})();`;

(async () => {
  if (!["A", "B"].includes(variant)) {
    console.error("usage: node scenarios/frozen.js <A|B> [n]");
    process.exit(2);
  }
  const name = `frozen-${variant}`;
  await S.control(n, { reset: 1, valid: 86400000, loop: 3, epoch: Date.now() });
  S.db(`update "Video" set "durationSec"=456, published=true where id='${S.ids(n).videoId}'`);
  S.resetProgress(n);
  const since = Date.now() - 1000;
  const res = { scenario: name, n, ...S.ids(n) };
  let o;
  try {
    o = await S.open(n, name, { device: "Pixel 7", down: 0, cpu: 1, init: FREEZE });
    await S.gotoWatchReady(o);
    res.play = await S.tapPlay(o);
    await sleep(20000);
    const t0 = Date.now();
    res.tAtFreeze = (await S.snap(o.page)).t;
    if (variant === "A") await o.page.evaluate(() => { document.querySelector("video").playbackRate = 0; });
    else await o.page.evaluate(() => { window.__freeze = true; });
    let ovAt = null;
    const tl = await S.monitor(o, variant === "A" ? 45000 : 170000, 1000, (s) => {
      if (s.overlay && !ovAt) ovAt = s.wall;
      if (ovAt && Date.now() - ovAt > 4000) return true;
    });
    res.overlayAfterSec = ovAt ? +((ovAt - t0) / 1000).toFixed(1) : null;
    res.overlayMsg = tl.find((s) => s.overlay)?.overlayMsg || null;
    let tlRetry = null;
    if (variant === "B") {
      await o.page.evaluate(() => { window.__freeze = false; const v = document.querySelector("video"); v.playbackRate = 1; v.defaultPlaybackRate = 1; });
      await o.page.locator('button:has-text("تلاش دوباره")').first().click({ timeout: 10000 }).catch((e) => (res.retryErr = e.message.slice(0, 100)));
      tlRetry = await S.monitor(o, 20000, 1000);
    }
    res.events = (await o.page.evaluate(() => window.__ev || [])).filter((e) => e[0] >= t0 - 1000).map((e) => `${o.rel(e[0])}s ${e[1]} ${JSON.stringify(e[2] || "")}`).slice(0, 60);
    res.analysis = S.analyze(tl, o.rel);
    res.tl = tl.map(S.fmt(o.rel));
    if (tlRetry) {
      res.retryAnalysis = S.analyze(tlRetry, o.rel);
      res.tlRetry = tlRetry.map(S.fmt(o.rel));
    }
    res.plays = o.plays.map((p) => `${o.rel(p.at)}s ${p.url}`);
    res.pageErrors = o.pageErrors;
    await o.page.goto("about:blank").catch(() => {});
    await sleep(2500);
    const rows = S.telemetry(n, since);
    res.telemetry = S.telBrief(rows, o.t0);
    res.counts = S.kindCounts(rows);
    const a = res.analysis;
    res.verdict =
      variant === "A"
        ? {
            noOverlay: a.overlaySamples === 0,
            recovered: a.lastT > res.tAtFreeze + 10,
            freezeLe15s: a.maxStallMs <= 15000,
            stallBufferedRow: !!res.counts["stall-buffered"],
            noPageError: o.pageErrors.length === 0,
          }
        : {
            overlayShown: res.overlayAfterSec != null,
            overlayWithin160s: res.overlayAfterSec != null && res.overlayAfterSec <= 160,
            giveupRow: !!res.counts.giveup,
            retryPlays: !!res.retryAnalysis && res.retryAnalysis.lastT > res.retryAnalysis.firstT + 5 && res.retryAnalysis.overlaySamples === 0,
            noPageError: o.pageErrors.length === 0,
          };
    res.pass = Object.values(res.verdict).every(Boolean);
  } catch (e) {
    res.error = String(e.stack || e).slice(0, 1500);
  }
  if (o) await o.browser.close().catch(() => {});
  const file = S.save(name, res);
  console.log(JSON.stringify({ name, pass: res.pass, verdict: res.verdict, overlayAfterSec: res.overlayAfterSec, counts: res.counts, error: res.error }, null, 1));
  S.report(name, res.pass, file);
  process.exit(res.pass === true ? 0 : res.error ? 2 : 1);
})();
