/**
 * ساخت نسخه‌های لوگوی Dp در public/brand (یک‌بار مصرف؛ خروجی در مخزن هست):
 *   npx -p opentype.js@1 node scripts/make-logo.mjs public/brand
 * متن‌ها با فونت Liberation Sans Bold به مسیر (path) تبدیل می‌شوند تا به فونت سیستم وابسته نباشند.
 */
import opentype from "opentype.js";
import fs from "node:fs";
const font = opentype.loadSync("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf");
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });

/** مسیر متن با فاصله‌ی حروف دلخواه؛ anchor: start|middle|end */
function textPath(str, x, y, size, anchor = "start", spacing = 0) {
  const glyphs = font.stringToGlyphs(str);
  const scale = size / font.unitsPerEm;
  let width = 0;
  glyphs.forEach((g, i) => { width += g.advanceWidth * scale + (i < glyphs.length - 1 ? spacing : 0); });
  let cx = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  let d = "";
  glyphs.forEach((g) => { d += g.getPath(cx, y, size).toPathData(2); cx += g.advanceWidth * scale + spacing; });
  return d;
}
const T = {
  num: textPath("10", 102, 36, 16, "end"),
  dp: textPath("Dp", 64, 84, 50, "middle", -2),
  doping: textPath("DOPING", 64, 104, 11, "middle", 3),
};
const BOLT = "M30 22 23 37h6l-3 11 10-16h-6l3-10z";
const GRAD = `<linearGradient id="g" x1="8" y1="8" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop stop-color="#22d3ee"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#e879f9"/></linearGradient>`;
const GRAD_D = `<linearGradient id="g" x1="8" y1="8" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop stop-color="#0e7490"/><stop offset=".55" stop-color="#7c3aed"/><stop offset="1" stop-color="#c026d3"/></linearGradient>`;

const tile = ({ inner, dpFill, numFill, textFill, textOp = 0.75, bolt = "#fbbf24", grad = GRAD, frame = "url(#g)" }) =>
  `<rect x="8" y="8" width="112" height="112" rx="26" fill="${frame}"/>` +
  `<rect x="13" y="13" width="102" height="102" rx="22" fill="${inner}"/>` +
  `<path d="${T.num}" fill="${numFill}"/><path d="${T.dp}" fill="${dpFill}"/><path d="${T.doping}" fill="${textFill}" fill-opacity="${textOp}"/><path d="${BOLT}" fill="${bolt}"/>`;

const svg = (body, defs = GRAD, vb = "0 0 128 128") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs>${defs}</defs>${body}</svg>\n`;

const variants = {
  // اصلی: برای زمینه‌ی تیره یا هر جایی
  "dp-logo": svg(tile({ inner: "#0b1026", dpFill: "url(#g)", numFill: "#67e8f9", textFill: "#fff" })),
  // نسخه‌ی روشن: داخل سفید برای چاپ و زمینه‌ی روشن
  "dp-logo-light": svg(tile({ inner: "#ffffff", dpFill: "url(#g)", numFill: "#0e7490", textFill: "#0f172a", textOp: 0.7, bolt: "#f59e0b" }), GRAD_D),
  // تک‌رنگ سفید (روی عکس یا زمینه‌ی رنگی)
  "dp-logo-white": svg(`<rect x="10.5" y="10.5" width="107" height="107" rx="24" fill="none" stroke="#fff" stroke-width="5"/><path d="${T.num}" fill="#fff"/><path d="${T.dp}" fill="#fff"/><path d="${T.doping}" fill="#fff"/><path d="${BOLT}" fill="#fff"/>`, ""),
  // تک‌رنگ مشکی (مهر، فکس، چاپ یک‌رنگ)
  "dp-logo-black": svg(`<rect x="10.5" y="10.5" width="107" height="107" rx="24" fill="none" stroke="#0f172a" stroke-width="5"/><path d="${T.num}" fill="#0f172a"/><path d="${T.dp}" fill="#0f172a"/><path d="${T.doping}" fill="#0f172a"/><path d="${BOLT}" fill="#0f172a"/>`, ""),
  // آیکون اپ (مربع کامل با پس‌زمینه) — برای PWA و استور
  "dp-app-icon": svg(`<rect width="128" height="128" fill="url(#bg)"/><g transform="translate(14 14) scale(.78125)">${tile({ inner: "#0b1026", dpFill: "url(#g)", numFill: "#67e8f9", textFill: "#fff" })}</g>`, GRAD + `<radialGradient id="bg" cx=".5" cy=".35" r=".75"><stop stop-color="#3b2a7a"/><stop offset="1" stop-color="#070a18"/></radialGradient>`),
  // آیکون maskable (حاشیه‌ی امن بیشتر برای اندروید)
  "dp-maskable": svg(`<rect width="128" height="128" fill="url(#bg)"/><g transform="translate(25.6 25.6) scale(.6)">${tile({ inner: "#0b1026", dpFill: "url(#g)", numFill: "#67e8f9", textFill: "#fff" })}</g>`, GRAD + `<radialGradient id="bg" cx=".5" cy=".35" r=".75"><stop stop-color="#3b2a7a"/><stop offset="1" stop-color="#070a18"/></radialGradient>`),
};
for (const [name, s] of Object.entries(variants)) fs.writeFileSync(`${out}/${name}.svg`, s);
console.log(Object.keys(variants).join(" "));
