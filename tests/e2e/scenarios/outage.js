// قطعی سرور ویدیو (همه‌ی قطعه‌ها خطای ۵۰۰) برای مدتی و سپس برگشت؛ پلیر باید نشان «در حال اتصال دوباره» بدهد،
// صفحه‌ی خطا نیاورد و از همان ثانیه ادامه دهد.
// N family: the CDN answers HTTP 500 for every .ts for OUTAGE_MS (or, with UNTIL_BUSY=1, until the player shows its
// "reconnecting" badge + EXTRA_MS) and then recovers. Optional SEEK to an unbuffered position at outage start.
//   node scenarios/outage.js [n]                                  20 s outage while playing (N-a)
//   SEEK=110 node scenarios/outage.js                             seek + 20 s outage (N-b2, same as set1 s11b)
//   UNTIL_BUSY=1 SEEK=110 node scenarios/outage.js                outage until the badge shows + 8 s (N-c)
// env: OUTAGE_MS (20000) UNTIL_BUSY EXTRA_MS (8000) SEEK AFTER_MS (30000) NAME. Default slot n = 16 (as set1 s11b).
const S = require("../lib");
const { sleep } = S;
S.useOut("scenarios");
const n = Number(process.argv[2] || 16);
const OUTAGE_MS = Number(process.env.OUTAGE_MS || 20000);
const UNTIL_BUSY = process.env.UNTIL_BUSY === "1";
const EXTRA_MS = Number(process.env.EXTRA_MS || 8000);
const SEEK = process.env.SEEK ? Number(process.env.SEEK) : null;
const AFTER_MS = Number(process.env.AFTER_MS || 30000);
const name = process.env.NAME || `outage${SEEK != null ? "-seek" + SEEK : ""}${UNTIL_BUSY ? "-untilbusy" : ""}`;

(async () => {
  await S.control(n, { reset: 1, valid: 86400000, loop: 1, epoch: Date.now() });
  S.db(`update "Video" set "durationSec"=152, published=true where id='${S.ids(n).videoId}'`);
  S.resetProgress(n);
  const since = Date.now() - 1000;
  const res = { scenario: name, n, outageMs: UNTIL_BUSY ? `until badge + ${EXTRA_MS}` : OUTAGE_MS, seek: SEEK };
  let o;
  try {
    o = await S.open(n, name, { device: null, down: 0, cpu: 1 });
    await S.gotoWatchReady(o);
    res.play = await S.tapPlay(o);
    await o.page.waitForFunction(() => document.querySelector("video").currentTime > 20, null, { timeout: 60000 });
    await S.control(n, { fail500: 1 });
    const tO = Date.now();
    if (SEEK != null) await o.page.evaluate((x) => (document.querySelector("video").currentTime = x), SEEK);
    let firstBusy = null;
    let tRec = null;
    const tl = await S.monitor(o, 260000, 500, async (s) => {
      if (s.busy && !firstBusy) firstBusy = s;
      const el = Date.now() - tO;
      if (!tRec && ((!UNTIL_BUSY && el >= OUTAGE_MS) || (UNTIL_BUSY && firstBusy && Date.now() - firstBusy.wall >= EXTRA_MS) || el > 200000)) {
        await S.control(n, { fail500: 0 });
        tRec = Date.now();
        res.outageEndedAfterSec = +((tRec - tO) / 1000).toFixed(1);
      }
      if (tRec && Date.now() - tRec >= AFTER_MS) return true;
    });
    await S.control(n, { fail500: 0 });
    const sec = (ms) => +((ms - tO) / 1000).toFixed(1);
    res.firstBusyAfterSec = firstBusy ? sec(firstBusy.wall) : null;
    const lastBusy = [...tl].reverse().find((x) => x.busy);
    res.lastBusyAfterSec = lastBusy ? sec(lastBusy.wall) : null;
    // first sample after the outage ended where the picture moves again
    const resumed = tl.find((x, i) => tRec && x.wall > tRec && i > 0 && x.t > tl[i - 1].t + 0.2 && !x.paused);
    res.resumedAfterSec = resumed ? sec(resumed.wall) : null;
    res.resumedAtT = resumed ? resumed.t : null;
    const a = S.analyze(tl, o.rel);
    res.analysis = a;
    res.hls500 = S.hlsLog().filter((x) => x.ns === S.ids(n).ns && x.ms >= tO && x.status === 500).length;
    res.tl = tl.filter((_, i) => i % 4 === 0 || i === tl.length - 1).map(S.fmt(o.rel));
    res.plays = o.plays.map((p) => `${o.rel(p.at)}s ${p.url}`);
    const urlUnchanged = S.common(o, tl).urlUnchanged; // before leaving the page below
    await o.page.goto("about:blank").catch(() => {});
    await sleep(2500);
    const rows = S.telemetry(n, since);
    res.telemetry = S.telBrief(rows, o.t0);
    res.counts = S.kindCounts(rows);
    const stalledDuringOutage = a.stalls.some((x) => x.ms > 4000);
    res.verdict = {
      outageInjected: res.hls500 > 0,
      noOverlay: a.overlaySamples === 0,
      badgeIfStalled: !stalledDuringOutage || res.firstBusyAfterSec != null,
      resumedWithin10sOfRecovery: !stalledDuringOutage || (res.resumedAfterSec != null && res.resumedAfterSec - res.outageEndedAfterSec <= 10),
      sameSecond: SEEK == null || (res.resumedAtT != null && res.resumedAtT < SEEK + 3),
      noJumpBack: a.jumpsBack.length === 0,
      keepsPlaying: a.lastT > (tl.find((s) => tRec && s.wall >= tRec)?.t ?? 0) + 10,
      urlUnchanged,
      noPageError: o.pageErrors.length === 0,
    };
    res.pass = Object.values(res.verdict).every(Boolean);
  } catch (e) {
    res.error = String(e.stack || e).slice(0, 1500);
  }
  await S.control(n, { fail500: 0 }).catch(() => {});
  if (o) await o.browser.close().catch(() => {});
  const file = S.save(name, res);
  console.log(JSON.stringify({ name, pass: res.pass, verdict: res.verdict, firstBusyAfterSec: res.firstBusyAfterSec, outageEndedAfterSec: res.outageEndedAfterSec, resumedAfterSec: res.resumedAfterSec, counts: res.counts, error: res.error }, null, 1));
  S.report(name, res.pass, file);
  process.exit(res.pass === true ? 0 : res.error ? 2 : 1);
})();
