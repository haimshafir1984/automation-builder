const express = require("express");
const router = express.Router();

function includesAny(s, arr) {
  s = (s || "").toLowerCase();
  return arr.some(k => s.includes(k));
}

router.post("/", (req, res) => {
  const text = (req.body && req.body.text) || "";
  let spec = {
    source: "webhook",
    trigger: "incoming-webhook",
    target: "email",
    action: "send",
    fields: {},
    filters: [],
    mapping: {},
    params: {
      source: { path: "incoming" },
      target: { to: "you@example.com", subject: "New event", body: "New item received" }
    }
  };

  const isSheets = includesAny(text, ["google sheet", "google sheets", "gsheet", "גוגל", "שיט", "גליון", "גיליון"]);
  const isNewRow = includesAny(text, ["row added", "new row", "שורה חדשה", "נוספה שורה"]);
  const isEmail = includesAny(text, ["email", "מייל"]);

  if (isSheets && isNewRow && isEmail) {
    spec = {
      source: "google-sheets",
      trigger: "row-added",
      target: "email",
      action: "send",
      fields: {},
      filters: [],
      mapping: {},
      params: {
        source: { spreadsheetId: "REPLACE_SPREADSHEET_ID", sheetName: "Sheet1", headerRow: 1, intervalMinutes: 1 },
        target: { to: "you@example.com", subject: "Row added", body: "New row" }
      }
    };
  }
  return res.json({ success: true, spec, valid: true, errors: null });
});

module.exports = router;
