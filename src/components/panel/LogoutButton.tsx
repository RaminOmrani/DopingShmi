"use client";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/logout";

export function LogoutButton() {
  return (
    <button className="btn-danger w-full" onClick={logout}>
      <LogOut className="size-4" /> خروج از حساب
    </button>
  );
}
