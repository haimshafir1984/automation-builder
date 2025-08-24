// routes/workflows.js
const express = require("express");

module.exports = function(engineApi){
  const r = express.Router();

  // רשימת וורקפלואים
  r.get("/workflows", (req, res) => {
    if (!engineApi) return res.json({ ok: true, engine: false, workflows: [] });
    res.json({ ok: true, engine: true, workflows: engineApi.listWorkflows() });
  });

  // עדכון enabled
  r.patch("/workflows/:id", (req, res) => {
    if (!engineApi) return res.status(400).json({ ok: false, error: "engine not enabled" });
    const id = req.params.id;
    const { enabled } = req.body || {};
    if (typeof enabled !== "boolean") return res.status(400).json({ ok: false, error: "enabled boolean required" });
    const wf = engineApi.setEnabled(id, enabled);
    if (!wf) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, workflow: wf });
  });

  // מחיקה
  r.delete("/workflows/:id", (req, res) => {
    if (!engineApi) return res.status(400).json({ ok: false, error: "engine not enabled" });
    const id = req.params.id;
    const ok = engineApi.removeWorkflow(id);
    if (!ok) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, removed: id });
  });

  // שליחת הודעת בדיקה ליעד
  r.post("/test-target", async (req, res) => {
    try {
      if (!engineApi) return res.status(400).json({ ok: false, error: "engine not enabled" });
      const { target, action = "send", params = {}, payload = {} } = req.body || {};
      if (!target) return res.status(400).json({ ok: false, error: "missing target" });
      const result = await engineApi.runAction(target, action, params, payload);
      res.json({ ok: true, result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  return r;
};
