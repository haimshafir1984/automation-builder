import React, { useState } from "react";
import { planFromText, dryRun, execute } from "../api";

export default function FreeTextPlanner() {
  const [text, setText] = useState("");
  const [plan, setPlan] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onPlan() {
    setLoading(true);
    setResult(null);
    try {
      const p = await planFromText(text);
      setPlan(p);
      if (p?.proposal?.steps) {
        setPipeline({ steps: p.proposal.steps });
      }
    } finally {
      setLoading(false);
    }
  }

  async function onDryRun() {
    setLoading(true);
    setResult(null);
    try {
      const r = await dryRun(pipeline);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  async function onExecute() {
    setLoading(true);
    setResult(null);
    try {
      const r = await execute(pipeline);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12, marginBottom: 24 }}>
      <h2>Plan & Execute from Free Text</h2>
      <textarea
        style={{ width: "100%", minHeight: 100 }}
        placeholder="כתוב כאן הוראה חופשית..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={onPlan} disabled={!text || loading}>תכנן</button>
        <button onClick={onDryRun} disabled={!pipeline || loading}>Dry Run</button>
        <button onClick={onExecute} disabled={!pipeline || loading}>Execute</button>
      </div>

      {plan && (
        <div style={{ marginTop: 16 }}>
          <h3>Plan</h3>
          <pre>{JSON.stringify(plan, null, 2)}</pre>
        </div>
      )}

      {pipeline && (
        <div style={{ marginTop: 16 }}>
          <h3>Pipeline</h3>
          <pre>{JSON.stringify(pipeline, null, 2)}</pre>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <h3>Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
