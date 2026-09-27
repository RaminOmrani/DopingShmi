import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { db } from "./db";
import { getRaw, setRaw } from "./settings";

export const SESSION_COOKIE = "ds_session";
const MAX_AGE = 60 * 60 * 24 * 60; // ۶۰ روز

let secretCache: Uint8Array | null = null;
async function secret() {
  if (secretCache) return secretCache;
  let s = process.env.AUTH_SECRET;
  if (!s) {
    s = (await getRaw("auth.secret")) as string | null ?? undefined;
    if (!s) {
      s = randomBytes(48).toString("base64url");
      await setRaw("auth.secret", s);
    }
  }
  secretCache = new TextEncoder().encode(s);
  return secretCache;
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(await secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getUser() {
  const id = await sessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, include: { classGroup: true } });
  if (!user || user.blocked) return null;
  return user;
}
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export const isAdmin = (u: { role: string } | null | undefined) => u?.role === "ADMIN" || u?.role === "STAFF";
export const isClassStudent = (u: { classStatus: string } | null | undefined) => u?.classStatus === "APPROVED";

/** برای صفحات: کاربر لاگین‌نکرده به صفحه ورود می‌رود */
export async function requireUser(opts: { allowIncomplete?: boolean } = {}) {
  const u = await getUser();
  if (!u) redirect("/login");
  if (!opts.allowIncomplete && !u.profileDone && !isAdmin(u)) redirect("/register");
  return u;
}

export async function requireAdmin() {
  const u = await getUser();
  if (!u) redirect("/login?next=/admin");
  if (!isAdmin(u)) redirect("/panel");
  return u;
}

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const hashOtp = (phone: string, code: string) => createHash("sha256").update(`${phone}:${code}`).digest("hex");
