/** ساخت آیکون‌های PWA از public/logo.svg */
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/logo.svg");
const bg = { r: 7, g: 10, b: 24, alpha: 1 };

async function icon(size: number, file: string, pad: number, round = false) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
  let base = sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([
    { input: Buffer.from(`<svg width="${size}" height="${size}"><defs><radialGradient id="r" cx=".5" cy=".35" r=".7"><stop stop-color="#3b2a7a"/><stop offset="1" stop-color="#070a18"/></radialGradient></defs><rect width="100%" height="100%" ${round ? `rx="${size * 0.22}"` : ""} fill="url(#r)"/></svg>`) },
    { input: logo, gravity: "center" },
  ]);
  await base.png().toFile(file);
}

(async () => {
  await icon(192, "public/icons/icon-192.png", 0.14);
  await icon(512, "public/icons/icon-512.png", 0.14);
  await icon(512, "public/icons/maskable-512.png", 0.24);
  await icon(192, "public/icons/maskable-192.png", 0.24);
  await icon(180, "public/icons/apple-touch-icon.png", 0.14);
  await icon(64, "public/icons/favicon-64.png", 0.08);
  await icon(96, "public/icons/shortcut-96.png", 0.12);
  console.log("icons ok");
})();
