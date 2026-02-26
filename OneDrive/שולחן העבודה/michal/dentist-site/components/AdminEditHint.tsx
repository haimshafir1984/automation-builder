import Link from "next/link";
import { cookies } from "next/headers";
import type { EditableSection } from "@/lib/site-content";

export default async function AdminEditHint({
  section
}: {
  section: EditableSection;
}) {
  const isAdmin = (await cookies()).get("admin_mode")?.value === "1";
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mt-4">
      <Link
        href={`/admin/content?section=${section}`}
        className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
      >
        עריכת תוכן עמוד זה
      </Link>
    </div>
  );
}
