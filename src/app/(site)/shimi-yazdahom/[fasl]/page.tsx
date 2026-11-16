import type { Metadata } from "next";
import { chapterParams } from "@/lib/site-routes";
import { ChapterPage, chapterMetadata } from "@/components/chapter/ChapterPage";

/** صفحه‌ی فصل‌های شیمی یازدهم (/shimi-yazdahom/fasl-N)؛ فصل بدون محتوا و نشانی ناشناخته ۴۰۴ می‌دهد */
export const revalidate = 300;
export const dynamicParams = false;
export const generateStaticParams = () => chapterParams("G11");

type Props = { params: Promise<{ fasl: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return chapterMetadata("G11", (await params).fasl);
}

export default async function Page({ params }: Props) {
  return <ChapterPage g="G11" fasl={(await params).fasl} />;
}
