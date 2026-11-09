#!/usr/bin/env node
// اجرای سناریوهای E2E با نام‌های خوانا و خلاصه‌ی قبول/رد در پایان.
// Friendly runner for the E2E scenarios.
//   node tests/e2e/run.mjs list                       names, slots and what each one checks
//   node tests/e2e/run.mjs hung-fragment always403    run these, one after another
//   node tests/e2e/run.mjs quick                      a group (quick | video | platform | all)
//   node tests/e2e/run.mjs set1:s5 set2:wake2         raw suite:scenario names work too
// flags: --up (start mocks + app with ctl.sh first) --down (stop them at the end) --parallel (only if slots differ)
// (also `pnpm e2e <names…>` from the repo root). Exit code = number of scenarios that did not pass.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_PORT = Number(process.env.E2E_APP_PORT || 3310);
const HLS_PORT = Number(process.env.E2E_HLS_PORT || 3600);
const ARVAN_PORT = Number(process.env.E2E_ARVAN_PORT || 3399);

// alias: [script, args, slots, minutes, what it checks]
const A = {
  "hung-fragment": ["set1.js", ["s1"], [1], 4, "segment download hangs mid-body (auto quality, 0.9 Mbps): watchdog recovers in ≤20 s, no overlay, frag-stall row"],
  "hung-manual480": ["set1.js", ["s2"], [2], 4.5, "hang with manual 480p at 1.5 Mbps: recovery ≤20 s, at most one demotion to auto, demotion survives reload"],
  "hung-head": ["set1.js", ["s3"], [3], 3.5, "hang before headers: hls.js 12 s TTFB timeout handles it (watchdog doesn't fire first), recovery ≤25 s"],
  "slow-link": ["set1.js", ["s4"], [4], 5, "link at 0.85× the lowest bitrate for 4.5 min: no frag-stall, no fresh link, no refresh/give-up rows"],
  cors403: ["set1.js", ["s5"], [5], 4, "links expire after 60 s with a CORS-less 403 (status 0): fresh link within ~60 s, link-suspect row, keeps playing"],
  always403: ["set1.js", ["s6"], [6], 4, "CDN always 403: give-up overlay within budget (≤100 s), giveup row, support code, auto-retry ~30 s, progress not zeroed"],
  "api-outage": ["set1.js", ["s7"], [7], 3, "/play API 503 (API=503|hang, TRIG=corrupt|hang) during a non-link recovery: no give-up, same link kept"],
  "html-fresh": ["set1.js", ["s8"], [8], 3, "/play?fresh=1 answers a CDN HTML challenge during recovery: refresh-bad row, deadline not zeroed, no give-up"],
  "html-fresh-expired": ["set1.js", ["s8c"], [18], 3.5, "HTML challenge while the link really expired: no immediate give-up (≥30 s), retried more than once"],
  "html-initial": ["set1.js", ["s8b"], [15], 1, "first /play returns HTML: Persian retry box with «تلاش دوباره», load-fail row, support code"],
  "offline-blips": ["set1.js", ["s9"], [9], 5.5, "7 offline blips (5-15 s) over 5 min (SHORT=1 → 3 min): no overlay, progress matches player, offline js-error queued"],
  manual720: ["set1.js", ["s10"], [10], 3.5, "manual 720p on 1.5 Mbps: demoted to auto within ≤3 stalls, toast, stays auto after reload"],
  "b-long": ["set1.js", ["s11a"], [11], 2.7, "link valid only 30 s, 130 s of play (desktop): continuous (≤5 s stall, no jump back), progress row correct"],
  "n-outage": ["set1.js", ["s11b"], [16], 1.5, "seek + 20 s CDN 500 outage: badge after ~4 s, resumes at the same second, no overlay"],
  d3: ["set1.js", ["s11c"], [17], 2, "permanent 403 + leave page/hide tab while overlay shown: progress row never zeroed"],
  soak: ["set1.js", ["s12"], [12], 8.5, "8 min soak with blips and two hangs: ≤2 frag-stalls, flat heap, back buffer ≤36 s, forward ≤65 s"],
  "ios-engine": ["set2.js", ["ios"], [13], 2, "iOS home-screen → native HLS (no hls.js chunk, no quality menu); Safari tab / ds-engine=hls override → hls.js"],
  "wake-lock": ["set2.js", ["wake"], [14, 13], 4, "Screen Wake Lock lifecycle: request on play, re-request on visible, held through refresh, released on pause/end/give-up/unmount"],
  "wake-refresh": ["set2.js", ["wake2"], [11], 2, "wake lock held (no release/new request) through a real expired-link refresh"],
  native: ["set2.js", ["native"], [19], 2, "native engine (Chromium native HLS emulation) + 8 s offline blip: no silent paused frame"],
  crash: ["set2.js", ["crash"], [20], 1, "renderer crash while playing → abnormal-exit row once (sid, position, prevVis), no banner on the watch page"],
  "pwa-relaunch": ["set2.js", ["pwa"], [1], 1, "unclean watch marker on PWA relaunch → «نیمه‌کاره ماند» banner + abnormal-exit(relaunch) once"],
  "clean-nav": ["set2.js", ["cleannav"], [2, 3], 1.5, "SPA / full navigation away from a playing video: no abnormal-exit, no banner, session-end rows"],
  exits: ["set2.js", ["exits"], [15], 3, "reload / navigation / tab close / ended / SPA while playing: never looks like a crash"],
  "session-end": ["set2.js", ["summary"], [3], 2.5, "2 min play then close tab: one session-end row, playedSec ≈120, 0 stalls, engine/build set"],
  api: ["set2.js", ["api"], [4, 5], 0.5, "API headers (no-store, Vary: Cookie), playback-log validation (400/401/413, eid dedupe), progress past 50 min without failed INSERTs"],
  shell: ["set2.js", ["shell"], [6], 1.5, "overscroll, landscape BottomNav, grain only on public pages, Persian error page, offline page, SW ds-v3, no panel HTML cached"],
  "chunk-offline": ["set2.js", ["chunkoff"], [6], 1, "chunk load error offline → Persian offline message, no reload loop, reload once online"],
  inapp: ["set2.js", ["inapp"], [7], 0.5, "Telegram / Android WebView UA shows the «open in Chrome or Safari» hint; normal Chrome doesn't"],
  admin: ["set2.js", ["admin"], [3, 8], 1, "/admin/playback renders all sections, filters (kind/sid/range/user), sampling notice, phone width; student redirected (run after other scenarios)"],
  "frozen-a": ["scenarios/frozen.js", ["A"], [20], 1.5, "picture frozen once (playbackRate 0): recovers by itself, no overlay"],
  "frozen-b": ["scenarios/frozen.js", ["B"], [20], 3.5, "picture frozen for good: retry overlay (known residual: after ~130 s), retry plays once unfrozen"],
  outage: ["scenarios/outage.js", [], [16], 1.5, "configurable CDN 500 outage (env OUTAGE_MS, UNTIL_BUSY, SEEK, …): badge, resume ≤10 s after recovery, no overlay"],
};
const SET1 = Object.keys(A).filter((k) => A[k][0] === "set1.js");
const GROUPS = {
  quick: ["hung-fragment", "always403"],
  video: SET1.filter((k) => k !== "soak"),
  platform: ["ios-engine", "wake-lock", "wake-refresh", "native", "crash", "pwa-relaunch", "clean-nav", "exits", "session-end", "api", "shell", "chunk-offline", "inapp", "admin"],
  all: [...SET1, "ios-engine", "wake-lock", "wake-refresh", "native", "crash", "pwa-relaunch", "clean-nav", "exits", "session-end", "api", "shell", "chunk-offline", "inapp", "frozen-a", "frozen-b", "outage", "admin"],
};

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const names = argv.filter((a) => !a.startsWith("--"));

if (!names.length || names[0] === "list" || names[0] === "help") {
  console.log("scenarios (slot = test student/video/mock namespace; same slot = never run in parallel):\n");
  for (const [k, [script, args, slots, min, what]] of Object.entries(A)) console.log(`  ${k.padEnd(19)} ${`${script} ${args.join(" ")}`.padEnd(26)} slot ${slots.join(",").padEnd(5)} ~${min} min  ${what}`);
  console.log(`\ngroups: ${Object.entries(GROUPS).map(([g, l]) => `${g} (${l.length})`).join(", ")}`);
  console.log("raw names: set1:<s1…s12|s8b|s8c|s11a…>, set2:<ios|wake|…>; flags: --up --down --parallel");
  process.exit(0);
}

const jobs = [];
for (const nm of names) {
  if (GROUPS[nm]) for (const k of GROUPS[nm]) jobs.push([k, ...A[k]]);
  else if (A[nm]) jobs.push([nm, ...A[nm]]);
  else if (/^set[12]:\w+$/.test(nm)) {
    const [suite, sc] = nm.split(":");
    jobs.push([nm, `${suite}.js`, [sc], [], 0, ""]);
  } else {
    console.error(`unknown scenario "${nm}" — see: node tests/e2e/run.mjs list`);
    process.exit(2);
  }
}

const portOpen = (p) => fetch(`http://127.0.0.1:${p}/`, { signal: AbortSignal.timeout(3000) }).then(() => true, () => false);
const ctl = (cmd) => execFileSync(path.join(DIR, "ctl.sh"), [cmd], { stdio: "inherit" });

// ─── preflight ───
if (!fs.existsSync(path.join(DIR, "vod", "master.m3u8")) && !process.env.E2E_VOD) {
  console.error("no test video — run: tests/e2e/gen-vod.sh");
  process.exit(2);
}
if (!fs.existsSync(path.join(DIR, ".run", "jwt"))) {
  console.error("no test logins — run: node tests/e2e/setup.mjs");
  process.exit(2);
}
if (flags.has("--up")) ctl("up");
const down = [];
for (const [p, what] of [[APP_PORT, "app"], [ARVAN_PORT, "arvan mock"], [HLS_PORT, "hls mock"]]) if (!(await portOpen(p))) down.push(`${what} (:${p})`);
if (down.length) {
  console.error(`not running: ${down.join(", ")} — start with: tests/e2e/ctl.sh up   (or pass --up)`);
  process.exit(2);
}

// ─── run ───
function runJob([name, script, args]) {
  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`\n=== ${name} (${script} ${args.join(" ")}) ${new Date().toISOString().slice(11, 19)}`);
    const child = spawn(process.execPath, [path.join(DIR, script), ...args], { cwd: DIR, env: process.env, stdio: ["ignore", "pipe", "inherit"] });
    const results = [];
    let buf = "";
    child.stdout.on("data", (d) => {
      process.stdout.write(d);
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.startsWith("E2E-RESULT ")) try { results.push(JSON.parse(line.slice(11))); } catch {}
      }
    });
    child.on("close", (code) => resolve({ name, code, results, sec: Math.round((Date.now() - started) / 1000) }));
  });
}

let outcomes = [];
if (flags.has("--parallel")) {
  const seen = new Map();
  for (const j of jobs) for (const s of j[3]) {
    if (seen.has(s)) {
      console.error(`--parallel refused: ${seen.get(s)} and ${j[0]} share slot ${s}`);
      process.exit(2);
    }
    seen.set(s, j[0]);
  }
  outcomes = await Promise.all(jobs.map(runJob));
} else for (const j of jobs) outcomes.push(await runJob(j));

if (flags.has("--down")) ctl("all-stop");

console.log("\n──────── summary ────────");
let failed = 0;
for (const o of outcomes) {
  const pass = o.code === 0;
  if (!pass) failed++;
  const files = o.results.map((r) => r.file).filter(Boolean).join(", ");
  console.log(`${pass ? "PASS" : o.code === 2 ? "ERROR" : "FAIL"}  ${o.name.padEnd(19)} ${String(o.sec).padStart(4)} s  ${files}`);
}
console.log(`${outcomes.length - failed}/${outcomes.length} passed`);
process.exit(failed);
