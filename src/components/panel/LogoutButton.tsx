"use client";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button className="btn-danger w-full" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/"; }}>
      <LogOut className="size-4" /> خروج از حساب
    </button>
  );
}
