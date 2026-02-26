import Link from "next/link";
import Section from "@/components/Section";
import Card from "@/components/Card";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import AdminEditHint from "@/components/AdminEditHint";
import { getSiteContent } from "@/lib/site-content";
import RevealOnScroll from "@/components/RevealOnScroll";
import {
  Award,
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  ScanLine,
  Smile,
  PhoneCall,
  MapPin,
  LifeBuoy
} from "lucide-react";

export default async function HomePage() {
  const content = await getSiteContent();
  const { home, about, shared } = content;

  return (
    <>
      <AdminEditHint section="home" />
      <section className="py-20 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/5 via-transparent to-transparent pointer-events-none" />
        <div className="container grid gap-10 md:grid-cols-2 items-center">
          <RevealOnScroll>
            <p className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {home.pill}
            </p>
            <h1 className="mt-4 text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-slate-900">
              {home.heroTitle}
            </h1>
            <p className="mt-5 text-slate-600 text-lg md:text-xl leading-relaxed">
              {home.heroSubtitle}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="btn-primary"
              >
                קביעת תור
              </Link>
              <Link
                href="/treatments"
                className="btn-secondary"
              >
                {home.secondaryCta}
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              {home.valueCards.map((card) => (
                <div key={card.title} className="surface-card p-4">
                  <div className="text-base font-bold text-[var(--primary-color)]">{card.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{card.text}</div>
                </div>
              ))}
            </div>
          </RevealOnScroll>

          <RevealOnScroll>
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50/80 to-white p-8 shadow-[0_15px_40px_-24px_rgba(2,132,199,0.5)]">
            {home.heroImageUrl ? (
              <img
                src={home.heroImageUrl}
                alt={home.heroTitle}
                className="mb-4 h-44 w-full rounded-2xl border border-slate-200 object-cover"
              />
            ) : null}
            <div className="text-sm font-semibold text-sky-800">{home.clinicalTitle}</div>
            <ul className="mt-4 space-y-3 text-slate-700">
              {home.clinicalBullets.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-5">
              <div className="font-semibold">{home.professionalMessageTitle}</div>
              <p className="text-slate-600 mt-1 text-sm leading-relaxed">
                {home.professionalMessage}
              </p>
            </div>
          </div>
          </RevealOnScroll>
        </div>

        <div className="container mt-8">
          <RevealOnScroll>
            <div className="surface-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <Award size={18} className="text-[var(--primary-color)]" />
                <span>Professional Staff</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Stethoscope size={18} className="text-[var(--primary-color)]" />
                <span>Modern Equipment</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldCheck size={18} className="text-[var(--primary-color)]" />
                <span>Emergency Care</span>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      <Section
        title={home.treatmentsTitle}
        subtitle={home.treatmentsSubtitle}
      >
        <RevealOnScroll>
        <div className="grid gap-4 md:grid-cols-3">
          {home.treatmentsCards.map((card, idx) => (
            <Card
              key={card.title}
              title={card.title}
              text={card.text}
              badge={card.badge}
              icon={[Stethoscope, ShieldCheck, Sparkles, ScanLine, Smile, Award][idx % 6]}
            />
          ))}
        </div>
        </RevealOnScroll>

        <div className="mt-6">
          <Link
            className="text-sm font-semibold text-sky-800 underline decoration-sky-300 underline-offset-4 transition duration-300 hover:text-slate-900"
            href="/treatments"
          >
            לכל תחומי הטיפול →
          </Link>
        </div>
      </Section>

      <Section title="המרפאה והרופא" subtitle={about.subtitle}>
        <RevealOnScroll>
          <div className="grid gap-6 md:grid-cols-2 items-stretch">
            <div className="surface-card overflow-hidden">
              {about.profileImageUrl ? (
                <img
                  src={about.profileImageUrl}
                  alt={about.introTitle}
                  className="h-full min-h-80 w-full object-cover"
                />
              ) : (
                <div className="h-full min-h-80 bg-gradient-to-br from-slate-100 to-white p-6 flex items-center justify-center text-slate-400">
                  תמונת פרופיל מקצועית
                </div>
              )}
            </div>
            <div className="surface-card p-7 flex flex-col">
              <h3 className="text-2xl font-bold text-slate-900">{about.introTitle}</h3>
              <p className="mt-3 text-slate-600 leading-relaxed">{about.introText}</p>
              <ul className="mt-5 space-y-2 text-slate-700 text-sm">
                {about.introBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ShieldCheck size={16} className="mt-0.5 text-[var(--primary-color)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/about"
                className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary-color)] hover:gap-2 transition duration-300"
              >
                להמשך קריאה
                <ArrowLeft size={16} />
              </Link>
            </div>
          </div>
        </RevealOnScroll>
      </Section>

      <Section
        title={home.processTitle}
        subtitle={home.processSubtitle}
      >
        <RevealOnScroll>
        <div className="grid gap-4 md:grid-cols-4">
          {home.processSteps.map((step) => (
            <div key={step.title} className="surface-card p-5">
              <div className="font-semibold text-slate-900">{step.title}</div>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
        </RevealOnScroll>
      </Section>

      <Section title={home.testimonialsTitle} subtitle={home.testimonialsSubtitle}>
        <RevealOnScroll>
        <Testimonials />
        </RevealOnScroll>
      </Section>

      <Section
        title={home.faqTitle}
        subtitle={home.faqSubtitle}
      >
        <RevealOnScroll>
        <FAQ />
        </RevealOnScroll>
      </Section>

      <Section
        title="יצירת קשר ומיקום"
        subtitle="אפשר לקבוע תור בטלפון או להשאיר פרטים ונחזור אליכם בהקדם."
      >
        <RevealOnScroll>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="surface-card p-6">
              <div className="space-y-3 text-slate-700">
                <div className="flex items-center gap-2">
                  <PhoneCall size={17} className="text-[var(--primary-color)]" />
                  <a href={`tel:${shared.phone}`} className="hover:text-[var(--primary-color)]">
                    {shared.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <LifeBuoy size={17} className="text-[var(--primary-color)]" />
                  <a href={`tel:${shared.mobile}`} className="hover:text-[var(--primary-color)]">
                    {shared.mobile}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={17} className="text-[var(--primary-color)]" />
                  <span>{shared.address}</span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/contact" className="btn-primary">
                  לתיאום ייעוץ
                </Link>
                <a href={`tel:${shared.phone}`} className="btn-secondary">
                  חיוג מהיר
                </a>
              </div>
            </div>

            <div className="surface-card overflow-hidden">
              {shared.mapEmbedUrl ? (
                <iframe
                  src={shared.mapEmbedUrl}
                  title="clinic-map"
                  className="h-[320px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="h-[320px] flex items-center justify-center text-slate-500">
                  הוסף קישור מפה מתוך פאנל הניהול
                </div>
              )}
            </div>
          </div>
        </RevealOnScroll>
      </Section>

      <section className="py-20">
        <div className="container">
          <RevealOnScroll>
          <div className="rounded-3xl bg-gradient-to-r from-sky-800 to-cyan-700 text-white p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_20px_60px_-35px_rgba(8,145,178,0.9)]">
            <div>
              <div className="text-2xl font-bold">{home.bottomCtaTitle}</div>
              <div className="text-slate-200 mt-2">
                {home.bottomCtaSubtitle}
              </div>
            </div>
            <Link
              href="/contact"
              className="rounded-xl bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-sky-50 transition"
            >
              {home.bottomCtaButton}
            </Link>
          </div>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}
