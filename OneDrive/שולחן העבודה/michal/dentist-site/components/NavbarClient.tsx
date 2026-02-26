"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type SharedData = {
  doctorName: string;
  specialty: string;
  navCtaLabel: string;
  logoImageUrl?: string;
};

const navItems = [
  { href: "/", label: "בית" },
  { href: "/about", label: "אודות" },
  { href: "/treatments", label: "תחומי טיפול" },
  { href: "/patient-instructions", label: "מרכז הדרכה" },
  { href: "/publications", label: "אקדמיה/פרסומים" },
  { href: "/contact", label: "צור קשר" },
  { href: "/admin", label: "Admin" }
] as const;

export default function NavbarClient({ shared }: { shared: SharedData }) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="container h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-white font-bold shadow-sm"
            style={{ backgroundColor: "var(--primary-color)" }}
          >
            {shared.logoImageUrl ? (
              <img
                src={shared.logoImageUrl}
                alt={shared.doctorName}
                className="h-full w-full object-cover"
              />
            ) : (
              "BF"
            )}
          </span>
          <div className="leading-tight">
            <div className="font-semibold">{shared.doctorName}</div>
            <div className="text-xs text-slate-500">{shared.specialty}</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`relative pb-1 transition duration-300 font-medium ${
                pathname === item.href
                  ? "text-[var(--primary-color)]"
                  : "text-slate-600 hover:text-[var(--primary-color)]"
              }`}
            >
              {item.label}
              <span
                className={`pointer-events-none absolute -bottom-0.5 right-0 h-0.5 rounded-full bg-[var(--primary-color)] transition-all duration-300 ${
                  pathname === item.href ? "w-full opacity-100" : "w-0 opacity-0"
                }`}
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/contact" className="btn-primary px-4 py-2 hidden sm:inline-flex">
            {shared.navCtaLabel}
          </Link>

          <div className="md:hidden relative">
            <details className="group">
              <summary className="list-none h-10 w-10 cursor-pointer rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 [&::-webkit-details-marker]:hidden">
                <span className="text-xl leading-none">☰</span>
              </summary>

              <div className="absolute top-12 left-0 w-[88vw] max-w-xs rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                <div className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={`mobile-${item.href}`}
                      href={item.href}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={`rounded-xl px-3 py-3 text-sm font-medium min-h-12 flex items-center transition ${
                        pathname === item.href
                          ? "bg-[var(--bg-glow-2)] text-[var(--primary-color)]"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <Link href="/contact" className="btn-primary mt-3 w-full justify-center">
                  {shared.navCtaLabel}
                </Link>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
