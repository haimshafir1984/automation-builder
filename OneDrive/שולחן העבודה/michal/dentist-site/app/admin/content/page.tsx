import Link from "next/link";
import AdminContentEditor from "@/components/AdminContentEditor";
import { disableAdminMode } from "../actions";

export default async function AdminContentPage({
  searchParams
}: {
  searchParams?: Promise<{ section?: string }>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <section className="py-12">
      <div className="container">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ניהול תוכן האתר</h1>
            <p className="text-slate-600 mt-1">
              עריכת עמודים ותכנים מתוך פאנל יחיד (ללא התחברות בשלב זה).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-secondary">
              חזרה לאתר
            </Link>
            <form action={disableAdminMode}>
              <button type="submit" className="btn-secondary">
                יציאה מ-Admin
              </button>
            </form>
          </div>
        </div>
        <AdminContentEditor initialSection={params.section} />
      </div>
    </section>
  );
}
