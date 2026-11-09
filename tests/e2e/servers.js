// شبیه‌ساز CDN ویدیو (HLS) روی :3600 و شبیه‌ساز API ویدیوی آروان روی :3399 برای تست E2E پخش.
// Mock HLS CDN (:3600) with expiring tokens / drops / forced 403 / 500s / corrupted segments / hung downloads,
// and mock Arvan VOD API (:3399). Usage: node servers.js [hls|arvan|both]
// Started/stopped by ctl.sh; see README.md («شبیه‌ساز CDN») for every /control parameter.
const http = require("http");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const REPO = path.resolve(DIR, "..", "..");
const VOD = path.resolve(process.env.E2E_VOD || path.join(DIR, "vod"));
const BAD = path.join(VOD, "badsegs");
const RUN = path.join(DIR, ".run");
fs.mkdirSync(RUN, { recursive: true });
const HLS_LOG = path.join(RUN, "hls.log");
const ARVAN_LOG = path.join(RUN, "arvan.log");
const HLS_PORT = Number(process.env.E2E_HLS_PORT || 3600);
const ARVAN_PORT = Number(process.env.E2E_ARVAN_PORT || 3399);
const which = process.argv[2] || "both";

const hung = [];
const newState = () => ({ epoch: 0, hangPer: {}, hangNext: 0, hangMode: "body", hangLevel: "", loop: 1, valid: 30000, dropRate: 0, always403: false, cors403: false, fail500: false, corruptSeg: "", corruptMode: "payload", corruptLeft: 0 });
const newStats = () => ({ total: 0, s200: 0, s403: 0, s404: 0, s500: 0, drops: 0, corrupted: 0, arvanCalls: 0 });
// namespace "" = legacy global state (video e2evid…1 / vid-test); other namespaces come from /t/<ms>/n/<ns>/... (vid-<ns> in the Arvan mock)
const states = { "": newState() };
const statsAll = { "": newStats() };
const getNs = (ns) => { if (!states[ns]) { states[ns] = newState(); statsAll[ns] = newStats(); } return [states[ns], statsAll[ns]]; };
const stats = statsAll[""];

const log = (file, obj) => fs.appendFileSync(file, JSON.stringify({ t: new Date().toISOString(), ms: Date.now(), ...obj }) + "\n");

const types = { ".m3u8": "application/vnd.apple.mpegurl", ".ts": "video/mp2t", ".js": "text/javascript", ".html": "text/html" };

/** corrupt a TS segment */
function corrupt(buf, mode) {
  const out = Buffer.from(buf);
  if (mode === "garbage") {
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 256) | 0;
    return out;
  }
  // "payload": keep TS headers + PES-start packets, scramble continuation payload of the video PID (0x100)
  // "allpayload": same for every elementary-stream packet (video+audio)
  for (let off = 0; off + 188 <= out.length; off += 188) {
    if (out[off] !== 0x47) continue;
    const pusi = (out[off + 1] & 0x40) !== 0;
    const pid = ((out[off + 1] & 0x1f) << 8) | out[off + 2];
    const afc = (out[off + 3] >> 4) & 3;
    if (pid === 0 || pid === 0x1000 || pid === 0x11) continue;
    if (mode === "payload" && pid !== 0x100) continue;
    if (pusi) continue;
    let p = off + 4;
    if (afc === 2) continue;
    if (afc === 3) p += 1 + out[off + 4];
    for (let i = p; i < off + 188; i++) out[i] = (Math.random() * 256) | 0;
  }
  return out;
}

if (which === "hls" || which === "both") {
  if (!fs.existsSync(path.join(VOD, "master.m3u8"))) {
    console.error(`no test video at ${VOD} — run tests/e2e/gen-vod.sh first`);
    process.exit(1);
  }
  http
    .createServer((req, res) => {
      const u = new URL(req.url, "http://x");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      if (req.method === "OPTIONS") return res.writeHead(204).end();
      if (u.pathname === "/control") {
        const ns = u.searchParams.get("ns") || "";
        const [state, stats] = getNs(ns);
        if (u.searchParams.get("reset") === "1") { Object.assign(state, newState()); Object.assign(stats, newStats()); }
        // epoch: links minted before it count as minted at `epoch` (emulates a fresh server-side link cache without restarting the app)
        if (u.searchParams.has("epoch")) state.epoch = Number(u.searchParams.get("epoch"));
        if (u.searchParams.has("cors403")) state.cors403 = u.searchParams.get("cors403") === "1";
        if (u.searchParams.has("valid")) state.valid = Number(u.searchParams.get("valid"));
        if (u.searchParams.has("dropRate")) state.dropRate = Number(u.searchParams.get("dropRate"));
        if (u.searchParams.has("always403")) state.always403 = u.searchParams.get("always403") === "1";
        if (u.searchParams.has("loop")) state.loop = Number(u.searchParams.get("loop"));
        if (u.searchParams.has("fail500")) state.fail500 = u.searchParams.get("fail500") === "1";
        if (u.searchParams.has("corruptSeg")) state.corruptSeg = u.searchParams.get("corruptSeg");
        if (u.searchParams.has("corruptMode")) state.corruptMode = u.searchParams.get("corruptMode");
        if (u.searchParams.has("corruptCount")) state.corruptLeft = Number(u.searchParams.get("corruptCount"));
        if (u.searchParams.has("hangNext")) state.hangNext = Number(u.searchParams.get("hangNext"));
        if (u.searchParams.has("hangMode")) state.hangMode = u.searchParams.get("hangMode");
        if (u.searchParams.has("hangLevel")) state.hangLevel = u.searchParams.get("hangLevel");
        if (u.searchParams.has("hang")) for (const kv of u.searchParams.get("hang").split(",")) { const [lv, n] = kv.split(":"); if (lv) state.hangPer[lv] = Number(n || 0); }
        if (u.searchParams.get("releaseHangs") === "1") { while (hung.length) { try { hung.pop().destroy(); } catch {} } }
        log(HLS_LOG, { ns, control: { ...state } });
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ state, stats }));
      }
      if (u.pathname === "/stats") {
        const [state, stats] = getNs(u.searchParams.get("ns") || "");
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ state, stats }));
      }
      // static test assets: probe page (plain hls.js against this mock, no app) + the app's own hls.js build
      if (u.pathname === "/hls.js") {
        let file;
        try { file = require.resolve("hls.js/dist/hls.js", { paths: [REPO] }); } catch { return res.writeHead(404).end("hls.js not installed (pnpm install)"); }
        res.writeHead(200, { "Content-Type": types[".js"] });
        return res.end(fs.readFileSync(file));
      }
      if (u.pathname === "/probe.html") {
        res.writeHead(200, { "Content-Type": types[".html"] });
        return res.end(fs.readFileSync(path.join(DIR, "probe.html")));
      }
      const m = u.pathname.match(/^\/t\/(\d+)\/(?:n\/([a-z0-9]+)\/)?(.+)$/);
      const ns = (m && m[2]) || "";
      const [state, stats] = getNs(ns);
      stats.total++;
      const done = (status, extra = {}) => log(HLS_LOG, { ns: ns || undefined, path: u.pathname, status, ...extra });
      if (!m) {
        stats.s404++;
        done(404);
        return res.writeHead(404).end("not found");
      }
      const token = Number(m[1]);
      const rel = m[3];
      const age = Date.now() - Math.max(token, state.epoch || 0);
      if (state.always403 || age > state.valid) {
        stats.s403++;
        // cors403: CDN answers the expired link with 403 but WITHOUT CORS headers (browser sees status 0)
        if (state.cors403 && !state.always403) { res.removeHeader("Access-Control-Allow-Origin"); res.removeHeader("Access-Control-Allow-Headers"); }
        done(403, { age, always403: state.always403, cors: !(state.cors403 && !state.always403) });
        return res.writeHead(403, { "Content-Type": "text/plain" }).end("expired");
      }
      const file = path.join(VOD, path.normalize(rel));
      if (!file.startsWith(VOD + path.sep) || !fs.existsSync(file)) {
        stats.s404++;
        done(404);
        return res.writeHead(404).end("nf");
      }
      if (rel.endsWith(".ts") && state.fail500) {
        stats.s500++;
        done(500, { age });
        return res.writeHead(500, { "Content-Type": "text/plain" }).end("server error");
      }
      const lvName = rel.split("/")[0];
      if (rel.endsWith(".ts") && ((state.hangNext > 0 && (!state.hangLevel || lvName === state.hangLevel)) || state.hangPer[lvName] > 0)) {
        // silently stalled TCP connection: headers (+ part of the body for hangMode=body) then nothing, socket left open
        if (state.hangPer[lvName] > 0) state.hangPer[lvName]--; else state.hangNext--;
        stats.hangs = (stats.hangs || 0) + 1;
        done("HANG", { age, mode: state.hangMode, level: lvName });
        hung.push(req.socket);
        if (state.hangMode === "head") return; // no response at all
        const buf = fs.readFileSync(file);
        res.writeHead(200, { "Content-Type": types[".ts"], "Content-Length": buf.length });
        res.write(buf.subarray(0, Math.floor(buf.length / 3)));
        return;
      }
      if (rel.endsWith(".ts") && state.dropRate > 0 && Math.random() < state.dropRate) {
        stats.drops++;
        done("DROP", { age });
        // simulate a mid-transfer connection drop: send headers + partial body then destroy
        const buf = fs.readFileSync(file);
        res.writeHead(200, { "Content-Type": types[".ts"], "Content-Length": buf.length });
        res.write(buf.subarray(0, Math.floor(buf.length / 3)));
        setTimeout(() => req.socket.destroy(), 50);
        return;
      }
      let buf = fs.readFileSync(file);
      let status = 200;
      if (state.loop > 1 && /^v\d\/index\.m3u8$/.test(rel)) {
        // longer video: repeat the segment list `loop` times with discontinuities
        const lines = buf.toString("utf8").split("\n");
        const head = lines.slice(0, lines.findIndex((l) => l.startsWith("#EXTINF")));
        const body = lines.slice(head.length).filter((l) => l && l !== "#EXT-X-ENDLIST");
        const out = [...head];
        for (let k = 0; k < state.loop; k++) { if (k) out.push("#EXT-X-DISCONTINUITY"); out.push(...body); }
        out.push("#EXT-X-ENDLIST", "");
        buf = Buffer.from(out.join("\n"));
      }
      if (rel.endsWith(".ts") && state.corruptSeg && path.basename(rel) === state.corruptSeg && state.corruptLeft > 0) {
        state.corruptLeft--;
        stats.corrupted++;
        if (state.corruptMode === "444") {
          // a valid segment the browser cannot decode (H.264 High 4:4:4) — generated by gen-vod.sh for seg025 only
          const bad = path.join(BAD, `${lvName}-${path.basename(rel, ".ts")}-444.ts`);
          buf = fs.existsSync(bad) ? fs.readFileSync(bad) : corrupt(buf, "garbage");
        } else buf = corrupt(buf, state.corruptMode);
        status = "CORRUPT";
      } else stats.s200++;
      done(status, { age });
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Content-Length": buf.length, "Cache-Control": "no-store" });
      res.end(buf);
    })
    .listen(HLS_PORT, "127.0.0.1", () => console.log(`hls mock on ${HLS_PORT} (vod: ${VOD})`));
}

if (which === "arvan" || which === "both") {
  http
    .createServer((req, res) => {
      const u = new URL(req.url, "http://x");
      stats.arvanCalls++;
      const authOk = req.headers.authorization === "Apikey test-key";
      // only whether the (test) key matched is logged, never the header itself
      log(ARVAN_LOG, { method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams), authOk });
      res.setHeader("Content-Type", "application/json");
      if (u.pathname === "/vod/2.0/channels") return res.end(JSON.stringify({ data: [] }));
      const vm = u.pathname.match(/^\/vod\/2\.0\/videos\/vid-(test|ns\d+)$/);
      if (vm) {
        const ns = vm[1] === "test" ? "" : vm[1];
        if (!authOk) return res.writeHead(401).end(JSON.stringify({ message: "unauthorized" }));
        return res.end(
          JSON.stringify({
            data: {
              id: `vid-${vm[1]}`,
              title: "E2E test video",
              status: "complete",
              // token = mint time (ms); the HLS mock answers 403 once the token is older than `valid`
              hls_playlist: `http://127.0.0.1:${HLS_PORT}/t/${Date.now()}/${ns ? `n/${ns}/` : ""}master.m3u8`,
              file_info: { general: { duration: 150 } },
            },
          }),
        );
      }
      res.writeHead(404).end(JSON.stringify({ message: "not found" }));
    })
    .listen(ARVAN_PORT, "127.0.0.1", () => console.log(`arvan mock on ${ARVAN_PORT}`));
}
