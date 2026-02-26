import { getSiteContent } from "@/lib/site-content";
import { Star } from "lucide-react";

export default async function Testimonials() {
  const testimonials = (await getSiteContent()).testimonials;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {testimonials.items.map((x, idx) => (
        <div
          key={`${x.name}-${idx}`}
          className="surface-card p-6 bg-white hover:-translate-y-1 hover:shadow-[0_20px_45px_-24px_rgba(15,23,42,0.35)]"
        >
          <div className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
            {testimonials.badgeLabel}
          </div>
          <div className="text-sky-700 text-lg leading-none">“</div>
          <div className="text-slate-800 leading-relaxed mt-1">{x.text}</div>
          <div className="mt-3 flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} fill="currentColor" />
            ))}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-800">{x.name}</div>
        </div>
      ))}
    </div>
  );
}
