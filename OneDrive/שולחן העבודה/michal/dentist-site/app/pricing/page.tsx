import Section from "@/components/Section";
import Link from "next/link";
import AdminEditHint from "@/components/AdminEditHint";
import { getSiteContent } from "@/lib/site-content";

export default async function PricingPage() {
  const { pricing } = await getSiteContent();

  return (
    <Section
      title={pricing.title}
      subtitle={pricing.subtitle}
    >
      <AdminEditHint section="pricing" />
      <div className="grid gap-4 md:grid-cols-2">
        {pricing.factors.map((factor) => (
          <div key={factor.title} className="surface-card p-6">
            <h3 className="font-semibold text-slate-900">{factor.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{factor.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-gradient-to-b from-[var(--bg-glow-1)] to-white p-6">
        <p className="text-slate-700 leading-relaxed">{pricing.summary}</p>
        <Link href="/contact" className="btn-primary inline-flex mt-5">
          {pricing.ctaLabel}
        </Link>
      </div>
    </Section>
  );
}
