import React, { useMemo, useState, useEffect } from "react";
import { createAutomation } from "../api";
import { RECIPES } from "../recipes";

function setDeep(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  while (parts.length > 1) {
    const p = parts.shift();
    cur[p] = cur[p] || {};
    cur = cur[p];
  }
  cur[parts[0]] = value;
}

function Input({ f, value, onChange }) {
  if (f.type === "select") {
    return (
      <select name={f.key} value={value ?? ""} required={!!f.required} onChange={onChange}>
        <option value="" disabled>בחר/י…</option>
        {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (f.type === "textarea") {
    return (
      <textarea
        name={f.key}
        placeholder={f.placeholder || ""}
        value={value ?? ""}
        required={!!f.required}
        onChange={onChange}
      />
    );
  }
  return (
    <input
      name={f.key}
      placeholder={f.placeholder || ""}
      value={value ?? ""}
      required={!!f.required}
      onChange={onChange}
    />
  );
}

export default function AutomationForm() {
  const [recipeKey, setRecipeKey] = useState(localStorage.getItem("recipeKey") || "sheets_to_email");
  const [tenantId, setTenantId] = useState(localStorage.getItem("tenantId") || "tenant-123");
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const recipe = RECIPES[recipeKey];

  // טען ערכי ברירת מחדל/LocalStorage כשמתכון משתנה
  useEffect(() => {
    const initial = {};
    recipe?.fields.forEach(f => {
      const key = `field:${recipeKey}:${f.key}`;
      const saved = localStorage.getItem(key);
      initial[f.key] = saved ?? (f.default ?? "");
    });
    setValues(initial);
    localStorage.setItem("recipeKey", recipeKey);
  }, [recipeKey, recipe]);

  const canSubmit = useMemo(() => {
    if (!tenantId || !recipe) return false;
    return recipe.fields.every(f => !f.required || String(values[f.key] ?? "").trim() !== "");
  }, [tenantId, recipe, values]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      // שמור שדות
      Object.entries(values).forEach(([k, v]) => {
        localStorage.setItem(`field:${recipeKey}:${k}`, v ?? "");
      });
      localStorage.setItem("tenantId", tenantId);

      // המרה ל־params עם מקשים מקוננים (email.to)
      const params = {};
      Object.entries(values).forEach(([k, v]) => setDeep(params, k, v));

      const payload = { source: recipeKey, tenantId, params };
      // ה־backend הנוכחי מקבל { source, target, description } — אבל בגרסת ה־proxy שלנו
      // כבר משתמשים ב־/workflows/create-from-recipe. אם אתה עדיין על ה־backend החדש,
      // אתה יכול להחליף ל- { source, target, description } לפי מה שכתבת שם.
      // כאן ניצור איחוד קטן:
      let mapped = payload;
      if (recipeKey === "sheets_to_email") {
        mapped = { source: "google-sheets", target: "email", description: "Sheets → IF → Email" };
      } else if (recipeKey === "webhook_to_email") {
        mapped = { source: "webhook", target: "email", description: "Webhook → Email" };
      } else if (recipeKey === "webhook_to_slack") {
        mapped = { source: "webhook", target: "slack", description: "Webhook → Slack" };
      }

      const res = await createAutomation(mapped);
      setResult(res);
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="header" style={{marginBottom: 12}}>
          <div className="brand">
            <div className="logo">A</div>
            <div>
              <h1>בנה אוטומציה</h1>
              <div className="sub">כתוב טקסט חופשי, בחר מתכון ולחץ צור</div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-row">
            <label>Tenant ID</label>
            <input
              placeholder="tenant-123"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label>מתכון</label>
            <select value={recipeKey} onChange={(e) => setRecipeKey(e.target.value)} required>
              {Object.entries(RECIPES).map(([key, def]) => (
                <option key={key} value={key}>{def.title}</option>
              ))}
            </select>
            {recipe?.hint && <div className="sub" style={{marginTop: 4}}>{recipe.hint}</div>}
          </div>

          {recipe && (
            <>
              {recipe.fields.map(f => (
                <div className="form-row" key={f.key}>
                  <label>{f.label}</label>
                  <Input
                    f={f}
                    value={values[f.key]}
                    onChange={(e) => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </>
          )}

          <div className="row-2" style={{marginTop: 8}}>
            <button className="btn" type="submit" disabled={!canSubmit || submitting}>
              {submitting ? "יוצר…" : "צור אוטומציה"}
            </button>
            <span className="kbd">⌘/Ctrl + S לשמירה מהירה</span>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="header" style={{marginBottom: 10}}>
          <h1 style={{fontSize: 18, margin: 0}}>תוצאה</h1>
        </div>

        {!result && <div className="sub">עדיין לא נוצרה אוטומציה</div>}

        {result && (
          <>
            <div style={{marginBottom: 8}}>
              {result.success
                ? <span className="badge ok">הצלחתי ליצור Workflow</span>
                : <span className="badge err">שגיאה</span>}
            </div>
            <div className="result">
              {JSON.stringify(result, null, 2)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
