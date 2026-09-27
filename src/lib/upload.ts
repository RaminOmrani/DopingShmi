import "server-only";
import sharp from "sharp";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
const MAX_BYTES = 25 * 1024 * 1024;

export interface SavedImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

/** ذخیره تصویر به WebP بهینه + بندانگشتی */
export async function saveImage(file: File, folder = "photos", maxWidth = 2200): Promise<SavedImage> {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("فایل ارسال نشده است");
  if (file.size > MAX_BYTES) throw new Error("حجم فایل بیش از ۲۵ مگابایت است");
  if (!/^image\//.test(file.type)) throw new Error("فقط فایل تصویری مجاز است");
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, folder);
  await mkdir(dir, { recursive: true });
  const id = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const img = sharp(buf, { failOn: "none" }).rotate();
  const main = await img.clone().resize({ width: maxWidth, height: maxWidth, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const thumb = await img.clone().resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, `${id}.webp`), main.data);
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, `${id}.t.webp`), thumb);
  return { url: `/uploads/${folder}/${id}.webp`, thumbUrl: `/uploads/${folder}/${id}.t.webp`, width: main.info.width, height: main.info.height };
}

export async function removeUpload(url?: string | null) {
  if (!url || !url.startsWith("/uploads/")) return;
  const p = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, url.slice("/uploads/".length));
  if (!p.startsWith(UPLOAD_DIR)) return;
  await unlink(p).catch(() => {});
  if (p.endsWith(".webp") && !p.endsWith(".t.webp")) await unlink(p.replace(/\.webp$/, ".t.webp")).catch(() => {});
}
