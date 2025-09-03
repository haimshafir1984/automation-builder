'use strict';

/**
 * Automation Builder - Backend (Render-ready)
 * LLM-first planner (Groq/OpenAI) + Heuristics fallback + Hebrew normalization.
 * Supports: Gmail/Sheets OAuth, planning, execute, saved automations, dry-run.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const twilio = require('twilio');

const fetchFn = (...args) => fetch(...args);
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

/* ---------------- Static ---------------- */
const PUBLIC_DIR = (process.env.PUBLIC_DIR && fs.existsSync(process.env.PUBLIC_DIR))
  ? process.env.PUBLIC_DIR
  : path.join(__dirname, 'public');
if (!fs.existsSync(PUBLIC_DIR)) console.warn('[static] PUBLIC_DIR missing:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

/* ---------------- Env ---------------- */
const PORT = process.env.PORT || 5000;
const OAUTH_REDIRECT_URL = process.env.OAUTH_REDIRECT_URL || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const LEGACY_GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

const NLP_PROVIDER = (process.env.NLP_PROVIDER || 'heuristic').toLowerCase();
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '';
const TWILIO_WHATSAPP_TO = process.env.TWILIO_WHATSAPP_TO || '';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

const TOKEN_STORE = (process.env.TOKEN_STORE || 'file').toLowerCase();
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const TOKENS_FILE_PATH = process.env.TOKENS_FILE_PATH || path.join(process.cwd(), 'tokens.json');
const KV_FILE_PATH = process.env.KV_FILE_PATH || path.join(process.cwd(), 'store.json');

const capabilities = [
  'gmail.unreplied','gmail.from','sheets.match',
  'sheets.append','email.send','whatsapp.send','slack.send','telegram.send','webhook.call'
];
const TOKENS_KEY = 'google_oauth_tokens_v1';

/* ---------------- Token Store ---------------- */
async function redisCommand(arr) {
  const url = UPSTASH_URL, token = UPSTASH_TOKEN;
  if (!url || !token) throw new Error('UPSTASH env not set');
  const resp = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ command: arr }) });
  if (!resp.ok) throw new Error(`Upstash ${resp.status}`);
  return await resp.json();
}
async function saveTokens(tokens){
  try{
    if (TOKEN_STORE === 'redis') { await redisCommand(['SET', TOKENS_KEY, JSON.stringify(tokens)]); }
    else { fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(tokens, null, 2)); }
    return true;
  }catch(e){ console.error('saveTokens', e); return false; }
}
async function loadTokens(){
  try{
    if (TOKEN_STORE === 'redis'){ const d = await redisCommand(['GET', TOKENS_KEY]); return d?.result ? JSON.parse(d.result) : null; }
    if (!fs.existsSync(TOKENS_FILE_PATH)) return null;
    return JSON.parse(fs.readFileSync(TOKENS_FILE_PATH,'utf8'));
  }catch(e){ console.error('loadTokens', e); return null; }
}
async function clearTokens(){
  try{
    if (TOKEN_STORE === 'redis') await redisCommand(['DEL', TOKENS_KEY]);
    else if (fs.existsSync(TOKENS_FILE_PATH)) fs.unlinkSync(TOKENS_FILE_PATH);
    return true;
  }catch(e){ console.error('clearTokens', e); return false; }
}
async function storeHealth(){
  const res = { store: TOKEN_STORE, ok: true };
  try{
    if (TOKEN_STORE === 'redis'){
      const key = `__probe_${Date.now()}`;
      await redisCommand(['SET', key, '1']); const got = await redisCommand(['GET', key]); await redisCommand(['DEL', key]);
      if (!got?.result) throw new Error('redis get failed');
    } else {
      fs.writeFileSync(TOKENS_FILE_PATH+'.probe','1'); const ok = fs.existsSync(TOKENS_FILE_PATH+'.probe'); fs.unlinkSync(TOKENS_FILE_PATH+'.probe'); if (!ok) throw new Error('file probe failed');
    }
  }catch(e){ res.ok=false; res.error=e.message||String(e); }
  return res;
}

/* ---------------- KV (file/redis) ---------------- */
async function kvSet(key, val){
  try{
    if (TOKEN_STORE === 'redis') await redisCommand(['SET', `kv:${key}`, JSON.stringify(val)]);
    else {
      const db = fs.existsSync(KV_FILE_PATH) ? JSON.parse(fs.readFileSync(KV_FILE_PATH,'utf8')||'{}') : {};
      db[key]=val; fs.writeFileSync(KV_FILE_PATH, JSON.stringify(db,null,2));
    }
  }catch(e){ console.error('kvSet', e); }
}
async function kvGet(key){
  try{
    if (TOKEN_STORE === 'redis'){ const d = await redisCommand(['GET', `kv:${key}`]); return d?.result ? JSON.parse(d.result) : null; }
    if (!fs.existsSync(KV_FILE_PATH)) return null;
    return (JSON.parse(fs.readFileSync(KV_FILE_PATH,'utf8')||'{}'))[key] ?? null;
  }catch(e){ console.error('kvGet', e); return null; }
}

/* ---------------- Google Clients ---------------- */
async function getOAuth2(){
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL);
  const persisted = await loadTokens();
  if (persisted?.refresh_token) oauth2Client.setCredentials({ refresh_token: persisted.refresh_token });
  else if (LEGACY_GOOGLE_REFRESH_TOKEN) oauth2Client.setCredentials({ refresh_token: LEGACY_GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}
async function getSheetsClient(){
  if (GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS)){
    const sa = new JWT({ keyFile: GOOGLE_APPLICATION_CREDENTIALS, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    return google.sheets({ version: 'v4', auth: sa });
  }
  return google.sheets({ version: 'v4', auth: await getOAuth2() });
}
async function getGmailClient(){ return google.gmail({ version: 'v1', auth: await getOAuth2() }); }
async function getCurrentUserEmail(){ try{ const g=await getGmailClient(); const p=await g.users.getProfile({userId:'me'}); return p.data.emailAddress||null; } catch{ return null; } }

/* ---------------- Basic Routes ---------------- */
app.get('/', (_,res)=>res.redirect('/wizard_plus.html'));
app.get(['/wizard_plus.html','/wizard_plus'], (req,res)=>{
  const fp=path.join(PUBLIC_DIR,'wizard_plus.html'); if(!fs.existsSync(fp)) return res.status(404).send('wizard_plus.html not found'); res.sendFile(fp);
});
app.get('/api/health', (_,res)=>res.json({ok:true,time:new Date().toISOString()}));
app.get('/api/registry', (_,res)=>res.json({ok:true,capabilities}));
app.get('/api/debug/staticDir', async (_,res)=>{ const health=await storeHealth(); res.json({ok:true,PUBLIC_DIR,TOKEN_STORE,storeOk:health.ok,storeError:health.error||null}); });
app.get('/api/nlp/status', (_,res)=>{ res.json({ ok:true, provider: NLP_PROVIDER, model: GROQ_MODEL }); });

/* ---------------- Google OAuth ---------------- */
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
];
app.get('/api/google/oauth/url', (req,res)=>{
  try{
    const o = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL);
    const url = o.generateAuthUrl({ access_type:'offline', scope:OAUTH_SCOPES, prompt:'consent' });
    res.json({ ok:true, url });
  }catch(e){ res.status(500).json({ ok:false, error:'OAUTH_URL_FAILED' }); }
});
app.get('/api/google/oauth/callback', async (req,res)=>{
  try{
    const code=req.query.code; const o=new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL);
    const { tokens } = await o.getToken(code);
    const existing = await loadTokens();
    const merged = { ...existing, ...tokens, refresh_token: tokens.refresh_token || existing?.refresh_token || LEGACY_GOOGLE_REFRESH_TOKEN || '' };
    const saved = await saveTokens(merged);
    if(!saved) return res.status(500).send('<html dir="rtl"><body>נכשל לשמור טוקנים. בדקו TOKEN_STORE.<br/><a href="/wizard_plus.html#connected=0">חזרה</a></body></html>');
    res.redirect('/wizard_plus.html#connected=1');
  }catch(e){ res.status(500).json({ ok:false, error:'OAUTH_CALLBACK_FAILED' }); }
});
app.get('/api/google/auth/status', async (req,res)=>{
  try{
    const tokens = await loadTokens(); const health = await storeHealth();
    res.json({ ok:true, hasRefreshToken: !!(tokens?.refresh_token || LEGACY_GOOGLE_REFRESH_TOKEN), storeOk:health.ok });
  }catch{ res.json({ ok:true, hasRefreshToken: !!LEGACY_GOOGLE_REFRESH_TOKEN, storeOk:false }); }
});
app.post('/api/google/logout', async (req,res)=>{ await clearTokens(); res.json({ ok:true }); });
app.get('/api/google/me', async (req,res)=>{ try{ const g=await getGmailClient(); const p=await g.users.getProfile({userId:'me'}); res.json({ok:true,emailAddress:p.data.emailAddress}); }catch(e){ res.json({ok:false,error:'GOOGLE_ME_FAILED'}); }});

/* ===================================================================
   NLP Planner (Groq/OpenAI first, Heuristics fallback) + Hebrew utils
=================================================================== */
const SKILLS = {
  triggers: {
    'gmail.unreplied': { required:['fromEmail'], optional:['newerThanDays','hours','limit'], defaults:{ newerThanDays:30, hours:10, limit:50 } },
    'gmail.from':      { required:['fromEmails'], optional:['newerThanDays','limit'],       defaults:{ newerThanDays:30, limit:100 } },
    'sheets.match':    { required:['spreadsheetId','sheetName','columnName','equals'], optional:['mode'], defaults:{ mode:'new' } },
  },
  actions: {
    'sheets.append': { required:['spreadsheetId','sheetName','row'], optional:[] },
    'email.send':    { required:['to'], optional:['subject','body'] },
    'whatsapp.send': { required:['to'], optional:['message'] },
    'slack.send':    { required:[], optional:['message'] },
    'telegram.send': { required:[], optional:['message'] },
    'webhook.call':  { required:[], optional:['url','method','headers','context'] },
  },
};
function normalizeHe(s=''){
  let t=String(s||'');
  t=t.replace(/[\u200e\u200f]/g,'').trim()
     .replace(/[“”„״]/g,'"').replace(/[’׳]/g,'\'').replace(/[–—]/g,'-')
     .replace(/ווא?טסאפ|ווטסאפ/gi,'whatsapp').replace(/גוגל\s*שיט|שיט\b/gi,'sheet').replace(/\bgmail\b/gi,'gmail')
     .replace(/\s+/g,' ');
  return t;
}
const RE_GMAIL_WORDS=/(gmail|מייל(?:ים)?|דוא["”]?ל|אימייל)/i, RE_UNREPLIED=/(שלא\s*נענ(?:ו|ה)|לא\s*נענ(?:ו|ה)|ללא\s*מענה|unrepl(?:ied)?|sla)/i,
      RE_SEND_VERBS=/(שול(?:ח|חים|חת|חות)|ישל(?:ח|חו)|שלח(?:ו)?|send|נשלח)/i, RE_WHATSAPP=/(whats\s*app|whatsapp|ו[וא]?טסאפ)/i,
      RE_SHEET_WORDS=/(גיליון|sheet|טבלה)/i, RE_TWO_PEOPLE=/(?:2|שניים|שני|שתיים|שתי)\s*(?:אנשים|שולחים)|אחד\s*מהם/i;
function extractEmail(s=''){ const m=s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/); return m?m[0]:''; }
function extractEmails(s=''){ const a=s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g); return Array.isArray(a)?Array.from(new Set(a)):[]; }
function extractSpreadsheetId(s=''){ const m=s.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); if(m) return m[1]; const m2=s.match(/spreadsheetId=([a-zA-Z0-9-_]+)/); return m2?m2[1]:''; }
function extractSheetName(s=''){ const t=s.replace(/\n/g,' '); let name=''; let m=t.match(/לשונית\s+["“]?(.+?)["”]?(?=\s|$)/i); if(m) name=m[1];
  if(!name){ m=t.match(/\b(?:tab|sheet|לשונית)\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i); if(m) name=m[1]; }
  if(!name){ m=t.match(/\b(?:בשם|שם)\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i); if(m) name=m[1]; }
  if(!name){ m=t.match(/בלשונית\s+([A-Za-zא-ת0-9 _\-]+)/i); if(m) name=m[1]; }
  return (name||'').trim().replace(/^בשם\s+/i,'');
}
function extractColumnName(s=''){ const t=s.replace(/\n/g,' '); let m=t.match(/בשדה(?:\s+של)?\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i); if(m) return m[1].trim();
  m=t.match(/(?:עמוד[הת]|column)\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i); return m?m[1].trim():''; }
function extractEqualsValue(s=''){ const t=s.replace(/\n/g,' '); let m=t.match(/הנתון\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i); if(m) return m[1].trim();
  m=t.match(/הערך\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i); if(m) return m[1].trim();
  m=t.match(/שווה\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i); if(m) return m[1].trim();
  m=t.match(/["“]([^"]+?)["”]/); return m?m[1].trim():''; }
function extractHours(s=''){ const m=s.match(/(\d+)\s*שעות|\b(\d+)\s*h/i); if(m) return parseInt(m[1]||m[2],10); return /יום/.test(s)?24:10; }
function extractNewerThanDays(s=''){ if(/חודש/.test(s)) return 30; if(/שבוע/.test(s)) return 7; const m=s.match(/(\d+)\s*י?ימים?/); if(m) return parseInt(m[1],10); return 30; }
function normalizeWhatsApp(x=''){ let n=String(x).trim().replace(/^whatsapp:/i,'').replace(/[^\d+]/g,''); if(!n) return null; if(!n.startsWith('+')) n='+'+n; return n; }
function looksLikeIntlPhone(n=''){ const x=normalizeWhatsApp(n); return !!(x && /^\+\d{9,15}$/.test(x)); }

/* ---------- Heuristics plan ---------- */
function heuristicsPlan(textOriginal){
  const t = normalizeHe(textOriginal); const steps=[]; const missing=[];
  const mentionsMail = RE_GMAIL_WORDS.test(t), mentionsUnreplied = RE_UNREPLIED.test(t);

  // SLA: unreplied
  if(mentionsMail && mentionsUnreplied){
    const fromEmail = extractEmail(t); const newerThanDays = extractNewerThanDays(t); const hours = extractHours(t);
    steps.push({ trigger:{ type:'gmail.unreplied', params:{ fromEmail: fromEmail||'', newerThanDays, hours, limit:50 } } });
    if (RE_WHATSAPP.test(t)){
      steps.push({ action:{ type:'whatsapp.send', params:{ to:'', message:'נמצא מייל שלא נענה: {{item.subject}} — {{item.webLink}}' } } });
      if (!fromEmail) missing.push({ key:'fromEmail', label:'כתובת המייל של השולח', example:'name@example.com' });
      missing.push({ key:'to', label:'מספר WhatsApp כולל קידומת מדינה', example:'9725xxxxxxxx' });
      return { steps, missing };
    } else {
      const spreadsheetId = extractSpreadsheetId(t);
      steps.push({ action:{ type:'sheets.append', params:{ spreadsheetId: spreadsheetId||'', sheetName:'SLA',
        row:{ from:'{{item.from}}', subject:'{{item.subject}}', date:'{{item.date}}', threadId:'{{item.threadId}}', webLink:'{{item.webLink}}' } } } });
      if(!fromEmail) missing.push({ key:'fromEmail', label:'כתובת המייל של השולח', example:'name@example.com' });
      if(!spreadsheetId) missing.push({ key:'spreadsheetId', label:'ה-ID של ה-Google Sheet', example:'https://docs.google.com/spreadsheets/d/<ID>/edit' });
      return { steps, missing };
    }
  }

  // Two senders → sheet log
  const mentionsSheet = RE_SHEET_WORDS.test(t);
  const mentionsTwo = RE_TWO_PEOPLE.test(t) && RE_SEND_VERBS.test(t);
  const mentionsSomeoneSends = /כל\s*פעם\s*שאחד(?:\s*מהם)?\s*שול/i.test(t);
  if(mentionsSheet && (mentionsTwo || mentionsSomeoneSends || RE_SEND_VERBS.test(t))){
    const emails = extractEmails(t); const fromEmails = emails.join(', '); const spreadsheetId = extractSpreadsheetId(t)||''; const sheetName = extractSheetName(t)||'InboxLog';
    steps.push({ trigger:{ type:'gmail.from', params:{ fromEmails: fromEmails||'', newerThanDays:30, limit:100 } } });
    steps.push({ action:{ type:'sheets.append', params:{ spreadsheetId: spreadsheetId||'', sheetName,
      row:{ from:'{{item.from}}', subject:'{{item.subject}}', date:'{{item.date}}', snippet:'{{item.snippet}}', body:'{{item.body}}', threadId:'{{item.threadId}}', webLink:'{{item.webLink}}' } } } });
    if(!fromEmails) missing.push({ key:'fromEmails', label:'כתובות המייל של השולחים (מופרד בפסיק)', example:'a@ex.com, b@ex.com' });
    if(!spreadsheetId) missing.push({ key:'spreadsheetId', label:'ה-ID של ה-Google Sheet', example:'https://docs.google.com/spreadsheets/d/<ID>/edit' });
    missing.push({ key:'sheetName', label:'שם הגיליון (Sheet)', example:'InboxLog' });
    return { steps, missing };
  }

  // Sheets match → Email/WhatsApp
  if (/(google\s*sheets?|גיליון|sheet|לשונית|טאב|row|שורה)/i.test(t)) {
    const spreadsheetId = extractSpreadsheetId(t)||''; const sheetName = extractSheetName(t)||'Sheet1';
    const columnName = extractColumnName(t)||''; const equals = extractEqualsValue(t)||'';
    steps.push({ trigger:{ type:'sheets.match', params:{ spreadsheetId, sheetName, columnName, equals, mode:'new' } } });
    if (/מייל|email|אימייל/i.test(t)){
      steps.push({ action:{ type:'email.send', params:{ to:'', subject:'התראה מגיליון {{item.__sheet}}', body:'{{item.__rowAsText}}' } } });
      if(!spreadsheetId) missing.push({ key:'spreadsheetId', label:'ה-ID של ה-Google Sheet', example:'https://docs.google.com/spreadsheets/d/<ID>/edit' });
      if(!sheetName)     missing.push({ key:'sheetName', label:'שם הגליון (Sheet)', example:'SLA או Sheet1' });
      if(!columnName)    missing.push({ key:'columnName', label:'שם העמודה/השדה', example:'project menger' });
      if(!equals)        missing.push({ key:'equals', label:'הערך שתואם להתראה', example:'haim shafir' });
      missing.push({ key:'to', label:'כתובת מייל לקבלת ההתראה', example:'name@example.com' });
      return { steps, missing };
    }
    if (RE_WHATSAPP.test(t)){
      steps.push({ action:{ type:'whatsapp.send', params:{ to:'', message:'שורה חדשה: {{item.__rowAsText}}' } } });
      if(!spreadsheetId) missing.push({ key:'spreadsheetId', label:'ה-ID של ה-Google Sheet', example:'https://docs.google.com/spreadsheets/d/<ID>/edit' });
      if(!sheetName)     missing.push({ key:'sheetName', label:'שם הגיליון (Sheet)', example:'SLA או Sheet1' });
      if(!columnName)    missing.push({ key:'columnName', label:'שם העמודה/השדה', example:'project menger' });
      if(!equals)        missing.push({ key:'equals', label:'הערך שתואם להתראה', example:'haim shafir' });
      missing.push({ key:'to', label:'מספר WhatsApp כולל קידומת מדינה', example:'9725xxxxxxxx' });
      return { steps, missing };
    }
  }

  return { steps:[], missing:[] };
}
function humanizeKey(skillName,key){
  const map = {
    spreadsheetId:{ label:'ה-ID של ה-Google Sheet', example:'https://docs.google.com/spreadsheets/d/<ID>/edit' },
    sheetName:{ label:'שם הגיליון (Sheet)', example:'InboxLog' },
    columnName:{ label:'שם העמודה/השדה', example:'project menger' },
    equals:{ label:'הערך שתואם להתראה', example:'haim shafir' },
    fromEmail:{ label:'כתובת המייל של השולח', example:'name@example.com' },
    fromEmails:{ label:'כתובות המייל של השולחים (מופרד בפסיק)', example:'a@ex.com, b@ex.com' },
    to:{ label:'כתובת מייל (או מספר בינ"ל ל-WhatsApp)', example:'name@example.com או 9725xxxxxxxx' },
  };
  const base = map[key] || { label:key, example:'' }; return { key, ...base };
}
function computeMissingFromRegistry(proposal){
  const missing=[]; for(const step of (proposal||[])){
    if(step.trigger){ const name=step.trigger.type; const spec=SKILLS.triggers[name]; if(!spec) continue; const p=step.trigger.params||{}; for(const k of spec.required) if(!p[k]) missing.push(humanizeKey(name,k)); }
    if(step.action){  const name=step.action.type;  const spec=SKILLS.actions[name];  if(!spec) continue; const p=step.action.params||{};  for(const k of spec.required) if(!p[k]) missing.push(humanizeKey(name,k)); }
  }
  const seen=new Set(); return missing.filter(m=>seen.has(m.key)?false:(seen.add(m.key),true));
}
function buildQuestions(missing){
  return (missing||[]).map(m=>{
    switch(m.key){
      case 'fromEmails': return 'אילו כתובות מייל של שני האנשים? (הפרד בפסיק)';
      case 'spreadsheetId': return 'איזה גיליון Google? (אפשר להדביק את כל הקישור)';
      case 'sheetName': return 'מה שם הלשונית (Sheet) בגיליון?';
      case 'columnName': return 'מה שם העמודה/השדה?';
      case 'equals': return 'איזה ערך בדיוק צריך לזהות בעמודה הזו?';
      case 'fromEmail': return 'ממי מגיעים המיילים (כתובת מייל מלאה)?';
      case 'to': return 'לאיזה יעד לשלוח? (כתובת מייל או מספר WhatsApp בינ"ל)';
      default: return `חסר ערך עבור ${m.label}`;
    }
  });
}

/* ---------------- LLM (Groq/OpenAI) JSON mode ---------------- */
const JSON_SCHEMA_PROMPT = `
בחר טריגרים ופעולות מתוך הרשימה, והחזר JSON בודד:
- טריגרים: gmail.unreplied, gmail.from, sheets.match
- פעולות: sheets.append, email.send, whatsapp.send, slack.send, telegram.send, webhook.call
- פורמט:
{ "proposal":[ { "trigger":{ "type":"...", "params":{...} } } | { "action":{ "type":"...", "params":{...} } } ... ],
  "missing":[ { "key":"...", "label":"...", "example":"..." } ... ] }
- אם חסרים ערכים, מלא אותם ב-"missing".
- החזר JSON בלבד, בלי טקסט חופשי.
`;
function safeJsonParse(s){ try{ return JSON.parse(s); }catch{ return null; } }
function tryExtractJsonBlock(s){ const m = s?.match(/\{[\s\S]*\}$/); return m ? safeJsonParse(m[0]) : null; }
function sanitizeProposal(raw=[]){
  const AT = new Set(['gmail.unreplied','gmail.from','sheets.match']);
  const AA = new Set(['sheets.append','email.send','whatsapp.send','slack.send','telegram.send','webhook.call']);
  const out=[]; for(const step of raw){
    if(step?.trigger?.type && AT.has(step.trigger.type)) out.push({ trigger:{ type:step.trigger.type, params: step.trigger.params||{} } });
    else if(step?.action?.type && AA.has(step.action.type)) out.push({ action:{ type:step.action.type, params: step.action.params||{} } });
  } return out;
}
async function callLLMForPlan(textOriginal){
  const normalized = normalizeHe(textOriginal);
  const userContent = `${JSON_SCHEMA_PROMPT}\n\nטקסט:\n${String(textOriginal)}\n\nNormalized:\n${normalized}\n`;
  if (NLP_PROVIDER === 'groq'){
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY missing');
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+process.env.GROQ_API_KEY, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role:'system', content:'אתה מתכנן אוטומציות. החזר JSON בלבד לפי ההוראות.' },
          { role:'user', content:userContent }
        ]
      })
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    const json = safeJsonParse(content) || tryExtractJsonBlock(content) || { proposal:[], missing:[] };
    return { raw:data, json };
  }
  if (NLP_PROVIDER === 'openai'){
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+process.env.OPENAI_API_KEY, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format:{ type:'json_object' },
        messages:[
          { role:'system', content:'אתה מתכנן אוטומציות. החזר JSON בלבד לפי ההוראות.' },
          { role:'user', content:userContent }
        ]
      })
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    const json = safeJsonParse(content) || tryExtractJsonBlock(content) || { proposal:[], missing:[] };
    return { raw:data, json };
  }
  throw new Error('LLM provider not enabled');
}
async function planFromText(text){
  if (NLP_PROVIDER !== 'heuristic'){
    try{
      const llm = await callLLMForPlan(text);
      const proposal = sanitizeProposal(llm.json?.proposal||[]);
      if (proposal.length){
        const missing = computeMissingFromRegistry(proposal);
        const questions = buildQuestions(missing);
        return { ok:true, provider:NLP_PROVIDER, proposal, missing, questions, nlp: llm.json||null };
      }
    }catch(e){ console.warn('[planner] LLM failed:', e.message||e); }
  }
  const h = heuristicsPlan(text);
  if (h.steps?.length){
    const missing = computeMissingFromRegistry(h.steps).concat(h.missing||[]);
    const seen=new Set(); const uniq=missing.filter(m=>seen.has(m.key)?false:(seen.add(m.key),true));
    const questions = buildQuestions(uniq);
    return { ok:true, provider:'heuristic', proposal:h.steps, missing:uniq, questions, nlp:null };
  }
  return { ok:true, provider:NLP_PROVIDER, proposal:[], missing:[], questions:[], nlp:null };
}

/* ---------------- Plan & Execute ---------------- */
app.post('/api/plan/from-text', async (req,res)=>{
  try{ const { text } = req.body||{}; const plan = await planFromText(text); res.json(plan); }
  catch(e){ console.error(e); res.status(500).json({ ok:false, error:'PLAN_FAILED' }); }
});

/** runPipeline with dryRun:
 *  - dryRun=false (ברירת מחדל): מריץ טריגר(ים) ואז אקשנים.
 *  - dryRun=true: מריץ רק טריגרים, מחזיר ספירת פריטים + sample, לא מבצע אקשנים.
 */
async function runPipeline(steps, { dryRun=false } = {}){
  let items = null;
  let actionsExecuted = 0;
  for (const step of steps){
    if (step.trigger){
      const { type, params } = step.trigger;
      if (type === 'gmail.unreplied') items = await triggerGmailUnreplied(params);
      else if (type === 'gmail.from') items = await triggerGmailFrom(params);
      else if (type === 'sheets.match') items = await triggerSheetsMatch(params);
      else throw new Error(`Unknown trigger: ${type}`);
    } else if (step.action){
      if (dryRun) continue; // מדלגים על אקשנים ב-Dry-Run
      const { type, params } = step.action;
      if (type === 'sheets.append'){ if (!items) items=[{}]; await actionSheetsAppend(params, items); actionsExecuted++; }
      else if (type === 'whatsapp.send'){ await actionWhatsappSend(params, items||[]); actionsExecuted++; }
      else if (type === 'email.send'){ await actionEmailSend(params, items||[]); actionsExecuted++; }
      else if (type === 'slack.send'){ await actionSlackSend(params, items||[]); actionsExecuted++; }
      else if (type === 'telegram.send'){ await actionTelegramSend(params, items||[]); actionsExecuted++; }
      else if (type === 'webhook.call'){ await actionWebhookCall(params, items||[]); actionsExecuted++; }
      else throw new Error(`Unknown action: ${type}`);
    }
  }
  if (dryRun) return { ok:true, dryRun:true, count: (items||[]).length, sample: (items||[]).slice(0,5) };
  return { ok:true, dryRun:false, actionsExecuted };
}

app.post('/api/automations/execute', async (req,res)=>{
  try{
    const { text, steps, dryRun=false } = req.body||{};
    let finalSteps = Array.isArray(steps) && steps.length ? steps : null;
    let missing = [];
    if (!finalSteps){ const plan = await planFromText(text); finalSteps = plan.proposal||[]; missing = plan.missing||[]; }
    if (missing.length) return res.status(400).json({ ok:false, error:'MISSING_FIELDS', missing });
    if (!finalSteps?.length) return res.status(400).json({ ok:false, error:'NO_STEPS_BUILT' });
    const result = await runPipeline(finalSteps, { dryRun: !!dryRun });
    res.json({ ok:true, result, steps:finalSteps, provider:NLP_PROVIDER });
  }catch(e){ console.error(e); res.status(500).json({ ok:false, error:'EXECUTION_FAILED' }); }
});

/* ---------------- Saved Automations ---------------- */
function genId(){ return 'a_' + Math.random().toString(36).slice(2,10); }
async function getAutosDB(){ return (await kvGet('autosByUser')) || {}; }
async function setAutosDB(db){ await kvSet('autosByUser', db||{}); }

app.get('/api/automations/list', async (req,res)=>{
  const email = await getCurrentUserEmail(); if(!email) return res.status(401).json({ ok:false, error:'NOT_AUTHENTICATED' });
  const db = await getAutosDB(); const mine = Object.values(db[email]||{}); res.json({ ok:true, items: mine });
});
app.post('/api/automations/save', async (req,res)=>{
  try{
    const email = await getCurrentUserEmail(); if(!email) return res.status(401).json({ ok:false, error:'NOT_AUTHENTICATED' });
    const { id, steps, text, title } = req.body||{};
    if(!Array.isArray(steps) || !steps.length) return res.status(400).json({ ok:false, error:'BAD_DEFINITION' });
    const db = await getAutosDB(); db[email] ||= {};
    const autoId = id || genId();
    db[email][autoId] = { id:autoId, title: title||'אוטומציה ללא שם', text: text||'', steps, owner:email, updatedAt:Date.now() };
    await setAutosDB(db); res.json({ ok:true, id:autoId });
  }catch(e){ console.error(e); res.status(500).json({ ok:false, error:'SAVE_FAILED' }); }
});
app.delete('/api/automations/:id', async (req,res)=>{
  try{
    const email = await getCurrentUserEmail(); if(!email) return res.status(401).json({ ok:false, error:'NOT_AUTHENTICATED' });
    const id = req.params.id; const db = await getAutosDB(); if (db[email]?.[id]) { delete db[email][id]; await setAutosDB(db); }
    res.json({ ok:true });
  }catch(e){ console.error(e); res.status(500).json({ ok:false, error:'DELETE_FAILED' }); }
});
app.post('/api/automations/execute-saved', async (req,res)=>{
  try{
    const email = await getCurrentUserEmail(); if(!email) return res.status(401).json({ ok:false, error:'NOT_AUTHENTICATED' });
    const { id } = req.body||{}; const db = await getAutosDB(); const auto = db[email]?.[id];
    if(!auto) return res.status(404).json({ ok:false, error:'NOT_FOUND' });
    const result = await runPipeline(auto.steps, { dryRun:false });
    res.json({ ok:true, result });
  }catch(e){ console.error(e); res.status(500).json({ ok:false, error:'EXEC_SAVED_FAILED' }); }
});

/* ---------------- Triggers ---------------- */
async function triggerGmailUnreplied(params){
  const { fromEmail, newerThanDays=30, hours=10, limit=50 } = params||{};
  if(!fromEmail) throw new Error('fromEmail is required');
  const gmail = await getGmailClient(); const profile = await gmail.users.getProfile({userId:'me'}); const myEmail = profile.data.emailAddress;
  const q = [`from:${fromEmail}`, `newer_than:${newerThanDays}d`, '-in:chats'].join(' ');
  const list = await gmail.users.messages.list({ userId:'me', q, maxResults: Math.min(limit,100) });
  const msgs = list.data.messages||[]; const thresholdMs = hours*60*60*1000; const now=Date.now(); const out=[];
  for(const m of msgs){
    const th = await gmail.users.threads.get({ userId:'me', id:m.threadId });
    const messages = th.data.messages||[]; const lastMsg = messages[messages.length-1];
    const headers = Object.fromEntries((lastMsg.payload.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
    const from = headers['from']||'', subject=headers['subject']||'', internalDate = parseInt(lastMsg.internalDate||'0',10);
    const ageMs = now - internalDate; const isFromMe = (headers['from']||'').toLowerCase().includes(myEmail.toLowerCase());
    if (isFromMe) continue;
    const replied = messages.some(msg=> {
      const h = Object.fromEntries((msg.payload.headers||[]).map(x=>[x.name.toLowerCase(),x.value])); const f = h['from']||''; return f.toLowerCase().includes(myEmail.toLowerCase());
    });
    if (replied) continue; if (ageMs < thresholdMs) continue;
    const threadId = th.data.id; const webLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`; const dateIso = new Date(internalDate).toISOString();
    out.push({ from, subject, date:dateIso, threadId, webLink, snippet:lastMsg.snippet||'' });
  }
  return out;
}
function parseAddress(str=''){ const m=str.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/); return m?m[0]:str; }
function extractPlainText(payload){ if(!payload) return '';
  const mime=payload.mimeType||''; if(mime==='text/plain' && payload.body?.data){ try{ return Buffer.from(payload.body.data,'base64').toString('utf8'); }catch{ return ''; } }
  if(payload.parts && Array.isArray(payload.parts)){ for(const p of payload.parts){ const got=extractPlainText(p); if(got) return got; } } return ''; }
async function triggerGmailFrom(params){
  const { fromEmails, newerThanDays=30, limit=100 } = params||{}; if(!fromEmails) throw new Error('fromEmails is required (comma-separated)');
  const gmail = await getGmailClient(); const addrs = fromEmails.split(',').map(s=>s.trim()).filter(Boolean);
  const qFrom = addrs.map(a=>`from:${a}`).join(' OR '); const q = [`(${qFrom})`, `newer_than:${newerThanDays}d`, '-in:chats'].join(' ');
  const key = `gmail:from:${addrs.join('|')}`; const lastTs = (await kvGet(key)) || 0;
  const list = await gmail.users.messages.list({ userId:'me', q, maxResults: Math.min(limit,100) }); const msgs=list.data.messages||[];
  const out=[]; let maxTs = lastTs;
  for(const m of msgs){
    const full = await gmail.users.messages.get({ userId:'me', id:m.id, format:'full' }); const msg=full.data;
    const headers = Object.fromEntries((msg.payload.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
    const from=headers['from']||'', subject=headers['subject']||'', internalDate=parseInt(msg.internalDate||'0',10); if(internalDate<=lastTs) continue; if(internalDate>maxTs) maxTs=internalDate;
    const threadId=msg.threadId, webLink=`https://mail.google.com/mail/u/0/#inbox/${threadId}`, dateIso=new Date(internalDate).toISOString(); const body = extractPlainText(msg.payload)||'';
    out.push({ from: parseAddress(from), subject, date:dateIso, snippet:msg.snippet||'', body, threadId, webLink });
  }
  if (maxTs > lastTs) await kvSet(key, maxTs);
  return out;
}
async function triggerSheetsMatch(params){
  const { spreadsheetId, sheetName='Sheet1', columnName, equals, mode='new' } = params||{};
  if(!spreadsheetId) throw new Error('spreadsheetId is required'); if(!columnName) throw new Error('columnName is required');
  const sheets = await getSheetsClient();
  const effectiveId = extractSpreadsheetId(spreadsheetId)||spreadsheetId;
  const range = `${sheetName}!A:ZZ`; const resp = await sheets.spreadsheets.values.get({ spreadsheetId:effectiveId, range });
  const values = resp.data.values || []; if(!values.length) return [];
  const header = values[0]; const rows = values.slice(1);
  const colIndex = header.findIndex(h => (h||'').trim().toLowerCase() === String(columnName).trim().toLowerCase());
  if (colIndex === -1) throw new Error(`column "${columnName}" not found`);
  const stateKey = `sheet:${effectiveId}:${sheetName}:lastRow`; let lastRow = (await kvGet(stateKey)) ?? 1; const startIdx = Math.max(0, lastRow - 1);
  const out=[]; for(let i=startIdx;i<rows.length;i++){
    const r=rows[i]; const val=(r[colIndex]||'').trim();
    if (val === String(equals).trim()){
      const obj={}; header.forEach((h,idx)=>obj[h||`col_${idx+1}`]=r[idx]??'');
      obj.__rowIndex = i+2; obj.__sheet = sheetName;
      obj.__rowAsText = header.map((h,idx)=>`${h||`col_${idx+1}`}: ${r[idx]??''}`).join(' | ');
      out.push(obj);
    }
  }
  if (mode === 'new'){ const absoluteLastRow = rows.length + 1; await kvSet(stateKey, absoluteLastRow); }
  return out;
}

/* ---------------- Actions ---------------- */
async function actionSheetsAppend(params, items){
  const { spreadsheetId, sheetName='Sheet1', row } = params||{}; if(!spreadsheetId) throw new Error('spreadsheetId is required');
  const sheets = await getSheetsClient(); const effectiveId = extractSpreadsheetId(spreadsheetId)||spreadsheetId;
  const values = (items||[]).map((item)=>{ const rendered={}; for(const [k,v] of Object.entries(row||{})) rendered[k]=String(v).replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g,(_,key)=>item[key]??''); return Object.values(rendered); });
  await sheets.spreadsheets.values.append({ spreadsheetId:effectiveId, range:`${sheetName}!A1`, valueInputOption:'USER_ENTERED', requestBody:{ values } });
}
async function actionWhatsappSend(params, items){
  if(!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM){ console.warn('Twilio not configured'); return; }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  let to = params?.to || TWILIO_WHATSAPP_TO || ''; let from = TWILIO_WHATSAPP_FROM || '';
  to = normalizeWhatsApp(to); from = normalizeWhatsApp(from);
  if(!to || !from || !looksLikeIntlPhone(to) || !looksLikeIntlPhone(from)) throw new Error('TWILIO_INVALID_PHONE');
  const text = (params?.message || 'Hello').replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g,(_,k)=>items?.[0]?.[k]??'');
  await client.messages.create({ from:`whatsapp:${from}`, to:`whatsapp:${to}`, body:text });
}
function encodeMessage(str){ return Buffer.from(str).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function actionEmailSend(params, items){
  const gmail = await getGmailClient(); const to = params?.to || ''; if(!to) throw new Error('EMAIL_TO_MISSING');
  const subjectTpl = params?.subject || 'התראה חדשה'; const bodyTpl = params?.body || '{{item.__rowAsText}}';
  for(const item of (items||[])){
    const subject = subjectTpl.replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g,(_,k)=>item[k]??'');
    const body    = bodyTpl.replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g,(_,k)=>item[k]??'');
    const raw = `To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset="UTF-8"\n\n${body}\n`;
    await gmail.users.messages.send({ userId:'me', requestBody:{ raw: encodeMessage(raw) } });
  }
}
async function actionSlackSend(params, items){
  if(!SLACK_WEBHOOK_URL){ console.warn('Slack webhook not configured'); return; }
  const text = (params?.message||'Automation notification').replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g,(_,k)=>items?.[0]?.[k]??'');
  await fetchFn(SLACK_WEBHOOK_URL,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
}
async function actionTelegramSend(params, items){
  if(!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID){ console.warn('Telegram not configured'); return; }
  const message=(params?.message||'Automation message').replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g,(_,k)=>items?.[0]?.[k]??'');
  const url=`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetchFn(url,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }) });
}
async function actionWebhookCall(params, items){
  const url=params?.url || WEBHOOK_URL; if(!url){ console.warn('Webhook URL missing'); return; }
  const body={ timestamp:new Date().toISOString(), items: items||[], context: params?.context||{} };
  await fetchFn(url,{ method: params?.method||'POST', headers:{'Content-Type':'application/json', ...(params?.headers||{})}, body: JSON.stringify(body) });
}

/* ---------------- Start ---------------- */
app.listen(PORT, ()=>{ console.log(`Server :${PORT} | PUBLIC_DIR=${PUBLIC_DIR} | TOKEN_STORE=${TOKEN_STORE} | NLP=${NLP_PROVIDER} | MODEL=${GROQ_MODEL}`); });
