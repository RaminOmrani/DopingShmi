export const BRAND = "دوپینگ شیمی";

export const GRADES = [
  { value: "G10", label: "دهم" },
  { value: "G11", label: "یازدهم" },
  { value: "G12", label: "دوازدهم" },
  { value: "GRAD", label: "فارغ‌التحصیل (کنکوری)" },
] as const;

export const MAJORS = [
  { value: "TAJROBI", label: "تجربی" },
  { value: "RIAZI", label: "ریاضی" },
] as const;

export const gradeLabel = (g?: string | null) =>
  g === "ALL" ? "همه پایه‌ها" : GRADES.find((x) => x.value === g)?.label ?? "—";
export const majorLabel = (m?: string | null) => MAJORS.find((x) => x.value === m)?.label ?? "—";
export const groupLabel = (g?: string | null, m?: string | null) =>
  g || m ? `${gradeLabel(g)}${m ? " " + majorLabel(m) : ""}` : "همه";

export const PROVINCES = [
  "خراسان رضوی", "تهران", "اصفهان", "فارس", "خراسان شمالی", "خراسان جنوبی", "آذربایجان شرقی", "آذربایجان غربی",
  "اردبیل", "البرز", "ایلام", "بوشهر", "چهارمحال و بختیاری", "خوزستان", "زنجان", "سمنان", "سیستان و بلوچستان",
  "قزوین", "قم", "کردستان", "کرمان", "کرمانشاه", "کهگیلویه و بویراحمد", "گلستان", "گیلان", "لرستان", "مازندران",
  "مرکزی", "هرمزگان", "همدان", "یزد",
];

export const CLASS_STATUS_LABEL: Record<string, string> = {
  NONE: "کاربر آزاد",
  PENDING: "در انتظار تأیید",
  APPROVED: "شاگرد کلاس",
  REJECTED: "رد شده",
};

/** سطح‌ها بر اساس عناصر جدول تناوبی — هر سطح یک عنصر */
export const ELEMENTS: [string, string][] = [
  ["H", "هیدروژن"], ["He", "هلیم"], ["Li", "لیتیم"], ["Be", "بریلیم"], ["B", "بور"], ["C", "کربن"], ["N", "نیتروژن"],
  ["O", "اکسیژن"], ["F", "فلوئور"], ["Ne", "نئون"], ["Na", "سدیم"], ["Mg", "منیزیم"], ["Al", "آلومینیم"], ["Si", "سیلیسیم"],
  ["P", "فسفر"], ["S", "گوگرد"], ["Cl", "کلر"], ["Ar", "آرگون"], ["K", "پتاسیم"], ["Ca", "کلسیم"], ["Sc", "اسکاندیم"],
  ["Ti", "تیتانیم"], ["V", "وانادیم"], ["Cr", "کروم"], ["Mn", "منگنز"], ["Fe", "آهن"], ["Co", "کبالت"], ["Ni", "نیکل"],
  ["Cu", "مس"], ["Zn", "روی"], ["Ga", "گالیم"], ["Ge", "ژرمانیم"], ["As", "آرسنیک"], ["Se", "سلنیم"], ["Br", "برم"],
  ["Kr", "کریپتون"], ["Rb", "روبیدیم"], ["Sr", "استرانسیم"], ["Y", "ایتریم"], ["Zr", "زیرکونیم"], ["Nb", "نیوبیم"],
  ["Mo", "مولیبدن"], ["Tc", "تکنسیم"], ["Ru", "روتنیم"], ["Rh", "رودیم"], ["Pd", "پالادیم"], ["Ag", "نقره"], ["Cd", "کادمیم"],
  ["In", "ایندیم"], ["Sn", "قلع"], ["Sb", "آنتیموان"], ["Te", "تلوریم"], ["I", "ید"], ["Xe", "زنون"], ["Cs", "سزیم"],
  ["Ba", "باریم"], ["La", "لانتان"], ["Ce", "سریم"], ["Pr", "پرازئودیمیم"], ["Nd", "نئودیمیم"], ["Pm", "پرومتیم"],
  ["Sm", "ساماریم"], ["Eu", "یوروپیم"], ["Gd", "گادولینیم"], ["Tb", "تربیم"], ["Dy", "دیسپروزیم"], ["Ho", "هولمیم"],
  ["Er", "اربیم"], ["Tm", "تولیم"], ["Yb", "ایتربیم"], ["Lu", "لوتسیم"], ["Hf", "هافنیم"], ["Ta", "تانتال"], ["W", "تنگستن"],
  ["Re", "رنیم"], ["Os", "اسمیم"], ["Ir", "ایریدیم"], ["Pt", "پلاتین"], ["Au", "طلا"],
];

/** امتیاز لازم برای رسیدن به سطح n (n از ۱): 12 * (n-1)^2 */
export const levelThreshold = (n: number) => 12 * (n - 1) * (n - 1);

export function levelOf(points: number) {
  let n = Math.floor(Math.sqrt(Math.max(0, points) / 12)) + 1;
  n = Math.min(n, ELEMENTS.length);
  const [symbol, name] = ELEMENTS[n - 1];
  const cur = levelThreshold(n);
  const next = n < ELEMENTS.length ? levelThreshold(n + 1) : cur;
  const progress = next > cur ? (points - cur) / (next - cur) : 1;
  return { level: n, symbol, name, current: cur, next, progress: Math.max(0, Math.min(1, progress)) };
}
