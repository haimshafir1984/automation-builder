// engine/triggers/imap.js
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const DEBUG = String(process.env.IMAP_DEBUG || "").toLowerCase() === "true";

/* ---------- store ---------- */
function loadStore() {
  const p = path.join(__dirname, "..", "data", "imap_store.json");
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return {}; }
}
function saveStore(data) {
  const p = path.join(__dirname, "..", "data", "imap_store.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

/* ---------- filters ---------- */
function norm(s){ return String(s ?? "").normalize("NFKC").replace(/\s+/g," ").trim().toLowerCase(); }
function passesFilters(email, filters){
  if (!Array.isArray(filters) || !filters.length) return true;
  for (const f of filters){
    const op = (f.op||"").trim();
    const field = (f.field||"").toLowerCase();
    let actual = "";
    if (field === "subject") actual = email.subject || "";
    else if (field === "from") actual = email.from?.text || email.from?.value?.map(v=>v.address).join(",") || "";
    else if (field === "to")   actual = email.to?.text   || email.to?.value?.map(v=>v.address).join(",")   || "";
    const expected = f.value != null ? String(f.value) : "";

    const a = norm(actual), e = norm(expected);
    let ok = true;
    switch (op){
      case "equals": ok = a === e; break;
      case "contains": ok = a.includes(e); break;
      case "not-empty": ok = a.length > 0; break;
      default: ok = true; break;
    }
    if (!ok) return false;
  }
  return true;
}

/* ---------- helpers ---------- */
function streamToBuffer(stream){
  return new Promise((resolve, reject)=>{
    const chunks = [];
    stream.on?.("data",(d)=>chunks.push(Buffer.from(d)));
    stream.on?.("end",()=>resolve(Buffer.concat(chunks)));
    stream.on?.("error",reject);
    // אם זו לא תזרים – נכשֵל מייד וניתפס בפולבאק
    if (!stream || typeof stream.on !== "function") {
      reject(new Error("not-a-stream"));
    }
  });
}

async function anyToBuffer(src) {
  if (!src) throw new Error("no source");
  if (Buffer.isBuffer(src)) return src;
  if (typeof src === "string") return Buffer.from(src);
  if (typeof src.on === "function") return await streamToBuffer(src); // Readable
  // נסיון אחרון – אולי Iterable של Uint8Array
  if (Symbol.asyncIterator in Object(src)) {
    const chunks = [];
    for await (const c of src) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
  throw new Error("unsupported source type");
}

/* ---------- scheduler ---------- */
function scheduleImapNewEmail(wf, store, runAction /*, saveStore */){
  const intervalMinutes = Number(wf.params?.source?.intervalMinutes || 2);
  const mailbox = wf.params?.source?.mailbox || process.env.IMAP_MAILBOX || "INBOX";

  const host = process.env.IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT || 993);
  const secure = String(process.env.IMAP_TLS || "true").toLowerCase() !== "false";
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!user || !pass) {
    console.warn("[imap] missing IMAP_USER/IMAP_PASS in env");
    return null;
  }

  const stateKey = `${user}:${mailbox}:${wf.id}`;
  const imapStore = loadStore();

  async function runner(){
    let client;
    try{
      client = new ImapFlow({
        host, port, secure,
        auth:{ user, pass },
        logger: DEBUG ? console : undefined
      });

      await client.connect();
      await client.mailboxOpen(mailbox);

      // קבלת UIDNEXT (בלי mailboxStatus)
      let uidNext = null;
      try {
        const st = await client.status(mailbox, { uidNext: true });
        uidNext = st?.uidNext;
      } catch {
        uidNext = client.mailbox?.uidNext;
      }
      if (!uidNext) uidNext = 1;

      // אתחול ראשון — לא לעבד היסטוריה
      if (imapStore[stateKey]?.lastUid == null) {
        imapStore[stateKey] = { lastUid: uidNext - 1 };
        saveStore(imapStore);
        console.log(`[imap] init ${mailbox} lastUid=${imapStore[stateKey].lastUid} (wf ${wf.id})`);
        await client.logout();
        return;
      }

      const lastUid = imapStore[stateKey].lastUid || 0;
      if (uidNext <= lastUid) { await client.logout(); return; }

      const range = `${lastUid + 1}:*`;
      let sent = 0, seen = 0;

      for await (const msg of client.fetch(range, { uid:true, source:true, envelope:true })){
        seen++;

        // השג את גוף ההודעה – תומך בכל הצורות
        let raw;
        try {
          raw = await anyToBuffer(msg.source);
        } catch {
          // פוּלבק: הורדה מפורשת
          const dl = await client.download(msg.uid, null, { uid: true });
          raw = await anyToBuffer(dl.content);
        }

        const parsed = await simpleParser(raw);

        const email = {
          uid: msg.uid,
          subject: parsed.subject || "",
          date: parsed.date ? new Date(parsed.date) : new Date(),
          from: parsed.from || null,
          to: parsed.to || null,
          text: (parsed.text || "").trim(),
          textSnippet: (parsed.text || "").trim().slice(0, 500),
          html: parsed.html || "",
        };

        if (!passesFilters(email, wf.filters)) continue;

        const payload = {
          source: "imap",
          mailbox,
          uid: email.uid,
          subject: email.subject,
          from: email.from ? email.from.text : "",
          to: email.to ? email.to.text : "",
          dateISO: email.date.toISOString(),
          text: email.text,
          textSnippet: email.textSnippet,
        };

        try{
          await runAction(wf.target, wf.action, wf.params?.target || {}, payload);
          sent++;
          if (DEBUG) console.log(`[imap] uid ${email.uid} → action sent`);
        }catch(e){
          console.error("[imap] action error:", e?.message || e);
        }
      }

      imapStore[stateKey].lastUid = uidNext - 1;
      saveStore(imapStore);
      console.log(`[imap] ${mailbox}: processed ${seen} new, sent ${sent} (wf ${wf.id})`);

      await client.logout();
    }catch(e){
      // not-a-stream מגיע לכאן במידה וה־source היה Buffer/מחרוזת (טיפלנו בפועל ב-fallback)
      if (e && e.message !== "not-a-stream") {
        console.error("[imap] error:", e?.message || e);
      }
      try{ if (client) await client.logout(); }catch{}
    }
  }

  const expr = `*/${intervalMinutes} * * * *`;
  const task = cron.schedule(expr, runner);
  return { id: wf.id, expr, type: "imap.new-email", task, runNow: runner };
}

function scheduleForWorkflow(wf, store, runAction /*, saveStore */){
  if (wf.source === "imap" && (wf.trigger === "new-email" || wf.trigger === "mail-received")){
    return scheduleImapNewEmail(wf, store, runAction);
  }
  return null;
}

module.exports = { scheduleForWorkflow };
