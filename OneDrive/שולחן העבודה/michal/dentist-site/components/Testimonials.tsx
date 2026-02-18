const t = [
  {
    name: "מטופל/ת",
    text: "הרגשתי שיש תהליך מסודר, הסבר ברור ויחס אישי לכל אורך הטיפול."
  },
  {
    name: "מטופל/ת",
    text: "התכנון היה מדויק, הביצוע רגוע, והתוצאה נראית טבעית."
  },
  {
    name: "מטופל/ת",
    text: "קיבלתי מענה מקצועי למקרה מורכב ותחושת ביטחון לאורך כל הדרך."
  }
];

export default function Testimonials() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {t.map((x) => (
        <div
          key={x.name}
          className="surface-card p-6 bg-gradient-to-b from-white to-sky-50/40"
        >
          <div className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
            דוגמאות כלליות
          </div>
          <div className="text-sky-700 text-lg leading-none">“</div>
          <div className="text-slate-800 leading-relaxed mt-1">{x.text}</div>
          <div className="mt-3 text-sm font-semibold text-slate-700">{x.name}</div>
        </div>
      ))}
    </div>
  );
}
