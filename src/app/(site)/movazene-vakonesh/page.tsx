import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { pageMeta } from "@/lib/page-meta";
import { chapterPath, TOOL_PATHS } from "@/lib/site-routes";
import { BalanceTool } from "@/components/tools/BalanceTool";
import { ToolPage } from "@/components/tools/ToolPage";
import { BALANCE, BALANCE_DEFAULT, BALANCE_EXAMPLES } from "@/content/tools/balance";

/**
 * ابزار «موازنه واکنش» (/movazene-vakonesh): موازنه‌گر (جزیره‌ی کلاینت) + آموزش روش وارسی با مثال‌های حل‌شده.
 * صفحه ایستاست (searchParams خوانده نمی‌شود)؛ تا live نشدن مسیر در site-routes، pageMeta آن را noindex می‌کند.
 */
export const revalidate = 300;

const PATH = TOOL_PATHS.balance;

export const metadata: Metadata = pageMeta({ title: BALANCE.title, description: BALANCE.description, path: PATH });

export default async function BalancePage() {
  const s = await getSetting("site");
  return (
    <ToolPage
      s={s}
      content={BALANCE}
      path={PATH}
      widget={<BalanceTool examples={BALANCE_EXAMPLES} initial={BALANCE_DEFAULT} />}
      related={[
        { path: chapterPath("G10", 2), desc: "پایستگی جرم، روش وارسی و استوکیومتری" },
        { path: chapterPath("G11", 1), desc: "استخراج فلزها، درصد خلوص و بازده" },
        { path: chapterPath("G12", 2), desc: "اکسایش و کاهش، نیم‌واکنش و عدد اکسایش" },
        { path: TOOL_PATHS.molarMass, desc: "جرم مولی واکنش‌دهنده‌ها و فراورده‌ها" },
        { path: TOOL_PATHS.periodic, desc: "نماد، نام فارسی و جرم اتمی عنصرها" },
        { path: TOOL_PATHS.formulas, desc: "رابطه‌های استوکیومتری در یک برگه" },
      ]}
    />
  );
}
