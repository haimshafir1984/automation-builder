export default function Card({
  title,
  text,
  badge
}: {
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <div className="surface-card p-6 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
        {badge ? (
          <span className="text-xs rounded-full bg-sky-50 px-3 py-1 text-sky-700 border border-sky-100">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}
