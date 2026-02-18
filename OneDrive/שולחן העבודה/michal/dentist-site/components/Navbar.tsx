import Link from "next/link";

const NavLink = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    className="text-slate-600 hover:text-sky-800 transition font-medium"
  >
    {label}
  </Link>
);

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="container h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-700 text-white font-bold shadow-sm">
            BF
          </span>
          <div className="leading-tight">
            <div className="font-semibold">ד״ר בני פרדמן</div>
            <div className="text-xs text-slate-500">מומחה לשיקום הפה</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <NavLink href="/" label="בית" />
          <NavLink href="/about" label="אודות" />
          <NavLink href="/treatments" label="תחומי טיפול" />
          <NavLink href="/publications" label="אקדמיה/פרסומים" />
          <NavLink href="/contact" label="צור קשר" />
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="btn-primary px-4 py-2"
          >
            לתיאום ייעוץ
          </Link>
        </div>
      </div>
    </header>
  );
}
