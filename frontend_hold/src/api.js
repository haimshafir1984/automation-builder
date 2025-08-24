// עדכן כאן אם ה־backend רץ על פורט/דומיין אחר
const API_BASE = "http://127.0.0.1:5000";


export async function createAutomation(data) {
  const res = await fetch(`${API_BASE}/api/automation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
