import Link from "next/link";
import Section from "@/components/Section";
import Card from "@/components/Card";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";

export default function HomePage() {
  return (
    <>
      <section className="py-14 md:py-20">
        <div className="container grid gap-10 md:grid-cols-2 items-center">
          <div>
            <p className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              ד״ר בני פרדמן • מומחה לשיקום הפה • הרצליה
            </p>
            <h1 className="mt-4 text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
              שיקום הפה ואסתטיקה דנטלית בהרצליה
            </h1>
            <p className="mt-4 text-slate-600 text-lg leading-relaxed">
              תכנון דיגיטלי, דיוק, ויחס אישי רגוע — משלב האבחון ועד החיוך.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="btn-primary"
              >
                לתיאום ייעוץ
              </Link>
              <Link
                href="/treatments"
                className="btn-secondary"
              >
                תחומי טיפול
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="surface-card p-4">
                <div className="text-base font-bold text-sky-700">מומחה בשיקום הפה</div>
                <div className="text-xs text-slate-600 mt-1">דיוק שיקומי במקרים פשוטים ומורכבים</div>
              </div>
              <div className="surface-card p-4">
                <div className="text-base font-bold text-sky-700">תכנון דיגיטלי מתקדם</div>
                <div className="text-xs text-slate-600 mt-1">קבלת החלטות על בסיס תכנון והדמיה</div>
              </div>
              <div className="surface-card p-4">
                <div className="text-base font-bold text-sky-700">תהליך מסודר וליווי אישי</div>
                <div className="text-xs text-slate-600 mt-1">שקיפות מלאה ותיאום ציפיות בכל שלב</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50/80 to-white p-8 shadow-[0_15px_40px_-24px_rgba(2,132,199,0.5)]">
            <div className="text-sm font-semibold text-sky-800">הגישה הקלינית</div>
            <ul className="mt-4 space-y-3 text-slate-700">
              <li>✓ אבחון יסודי ותיאום ציפיות רפואי</li>
              <li>✓ תכנון שיקומי דיגיטלי לכל מקרה</li>
              <li>✓ התאמה אישית של פתרונות אסתטיים ותפקודיים</li>
              <li>✓ ביצוע מדורג ושמירה על נוחות לאורך התהליך</li>
              <li>✓ בקרה ומעקב לטווח ארוך</li>
            </ul>

            <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-5">
              <div className="font-semibold">מסר מקצועי</div>
              <p className="text-slate-600 mt-1 text-sm leading-relaxed">
                שיקום הפה בגישה רפואית מדויקת, תכנון דיגיטלי מתקדם, פתרונות למקרים
                מורכבים, יחס אישי רגוע.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section
        title="תחומי טיפול עיקריים"
        subtitle="שיקום ואסתטיקה דנטלית המותאמים למצב הרפואי, לצורך התפקודי ולמטרות האסתטיות."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            title="שיקום פה מורכב"
            text="בניית תכנית טיפול מלאה למקרים עם שחיקה, שיניים חסרות או שחזורים מרובים."
            badge="שיקום"
          />
          <Card
            title="שיקום על גבי שתלים"
            text="תכנון וביצוע שיקומי מדויק על שתלים כחלק ממענה תפקודי ואסתטי."
            badge="שתלים"
          />
          <Card
            title="כתרים ושחזורים אסתטיים"
            text="שחזורים מתקדמים כמו זירקוניה/חרסינה לשילוב בין חוזק, נראות ונוחות."
            badge="אסתטיקה"
          />
          <Card
            title="תכנון דיגיטלי וסריקה ממוחשבת"
            text="שימוש בכלים דיגיטליים לצורך תכנון מדויק, הדמיה ושיפור חוויית הטיפול."
            badge="דיגיטלי"
          />
          <Card
            title="פתרונות לחוסר שיניים"
            text="בחירת פתרון מותאם אישית לשיקום לעיסה, יציבות ואסתטיקה."
            badge="פתרונות"
          />
          <Card
            title="שיפור חיוך בגישה רפואית"
            text="תכנון שמרני עם דגש על תוצאה טבעית, תפקוד נכון ושמירה על רקמות השן."
            badge="גישה אישית"
          />
        </div>

        <div className="mt-6">
          <Link
            className="text-sm font-semibold text-sky-800 underline decoration-sky-300 underline-offset-4"
            href="/treatments"
          >
            לכל תחומי הטיפול →
          </Link>
        </div>
      </Section>

      <Section
        title="איך זה עובד"
        subtitle="תהליך מסודר שמתחיל באבחון וממשיך לביצוע מדורג ובקרה לאורך זמן."
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { title: "1. אבחון", text: "בדיקה קלינית, איסוף נתונים והגדרת מטרות טיפול." },
            { title: "2. תכנון דיגיטלי", text: "בניית תכנית טיפול מדויקת עם חלופות ברורות." },
            { title: "3. ביצוע מדורג", text: "יישום התכנית בשלבים, בקצב מותאם ונוח." },
            { title: "4. בקרה ותחזוקה", text: "מעקב והנחיות לשמירה על התוצאה לאורך זמן." }
          ].map((step) => (
            <div key={step.title} className="surface-card p-5">
              <div className="font-semibold text-slate-900">{step.title}</div>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="מה אומרים מטופלים" subtitle="דוגמאות כלליות לצורך המחשה.">
        <Testimonials />
      </Section>

      <Section
        title="שאלות נפוצות"
        subtitle="תשובות קצרות בנושאים נפוצים בשיקום הפה ותהליך הטיפול."
      >
        <FAQ />
      </Section>

      <section className="py-12">
        <div className="container">
          <div className="rounded-3xl bg-gradient-to-r from-sky-800 to-cyan-700 text-white p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_20px_60px_-35px_rgba(8,145,178,0.9)]">
            <div>
              <div className="text-2xl font-bold">לתכנון שיקומי מדויק מתחילים באבחון</div>
              <div className="text-slate-200 mt-2">
                אפשר להשאיר פרטים ונחזור לתיאום ייעוץ אישי.
              </div>
            </div>
            <Link
              href="/contact"
              className="rounded-xl bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-sky-50 transition"
            >
              לתיאום ייעוץ
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
