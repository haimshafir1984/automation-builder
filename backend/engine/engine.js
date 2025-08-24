// engine/engine.js
const fs = require("fs");
const path = require("path");
const express = require("express");

// טריגרים
const sheetsTrigger = require("./triggers/sheets");
const imapTrigger = require("./triggers/imap");

// אקשנים
const emailAction = require("./actions/email");
const whatsappAction = require("./actions/whatsapp_twilio");
const slackAction = require("./actions/slack");
const telegramAction = require("./actions/telegram");
const sheetsAction = require("./actions/sheets"); // append-row

// ✅ חדש: מודול ה-Store המתמיד (state.json / workflows.json)
const storeMod = require("./store");

const DATA_DIR = path.join(__dirname, "data");
const WF_FILE = path.join(DATA_DIR, "workflows.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadWorkflows() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(WF_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveWorkflows(list) {
  ensureDataDir();
  fs.writeFileSync(WF_FILE, JSON.stringify(list, null, 2), "utf-8");
}

function genId() {
  return `${Date.now()}.${Math.floor(Math.random() * 1000)}`;
}

function startEngine(app) {
  // זה store פנימי לזיכרון ריצה (לא ה-state המתמיד)
  const store = {
    workflows: loadWorkflows(), // persisted list (מ- workﬂows.json)
    tasks: {},                  // id -> { id, type, expr, task }
  };

  function summarizeTasks() {
    return Object.values(store.tasks).map(t => ({
      id: t.id, type: t.type, expr: t.expr || null
    }));
  }

  // --- action dispatcher ---
  async function runAction(target, action, paramsTarget, payload) {
    if (target === "email" && action === "send") {
      return await emailAction.send(paramsTarget, payload);
    }
    if (target === "whatsapp" && action === "send") {
      return await whatsappAction.send(paramsTarget, payload);
    }
    if (target === "slack" && action === "send") {
      return await slackAction.send(paramsTarget, payload);
    }
    if (target === "telegram" && action === "send") {
      return await telegramAction.send(paramsTarget, payload);
    }
    if (target === "google-sheets" && action === "append-row") {
      return await sheetsAction.appendRow(paramsTarget, payload);
    }
    throw new Error(`unsupported action: ${target}.${action}`);
  }

  // --- scheduler for a given workflow ---
  function scheduleWorkflow(wf) {
    let t = null;

    // נטען state מתמיד בכל תזמון טריגר (כדי שהטריגר יוכל לקרוא/לכתוב ל-state.json)
    const persistentState = storeMod.loadStore();

    if (wf.source === "google-sheets" && wf.trigger === "row-added") {
      // ✅ העברה של saveStore (הייתה חסרה וגרמה ל-"saveStore is not a function")
      t = sheetsTrigger.scheduleForWorkflow(wf, persistentState, runAction, storeMod.saveStore);
    } else if (wf.source === "imap" && (wf.trigger === "new-email" || wf.trigger === "mail-received")) {
      // אם בעתיד נרצה גם state מתמיד ל-IMAP, אפשר להרחיב חתימה דומה
      t = imapTrigger.scheduleForWorkflow(wf, store, runAction);
    } else if (wf.source === "webhook" && wf.trigger === "incoming-webhook") {
      t = { id: wf.id, type: "webhook.incoming", expr: null };
    }

    if (t) store.tasks[wf.id] = t;
    return t;
  }

  function unscheduleWorkflow(id) {
    const t = store.tasks[id];
    if (t && t.task && typeof t.task.stop === "function") {
      try { t.task.stop(); } catch {}
    }
    delete store.tasks[id];
  }

  // --- persistence operations ---
  function addWorkflow(spec) {
    const wf = {
      id: genId(),
      enabled: true,
      ...spec
    };
    store.workflows.push(wf);
    saveWorkflows(store.workflows);
    if (wf.enabled) scheduleWorkflow(wf);
    return wf;
  }

  function listWorkflows() {
    return store.workflows.slice();
  }

  function setEnabled(id, enabled) {
    const wf = store.workflows.find(x => x.id === id);
    if (!wf) return null;
    if (wf.enabled === enabled) return wf;
    wf.enabled = enabled;
    saveWorkflows(store.workflows);
    if (enabled) scheduleWorkflow(wf);
    else unscheduleWorkflow(id);
    return wf;
  }

  function removeWorkflow(id) {
    const idx = store.workflows.findIndex(x => x.id === id);
    if (idx === -1) return false;
    unscheduleWorkflow(id);
    store.workflows.splice(idx, 1);
    saveWorkflows(store.workflows);
    return true;
  }

  // --- mount engine endpoints ---
  const router = express.Router();

  // DEBUG summary
  router.get("/debug", (req, res) => {
    res.json({
      ok: true,
      scheduled: summarizeTasks(),
      totals: { workflows: store.workflows.length, scheduled: Object.keys(store.tasks).length }
    });
  });

  // webhook endpoint: /engine/webhook/:path
  router.post("/webhook/:path", async (req, res) => {
    const p = req.params.path;
    const payload = req.body || {};
    let count = 0;
    for (const wf of store.workflows) {
      if (!wf.enabled) continue;
      if (wf.source === "webhook" && wf.trigger === "incoming-webhook") {
        const expected = wf?.params?.source?.path || "incoming";
        if (String(expected) === String(p)) {
          try {
            await runAction(wf.target, wf.action, wf.params?.target || {}, { source: "webhook", body: payload });
            count++;
            console.log("[webhook] delivered to", wf.id);
          } catch (e) {
            console.error("[webhook] error:", e?.message || e);
          }
        }
      }
    }
    res.json({ ok: true, results: [{ id: p, delivered: count }] });
  });

  app.use("/engine", router);

  // --- boot: schedule enabled workflows ---
  console.log(`[engine] starting with ${store.workflows.filter(w => w.enabled).length} workflows`);
  for (const wf of store.workflows) {
    if (wf.enabled) scheduleWorkflow(wf);
  }

  return {
    addWorkflow,
    listWorkflows,
    setEnabled,
    removeWorkflow,
    runAction
  };
}

module.exports = { startEngine };
