"use client";

import { useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/site-content";
import {
  THEME_PRESETS,
  isThemePresetId,
  type ThemePresetId
} from "@/lib/theme-presets";

const sectionOptions = [
  { value: "shared", label: "מיתוג ופרטי קשר" },
  { value: "home", label: "עמוד בית" },
  { value: "about", label: "עמוד אודות" },
  { value: "treatments", label: "עמוד תחומי טיפול" },
  { value: "pricing", label: "עמוד עלויות" },
  { value: "contact", label: "עמוד צור קשר + טופס" },
  { value: "faq", label: "שאלות נפוצות" },
  { value: "testimonials", label: "המלצות" },
  { value: "publications", label: "אקדמיה/פרסומים" }
] as const;

type SectionValue = (typeof sectionOptions)[number]["value"];

type ApiResult = {
  ok: boolean;
  content: SiteContent;
};

type UploadResponse = { ok: boolean; url?: string; error?: string };

function isSectionValue(value: string): value is SectionValue {
  return sectionOptions.some((opt) => opt.value === value);
}

const defaultTheme: SiteContent["shared"]["theme"] = {
  presetId: "medical",
  primaryColor: "#0369a1",
  accentColor: "#0ea5e9",
  fontFamily: "assistant"
};

export default function AdminContentEditor({
  initialSection
}: {
  initialSection?: string;
}) {
  const [selected, setSelected] = useState<SectionValue>(() =>
    isSectionValue(initialSection || "") ? (initialSection as SectionValue) : "home"
  );
  const [content, setContent] = useState<SiteContent | null>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/content", { cache: "no-store" });
        const data = (await res.json()) as ApiResult;
        setContent(data.content);
      } catch {
        setStatus("שגיאה בטעינת תוכן");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!content) {
      return;
    }
    const sectionData = content[selected];
    if (selected === "shared" && sectionData && typeof sectionData === "object") {
      const shared = sectionData as SiteContent["shared"];
      setDraft({
        ...shared,
        theme: { ...defaultTheme, ...(shared.theme || {}) }
      });
    } else {
      setDraft(sectionData);
    }
    setStatus("");
  }, [selected, content]);

  const selectedLabel = useMemo(
    () => sectionOptions.find((s) => s.value === selected)?.label ?? "",
    [selected]
  );

  function linesToList(value: string) {
    return value
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function listToLines(value: string[]) {
    return value.join("\n");
  }

  function updateDraft(next: unknown) {
    setDraft(next);
  }

  async function onSave() {
    if (!content || !draft) {
      return;
    }
    setSaving(true);
    setStatus("");

    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: selected, data: draft })
      });
      const data = (await res.json()) as ApiResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "שגיאה בשמירה");
      }
      setContent(data.content);
      setStatus("נשמר בהצלחה");
    } catch (error: unknown) {
      if (error instanceof Error) {
        setStatus(error.message);
      } else {
        setStatus("שמירה נכשלה");
      }
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File, onSuccess: (url: string) => void, fieldKey: string) {
    setUploadingField(fieldKey);
    setStatus("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = (await res.json()) as UploadResponse;
      if (!res.ok || !data.url) {
        throw new Error(data.error || "העלאת תמונה נכשלה");
      }
      onSuccess(data.url);
      setStatus("התמונה הועלתה בהצלחה. אל תשכח/י ללחוץ שמירה.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "שגיאה בהעלאה");
    } finally {
      setUploadingField("");
    }
  }

  function updateItemArray<T>(arr: T[], index: number, item: T) {
    return arr.map((x, i) => (i === index ? item : x));
  }

  if (loading) {
    return (
      <div className="surface-card p-6">
        <p className="text-slate-600">טוען תוכן...</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full md:w-auto">
          <label className="text-sm font-medium text-slate-700">בחירת סקשן</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as SectionValue)}
            className="mt-1 w-full md:w-[280px] rounded-xl border border-slate-200 px-3 py-2 bg-white"
          >
            {sectionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        עריכת תוכן: <span className="font-semibold text-slate-900">{selectedLabel}</span>
      </p>

      {selected === "shared" && draft ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {(() => {
            const sharedDraft = draft as SiteContent["shared"];
            const theme = { ...defaultTheme, ...(sharedDraft.theme || {}) };
            const activePresetId: ThemePresetId = isThemePresetId(theme.presetId)
              ? theme.presetId
              : "medical";
            return (
              <>
          <label className="text-sm">
            <span className="font-medium">שם הרופא</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.doctorName}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  doctorName: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">תת כותרת</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.specialty}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  specialty: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">טלפון</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.phone}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  phone: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">נייד</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.mobile}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  mobile: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-medium">כתובת</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.address}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  address: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-medium">אימייל</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.email}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  email: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">וואטסאפ/טלפון מהיר</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.whatsapp || ""}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  whatsapp: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">קישור מפה (Embed)</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.mapEmbedUrl || ""}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  mapEmbedUrl: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Facebook</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.social?.facebook || ""}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  social: {
                    ...(sharedDraft.social || {}),
                    facebook: e.target.value
                  }
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Instagram</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.social?.instagram || ""}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  social: {
                    ...(sharedDraft.social || {}),
                    instagram: e.target.value
                  }
                })
              }
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-medium">LinkedIn</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={sharedDraft.social?.linkedin || ""}
              onChange={(e) =>
                updateDraft({
                  ...sharedDraft,
                  social: {
                    ...(sharedDraft.social || {}),
                    linkedin: e.target.value
                  }
                })
              }
            />
          </label>
          <div className="md:col-span-2 rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div className="font-semibold text-slate-900">לוגו / תמונת מותג</div>
            <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                placeholder="/uploads/logo.png"
                value={sharedDraft.logoImageUrl || ""}
                onChange={(e) =>
                  updateDraft({
                    ...sharedDraft,
                    logoImageUrl: e.target.value
                  })
                }
              />
              <label className="btn-secondary cursor-pointer text-center">
                העלאת לוגו
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadImage(
                      file,
                      (url) =>
                        updateDraft({
                          ...sharedDraft,
                          logoImageUrl: url
                        }),
                      "shared.logoImageUrl"
                    );
                  }}
                />
              </label>
            </div>
            {sharedDraft.logoImageUrl ? (
              <img
                src={sharedDraft.logoImageUrl}
                alt="logo preview"
                className="mt-3 h-16 w-16 rounded-xl border border-slate-200 object-cover"
              />
            ) : null}
          </div>
          <label className="text-sm md:col-span-2">
            <span className="font-medium">טקסט תחתון</span>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 min-h-20"
              value={(draft as SiteContent["shared"]).footerTagline}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["shared"]),
                  footerTagline: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-medium">דיסקליימר</span>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 min-h-20"
              value={(draft as SiteContent["shared"]).footerDisclaimer}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["shared"]),
                  footerDisclaimer: e.target.value
                })
              }
            />
          </label>
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">עיצוב האתר</div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <label className="text-sm block">
                <span className="font-medium">בחירת תבנית עיצוב</span>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 bg-white"
                  value={activePresetId}
                  onChange={(e) => {
                    const nextPresetId = e.target.value as ThemePresetId;
                    if (!isThemePresetId(nextPresetId)) return;
                    const preset = THEME_PRESETS[nextPresetId];
                    updateDraft({
                      ...sharedDraft,
                      theme: {
                        presetId: preset.id,
                        primaryColor: preset.primaryColor,
                        accentColor: preset.accentColor,
                        fontFamily: preset.fontFamily
                      }
                    });
                  }}
                >
                  {(Object.values(THEME_PRESETS) as Array<(typeof THEME_PRESETS)[ThemePresetId]>).map(
                    (preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm">
                <span className="font-medium">צבע ראשי</span>
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200"
                  value={theme.primaryColor}
                  onChange={(e) =>
                    updateDraft({
                      ...sharedDraft,
                      theme: {
                        ...theme,
                        presetId: activePresetId,
                        primaryColor: e.target.value
                      }
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">צבע משני</span>
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200"
                  value={theme.accentColor}
                  onChange={(e) =>
                    updateDraft({
                      ...sharedDraft,
                      theme: {
                        ...theme,
                        presetId: activePresetId,
                        accentColor: e.target.value
                      }
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">פונט</span>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 bg-white"
                  value={theme.fontFamily}
                  onChange={(e) =>
                    updateDraft({
                      ...sharedDraft,
                      theme: {
                        ...theme,
                        presetId: activePresetId,
                        fontFamily: e.target.value as SiteContent["shared"]["theme"]["fontFamily"]
                      }
                    })
                  }
                >
                  <option value="assistant">Assistant</option>
                  <option value="heebo">Heebo</option>
                  <option value="rubik">Rubik</option>
                </select>
              </label>
            </div>
          </div>
              </>
            );
          })()}
        </div>
      ) : null}

      {selected === "home" && draft ? (
        <div className="mt-3 grid gap-4">
          {(
            [
              ["pill", "שורת פתיח עליונה"],
              ["heroTitle", "כותרת ראשית"],
              ["heroSubtitle", "תת כותרת"],
              ["primaryCta", "כפתור ראשי"],
              ["secondaryCta", "כפתור משני"],
              ["clinicalTitle", "כותרת תיבה צדדית"],
              ["professionalMessageTitle", "כותרת מסר מקצועי"],
              ["professionalMessage", "תוכן מסר מקצועי"],
              ["treatmentsTitle", "כותרת תחומי טיפול"],
              ["treatmentsSubtitle", "תת כותרת תחומי טיפול"],
              ["processTitle", "כותרת איך זה עובד"],
              ["processSubtitle", "תת כותרת איך זה עובד"],
              ["testimonialsTitle", "כותרת המלצות"],
              ["testimonialsSubtitle", "תת כותרת המלצות"],
              ["faqTitle", "כותרת FAQ"],
              ["faqSubtitle", "תת כותרת FAQ"],
              ["bottomCtaTitle", "כותרת CTA תחתון"],
              ["bottomCtaSubtitle", "תוכן CTA תחתון"],
              ["bottomCtaButton", "טקסט כפתור CTA תחתון"]
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="text-sm">
              <span className="font-medium">{label}</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 p-2"
                value={(draft as SiteContent["home"])[field]}
                onChange={(e) =>
                  updateDraft({
                    ...(draft as SiteContent["home"]),
                    [field]: e.target.value
                  })
                }
              />
            </label>
          ))}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div className="font-semibold text-slate-900">תמונת Hero</div>
            <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                value={(draft as SiteContent["home"]).heroImageUrl || ""}
                onChange={(e) =>
                  updateDraft({
                    ...(draft as SiteContent["home"]),
                    heroImageUrl: e.target.value
                  })
                }
                placeholder="/uploads/hero.jpg"
              />
              <label className="btn-secondary cursor-pointer text-center">
                העלאת תמונה
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadImage(
                      file,
                      (url) =>
                        updateDraft({
                          ...(draft as SiteContent["home"]),
                          heroImageUrl: url
                        }),
                      "home.heroImageUrl"
                    );
                  }}
                />
              </label>
            </div>
            {(draft as SiteContent["home"]).heroImageUrl ? (
              <img
                src={(draft as SiteContent["home"]).heroImageUrl}
                alt="hero preview"
                className="mt-3 h-28 w-full rounded-xl border border-slate-200 object-cover"
              />
            ) : null}
          </div>
          <label className="text-sm">
            <span className="font-medium">כרטיסי ערכים</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["home"]).valueCards.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="כותרת"
                    value={item.title}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["home"]),
                        valueCards: updateItemArray((draft as SiteContent["home"]).valueCards, idx, {
                          ...item,
                          title: e.target.value
                        })
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 p-2"
                      placeholder="טקסט"
                      value={item.text}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["home"]),
                          valueCards: updateItemArray((draft as SiteContent["home"]).valueCards, idx, {
                            ...item,
                            text: e.target.value
                          })
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary px-3"
                      onClick={() =>
                        updateDraft({
                          ...(draft as SiteContent["home"]),
                          valueCards: (draft as SiteContent["home"]).valueCards.filter(
                            (_, i) => i !== idx
                          )
                        })
                      }
                    >
                      מחק
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["home"]),
                    valueCards: [
                      ...(draft as SiteContent["home"]).valueCards,
                      { title: "כותרת חדשה", text: "טקסט חדש" }
                    ]
                  })
                }
              >
                + הוסף כרטיס
              </button>
            </div>
          </label>
          <label className="text-sm">
            <span className="font-medium">נקודות קליניות (שורה לכל נקודה)</span>
            <textarea
              className="mt-1 w-full min-h-24 rounded-xl border border-slate-200 p-2"
              value={listToLines((draft as SiteContent["home"]).clinicalBullets)}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["home"]),
                  clinicalBullets: linesToList(e.target.value)
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">כרטיסי תחומי טיפול</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["home"]).treatmentsCards.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="grid gap-2 md:grid-cols-3">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="כותרת"
                    value={item.title}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["home"]),
                        treatmentsCards: updateItemArray(
                          (draft as SiteContent["home"]).treatmentsCards,
                          idx,
                          { ...item, title: e.target.value }
                        )
                      })
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="טקסט"
                    value={item.text}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["home"]),
                        treatmentsCards: updateItemArray(
                          (draft as SiteContent["home"]).treatmentsCards,
                          idx,
                          { ...item, text: e.target.value }
                        )
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 p-2"
                      placeholder="תג"
                      value={item.badge || ""}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["home"]),
                          treatmentsCards: updateItemArray(
                            (draft as SiteContent["home"]).treatmentsCards,
                            idx,
                            { ...item, badge: e.target.value || undefined }
                          )
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary px-3"
                      onClick={() =>
                        updateDraft({
                          ...(draft as SiteContent["home"]),
                          treatmentsCards: (draft as SiteContent["home"]).treatmentsCards.filter(
                            (_, i) => i !== idx
                          )
                        })
                      }
                    >
                      מחק
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["home"]),
                    treatmentsCards: [
                      ...(draft as SiteContent["home"]).treatmentsCards,
                      { title: "כותרת חדשה", text: "טקסט חדש", badge: "תג" }
                    ]
                  })
                }
              >
                + הוסף כרטיס טיפול
              </button>
            </div>
          </label>
          <label className="text-sm">
            <span className="font-medium">שלבי תהליך</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["home"]).processSteps.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="כותרת שלב"
                    value={item.title}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["home"]),
                        processSteps: updateItemArray((draft as SiteContent["home"]).processSteps, idx, {
                          ...item,
                          title: e.target.value
                        })
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 p-2"
                      placeholder="תיאור"
                      value={item.text}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["home"]),
                          processSteps: updateItemArray((draft as SiteContent["home"]).processSteps, idx, {
                            ...item,
                            text: e.target.value
                          })
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary px-3"
                      onClick={() =>
                        updateDraft({
                          ...(draft as SiteContent["home"]),
                          processSteps: (draft as SiteContent["home"]).processSteps.filter(
                            (_, i) => i !== idx
                          )
                        })
                      }
                    >
                      מחק
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["home"]),
                    processSteps: [
                      ...(draft as SiteContent["home"]).processSteps,
                      { title: "שלב חדש", text: "תיאור שלב" }
                    ]
                  })
                }
              >
                + הוסף שלב
              </button>
            </div>
          </label>
        </div>
      ) : null}

      {selected === "about" && draft ? (
        <div className="mt-3 grid gap-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div className="font-semibold text-slate-900">תמונת פרופיל / אודות</div>
            <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                value={(draft as SiteContent["about"]).profileImageUrl || ""}
                onChange={(e) =>
                  updateDraft({
                    ...(draft as SiteContent["about"]),
                    profileImageUrl: e.target.value
                  })
                }
                placeholder="/uploads/about.jpg"
              />
              <label className="btn-secondary cursor-pointer text-center">
                העלאת תמונה
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadImage(
                      file,
                      (url) =>
                        updateDraft({
                          ...(draft as SiteContent["about"]),
                          profileImageUrl: url
                        }),
                      "about.profileImageUrl"
                    );
                  }}
                />
              </label>
            </div>
            {(draft as SiteContent["about"]).profileImageUrl ? (
              <img
                src={(draft as SiteContent["about"]).profileImageUrl}
                alt="about preview"
                className="mt-3 h-28 w-full rounded-xl border border-slate-200 object-cover"
              />
            ) : null}
          </div>
          {(
            [
              ["title", "כותרת עמוד"],
              ["subtitle", "תת כותרת"],
              ["introTitle", "כותרת בלוק ראשון"],
              ["introText", "טקסט בלוק ראשון"],
              ["approachTitle", "כותרת גישה טיפולית"],
              ["approachText", "טקסט גישה טיפולית"],
              ["principlesTitle", "כותרת עקרונות עבודה"]
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="text-sm">
              <span className="font-medium">{label}</span>
              {field.endsWith("Text") || field === "subtitle" ? (
                <textarea
                  className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2"
                  value={(draft as SiteContent["about"])[field]}
                  onChange={(e) =>
                    updateDraft({
                      ...(draft as SiteContent["about"]),
                      [field]: e.target.value
                    })
                  }
                />
              ) : (
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2"
                  value={(draft as SiteContent["about"])[field]}
                  onChange={(e) =>
                    updateDraft({
                      ...(draft as SiteContent["about"]),
                      [field]: e.target.value
                    })
                  }
                />
              )}
            </label>
          ))}
          <label className="text-sm">
            <span className="font-medium">נקודות פתיח (שורה לכל נקודה)</span>
            <textarea
              className="mt-1 w-full min-h-24 rounded-xl border border-slate-200 p-2"
              value={listToLines((draft as SiteContent["about"]).introBullets)}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["about"]),
                  introBullets: linesToList(e.target.value)
                })
              }
            />
          </label>
          <div className="text-sm">
            <span className="font-medium">פריטי גישה טיפולית</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["about"]).approachItems.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="כותרת"
                    value={item.title}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["about"]),
                        approachItems: updateItemArray((draft as SiteContent["about"]).approachItems, idx, {
                          ...item,
                          title: e.target.value
                        })
                      })
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="טקסט"
                    value={item.text}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["about"]),
                        approachItems: updateItemArray((draft as SiteContent["about"]).approachItems, idx, {
                          ...item,
                          text: e.target.value
                        })
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3"
                    onClick={() =>
                      updateDraft({
                        ...(draft as SiteContent["about"]),
                        approachItems: (draft as SiteContent["about"]).approachItems.filter(
                          (_, i) => i !== idx
                        )
                      })
                    }
                  >
                    מחק
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["about"]),
                    approachItems: [
                      ...(draft as SiteContent["about"]).approachItems,
                      { title: "כותרת חדשה", text: "טקסט חדש" }
                    ]
                  })
                }
              >
                + הוסף פריט גישה
              </button>
            </div>
          </div>
          <div className="text-sm">
            <span className="font-medium">עקרונות עבודה</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["about"]).principles.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="כותרת"
                    value={item.title}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["about"]),
                        principles: updateItemArray((draft as SiteContent["about"]).principles, idx, {
                          ...item,
                          title: e.target.value
                        })
                      })
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="טקסט"
                    value={item.text}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["about"]),
                        principles: updateItemArray((draft as SiteContent["about"]).principles, idx, {
                          ...item,
                          text: e.target.value
                        })
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3"
                    onClick={() =>
                      updateDraft({
                        ...(draft as SiteContent["about"]),
                        principles: (draft as SiteContent["about"]).principles.filter(
                          (_, i) => i !== idx
                        )
                      })
                    }
                  >
                    מחק
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["about"]),
                    principles: [
                      ...(draft as SiteContent["about"]).principles,
                      { title: "עיקרון חדש", text: "תיאור עיקרון" }
                    ]
                  })
                }
              >
                + הוסף עיקרון
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selected === "treatments" && draft ? (
        <div className="mt-3 grid gap-4">
          <label className="text-sm">
            <span className="font-medium">כותרת</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["treatments"]).title}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["treatments"]),
                  title: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">תת כותרת</span>
            <textarea
              className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["treatments"]).subtitle}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["treatments"]),
                  subtitle: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">כרטיסי טיפולים</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["treatments"]).cards.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="grid gap-2 md:grid-cols-3">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    value={item.title}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["treatments"]),
                        cards: updateItemArray((draft as SiteContent["treatments"]).cards, idx, {
                          ...item,
                          title: e.target.value
                        })
                      })
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    value={item.text}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["treatments"]),
                        cards: updateItemArray((draft as SiteContent["treatments"]).cards, idx, {
                          ...item,
                          text: e.target.value
                        })
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 p-2"
                      value={item.badge || ""}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["treatments"]),
                          cards: updateItemArray((draft as SiteContent["treatments"]).cards, idx, {
                            ...item,
                            badge: e.target.value || undefined
                          })
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary px-3"
                      onClick={() =>
                        updateDraft({
                          ...(draft as SiteContent["treatments"]),
                          cards: (draft as SiteContent["treatments"]).cards.filter((_, i) => i !== idx)
                        })
                      }
                    >
                      מחק
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["treatments"]),
                    cards: [
                      ...(draft as SiteContent["treatments"]).cards,
                      { title: "טיפול חדש", text: "תיאור טיפול", badge: "תג" }
                    ]
                  })
                }
              >
                + הוסף טיפול
              </button>
            </div>
          </label>
          <label className="text-sm">
            <span className="font-medium">כותרת "למי זה מתאים"</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["treatments"]).suitableTitle}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["treatments"]),
                  suitableTitle: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">טקסט "למי זה מתאים"</span>
            <textarea
              className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["treatments"]).suitableText}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["treatments"]),
                  suitableText: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">טקסט כפתור</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["treatments"]).ctaLabel}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["treatments"]),
                  ctaLabel: e.target.value
                })
              }
            />
          </label>
        </div>
      ) : null}

      {selected === "pricing" && draft ? (
        <div className="mt-3 grid gap-4">
          <label className="text-sm">
            <span className="font-medium">כותרת</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["pricing"]).title}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["pricing"]),
                  title: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">תת כותרת</span>
            <textarea
              className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["pricing"]).subtitle}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["pricing"]),
                  subtitle: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">גורמים לעלות</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["pricing"]).factors.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    value={item.title}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["pricing"]),
                        factors: updateItemArray((draft as SiteContent["pricing"]).factors, idx, {
                          ...item,
                          title: e.target.value
                        })
                      })
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    value={item.text}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["pricing"]),
                        factors: updateItemArray((draft as SiteContent["pricing"]).factors, idx, {
                          ...item,
                          text: e.target.value
                        })
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3"
                    onClick={() =>
                      updateDraft({
                        ...(draft as SiteContent["pricing"]),
                        factors: (draft as SiteContent["pricing"]).factors.filter((_, i) => i !== idx)
                      })
                    }
                  >
                    מחק
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["pricing"]),
                    factors: [
                      ...(draft as SiteContent["pricing"]).factors,
                      { title: "גורם חדש", text: "תיאור גורם" }
                    ]
                  })
                }
              >
                + הוסף גורם
              </button>
            </div>
          </label>
          <label className="text-sm">
            <span className="font-medium">סיכום</span>
            <textarea
              className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["pricing"]).summary}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["pricing"]),
                  summary: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">טקסט כפתור</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["pricing"]).ctaLabel}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["pricing"]),
                  ctaLabel: e.target.value
                })
              }
            />
          </label>
        </div>
      ) : null}

      {selected === "contact" && draft ? (
        <div className="mt-3 grid gap-4">
          {(
            [
              ["title", "כותרת עמוד"],
              ["subtitle", "תת כותרת"],
              ["infoTitle", "כותרת פרטי קשר"],
              ["prepTitle", "כותרת לפני פגישת ייעוץ"]
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="text-sm">
              <span className="font-medium">{label}</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 p-2"
                value={(draft as SiteContent["contact"])[field]}
                onChange={(e) =>
                  updateDraft({
                    ...(draft as SiteContent["contact"]),
                    [field]: e.target.value
                  })
                }
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="font-medium">רשימת הכנה (שורה לכל פריט)</span>
            <textarea
              className="mt-1 w-full min-h-24 rounded-xl border border-slate-200 p-2"
              value={listToLines((draft as SiteContent["contact"]).prepItems)}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["contact"]),
                  prepItems: linesToList(e.target.value)
                })
              }
            />
          </label>
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div className="font-semibold text-slate-900 mb-3">שדות טופס</div>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["fullName", "שם מלא"],
                  ["phone", "טלפון"],
                  ["email", "אימייל"],
                  ["preferredTime", "מועד חזרה"],
                  ["message", "סיבת פנייה"],
                  ["submit", "טקסט כפתור"],
                  ["loading", "טקסט בזמן שליחה"],
                  ["fullNamePlaceholder", "פלייסהולדר שם"],
                  ["phonePlaceholder", "פלייסהולדר טלפון"],
                  ["emailPlaceholder", "פלייסהולדר אימייל"],
                  ["messagePlaceholder", "פלייסהולדר הודעה"]
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="text-sm">
                  <span className="font-medium">{label}</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 bg-white"
                    value={(draft as SiteContent["contact"]).formLabels[field]}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["contact"]),
                        formLabels: {
                          ...(draft as SiteContent["contact"]).formLabels,
                          [field]: e.target.value
                        }
                      })
                    }
                  />
                </label>
              ))}
              <label className="text-sm md:col-span-2">
                <span className="font-medium">טקסט פרטיות / אזהרה</span>
                <textarea
                  className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2 bg-white"
                  value={(draft as SiteContent["contact"]).formLabels.privacy}
                  onChange={(e) =>
                    updateDraft({
                      ...(draft as SiteContent["contact"]),
                      formLabels: {
                        ...(draft as SiteContent["contact"]).formLabels,
                        privacy: e.target.value
                      }
                    })
                  }
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {selected === "faq" && draft ? (
        <div className="mt-3 space-y-2">
          {(draft as SiteContent["faq"]).items.map((item, idx) => (
            <div key={`${item.q}-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                className="rounded-xl border border-slate-200 p-2"
                placeholder="שאלה"
                value={item.q}
                onChange={(e) =>
                  updateDraft({
                    ...(draft as SiteContent["faq"]),
                    items: updateItemArray((draft as SiteContent["faq"]).items, idx, {
                      ...item,
                      q: e.target.value
                    })
                  })
                }
              />
              <input
                className="rounded-xl border border-slate-200 p-2"
                placeholder="תשובה"
                value={item.a}
                onChange={(e) =>
                  updateDraft({
                    ...(draft as SiteContent["faq"]),
                    items: updateItemArray((draft as SiteContent["faq"]).items, idx, {
                      ...item,
                      a: e.target.value
                    })
                  })
                }
              />
              <button
                type="button"
                className="btn-secondary px-3"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["faq"]),
                    items: (draft as SiteContent["faq"]).items.filter((_, i) => i !== idx)
                  })
                }
              >
                מחק
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              updateDraft({
                ...(draft as SiteContent["faq"]),
                items: [...(draft as SiteContent["faq"]).items, { q: "שאלה חדשה", a: "תשובה חדשה" }]
              })
            }
          >
            + הוסף שאלה
          </button>
        </div>
      ) : null}

      {selected === "testimonials" && draft ? (
        <div className="mt-3 grid gap-4">
          <label className="text-sm">
            <span className="font-medium">תווית קטנה בכרטיס</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["testimonials"]).badgeLabel}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["testimonials"]),
                  badgeLabel: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">המלצות</span>
            <div className="mt-2 space-y-2">
              {(draft as SiteContent["testimonials"]).items.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="שם"
                    value={item.name}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["testimonials"]),
                        items: updateItemArray((draft as SiteContent["testimonials"]).items, idx, {
                          ...item,
                          name: e.target.value
                        })
                      })
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 p-2"
                    placeholder="טקסט"
                    value={item.text}
                    onChange={(e) =>
                      updateDraft({
                        ...(draft as SiteContent["testimonials"]),
                        items: updateItemArray((draft as SiteContent["testimonials"]).items, idx, {
                          ...item,
                          text: e.target.value
                        })
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3"
                    onClick={() =>
                      updateDraft({
                        ...(draft as SiteContent["testimonials"]),
                        items: (draft as SiteContent["testimonials"]).items.filter((_, i) => i !== idx)
                      })
                    }
                  >
                    מחק
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["testimonials"]),
                    items: [
                      ...(draft as SiteContent["testimonials"]).items,
                      { name: "מטופל/ת", text: "תוכן המלצה" }
                    ]
                  })
                }
              >
                + הוסף המלצה
              </button>
            </div>
          </label>
        </div>
      ) : null}

      {selected === "publications" && draft ? (
        <div className="mt-3 grid gap-4">
          <label className="text-sm">
            <span className="font-medium">כותרת עמוד</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["publications"]).title}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["publications"]),
                  title: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">תת כותרת עמוד</span>
            <textarea
              className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2"
              value={(draft as SiteContent["publications"]).subtitle}
              onChange={(e) =>
                updateDraft({
                  ...(draft as SiteContent["publications"]),
                  subtitle: e.target.value
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">פרסומים</span>
            <div className="mt-2 space-y-3">
              {(draft as SiteContent["publications"]).items.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className="rounded-xl border border-slate-200 p-2"
                      placeholder="כותרת"
                      value={item.title}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["publications"]),
                          items: updateItemArray(
                            (draft as SiteContent["publications"]).items,
                            idx,
                            { ...item, title: e.target.value }
                          )
                        })
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 p-2"
                      placeholder="כתב עת"
                      value={item.journal}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["publications"]),
                          items: updateItemArray(
                            (draft as SiteContent["publications"]).items,
                            idx,
                            { ...item, journal: e.target.value }
                          )
                        })
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 p-2"
                      placeholder="שנה"
                      type="number"
                      value={item.year}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["publications"]),
                          items: updateItemArray(
                            (draft as SiteContent["publications"]).items,
                            idx,
                            { ...item, year: Number(e.target.value) || item.year }
                          )
                        })
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 p-2"
                      placeholder="DOI"
                      value={item.doi || ""}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["publications"]),
                          items: updateItemArray(
                            (draft as SiteContent["publications"]).items,
                            idx,
                            { ...item, doi: e.target.value || undefined }
                          )
                        })
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 p-2"
                      placeholder="קישור DOI"
                      value={item.doiUrl || ""}
                      onChange={(e) =>
                        updateDraft({
                          ...(draft as SiteContent["publications"]),
                          items: updateItemArray(
                            (draft as SiteContent["publications"]).items,
                            idx,
                            { ...item, doiUrl: e.target.value || undefined }
                          )
                        })
                      }
                    />
                    <div className="flex gap-2">
                      <input
                        className="w-full rounded-xl border border-slate-200 p-2"
                        placeholder="קישור PubMed"
                        value={item.pubmedUrl || ""}
                        onChange={(e) =>
                          updateDraft({
                            ...(draft as SiteContent["publications"]),
                            items: updateItemArray(
                              (draft as SiteContent["publications"]).items,
                              idx,
                              { ...item, pubmedUrl: e.target.value || undefined }
                            )
                          })
                        }
                      />
                      <button
                        type="button"
                        className="btn-secondary px-3"
                        onClick={() =>
                          updateDraft({
                            ...(draft as SiteContent["publications"]),
                            items: (draft as SiteContent["publications"]).items.filter(
                              (_, i) => i !== idx
                            )
                          })
                        }
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  updateDraft({
                    ...(draft as SiteContent["publications"]),
                    items: [
                      ...(draft as SiteContent["publications"]).items,
                      {
                        title: "פרסום חדש",
                        year: new Date().getFullYear(),
                        journal: "שם כתב עת"
                      }
                    ]
                  })
                }
              >
                + הוסף פרסום
              </button>
            </div>
          </label>
        </div>
      ) : null}

      {status ? (
        <p className="mt-3 text-sm text-slate-700">{status}</p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          שינוי נשמר ישירות לאתר. אחרי שמירה בצע/י רענון כדי לראות את העדכון.
        </p>
      )}
      {uploadingField ? (
        <p className="mt-2 text-xs text-slate-500">מעלה תמונה... ({uploadingField})</p>
      ) : null}
    </div>
  );
}
