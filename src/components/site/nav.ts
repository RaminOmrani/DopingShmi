/**
 * ساختار منوی سایت از روی SEO_ROUTES (فقط صفحه‌های live). در (site)/layout روی سرور ساخته و به Header داده می‌شود
 * تا syllabus و site-routes وارد باندل کلاینت هدر نشوند. صفحه‌ای که live نیست اصلاً در منو نمی‌آید.
 */
import { GRADE_PAGES } from "@/lib/syllabus";
import { GRADE_KEYS, QUIZ_HUB, TOOL_PATHS, chapterCount, chapterPath, chapterTitle, faslWord, gradeName, isLive, route } from "@/lib/site-routes";

export interface NavLink {
  href: string;
  label: string;
}
export interface NavGroup {
  /** سرگروه (مثل «شیمی دهم») که خودش هم لینک است */
  title?: NavLink;
  links: NavLink[];
}
export type NavItem = { label: string; href: string } | { label: string; groups: NavGroup[] };

const link = (href: string, label?: string): NavLink | null => (isLive(href) ? { href, label: label ?? route(href)?.label ?? href } : null);
const present = <T,>(x: T | null): x is T => x !== null;

/** پایه‌ها با فصل‌های live هر پایه */
export function gradeGroups(): NavGroup[] {
  return GRADE_KEYS.map((g) => ({
    title: link(GRADE_PAGES[g].path, `شیمی ${gradeName(g)}`) ?? undefined,
    links: Array.from({ length: chapterCount(g) }, (_, i) => link(chapterPath(g, i + 1), `فصل ${faslWord(i + 1)}: ${chapterTitle(g, i + 1)}`)).filter(present),
  })).filter((x) => x.title || x.links.length);
}

/** ابزارها و برگه‌ی فرمول (live) */
export function toolLinks(): NavLink[] {
  return [TOOL_PATHS.periodic, TOOL_PATHS.molarMass, TOOL_PATHS.balance, TOOL_PATHS.ph, TOOL_PATHS.formulas].map((p) => link(p)).filter(present);
}

/**
 * منوی اصلی: «آموزش شیمی» (پایه‌ها و فصل‌ها)، «ابزار شیمی»، «آزمون آنلاین»، «شیمی کنکور»، «کلاس خصوصی»، «ویدیوها»،
 * «مقالات» (فقط وقتی مقاله‌ی منتشرشده هست) و «درباره استاد». گروه بی‌عضو و صفحه‌ی غیر live حذف می‌شود.
 */
export function buildNav({ articles }: { articles: number }): NavItem[] {
  const items: (NavItem | null)[] = [];
  const grades = gradeGroups();
  if (grades.length) items.push({ label: "آموزش شیمی", groups: grades });
  const tools = toolLinks();
  if (tools.length) items.push({ label: "ابزار شیمی", groups: [{ links: tools }] });
  const flat = (href: string, label: string) => (isLive(href) ? { href, label } : null);
  items.push(
    flat(QUIZ_HUB, "آزمون آنلاین"),
    flat("/shimi-konkur", "شیمی کنکور"),
    flat("/tadris-shimi", "کلاس خصوصی"),
    flat("/courses", "ویدیوها"),
    articles > 0 ? flat("/articles", "مقالات") : null,
    flat("/javad-partovi", "درباره استاد"),
  );
  return items.filter(present);
}
