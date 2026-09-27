import "server-only";
import { db } from "../db";
import { getSetting, getRaw, setRaw } from "../settings";
import { sendPattern, sendSimple, getCredit, type SendResult } from "./provider";
import { SMS_TEMPLATES, MELIPAYAMAK_BODY_IDS, renderTemplate } from "./templates";

type Vars = Record<string, string | number | undefined>;

const TPL_VERSION = 2; // با تغییر متن پیش‌فرض الگوها بالا برود
let ensured = false;
export async function ensureTemplates() {
  if (ensured) return;
  // نسخه‌ی ۲: حذف لینک از متن‌ها (ملی‌پیامک بدون اینماد لینک را رد می‌کند) و هم‌خوانی با الگوهای تأییدشده
  if (Number((await getRaw("sms.tplVersion")) ?? 0) < TPL_VERSION) {
    for (const t of SMS_TEMPLATES) await db.smsTemplate.updateMany({ where: { key: t.key }, data: { body: t.body, name: t.name } });
    await setRaw("sms.tplVersion", TPL_VERSION);
  }
  const existing = await db.smsTemplate.findMany({ select: { key: true, bodyId: true } });
  const have = new Map(existing.map((e) => [e.key, e.bodyId]));
  const missing = SMS_TEMPLATES.filter((t) => !have.has(t.key));
  if (missing.length) await db.smsTemplate.createMany({ data: missing.map((t) => ({ key: t.key, name: t.name, body: t.body, bodyId: MELIPAYAMAK_BODY_IDS[t.key] || null })) });
  // کدهای الگوی ثبت‌شده در کد، برای الگوهایی که در پنل کد ندارند
  for (const [key, bodyId] of Object.entries(MELIPAYAMAK_BODY_IDS)) {
    if (bodyId && have.has(key) && !have.get(key)) await db.smsTemplate.update({ where: { key }, data: { bodyId } });
  }
  ensured = true;
}

async function cfg() {
  const s = await getSetting("sms");
  return s;
}

/** متن یک پیام برای قرار گرفتن در متغیر الگوی عمومی: بدون خط جدید، لینک و امضای تکراری */
function asGeneralVar(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b[\w-]+(\.[\w-]+)*\.(ir|com|net|org)\b/gi, "")
    .replace(/\n\s*دوپینگ شیمی(\s*-\s*جواد پرتویی)?\.?\s*$/, "") // امضای خط آخر (در الگوی عمومی تکرار نشود)
    .replace(/^([^،\n]{1,40}?) عزیز،\s*/, "$1، ") // «کاربر عزیز علی، ...» به‌جای «کاربر عزیز علی عزیز، ...»
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** مقدار متغیر الگو: بدون لینک و خط جدید (ملی‌پیامک رد می‌کند) */
const cleanVar = (v: string) => v.replace(/https?:\/\/\S+/g, "").replace(/\s*\n+\s*/g, " ").trim();

/**
 * ارسال یک الگو به یک شماره:
 *  ۱) اگر کد الگوی خودش ثبت شده → سرویس الگو
 *  ۲) وگرنه اگر الگوی عمومی کد دارد → متن داخل الگوی عمومی («کاربر عزیز ... با تشکر از همراهی شما دوپینگ شیمی»)
 *  ۳) وگرنه ارسال معمولی از خط اختصاصی
 */
export async function sendTemplate(
  key: string,
  to: string,
  vars: Vars,
  meta: { userId?: string; campaignId?: string } = {},
): Promise<SendResult> {
  await ensureTemplates();
  const def = SMS_TEMPLATES.find((t) => t.key === key);
  const tpl = await db.smsTemplate.findUnique({ where: { key } });
  if (!def || !tpl) return { ok: false, error: "الگو یافت نشد" };
  if (!tpl.enabled) return { ok: false, error: "الگو غیرفعال است" };
  const s = await cfg();
  let text = renderTemplate(tpl.body, vars);
  let res: SendResult;
  const general = key !== "general" && s.usePatterns && !tpl.bodyId ? await db.smsTemplate.findUnique({ where: { key: "general" } }) : null;
  if (general && (!general.bodyId || !general.enabled)) general.bodyId = null;
  if (s.provider === "mock") {
    if (general?.bodyId) text = renderTemplate(general.body, { message: asGeneralVar(text) });
    res = { ok: true, providerId: "mock" };
    console.log(`[sms:mock] ${to} → ${text}`);
  } else if (s.usePatterns && tpl.bodyId && def.patternArgs.length) {
    res = await sendPattern(s, to, tpl.bodyId, def.patternArgs.map((a) => cleanVar(String(vars[a] ?? ""))));
  } else if (general?.bodyId) {
    const inner = asGeneralVar(text);
    text = renderTemplate(general.body, { message: inner });
    res = await sendPattern(s, to, general.bodyId, [inner]);
  } else {
    res = await sendSimple(s, to, text);
  }
  await db.smsLog.create({
    data: {
      to,
      userId: meta.userId,
      campaignId: meta.campaignId,
      templateKey: key,
      text,
      status: s.provider === "mock" ? "MOCK" : res.ok ? "SENT" : "FAILED",
      error: res.ok ? null : res.error,
      providerId: res.providerId,
    },
  });
  return res;
}

export interface Recipient {
  id: string;
  phone: string;
  name: string;
  parentPhone?: string | null;
  parentSms?: boolean;
}

/**
 * ارسال گروهی در پس‌زمینه با ثبت کمپین.
 * vars می‌تواند تابعی از گیرنده باشد. includeParents: الگوی والدین هم ارسال شود.
 */
export async function sendBulk(opts: {
  title: string;
  templateKey: string;
  recipients: Recipient[];
  vars: (r: Recipient) => Vars;
  parent?: { templateKey: string; vars: (r: Recipient) => Vars };
}) {
  const s = await cfg();
  const parents = opts.parent && s.parentSms ? opts.recipients.filter((r) => r.parentSms && r.parentPhone) : [];
  const campaign = await db.smsCampaign.create({
    data: {
      title: opts.title,
      templateKey: opts.templateKey,
      text: renderTemplate((await db.smsTemplate.findUnique({ where: { key: opts.templateKey } }))?.body ?? "", opts.recipients[0] ? opts.vars(opts.recipients[0]) : {}),
      total: opts.recipients.length + parents.length,
    },
  });
  // اجرای پس‌زمینه (منتظر نمی‌مانیم)
  void (async () => {
    let sent = 0;
    let failed = 0;
    const jobs: (() => Promise<SendResult>)[] = [
      ...opts.recipients.map((r) => () => sendTemplate(opts.templateKey, r.phone, opts.vars(r), { userId: r.id, campaignId: campaign.id })),
      ...parents.map((r) => () => sendTemplate(opts.parent!.templateKey, r.parentPhone!, opts.parent!.vars(r), { userId: r.id, campaignId: campaign.id })),
    ];
    for (let i = 0; i < jobs.length; i++) {
      const r = await jobs[i]().catch(() => ({ ok: false }) as SendResult);
      if (r.ok) sent++;
      else failed++;
      if (i % 10 === 9 || i === jobs.length - 1) await db.smsCampaign.update({ where: { id: campaign.id }, data: { sent, failed } });
      if (s.provider !== "mock") await new Promise((res) => setTimeout(res, 120));
    }
    await db.smsCampaign.update({ where: { id: campaign.id }, data: { sent, failed, status: "DONE" } });
  })();
  return campaign;
}

export async function smsCredit() {
  return getCredit(await cfg());
}
