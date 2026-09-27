import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { zpVerify } from "@/lib/zarinpal";
import { fulfill } from "@/lib/purchase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.SITE_URL || url.origin;
  const pid = url.searchParams.get("pid") ?? "";
  const authority = url.searchParams.get("Authority") ?? "";
  const status = url.searchParams.get("Status");
  const payment = await db.payment.findUnique({ where: { id: pid } });
  const back = (ok: boolean, msg?: string) => NextResponse.redirect(`${origin}/panel/pay?ok=${ok ? 1 : 0}&pid=${pid}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}`);
  if (!payment || payment.authority !== authority) return back(false, "تراکنش نامعتبر است");
  if (payment.status === "PAID") return back(true);
  if (status !== "OK") {
    await db.payment.update({ where: { id: pid }, data: { status: "FAILED", error: "انصراف از پرداخت" } });
    return back(false, "پرداخت انجام نشد");
  }
  const v = await zpVerify(await getSetting("payment"), { amount: payment.amount, authority });
  if (!v.ok) {
    await db.payment.update({ where: { id: pid }, data: { status: "FAILED", error: v.error } });
    return back(false, v.error);
  }
  await fulfill(pid, v.refId ?? null);
  return back(true);
}
