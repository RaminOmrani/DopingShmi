import { GradeLanding, gradeMetadata } from "@/components/seo/GradeLanding";

export const revalidate = 300;
export const generateMetadata = () => gradeMetadata("G10");

export default function Page() {
  return <GradeLanding g="G10" />;
}
