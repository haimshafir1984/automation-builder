"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Users,
  Settings,
  PackageSearch,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/employees", label: "ניהול עובדים", icon: Users },
  { href: "/inventory", label: "ניהול מלאי", icon: PackageSearch },
  { href: "/customers", label: "מועדון לקוחות", icon: Box },
  { href: "/settings", label: "הגדרות", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-72 flex-col border-l border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
      <div className="mb-8 text-lg font-semibold text-slate-900">
        מערכת ניהול קמעונאית
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm transition",
                isActive
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <span>{item.label}</span>
              <Icon size={18} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

