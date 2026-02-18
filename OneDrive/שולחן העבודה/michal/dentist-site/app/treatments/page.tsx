import Section from "@/components/Section";
import Card from "@/components/Card";
import Link from "next/link";

const treatments = [
  {
    title: "בדיקה מקיפה + תכנית טיפול",
    text: "אבחון מקיף ותכנון שיקומי מדורג הכולל מטרות תפקוד ואסתטיקה.",
    badge: "אבחון"
  },
  {
    title: "שיקום פה מורכב",
    text: "פתרונות שיקומיים למקרים עם שחיקה, חסרים מרובים או שחזורים ישנים.",
    badge: "שיקום"
  },
  {
    title: "שיקום על גבי שתלים",
    text: "תכנון וביצוע שחזורים על שתלים תוך התאמה תפקודית ואסתטית.",
    badge: "שתלים"
  },
  {
    title: "כתרים ושחזורים אסתטיים",
    text: "שחזורים מתקדמים (זירקוניה/חרסינה) לשיפור יציבות, נראות ונוחות.",
    badge: "אסתטיקה"
  },
  {
    title: "תכנון דיגיטלי וסריקה ממוחשבת",
    text: "שימוש בכלים דיגיטליים לצורך תכנון מדויק וקבלת החלטות קלינית מבוססת.",
    badge: "דיגיטלי"
  },
  {
    title: "פתרונות לחוסר שיניים",
    text: "התאמת אפשרות טיפולית לפי מצב הלסת, עומסים תפקודיים ומטרות המטופל.",
    badge: "פתרונות"
  }
];

export default function TreatmentsPage() {
  return (
    <Section
      title="תחומי טיפול"
      subtitle="שיקום הפה ואסתטיקה דנטלית בגישה קלינית מדויקת, עם תכנון אישי לכל מקרה."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {treatments.map((t) => (
          <Card key={t.title} title={t.title} text={t.text} badge={t.badge} />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-sky-100 p-6 bg-gradient-to-b from-sky-50/70 to-white">
        <div className="font-semibold text-sky-800">למי זה מתאים?</div>
        <p className="text-slate-600 mt-2 leading-relaxed">
          למטופלים עם שחזורים ישנים, שיניים חסרות, קושי בלעיסה, שחיקה מתקדמת או
          רצון לשיפור אסתטיקת החיוך במסגרת תכנית רפואית מסודרת.
        </p>
      </div>

      <div className="mt-8">
        <Link href="/contact" className="btn-primary">
          לתיאום ייעוץ
        </Link>
      </div>
    </Section>
  );
}
