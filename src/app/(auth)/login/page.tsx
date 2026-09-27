import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "ورود / ثبت‌نام" };

export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
