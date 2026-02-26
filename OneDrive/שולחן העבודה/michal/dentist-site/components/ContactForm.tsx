"use client";

import { useState } from "react";
import type { SiteContent } from "@/lib/site-content";

type FormState = { ok: false; msg: string } | { ok: true; msg: string };

type FormLabels = SiteContent["contact"]["formLabels"];

export default function ContactForm({ labels }: { labels: FormLabels }) {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<FormState | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      fullName: String(fd.get("fullName") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || ""),
      message: String(fd.get("message") || ""),
      preferredTime: String(fd.get("preferredTime") || "")
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "שגיאה");
      }
      setState({ ok: true, msg: "תודה, קיבלנו את פנייתך ונחזור אליך בהקדם." });
      e.currentTarget.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "משהו השתבש";
      setState({ ok: false, msg: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="surface-card p-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">{labels.fullName}</label>
          <input
            name="fullName"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--bg-glow-2)]"
            placeholder={labels.fullNamePlaceholder}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">{labels.phone}</label>
          <input
            name="phone"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--bg-glow-2)]"
            placeholder={labels.phonePlaceholder}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">{labels.email}</label>
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--bg-glow-2)]"
            placeholder={labels.emailPlaceholder}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">{labels.preferredTime}</label>
          <select
            name="preferredTime"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--bg-glow-2)]"
            defaultValue="בוקר"
          >
            <option>בוקר</option>
            <option>צהריים</option>
            <option>אחר הצהריים</option>
            <option>ערב</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700">{labels.message}</label>
        <textarea
          name="message"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 min-h-[110px] outline-none transition focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--bg-glow-2)]"
          placeholder={labels.messagePlaceholder}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          disabled={loading}
          className="btn-primary disabled:opacity-60"
        >
          {loading ? labels.loading : labels.submit}
        </button>

        {state ? (
          <span
            className={state.ok ? "text-green-700 text-sm" : "text-red-700 text-sm"}
          >
            {state.msg}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {labels.privacy}
      </p>
    </form>
  );
}
