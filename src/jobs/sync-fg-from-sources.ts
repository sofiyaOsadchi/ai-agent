// src/jobs/sync-fg-from-sources.ts
import type { SheetsService } from "../services/sheets.js";

export type SyncFgFromSourcesConfig = {
  masterSpreadsheetId: string; // URL או ID
  masterTabName?: string;      // אם לא מצוין, ניקח טאב ראשון
  sources: Array<{
    spreadsheetId: string;     // URL או ID
    tabName?: string;          // אם לא מצוין, ניקח טאב ראשון
  }>;
};

type FG = { f: string; g: string };

const normalizeId = (v: unknown): string => String(v ?? "").trim();

export class SyncFgFromSourcesJob {
  constructor(private sheets: SheetsService) {}

  async run(cfg: SyncFgFromSourcesConfig): Promise<void> {
    const masterId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);
    const masterTab = cfg.masterTabName?.trim()
      ? cfg.masterTabName.trim()
      : await this.sheets.getFirstSheetTitle(masterId);

    // 1) Build Map מכל המקורות: id -> {f,g}
    //    כלל: המקור הראשון ברשימה "מנצח" (לא דורסים id שכבר קיים)
    const map = new Map<string, FG>();

    for (const src of cfg.sources) {
      const srcId = this.sheets.parseSpreadsheetId(src.spreadsheetId);
      const srcTab = src.tabName?.trim()
        ? src.tabName.trim()
        : await this.sheets.getFirstSheetTitle(srcId);

      // קוראים A:G כדי לקבל A (id) + F,G
      const rows = await this.sheets.readValues(srcId, `${srcTab}!A:G`);
      if (rows.length <= 1) continue;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] ?? [];
        const id = normalizeId(row[0]);
        if (!id) continue;

        if (!map.has(id)) {
          map.set(id, {
            f: String(row[5] ?? ""),
            g: String(row[6] ?? ""),
          });
        }
      }
    }

    // 2) קוראים את ה-Master, ובונים מערך כתיבה ל-F:G החל משורה 2
    const masterRows = await this.sheets.readValues(masterId, `${masterTab}!A:G`);
    const lastRow = masterRows.length; // כולל header
    if (lastRow <= 1) return;

    const out: string[][] = [];
    for (let i = 1; i < lastRow; i++) {
      const row = masterRows[i] ?? [];
      const id = normalizeId(row[0]);

      const hit = id ? map.get(id) : undefined;
      out.push([hit?.f ?? "", hit?.g ?? ""]); // אם אין התאמה - ריק
    }

    // 3) Batch update אחד בלבד: טווח F2:G{lastRow}
    await this.sheets.batchWriteValues(masterId, [
      {
        range: `${masterTab}!F2:G${lastRow}`,
        values: out,
      },
    ]);
  }
}