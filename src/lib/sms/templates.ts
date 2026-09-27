/**
 * الگوهای پیامک. متن هر الگو از پنل مدیریت قابل ویرایش است.
 * برای ارسال خدماتی، همین متن را در ملی‌پیامک با {0},{1},... (به ترتیب patternArgs) ثبت کنید
 * و «کد الگو» (bodyId) را در پنل مدیریت ← پیامک ← الگوها وارد کنید.
 */
/**
 * کدهای الگوی تأییدشده در ملی‌پیامک (bodyId). بعد از تأیید هر الگو، کدش را اینجا بنویسید؛
 * با اجرای update.sh روی سرور، برای الگوهایی که کدشان در پنل خالی است خودکار ثبت می‌شود.
 * (از پنل مدیریت ← پیامک ← الگوها هم قابل تغییر است و مقدار پنل اولویت دارد.)
 */
export const MELIPAYAMAK_BODY_IDS: Record<string, string> = {
  otp: "545211",
  welcome: "545212",
  class_fixed: "545214",
  class_cancelled: "545215",
  class_rescheduled: "545216",
  general: "545226",
};

export interface SmsTemplateDef {
  key: string;
  name: string;
  body: string;
  patternArgs: string[];
  /** متن آماده برای ثبت در پنل ملی‌پیامک */
  melipayamak: string;
  description: string;
}

/* نکته: ملی‌پیامک لینک (مثل آدرس سایت) را بدون اینماد در الگو و متغیر قبول نمی‌کند؛ متن‌ها بدون لینک‌اند. */
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
    body: "{{name}} عزیز، به دوپینگ شیمی خوش آمدی. حساب شما فعال شد؛ با همین شماره وارد شو",
    patternArgs: ["name"],
    melipayamak: "{0} عزیز، به دوپینگ شیمی خوش آمدی. حساب شما فعال شد؛ با همین شماره وارد شو",
    description: "وقتی مدیر درخواست شاگرد کلاس را تأیید می‌کند",
  },
  {
    key: "class_fixed",
    name: "کلاس فیکس شد",
    body: "{{name}} عزیز، کلاس {{class}} در تاریخ {{date}} ساعت {{time}} در {{place}} برگزار می‌شود.\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["name", "class", "date", "time", "place"],
    melipayamak: "{0} عزیز، کلاس {1} در تاریخ {2} ساعت {3} در {4} برگزار می‌شود.\nدوپینگ شیمی - جواد پرتویی",
    description: "قطعی‌شدن جلسه (کلاس گروهی یا خصوصی)",
  },
  {
    key: "class_cancelled",
    name: "کلاس لغو شد",
    body: "{{name}} عزیز، کلاس {{class}} مورخ {{date}} ساعت {{time}} لغو شد.\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["name", "class", "date", "time"],
    melipayamak: "{0} عزیز، کلاس {1} مورخ {2} ساعت {3} لغو شد.\nدوپینگ شیمی - جواد پرتویی",
    description: "لغو جلسه",
  },
  {
    key: "class_rescheduled",
    name: "جابه‌جایی کلاس",
    body: "{{name}} عزیز، کلاس {{class}} به تاریخ {{date}} ساعت {{time}} منتقل شد.\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["name", "class", "date", "time"],
    melipayamak: "{0} عزیز، کلاس {1} به تاریخ {2} ساعت {3} منتقل شد.\nدوپینگ شیمی - جواد پرتویی",
    description: "تغییر زمان جلسه",
  },
  {
    key: "exam_new",
    name: "آزمون جدید",
    body: "{{name}} عزیز، آزمون {{exam}} تا {{until}} فعال است. برای شرکت وارد اپلیکیشن دوپینگ شیمی شو.",
    patternArgs: ["name", "exam", "until"],
    melipayamak: "{0} عزیز، آزمون {1} تا {2} فعال است. برای شرکت وارد اپلیکیشن دوپینگ شیمی شو.",
    description: "اطلاع‌رسانی آزمون جدید",
  },
  {
    key: "exam_result",
    name: "نتیجه آزمون",
    body: "{{name}} عزیز، نتیجه آزمون {{exam}} ثبت شد. نمره شما: {{score}}\nکارنامه کامل در اپلیکیشن دوپینگ شیمی",
    patternArgs: ["name", "exam", "score"],
    melipayamak: "{0} عزیز، نتیجه آزمون {1} ثبت شد. نمره شما: {2}\nکارنامه کامل در اپلیکیشن دوپینگ شیمی",
    description: "پس از ثبت/وارد کردن نتایج آزمون",
  },
  {
    key: "parent_exam_result",
    name: "نتیجه آزمون (به والدین)",
    body: "ولی گرامی، نتیجه آزمون {{exam}} فرزندتان {{name}} ثبت شد. نمره: {{score}}\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["exam", "name", "score"],
    melipayamak: "ولی گرامی، نتیجه آزمون {0} فرزندتان {1} ثبت شد. نمره: {2}\nدوپینگ شیمی - جواد پرتویی",
    description: "برای والدینی که شماره‌شان ثبت و اطلاع‌رسانی را فعال کرده‌اند",
  },
  {
    key: "parent_class",
    name: "اطلاع‌رسانی کلاس (به والدین)",
    body: "ولی گرامی، کلاس {{class}} فرزندتان {{name}} در تاریخ {{date}} ساعت {{time}} {{status}}.\nدوپینگ شیمی - جواد پرتویی",
    patternArgs: ["class", "name", "date", "time", "status"],
    melipayamak: "ولی گرامی، کلاس {0} فرزندتان {1} در تاریخ {2} ساعت {3} {4}.\nدوپینگ شیمی - جواد پرتویی",
    description: "کپی پیامک کلاس برای والدین — {4} یکی از: «برگزار می‌شود»، «لغو شد»، «جابه‌جا شد»",
  },
  {
    key: "video_new",
    name: "ویدیو جدید",
    body: "{{name}} عزیز، ویدیو جدید {{video}} منتشر شد. همین حالا در اپلیکیشن دوپینگ شیمی ببین.",
    patternArgs: ["name", "video"],
    melipayamak: "{0} عزیز، ویدیو جدید {1} منتشر شد. همین حالا در اپلیکیشن دوپینگ شیمی ببین.",
    description: "انتشار ویدیوی جدید",
  },
  {
    key: "purchase_ok",
    name: "خرید موفق",
    body: "{{name}} عزیز، دسترسی {{item}} برای شما فعال شد. مدت اعتبار: {{until}}\nدوپینگ شیمی",
    patternArgs: ["name", "item", "until"],
    melipayamak: "{0} عزیز، دسترسی {1} برای شما فعال شد. مدت اعتبار: {2}\nدوپینگ شیمی",
    description: "پس از پرداخت موفق — {2} «دائمی» یا «تا تاریخ ...»",
  },
  {
    key: "sub_expiring",
    name: "پایان دسترسی نزدیک است",
    body: "{{name}} عزیز، دسترسی {{item}} تا {{days}} روز دیگر به پایان می‌رسد. برای تمدید وارد اپلیکیشن دوپینگ شیمی شو.",
    patternArgs: ["name", "item", "days"],
    melipayamak: "{0} عزیز، دسترسی {1} تا {2} روز دیگر به پایان می‌رسد. برای تمدید وارد اپلیکیشن دوپینگ شیمی شو.",
    description: "۳ روز قبل از پایان دسترسی‌های زمان‌دار",
  },
  {
    key: "general",
    name: "پیام عمومی / اختصاصی",
    body: "کاربر عزیز {{message}} با تشکر از همراهی شما دوپینگ شیمی",
    patternArgs: ["message"],
    melipayamak: "کاربر عزیز {0} با تشکر از همراهی شما دوپینگ شیمی",
    description: "پیام دلخواه تکی یا گروهی؛ الگوهایی که هنوز کد تأییدشده ندارند هم از همین الگو ارسال می‌شوند",
  },
];

export const renderTemplate = (body: string, vars: Record<string, string | number | undefined>) =>
  body.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
