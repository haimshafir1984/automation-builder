const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true });
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args, { agent: keepAliveAgent }));
const { sanitizeLog } = require('../utils/sanitize');

class NLPService {
  constructor(groqApiKey, model) {
    this.groqApiKey = groqApiKey;
    this.model = model;
  }

  normalizeHeb(text = '') {
    return String(text || '')
      .replace(/[\u200e\u200f]/g, '')
      .replace(/[""„´]/g, '"')
      .replace(/['³]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/ו?וואטסאפ|וואטסאפ|ווהטסאפ/gi, 'WhatsApp')
      .replace(/גוגל\s*שיט|שיט\b|גיליון/gi, 'Sheet')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractEntities(text = '') {
    const out = {};
    const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    if (emails?.length) out.emails = Array.from(new Set(emails));

    const phones = text.match(/\b\+?\d{9,15}\b/g);
    if (phones?.length) out.phones = Array.from(new Set(phones));

    const h = text.match(/(\d+)\s*שעות?/);
    if (h) out.hours = +h[1];

    const d = text.match(/(\d+)\s*ימים?/);
    if (d) out.days = +d[1];

    if (/חודש|30\s*יום/.test(text)) out.days = out.days || 30;

    const m = text.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m) out.spreadsheetId = m[1];

    const cm = text.match(/"([^"]+)"|'([^']+)'/);
    if (cm) out.columnName = cm[1] || cm[2];

    return out;
  }

  async planFromText(text) {
    if (!this.groqApiKey) return { ok: false, error: 'GROQ_API_KEY_MISSING' };
    const normalizedText = this.normalizeHeb(text);

    try {
      const response = await this.callGroqAPI(normalizedText);
      return { ok: true, provider: 'groq', ...response };
    } catch (error) {
      console.error('Groq error:', sanitizeLog(error?.message || String(error)));
      return { ok: false, error: 'GROQ_API_ERROR', details: 'LLM call failed' };
    }
  }

  async callGroqAPI(text) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      ...this.getFewShotExamples(),
      { role: 'user', content: text }
    ];

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages
      })
    });

    if (!resp.ok) throw new Error(`Groq API error: ${resp.status}`);
    const data = await resp.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  }

  getSystemPrompt() {
    return `אתה מתכנן אוטומציות. קלט: משפט חופשי בעברית.
החזר JSON בלבד במבנה:
{
  "proposal": [
    { "trigger": { "type": "gmail.unreplied", "params": {...} } },
    { "action":  { "type": "sheets.append", "params": {...} } }
  ],
  "missing": [{ "key": "...", "label": "...", "example": "..." }],
  "questions": ["..."]
}`;
  }

  getFewShotExamples() {
    return [
      {
        role: 'user',
        content: 'כל מייל מ-haim@example.com שלא נענה 10 שעות ב-30 ימים – רשומה ב-Google Sheet בשם "InboxLog"'
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          proposal: [
            {
              trigger: {
                type: 'gmail.unreplied',
                params: { fromEmail: 'haim@example.com', newerThanDays: 30, hours: 10, limit: 50 }
              }
            },
            {
              action: {
                type: 'sheets.append',
                params: {
                  spreadsheetId: '',
                  sheetName: 'InboxLog',
                  row: {
                    from: '{{item.from}}',
                    subject: '{{item.subject}}',
                    date: '{{item.date}}',
                    webLink: '{{item.webLink}}'
                  }
                }
              }
            }
          ],
          missing: [{ key: 'spreadsheetId', label: 'ה-ID של ה-Google Sheet', example: 'https://docs.google.com/spreadsheets/d/<ID>/edit' }],
          questions: []
        })
      }
    ];
  }
}

module.exports = { NLPService };
