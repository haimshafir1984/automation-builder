import Section from "@/components/Section";
import ContactForm from "@/components/ContactForm";
import AdminEditHint from "@/components/AdminEditHint";
import { getSiteContent } from "@/lib/site-content";

export default async function ContactPage() {
  const { contact, shared } = await getSiteContent();

  return (
    <Section
      title={contact.title}
      subtitle={contact.subtitle}
    >
      <AdminEditHint section="contact" />
      <div className="grid gap-6 md:grid-cols-2">
        <ContactForm labels={contact.formLabels} />

        <div className="surface-card p-6 bg-gradient-to-b from-[var(--bg-glow-1)] to-white">
          <h3 className="font-semibold text-lg">{contact.infoTitle}</h3>
          <div className="mt-3 text-slate-700 space-y-2">
            <div>
              <span className="font-semibold">טלפון:</span> {shared.phone}
            </div>
            <div>
              <span className="font-semibold">נייד:</span> {shared.mobile}
            </div>
            {shared.whatsapp ? (
              <div>
                <span className="font-semibold">WhatsApp:</span>{" "}
                <a
                  href={`https://wa.me/${shared.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--primary-color)] underline underline-offset-2"
                >
                  {shared.whatsapp}
                </a>
              </div>
            ) : null}
            <div>
              <span className="font-semibold">אימייל:</span>{" "}
              <a
                href={`mailto:${shared.email}`}
                className="text-[var(--primary-color)] underline underline-offset-2"
              >
                {shared.email}
              </a>
            </div>
            <div>
              <span className="font-semibold">כתובת:</span> {shared.address}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-5">
            <div className="font-semibold text-slate-900">{contact.prepTitle}</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-1">
              {contact.prepItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200">
            {shared.mapEmbedUrl ? (
              <iframe
                src={shared.mapEmbedUrl}
                title="contact-map"
                className="h-[260px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-slate-500 bg-white">
                ניתן להוסיף קישור מפה מתוך פאנל הניהול
              </div>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
