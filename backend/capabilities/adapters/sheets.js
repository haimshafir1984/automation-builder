const gs = require('../../lib/googleSheets');

module.exports = {
  append: {
    async dryRun(ctx, params={}) {
      const { spreadsheetId, sheetName='Sheet1', row, columns } = params;
      if (row && typeof row === 'object') {
        const header = Object.keys(row);
        const preview = [header.map(k => row[k])];
        return { spreadsheetId, tab: sheetName, header, preview, appended: 0, mode: 'row-object' };
      }
      const cols = Array.isArray(columns) && columns.length ? columns : ['from','subject','date'];
      const preview = (ctx.items || []).slice(0, 3).map(i => cols.map(c => i[c] ?? ''));
      return { spreadsheetId, tab: sheetName, columns: cols, preview, appended: 0, mode: 'columns+items' };
    },
    async execute(ctx, params={}) {
      const { spreadsheetId, sheetName='Sheet1' } = params;
      if (params.row && typeof params.row === 'object') {
        const { header, appended } = await gs.appendRowObject({ spreadsheetId, tab: sheetName, rowObj: params.row });
        return { spreadsheetId, tab: sheetName, header, appended };
      }
      const columns = Array.isArray(params.columns) && params.columns.length ? params.columns : ['from','subject','date'];
      const items = ctx.items || [];
      const rows = items.map(i => columns.map(c => i[c] ?? ''));
      const { appended } = await gs.appendRows(spreadsheetId, sheetName, rows);
      return { spreadsheetId, tab: sheetName, columns, appended };
    }
  }
};
