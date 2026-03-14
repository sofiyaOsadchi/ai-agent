import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type WrapPFromSheetConfig = {
  spreadsheetId: string; // URL או ID
  tab?: string;          // אם ריק - הטאב הראשון
  targetCol?: string;    // ברירת מחדל: "F"
  skipHeader?: boolean;  // ברירת מחדל: true
};

/**
 * Wraps every non-empty cell in a target column with <p>...</p>.
 * Only touches the target column (default F).
 */
export class WrapPFromSheetJob {
  constructor(private sheets: SheetsService) {}

  async run(cfg: WrapPFromSheetConfig): Promise<void> {
    const spreadsheetId = this.sheets.parseSpreadsheetId(cfg.spreadsheetId);
    const tab = cfg.tab?.trim()
      ? cfg.tab.trim()
      : await this.sheets.getFirstSheetTitle(spreadsheetId);

    const col = (cfg.targetCol ?? "F").trim().toUpperCase();
    const skipHeader = cfg.skipHeader ?? true;

    const range = `${tab}!${col}:${col}`; // entire column
    const values = await this.sheets.readValues(spreadsheetId, range);

    if (!values.length) {
      console.log(chalk.yellow(`⚠️ No values found in ${range}`));
      return;
    }

    const out = values.map((row, idx) => {
      const cell = row?.[0] ?? "";

      // Keep header as-is
      if (skipHeader && idx === 0) return [cell];

      if (!cell) return [cell];

      // If already wrapped - keep as-is
      const alreadyWrapped = /^\s*<p>[\s\S]*<\/p>\s*$/i.test(cell);
      if (alreadyWrapped) return [cell];

      // Preserve text exactly (no trim)
      return [`<p>${cell}</p>`];
    });

    await this.sheets.writeValues(spreadsheetId, range, out);
    console.log(chalk.green(`✅ Wrapped column ${col} with <p>...</p> in tab "${tab}"`));
  }
}