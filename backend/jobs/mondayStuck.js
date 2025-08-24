// backend/jobs/mondayStuck.js
/**
 * דורש MONDAY_API_TOKEN תקין.
 * options:
 *  - dryRun
 *  - boardId (אם לא, יקח מ-ENV MONDAY_BOARD_ID)
 *  - statusColumnId (אם לא, יקח מ-ENV MONDAY_STATUS_COLUMN_ID)
 *  - stuckStatuses: string[] (labels to flag)  (ENV MONDAY_STUCK_STATUSES=In Progress,Waiting,...)
 *  - olderThanDays: number (e.g. 3)
 *  - spreadsheetIdOverride, tabOverride ('MondayStuck')
 */
const {
  extractSpreadsheetId,
  getSheetsClientWithOAuth,
  ensureHeaderRowIfEmpty,
  appendRow,
} = require('../lib/sheetsHelper');

async function ensureFetch() {
  if (typeof fetch === 'function') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
}

async function run(req, {
  dryRun = true,
  boardId = process.env.MONDAY_BOARD_ID,
  statusColumnId = process.env.MONDAY_STATUS_COLUMN_ID,
  stuckStatuses = (process.env.MONDAY_STUCK_STATUSES || '').split(',').map(s => s.trim()).filter(Boolean),
  olderThanDays = 3,
  spreadsheetIdOverride = null,
  tabOverride = 'MondayStuck',
} = {}) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error('MONDAY_API_TOKEN is missing');

  if (!boardId) throw new Error('boardId is required');
  if (!statusColumnId) throw new Error('statusColumnId is required');
  if (!Array.isArray(stuckStatuses) || !stuckStatuses.length) throw new Error('stuckStatuses required');

  const _fetch = await ensureFetch();
  const query = `
    query($boardId: [Int]) {
      boards (ids: $boardId) {
        id
        name
        items {
          id
          name
          updated_at
          column_values {
            id
            title
            text
            value
          }
        }
      }
    }
  `;

  const resp = await _fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify({ query, variables: { boardId: Number(boardId) } })
  });
  const data = await resp.json();
  if (data.errors) throw new Error('Monday GraphQL error: ' + JSON.stringify(data.errors));

  const board = data?.data?.boards?.[0];
  if (!board) throw new Error('Board not found');

  const now = Date.now();
  const thresholdMs = Number(olderThanDays) * 24 * 60 * 60 * 1000;

  function getColText(item, colId) {
    const c = (item.column_values || []).find(cv => cv.id === colId);
    return c?.text || '';
  }

  const items = [];
  for (const it of board.items || []) {
    const statusText = getColText(it, statusColumnId);
    if (!stuckStatuses.includes(statusText)) continue;

    const lastUpdate = new Date(it.updated_at).getTime();
    const ageMs = now - lastUpdate;
    if (ageMs < thresholdMs) continue;

    items.push({
      id: it.id,
      name: it.name,
      status: statusText,
      updated_at: it.updated_at
    });
  }

  let appended = 0;
  if (!dryRun && items.length) {
    const spreadsheetIdRaw = spreadsheetIdOverride || process.env.MONDAY_SHEET_SPREADSHEET_ID || process.env.LEADS_SHEET_SPREADSHEET_ID;
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdRaw);
    const tab = tabOverride || 'MondayStuck';
    if (!spreadsheetId) throw new Error('MONDAY_SHEET_SPREADSHEET_ID (or LEADS) is missing/invalid');

    const sheets = getSheetsClientWithOAuth(req);
    const header = ['id', 'name', 'status', 'updated_at', 'board_id', 'board_name'];
    await ensureHeaderRowIfEmpty(sheets, spreadsheetId, tab, header);

    for (const row of items) {
      await appendRow(sheets, spreadsheetId, tab, [row.id, row.name, row.status, row.updated_at, board.id, board.name]);
      appended++;
    }
  }

  return { ok: true, dryRun, board: { id: board.id, name: board.name }, olderThanDays, stuckStatuses, count: items.length, appended, items: items.slice(0, 20) };
}

module.exports = { run };
