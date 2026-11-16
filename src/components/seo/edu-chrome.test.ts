/** آزمون قطعه‌های مشترک صفحه‌های آموزشی (اجرا: pnpm test:chem) */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumbs, Byline, Callout, RelatedLinks, RouteLink, SoftCta, jalaliLong } from "./EduChrome";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { TEACHER_CREDENTIAL, crumbsFor, route } from "../../lib/site-routes";

// مسیرهایی که هرگز live نیستند (زیرمسیر ثبت‌نشده در فضای نام صفحه‌های برنامه‌ریزی‌شده)
const NOT_LIVE = "/azmoon-shimi/dahom-fasl-4";
const NOT_LIVE_2 = "/shimi-dahom/fasl-4";

const s = DEFAULT_SETTINGS.site;
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("تاریخ شمسی", () => {
  assert.equal(jalaliLong("2026-11-16"), "۲۵ آبان ۱۴۰۵");
  assert.equal(jalaliLong("2026-03-21"), "۱ فروردین ۱۴۰۵");
});

test("RouteLink: فقط مسیر live لینک می‌شود", () => {
  assert.equal(html(h(RouteLink, { path: "/shimi-dahom", className: "x", children: "شیمی دهم" })), '<a class="x" href="/shimi-dahom">شیمی دهم</a>');
  assert.equal(html(h(RouteLink, { path: NOT_LIVE, className: "x", children: "آزمون" })), '<span class="x">آزمون</span>');
  assert.equal(html(h(RouteLink, { path: NOT_LIVE, fallback: null, children: "آزمون" })), "");
});

test("Callout: محتوای خالی و «نکته استاد» بدون متن پنهان است", () => {
  assert.equal(html(h(Callout, { kind: "teacher" }, "")), "");
  assert.equal(html(h(Callout, { kind: "teacher" }, [])), "");
  assert.equal(html(h(Callout, { kind: "teacher" })), "");
  const tip = html(h(Callout, { kind: "konkur" }, "متن"));
  assert.match(tip, /^<aside role="note"/);
  assert.match(tip, /نکته‌ی تستی/);
  assert.match(html(h(Callout, { kind: "mistake" }, "x")), /اشتباه رایج/);
  assert.match(html(h(Callout, { kind: "example" }, "x")), /مثال/);
});

test("RelatedLinks: لینک غیر live حذف و بخش خالی پنهان می‌شود", () => {
  assert.equal(html(h(RelatedLinks, { links: [NOT_LIVE, NOT_LIVE_2] })), "");
  const out = html(h(RelatedLinks, { links: [NOT_LIVE, "/shimi-konkur"] }));
  assert.match(out, /href="\/shimi-konkur"/);
  assert.ok(!out.includes(NOT_LIVE));
  assert.match(out, />شیمی کنکور</);
});

test("Breadcrumbs و Byline", () => {
  const bc = html(h(Breadcrumbs, { items: crumbsFor("/shimi-dahom/fasl-1") }));
  assert.match(bc, /href="\/shimi-dahom"/);
  assert.match(bc, /aria-current="page"[^>]*>فصل اول</);
  const by = html(h(Byline, { s, path: "/shimi-dahom/fasl-1" }));
  assert.match(by, /نویسنده: <a[^>]*>دوپینگ شیمی<\/a>/);
  assert.ok(!by.includes("بازبینی علمی:"), "تا تأیید استاد، امضا سازمانی است");
  assert.ok(!by.includes(TEACHER_CREDENTIAL));
  assert.match(by, new RegExp(`<time dateTime="${route("/shimi-dahom/fasl-1")!.updated}">`));
  const soft = html(h(SoftCta, { s }));
  assert.match(soft, /href="\/tadris-shimi"[^>]*>کلاس خصوصی شیمی در مشهد</);
  assert.ok(!soft.includes("لیسانس") && !by.includes("لیسانس"));
});
