// engine/actions/telegram.js
const axios = require("axios");

function tmpl(str, ctx = {}) {
  if (!str) return "";
  return str.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const parts = key.split(".");
    let v = ctx;
    for (const p of parts) v = v?.[p];
    return v == null ? "" : String(v);
  });
}

async function send(params = {}, payload = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;
  if (!token) throw new Error("missing TELEGRAM_BOT_TOKEN");
  const chat_id = params.chatId || defaultChatId;
  if (!chat_id) throw new Error("missing Telegram chat_id");

  const textRaw = params.text || "Event:\n{{payloadJson}}";
  const text = tmpl(textRaw, { ...payload, payloadJson: JSON.stringify(payload, null, 2) });

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await axios.post(url, { chat_id, text });
  return { ok: true, message_id: resp.data?.result?.message_id };
}

module.exports = { send };
