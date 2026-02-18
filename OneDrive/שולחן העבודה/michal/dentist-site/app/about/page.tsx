import Section from "@/components/Section";

export default function AboutPage() {
  return (
    <Section
      title="אודות ד״ר בני פרדמן"
      subtitle="מומחה לשיקום הפה ואסתטיקה דנטלית, עם דגש על תכנון מדויק, שקיפות קלינית ויחס אישי רגוע."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-6">
          <h3 className="font-semibold text-lg">ד״ר בני פרדמן</h3>
          <p className="mt-3 text-slate-600 leading-relaxed">
            ד״ר בני פרדמן מטפל במקרים שיקומיים ותפקודיים, כולל מקרים מורכבים
            הדורשים ראייה רחבה ותכנון רב-שלבי. תהליך העבודה משלב אבחון מעמיק,
            תכנון דיגיטלי, ושיח מקצועי ברור עם המטופל לכל אורך הדרך.
          </p>
          <ul className="mt-4 space-y-2 text-slate-700">
            <li>• מומחה לשיקום הפה ואסתטיקה דנטלית</li>
            <li>• טיפול במקרים מורכבים עם תכנון פרטני</li>
            <li>• גישה רפואית מדויקת עם תקשורת בגובה העיניים</li>
          </ul>
        </div>

        <div className="surface-card p-6 bg-gradient-to-b from-sky-50/70 to-white">
          <h3 className="font-semibold text-lg">גישה טיפולית</h3>
          <p className="mt-3 text-slate-600 leading-relaxed">
            בכל תכנית טיפול מושם דגש על תפקוד, אסתטיקה ויציבות לטווח ארוך.
            לפני כל שלב מוצגות האפשרויות, המשמעויות והשלבים הבאים בצורה ברורה.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="font-semibold">שקיפות ותיאום ציפיות</div>
              <div className="text-sm text-slate-600 mt-1">
                הסבר קליני ברור על החלופות, השלבים וההחלטות הטיפוליות.
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="font-semibold">תכנון קפדני</div>
              <div className="text-sm text-slate-600 mt-1">
                תכנון שיקומי דיגיטלי והגדרה מדויקת של מטרות טיפול.
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="font-semibold">אקדמיה ומחקר</div>
              <div className="text-sm text-slate-600 mt-1">
                מעורבות מתמשכת בתחומי חומרים דנטליים והדבקה כחלק מחשיבה קלינית עדכנית.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50/70 to-white p-6">
        <h3 className="text-xl font-bold text-slate-900">עקרונות עבודה</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="font-semibold">דיוק רפואי</div>
            <p className="mt-1 text-sm text-slate-600">
              קבלת החלטות קליניות על בסיס אבחון יסודי ותכנון מדויק.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="font-semibold">שמרנות</div>
            <p className="mt-1 text-sm text-slate-600">
              בחירה בפתרונות שמאזנים בין שיקום איכותי לשמירה על רקמות בריאות.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="font-semibold">אסתטיקה טבעית</div>
            <p className="mt-1 text-sm text-slate-600">
              תוצאה הרמונית שמתאימה למבנה הפנים ולחיוך האישי של כל מטופל.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="font-semibold">תיאום ציפיות</div>
            <p className="mt-1 text-sm text-slate-600">
              שיח פתוח וברור על תהליך, שלבים ויעדים קליניים לפני תחילת הטיפול.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
