import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck, ChevronDown, ChevronLeft, ClipboardList, FileCheck2, Globe, MapPin, Megaphone, MessageCircle, Phone, PlayCircle, UserRound, Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { canonicalUrl, eduGraph, pageMeta } from "@/lib/page-meta";
import { LD_ID, ldRef } from "@/lib/seo";
import { GRADE_LIST } from "@/lib/syllabus";
import { TEACHER_CREDENTIAL, crumbsFor } from "@/lib/site-routes";
import { gradeLabel } from "@/lib/constants";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Byline } from "@/components/seo/EduChrome";
import { faNum } from "@/lib/utils";

export const revalidate = 300;

const PATH = "/tadris-shimi";
/**
 * کلاس آنلاین برای شهرهای دیگر: تا مالک سایت تأیید نکرده false بماند (صفحه همان ادعاهای قبلی را دارد:
 * کلاس‌ها در شهر خود استاد و ویدیوها در اپلیکیشن). با true، کارت «کلاس آنلاین» و areaServed «ایران» اضافه می‌شود.
 */
const ONLINE_CLASSES = false;

/** خط مدرک تحصیلی از فهرست سوابق تنظیمات کنار گذاشته می‌شود تا همیشه متن دقیق TEACHER_CREDENTIAL نمایش داده شود */
const isDegreeLine = (c: string) => /کارشناسی|لیسانس/.test(c);

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetting("site");
  const city = s.city || "مشهد";
  return pageMeta({
    title: `کلاس خصوصی شیمی و دبیر شیمی کنکور در ${city} | ${s.brand}`,
    description: `کلاس خصوصی و گروهی شیمی در ${city} با استاد ${s.teacherName}، دبیر شیمی کنکور: شیمی دهم، یازدهم و دوازدهم، همایش جمع‌بندی و راهنمای انتخاب معلم خصوصی.`,
    path: PATH,
  });
}

export default async function TadrisPage() {
  const [s, topics] = await Promise.all([
    getSetting("site"),
    db.topic
      .findMany({ where: { published: true }, orderBy: [{ grade: "asc" }, { order: "asc" }], select: { id: true, title: true, grade: true } })
      .catch(() => []),
  ]);
  const city = s.city || "مشهد";
  const phone = s.phone ? faNum(s.phone) : "";
  const crumbs = crumbsFor(PATH);
  const otherCreds = s.credentials.filter((c) => !isDegreeLine(c));
  const address = s.address && s.address.trim() !== city ? s.address : "";
  const messengers = [s.telegram && "تلگرام", s.bale && "بله"].filter(Boolean).join(" و ");

  const services = [
    { icon: UserRound, t: "کلاس خصوصی شیمی", d: "تک‌نفره و متناسب با سطح و هدف دانش‌آموز؛ از رفع اشکال یک مبحث تا برنامه‌ی کامل امتحان نهایی و کنکور." },
    { icon: Users, t: "کلاس گروهی شیمی", d: "کلاس‌های دهم، یازدهم، دوازدهم و کنکور در مدرسه و آموزشگاه." },
    { icon: Megaphone, t: "همایش جمع‌بندی", d: "همایش‌های نکته و تست و جمع‌بندی شیمی پیش از امتحان‌ها و کنکور." },
    ...(ONLINE_CLASSES ? [{ icon: Globe, t: "کلاس آنلاین برای شهرهای دیگر", d: "کلاس خصوصی آنلاین برای دانش‌آموزانی که در شهر دیگری زندگی می‌کنند." }] : []),
    { icon: PlayCircle, t: "ویدیوی آموزشی", d: "تدریس مبحث‌به‌مبحث در اپلیکیشن، همراه با جلسه‌های رایگان؛ از هر شهری در دسترس است." },
    { icon: FileCheck2, t: "آزمون و کارنامه", d: "آزمون‌های منظم با تحلیل درصد، تراز و مقایسه با گروه." },
  ];

  const firstSteps = [
    { t: "تماس و هماهنگی", d: `با ${phone ? `شماره‌ی ${phone}` : "پشتیبانی"} تماس بگیرید یا پیام بدهید و پایه، رشته، هدف (امتحان مدرسه، امتحان نهایی یا کنکور) و زمان‌های آزادتان را بگویید.` },
    { t: "بررسی سطح و هدف", d: "در شروع کار، وضعیت دانش‌آموز در مبحث‌های پایه‌ای مثل مول، آرایش الکترونی و استوکیومتری و نمره‌های اخیرش بررسی می‌شود تا کلاس از نقطه‌ی درست شروع شود." },
    { t: "برنامه‌ی جلسه‌ها", d: "بر اساس هدف و فاصله تا امتحان، ترتیب مبحث‌ها و برنامه‌ی جلسه‌ها چیده می‌شود؛ کلاس خصوصی برای هر دانش‌آموز جداگانه برنامه‌ریزی می‌شود." },
    { t: "یادآوری جلسه", d: "زمان هر جلسه در پنل دانش‌آموز ثبت و پیش از کلاس برای دانش‌آموز و در صورت تمایل برای والدین پیامک می‌شود." },
    { t: "پیگیری پیشرفت", d: "نتیجه‌ی آزمون‌ها، زمان مطالعه و ویدیوهای دیده‌شده در پنل دانش‌آموز به‌صورت نمودار دیده می‌شود." },
  ];

  const suits = [
    "دانش‌آموزانی که در یک مبحث پایه، مثل مول یا استوکیومتری، عقب مانده‌اند و کلاس مدرسه جلو رفته است.",
    "داوطلبانی که با وجود مطالعه، درصد شیمی‌شان در آزمون‌ها بالا نمی‌رود و تحلیل دقیق اشتباه‌ها را لازم دارند.",
    "دانش‌آموزان دوازدهم که می‌خواهند امتحان نهایی و کنکور را با یک برنامه‌ی واحد پیش ببرند.",
    "فارغ‌التحصیلانی که برای کنکور، شیمی را دوباره از پایه شروع می‌کنند.",
    "دانش‌آموزان دهم و یازدهم که می‌خواهند از همان سال اول، شیمی را با نگاه کنکوری بخوانند.",
  ];

  const guide = [
    { t: "تسلط بر کتاب درسی فعلی", d: "کتاب‌های شیمی چند بار بازنگری شده‌اند و بخشی از مطالب جابه‌جا یا حذف شده است. بپرسید معلم با کدام چاپ کتاب درس می‌دهد و تغییرهای اخیر را می‌شناسد یا نه." },
    { t: "تجربه در همان هدف", d: "تدریس برای امتحان مدرسه، امتحان نهایی و کنکور هر کدام مهارت خودش را دارد؛ معلمی را انتخاب کنید که در هدف شما سابقه‌ی روشن دارد." },
    { t: "برنامه‌ی روشن", d: "کلاس خوب از همان ابتدا هدف و ترتیب مبحث‌ها را روشن می‌کند و هر جلسه خروجی مشخصی دارد، نه فقط حل چند تمرین پراکنده." },
    { t: "تمرین و آزمون بین جلسه‌ها", d: "پیشرفت واقعی بین جلسه‌ها اتفاق می‌افتد؛ بپرسید تمرین‌ها و آزمون‌های میان جلسه‌ها چطور تعیین و بررسی می‌شوند." },
    { t: "گزارش شفاف به خانواده", d: "والدین باید بدون حدس و گمان بدانند فرزندشان کجای مسیر است: نمره‌ی آزمون‌ها و روند پیشرفت، به‌صورت منظم." },
    { t: "شیوه‌ی توضیح", d: "معلم خوب مفهوم را پیش از فرمول توضیح می‌دهد. یک گفت‌وگوی کوتاه کافی است تا ببینید شیوه‌ی توضیح او با دانش‌آموز جور است یا نه." },
  ];
  const askBefore = ["با کدام چاپ کتاب درسی تدریس می‌کنید؟", "برای هدف ما چه برنامه‌ای پیشنهاد می‌کنید؟", "پیشرفت را چطور و هر چند وقت گزارش می‌دهید؟", "اگر جلسه‌ای لغو شود چه می‌شود؟", "هزینه برای چه تعداد جلسه است؟"];

  const faqs = [
    {
      q: `کلاس شیمی در ${city} حضوری است یا آنلاین هم دارید؟`,
      a: ONLINE_CLASSES
        ? `کلاس‌های خصوصی و گروهی و همایش‌ها در ${city} برگزار می‌شوند و برای دانش‌آموزان شهرهای دیگر کلاس خصوصی آنلاین هم داریم. ویدیوهای آموزشی اپلیکیشن ${s.brand} هم از هر شهری در دسترس است.`
        : `کلاس‌های خصوصی و گروهی و همایش‌ها در ${city} برگزار می‌شوند. دانش‌آموزان شهرهای دیگر می‌توانند از ویدیوهای آموزشی اپلیکیشن ${s.brand} استفاده کنند؛ برای شرایط دیگر تماس بگیرید.`,
    },
    { q: "کلاس خصوصی شیمی برای کدام پایه‌ها و رشته‌هاست؟", a: "شیمی دهم، یازدهم و دوازدهم در رشته‌های تجربی و ریاضی، هم برای امتحان‌های مدرسه و امتحان نهایی و هم برای آمادگی کنکور سراسری؛ شامل آموزش مفهومی، حل تمرین و تست‌های کنکوری." },
    { q: "کلاس گروهی و همایش شیمی کی و کجا برگزار می‌شود؟", a: `کلاس‌های گروهی در مدرسه و آموزشگاه و همایش‌های جمع‌بندی شیمی پیش از امتحان‌ها و کنکور برگزار می‌شوند. زمان و مکان هر دوره در اپلیکیشن ${s.brand} و با پیامک اعلام می‌شود و عکس همایش‌های گذشته در گالری سایت آمده است.` },
    { q: "آیا ویدیوی آموزشی شیمی هم هست؟", a: `بله. ویدیوهای تدریس مبحث‌به‌مبحث در اپلیکیشن ${s.brand} قرار دارد و برخی جلسه‌ها رایگان‌اند. شاگردان کلاس‌های استاد پس از تأیید عضویت به همه‌ی ویدیوها دسترسی دارند.` },
    { q: "والدین چطور پیشرفت دانش‌آموز را دنبال می‌کنند؟", a: "هر دانش‌آموز در پنل خود نتیجه‌ی آزمون‌ها، روند پیشرفت یا پسرفت نسبت به گروه، زمان مطالعه و ویدیوهای دیده‌شده را به‌صورت نمودار می‌بیند و والدین می‌توانند همین گزارش را همراه او ببینند." },
    { q: "برای ثبت‌نام کلاس خصوصی شیمی چه کار کنم؟", a: `${phone ? `با شماره‌ی ${phone} تماس بگیرید${messengers ? ` یا در ${messengers} پیام بدهید` : ""}.` : "از راه‌های تماس همین صفحه پیام بدهید."} اگر شاگرد کلاس‌ها هستید، در اپلیکیشن ثبت‌نام کنید و از بخش پروفایل درخواست عضویت در کلاس را بفرستید تا پس از تأیید، دسترسی شما فعال شود.` },
  ];

  const serviceId = `${canonicalUrl(PATH)}#service`;
  const areaServed: object[] = [{ "@type": "City", name: city }, ...(ONLINE_CLASSES ? [{ "@type": "Country", name: "ایران" }] : [])];
  const ld = eduGraph(s, {
    path: PATH,
    title: `کلاس خصوصی شیمی و دبیر شیمی کنکور در ${city}`,
    description: `کلاس خصوصی و گروهی شیمی دهم، یازدهم، دوازدهم و کنکور در ${city} با استاد ${s.teacherName}.`,
    type: "WebPage",
    breadcrumb: crumbs,
    about: ldRef(serviceId),
    extra: { mainEntity: ldRef(serviceId) },
    nodes: [
      {
        "@type": "Service",
        "@id": serviceId,
        name: `کلاس خصوصی و گروهی شیمی در ${city}`,
        serviceType: "تدریس خصوصی و گروهی شیمی دبیرستان و کنکور",
        url: canonicalUrl(PATH),
        provider: [ldRef(LD_ID.teacher), ldRef(LD_ID.org)],
        areaServed,
        audience: { "@type": "EducationalAudience", educationalRole: "student", audienceType: "دانش‌آموزان پایه‌ی دهم تا دوازدهم و داوطلبان کنکور" },
        ...(s.phone ? { availableChannel: { "@type": "ServiceChannel", servicePhone: { "@type": "ContactPoint", telephone: s.phone, contactType: "ثبت‌نام و مشاوره" } } } : {}),
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "کلاس‌های شیمی",
          itemListElement: services.map((x) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: x.t, description: x.d } })),
        },
      },
    ],
  });

  return (
    <main className="mx-auto max-w-6xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <p className="mb-3 text-sm font-bold text-cyan">{s.brand} · {city}</p>
      <h1 className="section-title mb-4">
        کلاس خصوصی شیمی {city} و تدریس شیمی کنکور با <span className="text-gradient">استاد {s.teacherName}</span>
      </h1>
      <Byline s={s} path={PATH} />
      <p className="mb-4 max-w-3xl leading-9 text-white/75">
        استاد {s.teacherName}، دبیر شیمی {city} و مدرس شیمی کنکور، کلاس خصوصی و گروهی شیمی دهم، یازدهم و دوازدهم و کلاس‌های آمادگی کنکور را در {city} برگزار
        می‌کند. اگر دنبال معلم شیمی کنکور در {city} هستید یا برای فرزندتان کلاس خصوصی شیمی می‌خواهید، در این صفحه انواع کلاس، روند شروع، شیوه‌ی تعیین
        هزینه، معیارهای انتخاب معلم خصوصی و راه‌های تماس را می‌خوانید.
      </p>
      <p className="mb-8 max-w-3xl leading-9 text-white/75">
        {s.brand} مجموعه‌ی آموزشی استاد {s.teacherName} است و تدریس شیمی در اینجا یعنی فهم مفهومی، تسلط بر تست و برنامه‌ی دقیق؛ از شیمی دهم تا جمع‌بندی کنکور.
      </p>
      <div className="mb-14 flex flex-wrap gap-3">
        {s.phone && (
          <a href={`tel:${s.phone}`} className="btn-primary">
            <Phone aria-hidden className="size-4" /> مشاوره و ثبت‌نام: <bdi dir="ltr">{phone}</bdi>
          </a>
        )}
        <Link href="/login?mode=signup" rel="nofollow" className="btn-ghost">ثبت‌نام در اپلیکیشن</Link>
      </div>

      <section className="mb-14" aria-labelledby="anva">
        <h2 id="anva" className="mb-5 text-2xl font-black">انواع کلاس‌ها و خدمات آموزشی</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((x) => (
            <div key={x.t} className="card p-5">
              <x.icon aria-hidden className="mb-3 size-8 text-cyan" strokeWidth={1.6} />
              <h3 className="mb-1 font-black">{x.t}</h3>
              <p className="text-sm leading-7 text-white/65">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-14 grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="jalase-aval">
          <h2 id="jalase-aval" className="mb-4 text-xl font-black">شروع کلاس خصوصی چطور است؟</h2>
          <ol className="grid gap-3">
            {firstSteps.map((x, i) => (
              <li key={x.t} className="flex gap-3 leading-8 text-white/75">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cyan/15 text-sm font-black text-cyan">{faNum(i + 1)}</span>
                <p>
                  <b className="text-white/90">{x.t}:</b> {x.d}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section className="card p-6" aria-labelledby="monaseb">
          <h2 id="monaseb" className="mb-4 text-xl font-black">کلاس خصوصی شیمی برای چه کسانی مناسب است؟</h2>
          <ul className="list-disc space-y-2 pr-5 leading-8 text-white/75 marker:text-cyan">
            {suits.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <p className="mt-4 text-sm leading-7 text-white/60">
            برای رفع اشکال‌های پراکنده گاهی چند جلسه کافی است؛ برای برنامه‌ی کامل کنکور، کلاس منظم در طول سال نتیجه‌ی بهتری دارد.
          </p>
        </section>
      </div>

      <section className="mb-14" aria-labelledby="hazine">
        <h2 id="hazine" className="mb-4 text-2xl font-black">هزینه‌ی کلاس چطور تعیین می‌شود؟</h2>
        <p className="max-w-3xl leading-9 text-white/75">
          هزینه‌ی کلاس خصوصی شیمی عدد ثابتی برای همه نیست و به نوع کلاس (خصوصی یا گروهی) و تعداد و مدت جلسه‌ها بستگی دارد. هزینه‌ی دقیق پیش از شروع و
          هنگام هماهنگی تلفنی اعلام می‌شود تا آن را با برنامه‌ی پیشنهادی بسنجید. قیمت ویدیوهای آموزشی جداست و برای هر مبحث یا بسته در بخش{" "}
          <Link href="/courses" className="font-bold text-cyan hover:underline">ویدیوهای آموزش شیمی</Link> نوشته شده است.
        </p>
      </section>

      <section className="mb-14" aria-labelledby="rahnama">
        <h2 id="rahnama" className="mb-3 text-2xl font-black">راهنمای انتخاب معلم خصوصی شیمی</h2>
        <p className="mb-5 max-w-3xl leading-9 text-white/75">
          چه کلاس ما را انتخاب کنید چه نه، این معیارها به شما و خانواده کمک می‌کند معلم خصوصی شیمی مناسب را پیدا کنید:
        </p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guide.map((x) => (
            <div key={x.t} className="card p-5">
              <h3 className="mb-2 flex items-center gap-2 font-black">
                <BadgeCheck aria-hidden className="size-4 shrink-0 text-cyan" /> {x.t}
              </h3>
              <p className="text-sm leading-7 text-white/70">{x.d}</p>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-black">
            <ClipboardList aria-hidden className="size-4 shrink-0 text-amber" /> پرسش‌هایی که پیش از ثبت‌نام بپرسید
          </h3>
          <ul className="grid gap-2 text-sm leading-7 text-white/75 sm:grid-cols-2">
            {askBefore.map((x) => <li key={x}>• {x}</li>)}
          </ul>
        </div>
      </section>

      <section className="mb-14 grid gap-6 lg:grid-cols-2" aria-label="سوابق و تماس">
        <div className="card p-6">
          <h2 className="mb-4 text-xl font-black">چرا استاد {s.teacherName}؟</h2>
          <ul className="list-disc space-y-2 pr-5 leading-8 text-white/75 marker:text-cyan">
            <li>{TEACHER_CREDENTIAL}</li>
            {otherCreds.map((c) => <li key={c}>{c}</li>)}
          </ul>
          {s.highlights.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-black text-white/85">رتبه‌های برتر شاگردان</h3>
              <ul className="flex flex-wrap gap-2">
                {s.highlights.map((h) => (
                  <li key={h.label} className="chip">
                    <b className="text-white/90">{faNum(h.value)}</b> {h.label}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link href="/javad-partovi" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-cyan">
            معرفی و سوابق استاد {s.teacherName} <ChevronLeft aria-hidden className="size-4" />
          </Link>
        </div>
        <div className="card p-6" id="tamas">
          <h2 className="mb-4 text-xl font-black">اطلاعات تماس و محل برگزاری</h2>
          <address className="grid gap-3 not-italic leading-8 text-white/75">
            <p className="font-bold text-white/90">{s.brand}، استاد {s.teacherName}</p>
            <p className="flex items-start gap-2">
              <MapPin aria-hidden className="mt-2 size-4 shrink-0 text-cyan" />
              <span>
                {city}
                {address && `، ${address}`}
                {s.mapUrl && (
                  <>
                    {" · "}
                    <a href={s.mapUrl} target="_blank" rel="noopener" className="text-cyan hover:underline">مسیر روی نقشه</a>
                  </>
                )}
              </span>
            </p>
            {s.phone && (
              <p className="flex items-center gap-2">
                <Phone aria-hidden className="size-4 shrink-0 text-cyan" />
                <a href={`tel:${s.phone}`} className="hover:text-cyan"><bdi dir="ltr">{phone}</bdi></a>
              </p>
            )}
            {(s.telegram || s.bale) && (
              <p className="flex items-center gap-2">
                <MessageCircle aria-hidden className="size-4 shrink-0 text-cyan" />
                <span>
                  پیام در{" "}
                  {s.telegram && <a href={s.telegram} target="_blank" rel="noopener" className="text-cyan hover:underline">تلگرام</a>}
                  {s.telegram && s.bale && " و "}
                  {s.bale && <a href={s.bale} target="_blank" rel="noopener" className="text-cyan hover:underline">بله</a>}
                </span>
              </p>
            )}
          </address>
        </div>
      </section>

      {topics.length > 0 && (
        <section className="mb-14" aria-labelledby="sarfasl">
          <h2 id="sarfasl" className="mb-5 text-2xl font-black">سرفصل‌های تدریس شیمی</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {["G10", "G11", "G12", "ALL"].map((g) => {
              const list = topics.filter((t) => t.grade === g);
              if (!list.length) return null;
              return (
                <div key={g} className="card p-5">
                  <h3 className="mb-3 font-black">شیمی {gradeLabel(g)}</h3>
                  <ul className="space-y-2 text-sm">
                    {list.map((t) => (
                      <li key={t.id}>
                        <Link href={`/courses/${t.id}`} className="text-white/75 hover:text-cyan">{t.title}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-14" aria-labelledby="rahnama-paye">
        <h2 id="rahnama-paye" className="mb-5 text-2xl font-black">راهنمای آموزش شیمی هر پایه</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{ href: "/shimi-konkur", t: "شیمی کنکور" }, ...GRADE_LIST.map((g) => ({ href: g.path, t: `آموزش شیمی ${g.name}` }))].map((l) => (
            <Link key={l.href} href={l.href} className="card flex items-center justify-between p-4 font-bold hover:border-cyan/30">
              {l.t}
              <ChevronLeft aria-hidden className="size-4 text-white/40" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-14" aria-labelledby="porsesh-ha">
        <h2 id="porsesh-ha" className="mb-5 text-2xl font-black">پرسش‌های متداول درباره‌ی کلاس خصوصی شیمی در {city}</h2>
        <div className="grid gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-bold">
                {f.q}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-white/40 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 leading-8 text-white/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="card glow-border flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-bold">عکس همایش‌ها و کلاس‌های گذشته</p>
          <p className="text-sm text-white/55">نمونه‌ای از همایش‌های جمع‌بندی شیمی استاد {s.teacherName}</p>
        </div>
        <Link href="/gallery" className="btn-ghost">گالری همایش‌ها <ChevronLeft aria-hidden className="size-4" /></Link>
      </div>
    </main>
  );
}
