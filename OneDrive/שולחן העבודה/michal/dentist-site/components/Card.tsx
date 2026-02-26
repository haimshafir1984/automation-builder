import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentType } from "react";

export default function Card({
  title,
  text,
  badge,
  href = "/treatments",
  icon: Icon
}: {
  title: string;
  text: string;
  badge?: string;
  href?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="surface-card p-6 rounded-2xl bg-white hover:-translate-y-1 hover:shadow-[0_20px_45px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-[var(--primary-color)] border border-slate-200">
              <Icon size={18} />
            </span>
          ) : null}
          <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
        </div>
        {badge ? (
          <span className="text-xs rounded-full bg-sky-50 px-3 py-1 text-sky-700 border border-sky-100">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-slate-600 leading-relaxed">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary-color)] transition duration-300 hover:gap-2"
      >
        Learn More
        <ArrowLeft size={16} />
      </Link>
    </div>
  );
}
