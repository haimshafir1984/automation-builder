import Link from "next/link";
import { cookies } from "next/headers";

export default async function AdminModeBar() {
  const isAdmin = (await cookies()).get("admin_mode")?.value === "1";
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="bg-sky-900 text-white text-sm">
      <div className="container py-2 flex items-center justify-between gap-2">
        <span>מצב Admin פעיל</span>
        <div className="flex items-center gap-3">
          <Link href="/admin/content" className="underline underline-offset-2">
            ניהול תוכן
          </Link>
          <Link href="/admin" className="underline underline-offset-2">
            יציאה
          </Link>
        </div>
      </div>
    </div>
  );
}
