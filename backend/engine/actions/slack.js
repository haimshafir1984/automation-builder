// engine/actions/slack.js
const { WebClient } = require("@slack/web-api");

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
  const token = process.env.SLACK_BOT_TOKEN;
  const defaultChannel = process.env.SLACK_CHANNEL;
  if (!token) throw new Error("missing SLACK_BOT_TOKEN");
  const client = new WebClient(token);

  const channel = params.channel || defaultChannel;
  if (!channel) throw new Error("missing Slack channel");

  const textRaw = params.text || "Event:\n{{payloadJson}}";
  const text = tmpl(textRaw, { ...payload, payloadJson: JSON.stringify(payload, null, 2) });

  const resp = await client.chat.postMessage({ channel, text });
  return { ok: true, ts: resp.ts, channel: resp.channel };
}

module.exports = { send };
