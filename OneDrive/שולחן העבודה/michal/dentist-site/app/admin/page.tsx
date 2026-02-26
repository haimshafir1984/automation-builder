import Link from "next/link";
import { cookies } from "next/headers";
import { disableAdminMode, enableAdminMode } from "./actions";

export default async function AdminEntryPage() {
  const isAdmin = (await cookies()).get("admin_mode")?.value === "1";

  return (
    <section className="py-16">
      <div className="container max-w-2xl">
        <div className="surface-card p-8">
          <h1 className="text-2xl font-bold text-slate-900">פאנל ניהול</h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            זהו מצב ניהול ראשוני ללא שם משתמש וסיסמה, לצורך בדיקה והבדלה בין אתר
            רגיל לבין עריכת תוכן.
          </p>

          {!isAdmin ? (
            <form action={enableAdminMode} className="mt-6">
              <button className="btn-primary" type="submit">
                כניסה למצב Admin
              </button>
            </form>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/admin/content" className="btn-primary">
                מעבר לניהול תוכן
              </Link>
              <form action={disableAdminMode}>
                <button type="submit" className="btn-secondary">
                  יציאה מ-Admin
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
