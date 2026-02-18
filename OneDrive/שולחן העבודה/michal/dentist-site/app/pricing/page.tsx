import Section from "@/components/Section";
import Link from "next/link";

const factors = [
  {
    title: "מורכבות קלינית",
    text: "רמת המורכבות הרפואית והצורך בשלבים שיקומיים מרובים."
  },
  {
    title: "מספר השיניים המעורבות",
    text: "היקף האזור המטופל משפיע על משך התהליך והיקף העבודה."
  },
  {
    title: "סוג השחזור הנדרש",
    text: "בחירת חומרים וטכניקות (כגון זירקוניה/חרסינה) מותאמת לכל מקרה."
  },
  {
    title: "רכיבים משלימים",
    text: "במקרים מסוימים נדרשים שתלים, מעבדה או הליכים משלימים נוספים."
  },
  {
    title: "מספר שלבי הטיפול",
    text: "תכנית טיפול מדורגת כוללת שלבים שונים של תכנון, ביצוע ובקרה."
  }
];

export default function PricingPage() {
  return (
    <Section
      title="איך נקבעת עלות הטיפול"
      subtitle="במקום מחירון קשיח, העלות נקבעת לאחר בדיקה קלינית ותכנון אישי בהתאם למאפייני המקרה."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {factors.map((factor) => (
          <div key={factor.title} className="surface-card p-6">
            <h3 className="font-semibold text-slate-900">{factor.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{factor.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-sky-100 bg-sky-50/60 p-6">
        <p className="text-slate-700 leading-relaxed">
          לאחר בדיקה ותיאום ציפיות מתקבלת הערכה מסודרת הכוללת שלבים קליניים,
          אפשרויות טיפול ועלויות צפויות.
        </p>
        <Link href="/contact" className="btn-primary inline-flex mt-4">
          לקבלת הערכה מסודרת לאחר בדיקה
        </Link>
      </div>
    </Section>
  );
}
