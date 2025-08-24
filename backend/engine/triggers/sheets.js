// engine/triggers/sheets.js
const fs = require("fs");
const cron = require("node-cron");
const { google } = require("googleapis");

const DEBUG = String(process.env.SHEETS_DEBUG_FILTERS || "").toLowerCase() === "true";

/* ---------- Google Service Account helpers ---------- */
function loadServiceAccount() {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (filePath && fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF|\uFEFF$/g, "");
    return JSON.parse(raw);
  }
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    const raw = Buffer.from(b64, "base64").toString("utf-8").replace(/^\uFEFF|\uFEFF$/g, "");
    return JSON.parse(raw);
  }
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY && process.env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, "\n");
  if (email && key) return { client_email: email, private_key: key };
  throw new Error("Missing Google service account credentials");
}

function getSheetsClient() {
  const sa = loadServiceAccount();
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return { api: google.sheets({ version: "v4", auth: jwt }), auth: jwt };
}

/* ---------------------- helpers --------------------- */
async function fetchRows(sheetsApi, spreadsheetId, sheetName) {
  const range = `${sheetName}!A:ZZ`;
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS",
  });
  return res.data.values || [];
}

async function fetchSheetGid(sheetsApi, spreadsheetId, sheetName) {
  const res = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const found = (res.data.sheets || []).find(s => s.properties && s.properties.title === sheetName);
  return found?.properties?.sheetId ?? null;
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    const key = (h || `col${i + 1}`).toString().trim();
    obj[key] = row[i] ?? "";
  });
  return obj;
}

function norm(s) {
  return String(s ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function lettersToIndex(letters) {
  let n = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const c = up.charCodeAt(i);
    if (c < 65 || c > 90) return -1;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function resolveValue(headers, rowArr, rowObj, field) {
  if (!field) return "";
  const raw = String(field).trim();

  // by header name
  const nHeaders = headers.map((h) => norm(h || ""));
  const idxByHeader = nHeaders.indexOf(norm(raw));
  if (idxByHeader >= 0) return rowArr[idxByHeader] ?? "";

  // by column letters (A, B, C, …)
  const idxByLetters = lettersToIndex(raw);
  if (idxByLetters >= 0) return rowArr[idxByLetters] ?? "";

  // direct object key
  return rowObj[raw] ?? "";
}

function passesFilters(headers, rowArr, rowObj, filters) {
  if (!Array.isArray(filters) || filters.length === 0) return true;
  for (const f of filters) {
    const op = (f.op || "").toString().trim();
    const actualRaw = resolveValue(headers, rowArr, rowObj, f.field);
    const expectedRaw = f.value != null ? String(f.value) : "";
    const actualN = norm(actualRaw);
    const expectedN = norm(expectedRaw);
    let ok = true;
    switch (op) {
      case "equals":
        ok = actualN === expectedN;
        break;
      case "contains":
        ok = actualN.includes(expectedN);
        break;
      case "not-empty":
        ok = actualN.length > 0;
        break;
      default:
        ok = true;
        break;
    }
    if (DEBUG) console.log("[sheets][filter]", { field: f.field, op, expected: expectedRaw, actual: actualRaw, ok });
    if (!ok) return false;
  }
  return true;
}

/* --------------------- scheduler -------------------- */
function scheduleSheetsRowAdded(wf, store, runAction, saveStore) {
  const minutes = Number(wf.params?.source?.intervalMinutes || 2);
  const spreadsheetId = wf.params?.source?.spreadsheetId;
  const sheetName = wf.params?.source?.sheetName || "Sheet1";
  const headerRow = Number(wf.params?.source?.headerRow || 1);
  if (!spreadsheetId) {
    console.warn(`[sheets] workflow ${wf.id} missing spreadsheetId`);
    return null;
  }

  const stateKey = `${spreadsheetId}:${sheetName}:${wf.id}`;
  store._sheetsState = store._sheetsState || {};
  const state = store._sheetsState;

  async function runner() {
    try {
      const { api: sheetsApi } = getSheetsClient();
      const rows = await fetchRows(sheetsApi, spreadsheetId, sheetName);
      if (!rows.length) return;

      // cache gid per workflow
      if (!state[stateKey]?.gid) {
        const gid = await fetchSheetGid(sheetsApi, spreadsheetId, sheetName);
        state[stateKey] = { ...(state[stateKey] || {}), gid };
        saveStore(store);
      }

      const headerRowIndex = Math.max(0, headerRow - 1);
      const headers = rows[headerRowIndex] || [];
      const dataRows = rows.slice(headerRowIndex + 1);
      if (DEBUG && headers.length) console.log("[sheets] headers:", headers);

      // first run — set pointer to current length, don't fire on old rows
      if (state[stateKey]?.last == null) {
        state[stateKey] = { ...(state[stateKey] || {}), last: dataRows.length };
        saveStore(store);
        console.log(`[sheets] init ${sheetName} rows=${dataRows.length} (wf ${wf.id})`);
        return;
      }

      const last = state[stateKey].last || 0;
      if (dataRows.length > last) {
        const newOnes = dataRows.slice(last);
        let sent = 0;
        for (let idx = 0; idx < newOnes.length; idx++) {
          const rowArr = newOnes[idx];
          const rowObj = rowToObject(headers, rowArr);
          const rowIndex = headerRowIndex + 2 + last + idx; // 1-based with header row

          if (!passesFilters(headers, rowArr, rowObj, wf.filters)) {
            if (DEBUG) console.log(`[sheets] row ${rowIndex} skipped by filters`, rowObj);
            continue;
          }

          let sheetUrlRange = null;
          const gid = state[stateKey].gid;
          try {
            const rangeA1 = `${sheetName}!A${rowIndex}:Z${rowIndex}`;
            if (gid != null) {
              sheetUrlRange = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}&range=${encodeURIComponent(rangeA1)}`;
            } else {
              sheetUrlRange = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#range=${encodeURIComponent(rangeA1)}`;
            }
          } catch (_) {}

          const payload = {
            source: "google-sheets",
            spreadsheetId,
            sheetName,
            rowIndex,
            row: rowObj,
            sheetUrlRange
          };

          try {
            await runAction(wf.target, wf.action, wf.params?.target || {}, payload);
            sent++;
            if (DEBUG) console.log(`[sheets] row ${rowIndex} → action sent`);
          } catch (e) {
            console.error("[sheets] action error:", e && e.message);
          }
        }
        state[stateKey].last = dataRows.length;
        saveStore(store);
        console.log(`[sheets] ${sheetName}: processed ${newOnes.length} new, sent ${sent} (wf ${wf.id})`);
      }
    } catch (e) {
      console.error("[sheets] error:", e && e.message);
    }
  }

  const expr = `*/${minutes} * * * *`;
  const task = cron.schedule(expr, runner);
  return { id: wf.id, expr, type: "sheets.row-added", task, runNow: runner };
}

function scheduleForWorkflow(wf, store, runAction, saveStore) {
  if (wf.source === "google-sheets" && wf.trigger === "row-added") {
    return scheduleSheetsRowAdded(wf, store, runAction, saveStore);
  }
  return null;
}

module.exports = { scheduleForWorkflow };
