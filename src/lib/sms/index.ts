import "server-only";
import { db } from "../db";
import { getSetting } from "../settings";
import { sendPattern, sendSimple, getCredit, type SendResult } from "./provider";
import { SMS_TEMPLATES, renderTemplate } from "./templates";

type Vars = Record<string, string | number | undefined>;

export async function ensureTemplates() {
  const existing = await db.smsTemplate.findMany({ select: { key: true } });
  const have = new Set(existing.map((e) => e.key));
  const missing = SMS_TEMPLATES.filter((t) => !have.has(t.key));
  if (missing.length) await db.smsTemplate.createMany({ data: missing.map((t) => ({ key: t.key, name: t.name, body: t.body })) });
}

async function cfg() {
  const s = await getSetting("sms");
  return s;
}

/** ارسال یک الگو به یک شماره. اگر کد الگو ثبت شده باشد از سرویس الگو، وگرنه ارسال معمولی. */
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
  const text = renderTemplate(tpl.body, vars);
  let res: SendResult;
  if (s.provider === "mock") {
    res = { ok: true, providerId: "mock" };
    console.log(`[sms:mock] ${to} → ${text}`);
  } else if (s.usePatterns && tpl.bodyId && def.patternArgs.length) {
    res = await sendPattern(s, to, tpl.bodyId, def.patternArgs.map((a) => String(vars[a] ?? "")));
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
