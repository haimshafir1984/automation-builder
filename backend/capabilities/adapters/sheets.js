// backend/capabilities/adapters/sheets.js
/**
 * Sheets adapter: append rows
 */
const googleSheets = require('../../lib/googleSheets'); // helper שלך

module.exports = {
  append: {
    async dryRun(ctx, params={}){
      const { spreadsheetId, tab='Sheet1', columns=['from','subject','date'] } = params;
      const preview = (ctx.items || []).slice(0, 3).map(i => columns.map(c => i[c] ?? ''));
      return {
        spreadsheetId, tab, columns,
        preview,
        appended: 0
      };
    },
    async execute(ctx, params={}){
      const { spreadsheetId, tab='Sheet1', columns=['from','subject','date'] } = params;
      if (!spreadsheetId) throw new Error('spreadsheetId is required');

      const items = ctx.items || [];
      const rows = items.map(i => columns.map(c => i[c] ?? ''));
      let appended = 0;
      if (rows.length) {
        await googleSheets.appendRows({ spreadsheetId, tab, rows }); // helper שלך
        appended = rows.length;
      }
      return { spreadsheetId, tab, columns, appended };
    }
  }
};
