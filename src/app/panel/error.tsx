"use client";
import AppError from "../error";

/** خطای صفحه‌های پنل: همان صفحه‌ی خطای سراسری، ولی داخل layout پنل تا منوها و نشانگر تماشا سر جایشان بمانند */
export default function PanelError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <AppError {...props} />;
}
