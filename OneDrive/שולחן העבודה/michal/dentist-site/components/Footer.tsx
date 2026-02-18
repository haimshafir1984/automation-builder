import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200/70 bg-white/70 backdrop-blur">
      <div className="container py-10 grid gap-6 md:grid-cols-3">
        <div>
          <div className="font-semibold text-lg text-slate-900">ד״ר בני פרדמן</div>
          <p className="text-slate-600 mt-2 text-sm">
            שיקום הפה בגישה רפואית מדויקת, תכנון דיגיטלי מתקדם, פתרונות למקרים
            מורכבים ויחס אישי רגוע.
          </p>
        </div>

        <div className="text-sm">
          <div className="font-semibold mb-2 text-slate-900">קישורים</div>
          <div className="flex flex-col gap-2">
            <Link className="text-slate-600 hover:text-sky-800" href="/">
              בית
            </Link>
            <Link className="text-slate-600 hover:text-sky-800" href="/about">
              אודות
            </Link>
            <Link className="text-slate-600 hover:text-sky-800" href="/treatments">
              תחומי טיפול
            </Link>
            <Link className="text-slate-600 hover:text-sky-800" href="/pricing">
              עלויות טיפול
            </Link>
            <Link className="text-slate-600 hover:text-sky-800" href="/publications">
              אקדמיה/פרסומים
            </Link>
            <Link className="text-slate-600 hover:text-sky-800" href="/contact">
              צור קשר
            </Link>
          </div>
        </div>

        <div className="text-sm">
          <div className="font-semibold mb-2 text-slate-900">פרטים</div>
          <div className="text-slate-600 space-y-1">
            <div>כתובת: הנדיב 71, הרצליה</div>
            <div>טלפון: 09-7790809</div>
            <div>נייד: 053-4534916</div>
            <div>
              אימייל:{" "}
              <a
                href="mailto:benny.ferdman@gmail.com"
                className="hover:text-sky-800 underline underline-offset-2"
              >
                benny.ferdman@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 text-xs text-slate-500">
        © {new Date().getFullYear()} ד״ר בני פרדמן. התוכן באתר אינו מהווה ייעוץ
        רפואי. אבחון יינתן בבדיקה בלבד.
      </div>
    </footer>
  );
}
