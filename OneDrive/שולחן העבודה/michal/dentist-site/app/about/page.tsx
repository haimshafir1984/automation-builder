import Section from "@/components/Section";
import AdminEditHint from "@/components/AdminEditHint";
import { getSiteContent } from "@/lib/site-content";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Stethoscope } from "lucide-react";

export default async function AboutPage() {
  const { about } = await getSiteContent();

  return (
    <Section
      title={about.title}
      subtitle={about.subtitle}
    >
      <AdminEditHint section="about" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-7">
          {about.profileImageUrl ? (
            <img
              src={about.profileImageUrl}
              alt={about.introTitle}
              className="mb-5 h-60 w-full rounded-2xl border border-slate-200 object-cover"
            />
          ) : null}
          <h3 className="font-bold text-2xl text-slate-900">{about.introTitle}</h3>
          <p className="mt-3 text-slate-600 leading-relaxed">
            {about.introText}
          </p>
          <ul className="mt-5 space-y-2 text-slate-700">
            {about.introBullets.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 text-[var(--primary-color)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary-color)] transition duration-300 hover:gap-2"
          >
            לתיאום פגישת ייעוץ
            <ArrowLeft size={16} />
          </Link>
        </div>

        <div className="surface-card p-7 bg-gradient-to-b from-[var(--bg-glow-1)] to-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            <Stethoscope size={14} className="text-[var(--primary-color)]" />
            גישה רפואית מתקדמת
          </div>
          <h3 className="mt-4 font-bold text-2xl text-slate-900">{about.approachTitle}</h3>
          <p className="mt-3 text-slate-600 leading-relaxed">
            {about.approachText}
          </p>
          <div className="mt-4 grid gap-3">
            {about.approachItems.map((item) => (
              <div key={item.title} className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="font-semibold">{item.title}</div>
                <div className="text-sm text-slate-600 mt-1">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-gradient-to-b from-[var(--bg-glow-2)] to-white p-6">
        <h3 className="text-xl font-bold text-slate-900">{about.principlesTitle}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {about.principles.map((item) => (
            <div key={item.title} className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="font-semibold">{item.title}</div>
              <p className="mt-1 text-sm text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
