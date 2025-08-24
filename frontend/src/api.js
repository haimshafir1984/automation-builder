// עדכן כאן אם ה־backend רץ על פורט/דומיין אחר
const API_BASE = "http://127.0.0.1:5000";

/** תכנון מתוך טקסט חופשי */
export async function planFromText(text) {
  const res = await fetch(`${API_BASE}/api/plan/from-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

/** סימולציה (ללא שליחה אמיתית) */
export async function dryRun(pipeline) {
  const res = await fetch(`${API_BASE}/api/automations/dry-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pipeline),
  });
  return res.json();
}

/** הרצה בפועל */
export async function execute(pipeline) {
  const res = await fetch(`${API_BASE}/api/automations/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pipeline),
  });
  return res.json();
}

/**
 * תאימות לאחור ל-AutomationForm:
 * אם הקומפוננטה שולחת אובייקט "type/proposal" — ה-backend יודע להפוך אותו ל-pipeline (toPipeline)
 * ואם כבר שולחים pipeline מלא { steps: [...] } — זה יבוצע כמו שהוא.
 */
export async function createAutomation(data) {
  const res = await fetch(`${API_BASE}/api/automations/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
