import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { pageMeta } from "@/lib/page-meta";
import { chapterPath, TOOL_PATHS } from "@/lib/site-routes";
import { PhTool } from "@/components/tools/PhTool";
import { ToolPage } from "@/components/tools/ToolPage";
import { PH } from "@/content/tools/ph";

/**
 * ابزار «محاسبه pH» (/mohasebe-ph): ماشین‌حساب سه‌زبانه (جزیره‌ی کلاینت) + راهنمای pH، Ka و درجه‌ی یونش.
 * صفحه ایستاست؛ تا live نشدن مسیر در site-routes، pageMeta آن را noindex می‌کند.
 */
export const revalidate = 300;

const PATH = TOOL_PATHS.ph;

export const metadata: Metadata = pageMeta({ title: PH.title, description: PH.description, path: PATH });

export default async function PhPage() {
  const s = await getSetting("site");
  return (
    <ToolPage
      s={s}
      content={PH}
      path={PATH}
      widget={<PhTool />}
      related={[
        { path: chapterPath("G12", 1), desc: "اسید و باز آرنیوس، ثابت یونش و pH" },
        { path: chapterPath("G10", 3), desc: "غلظت مولار و محلول‌ها" },
        { path: TOOL_PATHS.molarMass, desc: "جرم مولی برای ساختن محلول با غلظت معین" },
        { path: TOOL_PATHS.balance, desc: "موازنه‌ی واکنش خنثی شدن" },
        { path: TOOL_PATHS.formulas, desc: "رابطه‌های pH و ثابت یونش در یک برگه" },
      ]}
    />
  );
}
