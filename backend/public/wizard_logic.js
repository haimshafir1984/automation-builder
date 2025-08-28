// backend/public/wizard_logic.js
(() => {
  // --- מיפוי סלקטורים — אם ה-HTML שלך משתמש ב-id שונים, שנה רק כאן:
  const sel = {
    text:       '#userText',
    plan:       '#planJson',
    missing:    '#missingBox',
    out:        '#out',
    userKey:    '#userKey',
    ollamaUrl:  '#ollamaUrl',
    ollamaModel:'#ollamaModel',
  };

  const $ = s => document.querySelector(s);
  const show = (j, el=sel.out) => { const x = (typeof j === 'string')? j : JSON.stringify(j,null,2); $(el) && ($(el).textContent = x); };

  async function planFromText(){
    const text = ($(sel.text)?.value || '').trim();
    const baseUrl = ($(sel.ollamaUrl)?.value || '').trim();
    const model   = ($(sel.ollamaModel)?.value || '').trim();
    if (!text){ alert('נא להזין טקסט'); return; }

    const payload = { text };
    if (baseUrl) payload.baseUrl = baseUrl;
    if (model)   payload.model   = model;

    let j;
    try {
      const r = await fetch('/api/plan/from-text', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      j = await r.json();
    } catch(e){
      j = { ok:true, proposal:{ steps: [] }, missing: [] };
    }
    if (j && j.ok && j.proposal && Array.isArray(j.proposal.steps)){
      $(sel.plan) && ($(sel.plan).value = JSON.stringify(j.proposal, null, 2));
    } else {
      $(sel.plan) && ($(sel.plan).value = JSON.stringify({ steps: [] }, null, 2));
    }
    renderMissing(j?.missing || []);
    if (j?.nlpError) show('NLP note: '+j.nlpError+' · provider='+(j.provider||'—'));
  }

  let lastMissing = [];
  function renderMissing(m){
    lastMissing = m || [];
    const box = $(sel.missing); if (!box) return;
    box.innerHTML = '';
    if (!lastMissing.length){ box.textContent = '✓ אין שדות חסרים'; return; }
    lastMissing.forEach(m => {
      const id = `missing_${m.step}_${m.key}`;
      const row = document.createElement('div'); row.style.marginBottom='8px';
      row.innerHTML = `<div class="small">צעד #${m.step} — שדה נדרש: <b>${m.key}</b></div><input type="text" id="${id}" placeholder="ערך עבור ${m.key}">`;
      box.appendChild(row);
    });
  }

  function applyMissing(){
    try{
      const ta = $(sel.plan); if (!ta) return;
      const plan = JSON.parse(ta.value || '{"steps":[]}');
      if(!Array.isArray(plan.steps)) plan.steps = [];
      lastMissing.forEach(m => {
        const el = document.getElementById(`missing_${m.step}_${m.key}`);
        const val = (el && el.value || '').trim();
        if (!plan.steps[m.step]) return;
        const unit = plan.steps[m.step].action || plan.steps[m.step].trigger || {};
        if (!unit.params) unit.params = {};
        if (val) unit.params[m.key] = val;
      });
      ta.value = JSON.stringify(plan, null, 2);
      renderMissing([]);
    }catch(e){ show({ok:false,error:String(e.message||e)}); }
  }

  async function runPipeline(mode){
    try{
      const ta = $(sel.plan); if (!ta){ alert('לא נמצא שדה JSON'); return; }
      const txt = (ta.value || '').trim();
      if (!txt){ alert('אין תכנון'); return; }
      let plan; try { plan = JSON.parse(txt); } catch { alert('JSON לא תקין'); return; }
      if (!plan.steps || !plan.steps.length){ alert('תכנון ריק'); return; }

      const url = mode === 'dry' ? '/api/automations/dry-run' : '/api/automations/execute';
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(plan) });
      const j = await r.json();
      show(j);
    }catch(e){ show({ok:false,error:String(e.message||e)}); }
  }

  // חשיפת פונקציות אם הכפתורים שלך קוראים אליהן inline ב-HTML:
  window.planFromText = planFromText;
  window.applyMissing = applyMissing;
  window.runPipeline  = (m) => runPipeline(m);

  // אופציונלי: פונקציות OAuth אם יש לך כפתורים קיימים
  window.connectGoogle = async function(){
    try{
      const userKey = ($(sel.userKey)?.value || 'default').trim();
      const r = await fetch(`/api/google/oauth/url?userKey=${encodeURIComponent(userKey)}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error||'oauth url error');
      if (!j.connected && j.url) window.open(j.url, '_blank');
    } catch(e){ show({ok:false,error:String(e.message||e)}); }
  };
  window.checkGoogle = async function(){
    try{
      const userKey = ($(sel.userKey)?.value || 'default').trim();
      const r = await fetch(`/api/google/me?userKey=${encodeURIComponent(userKey)}`);
      const j = await r.json();
      show(j);
    } catch(e){ show({ok:false,error:String(e.message||e)}); }
  };
})();
