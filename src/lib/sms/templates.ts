/**
 * الگوهای پیامک. متن هر الگو از پنل مدیریت قابل ویرایش است.
 * برای ارسال خدماتی، همین متن را در ملی‌پیامک با {0},{1},... (به ترتیب patternArgs) ثبت کنید
 * و «کد الگو» (bodyId) را در پنل مدیریت ← پیامک ← الگوها وارد کنید.
 */
export interface SmsTemplateDef {
  key: string;
  name: string;
  body: string;
  patternArgs: string[];
  /** متن آماده برای ثبت در پنل ملی‌پیامک */
  melipayamak: string;
  description: string;
}

export const SMS_TEMPLATES: SmsTemplateDef[] = [
  {
    key: "otp",
    name: "کد ورود",
    body: "کد ورود شما به دوپینگ شیمی: {{code}}\nاین کد تا {{minutes}} دقیقه معتبر است.",
    patternArgs: ["code", "minutes"],
    melipayamak: "کد ورود شما به دوپینگ شیمی: {0}\nاین کد تا {1} دقیقه معتبر است.",
    description: "هنگام ورود با شماره موبایل",
  },
  {
    key: "welcome",
    name: "خوش‌آمد / تأیید شاگرد کلاس",
    body: "{{name}} عزیز، به دوپینگ شیمی خوش آمدی. حساب شما فعال شد؛ با همین شماره وارد شو: dopingshimi.ir",
    patternArgs: ["name"],
    melipayamak: "{0} عزیز، به دوپینگ شیمی خوش آمدی. حساب شما فعال شد؛ با همین شماره وارد شو: dopingshimi.ir",
    description: "وقتی مدیر درخواست شاگرد کلاس را تأیید می‌کند",
  },
  {
    key: "class_fixed",
    name: "کلاس فیکس شد",
    body: "{{name}} عزیز، کلاس {{class}} در تاریخ {{date}} ساعت {{time}} در {{place}} برگزار می‌شود.\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["name", "class", "date", "time", "place"],
    melipayamak: "{0} عزیز، کلاس {1} در تاریخ {2} ساعت {3} در {4} برگزار می‌شود.\nدوپینگ شیمی - جواد پرتویی",
    description: "اطلاع‌رسانی قطعی‌شدن جلسه به اعضای یک کلاس",
  },
  {
    key: "class_cancelled",
    name: "کلاس لغو شد",
    body: "{{name}} عزیز، کلاس {{class}} مورخ {{date}} ساعت {{time}} لغو شد.\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["name", "class", "date", "time"],
    melipayamak: "{0} عزیز، کلاس {1} مورخ {2} ساعت {3} لغو شد.\nدوپینگ شیمی - جواد پرتویی",
    description: "لغو جلسه کلاس",
  },
  {
    key: "class_rescheduled",
    name: "جابه‌جایی کلاس",
    body: "{{name}} عزیز، کلاس {{class}} به تاریخ {{date}} ساعت {{time}} منتقل شد.\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["name", "class", "date", "time"],
    melipayamak: "{0} عزیز، کلاس {1} به تاریخ {2} ساعت {3} منتقل شد.\nدوپینگ شیمی - جواد پرتویی",
    description: "تغییر زمان جلسه کلاس",
  },
  {
    key: "exam_new",
    name: "آزمون جدید",
    body: "{{name}} عزیز، آزمون «{{exam}}» تا {{until}} فعال است. برای شرکت وارد dopingshimi.ir شو.",
    patternArgs: ["name", "exam", "until"],
    melipayamak: "{0} عزیز، آزمون «{1}» تا {2} فعال است. برای شرکت وارد dopingshimi.ir شو.",
    description: "اطلاع‌رسانی آزمون جدید",
  },
  {
    key: "exam_result",
    name: "نتیجه آزمون",
    body: "{{name}} عزیز، نتیجه آزمون «{{exam}}» ثبت شد. نمره شما: {{score}}\nکارنامه کامل: dopingshimi.ir",
    patternArgs: ["name", "exam", "score"],
    melipayamak: "{0} عزیز، نتیجه آزمون «{1}» ثبت شد. نمره شما: {2}\nکارنامه کامل: dopingshimi.ir",
    description: "پس از ثبت/وارد کردن نتایج آزمون",
  },
  {
    key: "parent_exam_result",
    name: "نتیجه آزمون (به والدین)",
    body: "ولی گرامی، نتیجه آزمون «{{exam}}» فرزندتان {{name}}: {{score}}\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["exam", "name", "score"],
    melipayamak: "ولی گرامی، نتیجه آزمون «{0}» فرزندتان {1}: {2}\nدوپینگ شیمی - جواد پرتویی",
    description: "برای والدینی که شماره‌شان ثبت و اطلاع‌رسانی را فعال کرده‌اند",
  },
  {
    key: "parent_class",
    name: "اطلاع‌رسانی کلاس (به والدین)",
    body: "ولی گرامی، کلاس {{class}} فرزندتان {{name}}: {{status}} — {{date}} ساعت {{time}}\nدوپینگ شیمی",
    patternArgs: ["class", "name", "status", "date", "time"],
    melipayamak: "ولی گرامی، کلاس {0} فرزندتان {1}: {2} — {3} ساعت {4}\nدوپینگ شیمی",
    description: "کپی پیامک فیکس/لغو/جابه‌جایی کلاس برای والدین",
  },
  {
    key: "video_new",
    name: "ویدیو جدید",
    body: "{{name}} عزیز، ویدیو جدید «{{video}}» منتشر شد. همین حالا در dopingshimi.ir ببین.",
    patternArgs: ["name", "video"],
    melipayamak: "{0} عزیز، ویدیو جدید «{1}» منتشر شد. همین حالا در dopingshimi.ir ببین.",
    description: "انتشار ویدیوی جدید",
  },
  {
    key: "purchase_ok",
    name: "خرید موفق",
    body: "{{name}} عزیز، «{{item}}» برای شما فعال شد{{until}}.\nدوپینگ شیمی",
    patternArgs: ["name", "item", "until"],
    melipayamak: "{0} عزیز، «{1}» برای شما فعال شد{2}.\nدوپینگ شیمی",
    description: "پس از پرداخت موفق",
  },
  {
    key: "sub_expiring",
    name: "پایان دسترسی نزدیک است",
    body: "{{name}} عزیز، دسترسی «{{item}}» {{days}} روز دیگر به پایان می‌رسد. برای تمدید: dopingshimi.ir",
    patternArgs: ["name", "item", "days"],
    melipayamak: "{0} عزیز، دسترسی «{1}» {2} روز دیگر به پایان می‌رسد. برای تمدید: dopingshimi.ir",
    description: "۳ روز قبل از پایان دسترسی‌های زمان‌دار",
  },
  {
    key: "general",
    name: "پیام عمومی",
    body: "{{message}}\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: [],
    melipayamak: "(با خط اختصاصی و ارسال معمولی فرستاده می‌شود؛ ثبت الگو لازم نیست)",
    description: "پیام دلخواه تکی یا گروهی",
  },
];

export const renderTemplate = (body: string, vars: Record<string, string | number | undefined>) =>
  body.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
