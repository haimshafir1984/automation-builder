const items = [
  {
    q: "כמה זמן נמשך תהליך שיקום הפה?",
    a: "משך הטיפול משתנה לפי מורכבות המקרה. לאחר בדיקה ותכנון תקבלו סדר שלבים ברור ולוחות זמנים משוערים."
  },
  {
    q: "כמה מפגשים נדרשים בדרך כלל?",
    a: "לעיתים מדובר במספר מצומצם של מפגשים ולעיתים בתהליך מדורג. התכנית מותאמת אישית למצב הקליני וליעדי הטיפול."
  },
  {
    q: "האם הטיפול כרוך בכאב?",
    a: "הטיפולים מבוצעים עם אלחוש מקומי וטכניקות עדינות לפי צורך, תוך הקפדה על נוחות המטופל לאורך כל התהליך."
  },
  {
    q: "איך שומרים על תוצאות הטיפול?",
    a: "בסיום התהליך ניתנות הנחיות תחזוקה וביקורות תקופתיות, כדי לשמור על תפקוד ואסתטיקה לאורך זמן."
  }
];

export default function FAQ() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((it) => (
        <div key={it.q} className="surface-card p-6">
          <div className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-100">
            שאלה נפוצה
          </div>
          <div className="font-semibold mt-3 text-slate-900">{it.q}</div>
          <div className="mt-2 text-slate-600 text-sm leading-relaxed">{it.a}</div>
        </div>
      ))}
    </div>
  );
}
