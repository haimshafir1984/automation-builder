// routes/sheets.js
const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");

const router = express.Router();

function extractSpreadsheetId(input) {
  if (!input) return null;
  if (/^[a-zA-Z0-9-_]{30,}$/.test(input)) return input;
  const m = String(input).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

// ===== Service Account client (existing) =====
function getSheetsClientWithServiceAccount(scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]) {
  const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing or not found");
  }
  const sa = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const auth = new google.auth.JWT(sa.client_email, null, sa.private_key, scopes);
  return { sheets: google.sheets({ version: "v4", auth }), auth };
}

// ===== OAuth client (new) =====
function getSheetsClientWithOAuth(req, scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]) {
  const tokens = req.session.googleTokens;
  if (!tokens) throw new Error("Not connected to Google (OAuth)");
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2.setCredentials(tokens);
  return { sheets: google.sheets({ version: "v4", auth: oauth2 }), auth: oauth2 };
}

// GET /api/sheets/test-access?spreadsheetId=...&mode=auto|oauth|sa
router.get("/test-access", async (req, res) => {
  try {
    const raw = req.query.spreadsheetId;
    const spreadsheetId = extractSpreadsheetId(raw);
    if (!spreadsheetId) return res.status(400).json({ ok: false, error: "Invalid spreadsheetId or URL" });

    const mode = (req.query.mode || "auto").toLowerCase();
    let api;
    if (mode === "oauth") {
      api = getSheetsClientWithOAuth(req).sheets;
    } else if (mode === "sa") {
      api = getSheetsClientWithServiceAccount().sheets;
    } else {
      // auto: prefer oauth if available, else SA
      api = (req.session.googleTokens ? getSheetsClientWithOAuth(req) : getSheetsClientWithServiceAccount()).sheets;
    }

    await api.spreadsheets.get({ spreadsheetId });
    res.json({ ok: true, spreadsheetId, mode: mode === "auto" ? (req.session.googleTokens ? "oauth" : "sa") : mode });
  } catch (e) {
    res.json({ ok: false, error: e?.message || String(e) });
  }
});

// POST /api/sheets/grant-access  { spreadsheetId }
router.post("/grant-access", async (req, res) => {
  try {
    const raw = (req.body && (req.body.spreadsheetId || req.body.id)) || null;
    const spreadsheetId = extractSpreadsheetId(raw);
    if (!spreadsheetId) return res.status(400).json({ ok: false, error: "Invalid spreadsheetId or URL" });

    // need OAuth to modify permissions
    const { auth: oauthAuth } = getSheetsClientWithOAuth(req, ["https://www.googleapis.com/auth/drive"]);
    const drive = google.drive({ version: "v3", auth: oauthAuth });

    // find Service Account email
    const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!jsonPath || !fs.existsSync(jsonPath)) return res.status(400).json({ ok: false, error: "missing GOOGLE_SERVICE_ACCOUNT_JSON" });
    const sa = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const saEmail = sa.client_email;
    if (!saEmail) return res.status(400).json({ ok: false, error: "service account email not found" });

    // add permission writer to SA
    await drive.permissions.create({
      fileId: spreadsheetId,
      supportsAllDrives: true,
      requestBody: {
        type: "user",
        role: "writer",
        emailAddress: saEmail,
      },
    });

    res.json({ ok: true, spreadsheetId, grantedTo: saEmail });
  } catch (e) {
    res.json({ ok: false, error: e?.message || String(e) });
  }
});

module.exports = router;
