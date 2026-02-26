"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Step = {
  time: string;
  title: string;
  icon: string;
  content: string;
  warnings: string[];
  videoId: string;
};

type Procedure = {
  title: string;
  steps: Step[];
};

const instructionsData: Record<"extraction" | "whitening" | "dentures", Procedure> = {
  extraction: {
    title: "עקירה או השתלה",
    steps: [
      {
        time: "מיד בתום הטיפול (0-20 דקות)",
        title: "עצירת הדימום",
        icon: "Clock",
        content:
          "יש לנשוך את ספוגית הגזה למשך 20 דקות. אין לירוק - יש לבלוע את הרוק. אם הפה רדום, היזהרו מנשיכת השפתיים או הלשון.",
        warnings: ["לא לירוק!", "לא לשטוף את הפה"],
        videoId: "vid_extraction_1"
      },
      {
        time: "בשעתיים-שלוש הראשונות",
        title: "התאוששות והרדמה",
        icon: "CoffeeOff",
        content:
          "הימנעו מאכילה ושתייה. אם צריך לקחת כדור, עשו זאת עם מעט מים. ניתן לקרר את האזור עם קרח מבחוץ.",
        warnings: ["אסור לאכול", "זהירות מכוויות (הפה רדום)"],
        videoId: "vid_extraction_2"
      },
      {
        time: "24 השעות הראשונות",
        title: "השעות הקריטיות",
        icon: "AlertTriangle",
        content:
          "אסור לירוק, אסור לשטוף את הפה ואסור לצחצח את אזור העקירה. יש להימנע מעישון, אלכוהול, או שתייה בקשית (פעולת היניקה פוגעת בקריש הדם). תזונה: אוכל קר ורך בלבד.",
        warnings: ["ללא קשית", "ללא עישון", "ללא יריקה"],
        videoId: "vid_extraction_3"
      },
      {
        time: "היום למחרת (אחרי 24 שעות)",
        title: "חזרה לשגרה והיגיינה",
        icon: "RefreshCw",
        content:
          "ניתן לחזור לצחצח שיניים (בזהירות באזור העקירה). יש להתחיל שטיפות פה (CORSODYL/TARODENT) פעמיים ביום. תיתכן נפיחות או סימן כחול - זה תקין ויעבור.",
        warnings: [],
        videoId: "vid_extraction_4"
      }
    ]
  },
  whitening: {
    title: "הלבנה ביתית",
    steps: [
      {
        time: "לפני השימוש",
        title: "הכנה",
        icon: "Sparkles",
        content:
          "צחצחו שיניים והשתמשו בחוט דנטלי. ההלבנה עובדת רק על שיניים נקיות לחלוטין.",
        warnings: ["לא בזמן הריון"],
        videoId: "vid_white_1"
      },
      {
        time: "הנחת החומר",
        title: "מינון מדויק",
        icon: "Pipette",
        content:
          "הניחו פס ג'ל דק (כ-1/7 מזרק) בחלק הפנימי של הסד (בצד שפונה לשפה).",
        warnings: ["לא להעמיס חומר"],
        videoId: "vid_white_2"
      },
      {
        time: "זמן הפעולה",
        title: "הרכבת הסד",
        icon: "Moon",
        content:
          "הניחו את הסד בפה. אם יצא חומר לחניכיים - נגבו מיד (זה גורם לרגישות). ניתן לישון עם הסד או להרכיב ל-4-6 שעות ביום.",
        warnings: ["לנקות שאריות מהחניכיים"],
        videoId: "vid_white_3"
      },
      {
        time: "בסיום הטיפול",
        title: "תחזוקה",
        icon: "Droplets",
        content:
          "שטפו את הסד במים קרים וייבשו. הימנעו במשך הטיפול מקפה, תה, יין אדום, קולה ועישון.",
        warnings: ["להימנע מאוכל צובע"],
        videoId: "vid_white_4"
      }
    ]
  },
  dentures: {
    title: "תותבות חדשות",
    steps: [
      {
        time: "ימי ההסתגלות",
        title: "התחלה חדשה",
        icon: "Smile",
        content:
          "בימים הראשונים ייתכן קושי בדיבור או ריבוי רוק - זה זמני. התחילו עם מזון רך ולעסו לאט.",
        warnings: ["להתחיל לאט"],
        videoId: "vid_denture_1"
      },
      {
        time: "שגרת ערב",
        title: "ניקיון יומיומי",
        icon: "MoonStar",
        content:
          "חובה להוציא את התותבת בלילה! יש לנקות אותה עם מברשת וסבון כלים (ללא משחה רגילה) ולשמור בכוס מים.",
        warnings: ["לישון בלי תותבת!"],
        videoId: "vid_denture_2"
      },
      {
        time: "טיפול בפה",
        title: "היגיינת הפה",
        icon: "HeartPulse",
        content:
          "גם ללא שיניים - יש לנקות את החניכיים, הלשון והחיך עם מברשת רכה בבוקר ובערב להמרצת הדם.",
        warnings: [],
        videoId: "vid_denture_3"
      }
    ]
  }
};

const iconMap: Record<string, string> = {
  Clock: "🕒",
  CoffeeOff: "🚫☕",
  AlertTriangle: "⚠️",
  RefreshCw: "🔄",
  Sparkles: "✨",
  Pipette: "🧪",
  Moon: "🌙",
  Droplets: "💧",
  Smile: "🙂",
  MoonStar: "🌙",
  HeartPulse: "💓"
};

function TimelineItem({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const firstSentence = step.content.split(".")[0]?.trim();
  const doHint = firstSentence ? `${firstSentence}.` : "פועלים לפי ההנחיות בשלב זה.";

  return (
    <div
      ref={ref}
      className={`relative pr-10 pb-10 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${Math.min(index * 80, 350)}ms` }}
    >
      <div className="absolute right-4 top-0 bottom-0 w-px bg-slate-200" />
      <div className="absolute right-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-sm shadow-sm">
        {iconMap[step.icon] || "•"}
      </div>

      <article className="surface-card p-5">
        <div className="text-xs font-semibold text-[var(--primary-color)]">{step.time}</div>
        <h3 className="mt-1 text-lg font-bold text-slate-900">{step.title}</h3>
        <p className="mt-3 text-slate-700 leading-relaxed">{step.content}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="text-sm font-semibold text-emerald-800">✓ מה כן לעשות</div>
            <p className="mt-1 text-sm text-emerald-900">{doHint}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-3">
            <div className="text-sm font-semibold text-red-800">✕ מה לא לעשות</div>
            {step.warnings.length ? (
              <ul className="mt-1 space-y-1 text-sm text-red-900">
                {step.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-red-900">אין איסורים מיוחדים בשלב זה.</p>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
          title={`coming-soon-${step.videoId}`}
        >
          ▶️ צפייה בהדרכה (בקרוב)
        </button>
      </article>
    </div>
  );
}

export default function PatientInstructionsCenter() {
  const [selected, setSelected] = useState<keyof typeof instructionsData>("extraction");
  const current = useMemo(() => instructionsData[selected], [selected]);

  return (
    <div className="space-y-8">
      <div className="surface-card p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected("extraction")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selected === "extraction"
                ? "text-white"
                : "bg-white text-slate-700 border border-slate-300"
            }`}
            style={selected === "extraction" ? { backgroundColor: "var(--primary-color)" } : undefined}
          >
            עקירה והשתלה
          </button>
          <button
            type="button"
            onClick={() => setSelected("whitening")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selected === "whitening"
                ? "text-white"
                : "bg-white text-slate-700 border border-slate-300"
            }`}
            style={selected === "whitening" ? { backgroundColor: "var(--primary-color)" } : undefined}
          >
            הלבנה ביתית
          </button>
          <button
            type="button"
            onClick={() => setSelected("dentures")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selected === "dentures"
                ? "text-white"
                : "bg-white text-slate-700 border border-slate-300"
            }`}
            style={selected === "dentures" ? { backgroundColor: "var(--primary-color)" } : undefined}
          >
            תותבות
          </button>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="text-2xl font-extrabold text-slate-900">{current.title}</h2>
        <p className="mt-2 text-slate-600">
          הנחיות הדרגתיות לביצוע בבית. יש לפעול לפי ההוראות של הרופא במקרה אישי.
        </p>
      </div>

      <div>
        {current.steps.map((step, index) => (
          <TimelineItem key={`${step.videoId}-${index}`} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}
