import Section from "@/components/Section";
import ContactForm from "@/components/ContactForm";

export default function ContactPage() {
  return (
    <Section
      title="תיאום ייעוץ"
      subtitle="השאירו פרטים ונחזור אליכם לתיאום שיחה ראשונית."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <ContactForm />

        <div className="surface-card p-6 bg-gradient-to-b from-sky-50/70 to-white">
          <h3 className="font-semibold text-lg">פרטי קשר</h3>
          <div className="mt-3 text-slate-700 space-y-2">
            <div>
              <span className="font-semibold">טלפון:</span> 09-7790809
            </div>
            <div>
              <span className="font-semibold">נייד:</span> 053-4534916
            </div>
            <div>
              <span className="font-semibold">אימייל:</span>{" "}
              <a
                href="mailto:benny.ferdman@gmail.com"
                className="text-sky-800 underline underline-offset-2"
              >
                benny.ferdman@gmail.com
              </a>
            </div>
            <div>
              <span className="font-semibold">כתובת:</span> הנדיב 71, הרצליה
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-5">
            <div className="font-semibold text-slate-900">לפני פגישת ייעוץ</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-1">
              <li>• רשימת תרופות קבועות</li>
              <li>• רגישויות ידועות</li>
              <li>• צילומים או סיכומים קודמים אם קיימים</li>
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
