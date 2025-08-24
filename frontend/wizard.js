const API = "http://127.0.0.1:5000";

let wizardState = {};
let currentSlots = [];

async function startWizard() {
  const text = document.querySelector("#freeText").value.trim();
  const r = await fetch(`${API}/wizard/start`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  }).then(x=>x.json());
  wizardState = r.state || {};
  currentSlots = r.slots || [];
  renderQuestions();
}

function renderQuestions() {
  const container = document.querySelector("#questions");
  container.innerHTML = "";

  const next = currentSlots.find(s => s.status === "missing");
  if (!next) {
    const btn = document.createElement("button");
    btn.textContent = "צור והפעל ב-n8n";
    btn.onclick = createInN8N;
    container.appendChild(btn);
    return;
  }

  const label = document.createElement("label");
  label.textContent = next.label + (next.suggest ? ` (הצעה: ${next.suggest})` : "");
  container.appendChild(label);

  let input;
  if (next.type === "choice") {
    input = document.createElement("select");
    (next.choices || []).forEach(c => {
      const opt = document.createElement("option"); opt.value = c; opt.textContent = c;
      if (next.default && next.default === c) opt.selected = true;
      input.appendChild(opt);
    });
  } else if (next.type === "select") {
    input = document.createElement("select");
    (next.choices || []).forEach(c => {
      const opt = document.createElement("option"); opt.value = c; opt.textContent = c;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement("input");
    input.type = "text";
    if (next.suggest) input.value = next.suggest;
    if (next.value)   input.value = next.value;
  }
  container.appendChild(input);

  const btn = document.createElement("button");
  btn.textContent = "המשך";
  btn.onclick = async () => {
    const val = input.value.trim();
    if (!val) { alert("נא למלא ערך"); return; }
    const r = await fetch(`${API}/wizard/answer`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: wizardState, slotId: next.id, value: val })
    }).then(x=>x.json());
    wizardState = r.state;
    currentSlots = r.slots;
    if (next.id === "spreadsheetId") await loadTabs(val);
    if (next.id === "sheetTab") await loadHeaders(wizardState.spreadsheetId, val);
    renderQuestions();
  };
  container.appendChild(btn);
}

async function loadTabs(sheetId) {
  const data = await fetch(`${API}/google/tabs?sheetId=${encodeURIComponent(sheetId)}`).then(x=>x.json());
  const slot = currentSlots.find(s=>s.id==="sheetTab");
  if (slot && data.ok) {
    slot.type = "select"; slot.choices = data.titles; slot.status = "missing";
  }
}

async function loadHeaders(sheetId, tab) {
  const data = await fetch(`${API}/google/headers?sheetId=${encodeURIComponent(sheetId)}&tab=${encodeURIComponent(tab)}`).then(x=>x.json());
  const slot = currentSlots.find(s=>s.id==="column");
  if (slot && data.ok) {
    slot.type = "select"; slot.choices = data.headers; slot.status = "missing";
  }
}

async function createInN8N() {
  const p = {
    spreadsheetId: wizardState["spreadsheetId"],
    sheetTab:      wizardState["sheetTab"],
    column:        wizardState["column"],
    operator:      wizardState["operator"] || "equals",
    value:         wizardState["value"],
    emailTo:       wizardState["email.to"],
    emailSubject:  wizardState["email.subject"] || "נמצאה התאמה ב-{{column}}: {{value}}",
    emailBody:     wizardState["email.body"] || "Project: {{project name}}\nSalary: {{salary}}\nDate: {{date}}",
  };

  const r = await fetch(`${API}/workflows/sheets-to-email`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  }).then(x=>x.json());

  document.querySelector("#result").textContent = JSON.stringify(r, null, 2);
  if (r.success) alert("נוצר וורקפלו ב-n8n 🎉");
}

document.querySelector("#startBtn").onclick = startWizard;
