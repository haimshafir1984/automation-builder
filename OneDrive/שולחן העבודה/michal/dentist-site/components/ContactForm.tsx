"use client";

import { useState } from "react";

type FormState = { ok: false; msg: string } | { ok: true; msg: string };

export default function ContactForm() {
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
          <label className="text-sm font-medium text-slate-700">שם מלא</label>
          <input
            name="fullName"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="שם מלא"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">טלפון לחזרה</label>
          <input
            name="phone"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="05x-xxxxxxx"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            אימייל (אופציונלי)
          </label>
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="name@email.com"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">מועד מועדף לחזרה</label>
          <select
            name="preferredTime"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
        <label className="text-sm font-medium text-slate-700">סיבת הפנייה</label>
        <textarea
          name="message"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 min-h-[110px] outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          placeholder="תיאור קצר של הצורך או המטרה לטיפול"
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          disabled={loading}
          className="btn-primary disabled:opacity-60"
        >
          {loading ? "שולח..." : "חזרו אליי"}
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
        אין לשלוח מידע רפואי רגיש בטופס. במקרה חירום רפואי יש לפנות למוקד מתאים.
      </p>
    </form>
  );
}
