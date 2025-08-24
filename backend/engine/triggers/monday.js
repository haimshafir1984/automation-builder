const cron = require("node-cron");
const fetch = require("node-fetch");

const DEBUG = String(process.env.MONDAY_DEBUG || "").toLowerCase() === "true";

async function gql(apiToken, query, variables){
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiToken
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (!res.ok || data.errors) throw new Error("Monday API error: " + JSON.stringify(data.errors || data));
  return data.data;
}

function scheduleMondayItemCreated(wf, store, runAction, saveStore){
  const minutes = Number(wf.params?.source?.intervalMinutes || 5);
  const apiToken = wf.params?.source?.apiToken || process.env.MONDAY_API_TOKEN;
  const boardId  = Number(wf.params?.source?.boardId || 0);
  if (!apiToken || !boardId) { console.warn("[monday] missing apiToken/boardId"); return null; }

  const stateKey = `monday:${boardId}:${wf.id}`;
  store._mondayState = store._mondayState || {};
  const state = store._mondayState;

  async function runner(){
    try {
      const q = `query ($bid: [Int]) {
        boards (ids: $bid) {
          items_page (limit: 100) { items { id name created_at } }
        }
      }`;
      const resp = await gql(apiToken, q, { bid: [boardId] });
      const items = resp.boards?.[0]?.items_page?.items || [];
      if (!(stateKey in state)){
        state[stateKey] = { lastCount: items.length };
        saveStore(store);
        console.log(`[monday] init board ${boardId} items=${items.length} (wf ${wf.id})`);
        return;
      }
      const last = state[stateKey].lastCount || 0;
      if (items.length > last){
        const newOnes = items.slice(0, items.length - last).reverse();
        let sent = 0;
        for (const it of newOnes){
          const payload = { source: "monday", boardId, item: it };
          try { await runAction(wf.target, wf.action, wf.params?.target || {}, payload); sent++; }
          catch(e){ console.error("[monday] action error:", e && e.message); }
        }
        state[stateKey].lastCount = items.length;
        saveStore(store);
        console.log(`[monday] board ${boardId}: processed ${newOnes.length} new, sent ${sent} (wf ${wf.id})`);
      }
    } catch(e){ console.error("[monday] error:", e && e.message); }
  }

  const expr = `*/${minutes} * * * *`;
  const task = cron.schedule(expr, runner);
  return { id: wf.id, expr, type: "monday.item-created", task, runNow: runner };
}

function scheduleForWorkflow(wf, store, runAction, saveStore){
  if (wf.source === "monday" && wf.trigger === "item-created"){
    return scheduleMondayItemCreated(wf, store, runAction, saveStore);
  }
  return null;
}

module.exports = { scheduleForWorkflow };
