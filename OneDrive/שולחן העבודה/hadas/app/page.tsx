import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">
          לוח בקרה
        </h1>
        <p className="text-slate-500">
          ניהול מרוכז של מלאי, עובדים ומועדון לקוחות.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">ניהול מלאי</h2>
          <p className="mt-2 text-sm text-slate-500">
            ניהול כניסות, יציאות והתראות מלאי.
          </p>
          <Link
            className="mt-4 inline-flex text-sm text-slate-700 underline"
            href="/inventory"
          >
            מעבר לניהול מלאי
          </Link>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">ניהול עובדים</h2>
          <p className="mt-2 text-sm text-slate-500">
            מכירות, בונוסים ומשמרות.
          </p>
          <Link
            className="mt-4 inline-flex text-sm text-slate-700 underline"
            href="/employees"
          >
            מעבר לניהול עובדים
          </Link>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">מועדון לקוחות</h2>
          <p className="mt-2 text-sm text-slate-500">
            מועדון לקוחות ושידורי שיווק.
          </p>
          <Link
            className="mt-4 inline-flex text-sm text-slate-700 underline"
            href="/customers"
          >
            מעבר למועדון לקוחות
          </Link>
        </Card>
      </section>
    </>
  );
}

