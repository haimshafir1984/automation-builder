import Section from "@/components/Section";
import Card from "@/components/Card";
import Link from "next/link";
import AdminEditHint from "@/components/AdminEditHint";
import { getSiteContent } from "@/lib/site-content";
import { ArrowLeft } from "lucide-react";

export default async function TreatmentsPage() {
  const { treatments } = await getSiteContent();

  return (
    <Section
      title={treatments.title}
      subtitle={treatments.subtitle}
    >
      <AdminEditHint section="treatments" />
      <div className="grid gap-4 md:grid-cols-3">
        {treatments.cards.map((t) => (
          <Card key={t.title} title={t.title} text={t.text} badge={t.badge} />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 p-6 bg-gradient-to-b from-[var(--bg-glow-1)] to-white">
        <div className="font-semibold text-[var(--primary-color)]">{treatments.suitableTitle}</div>
        <p className="text-slate-600 mt-2 leading-relaxed">
          {treatments.suitableText}
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">לא בטוחים מה נכון עבורכם?</h3>
          <p className="mt-1 text-sm text-slate-600">
            נקבע פגישת אבחון ונבנה תכנית טיפול מדויקת לפי הצרכים שלכם.
          </p>
        </div>
        <Link href="/contact" className="btn-primary inline-flex items-center gap-2">
          {treatments.ctaLabel}
          <ArrowLeft size={16} />
        </Link>
      </div>
    </Section>
  );
}
