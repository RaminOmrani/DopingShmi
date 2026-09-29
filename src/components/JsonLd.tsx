/** داده‌ی ساختاریافته برای گوگل (schema.org) */
export function JsonLd({ data }: { data: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: data }} />;
}
