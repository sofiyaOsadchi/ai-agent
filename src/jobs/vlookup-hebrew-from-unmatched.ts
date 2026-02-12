import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type VlookupHebrewFromUnmatchedConfig = {
  masterSpreadsheetId: string;
  masterTabName?: string; // default: "Sheet1"
  unmatchedTabName?: string; // default: "Unmatched (Hebrew Injection)"

  // Master columns (Sheet1)
  masterQuestionColLetter?: string; // default: "C"
  masterQuestionHebColLetter?: string; // default: "E"
  masterAnswerHebColLetter?: string; // default: "F"

  // Unmatched columns
  unmatchedMasterRowColLetter?: string; // default: "B"
  unmatchedQuestionEnColLetter?: string; // default: "D"
  unmatchedMatchedQuestionHeColLetter?: string; // default: "K"
  unmatchedMatchedAnswerHeColLetter?: string; // default: "L"

  // Behavior
  overwriteExisting?: boolean; // default: false
  copyQuestionHebrew?: boolean; // default: false (אם רוצים גם להכניס matched_question_he לעמודה E)
  writeBackStatus?: boolean; // default: true
  statusColLetter?: string; // default: "M"
};

const colIdx = (letter: string) => letter.toUpperCase().charCodeAt(0) - 65;

const normalize = (s: string) =>
  (s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export class VlookupHebrewFromUnmatchedJob {
  constructor(private sheets: SheetsService) {}

  async run(cfg: VlookupHebrewFromUnmatchedConfig): Promise<void> {
    const masterTab = cfg.masterTabName?.trim() || "Sheet1";
    const unmatchedTab = cfg.unmatchedTabName?.trim() || "Unmatched (Hebrew Injection)";

    const masterQCol = cfg.masterQuestionColLetter || "C";
    const masterQHeCol = cfg.masterQuestionHebColLetter || "E";
    const masterAHeCol = cfg.masterAnswerHebColLetter || "F";

    const unMasterRowCol = cfg.unmatchedMasterRowColLetter || "B";
    const unQEnCol = cfg.unmatchedQuestionEnColLetter || "D";
    const unQHeCol = cfg.unmatchedMatchedQuestionHeColLetter || "K";
    const unAHeCol = cfg.unmatchedMatchedAnswerHeColLetter || "L";

    const overwrite = cfg.overwriteExisting ?? false;
    const copyQHe = cfg.copyQuestionHebrew ?? false;
    const writeStatus = cfg.writeBackStatus ?? true;
    const statusCol = cfg.statusColLetter || "M";

    // 1) Read master
    const master = await this.sheets.readValues(cfg.masterSpreadsheetId, `${masterTab}!A:Z`);
    if (master.length < 2) {
      throw new Error(`Master tab "${masterTab}" is empty or missing rows`);
    }

    const masterQIdx = colIdx(masterQCol);
    const masterQHeIdx = colIdx(masterQHeCol);
    const masterAHeIdx = colIdx(masterAHeCol);

    // Build map: question_en -> rowNumber (1-based)
    const qToRow = new Map<string, number[]>();
    for (let r = 2; r <= master.length; r++) {
      const row = master[r - 1] ?? [];
      const q = normalize(String(row[masterQIdx] ?? ""));
      if (!q) continue;
      const arr = qToRow.get(q) ?? [];
      arr.push(r);
      qToRow.set(q, arr);
    }

    // 2) Read unmatched
    const unmatched = await this.sheets.readValues(cfg.masterSpreadsheetId, `${unmatchedTab}!A:Z`);
    if (unmatched.length < 2) {
      console.log(chalk.yellow(`⚠️ Unmatched tab "${unmatchedTab}" has no rows to process.`));
      return;
    }

    const unMasterRowIdx = colIdx(unMasterRowCol);
    const unQEnIdx = colIdx(unQEnCol);
    const unQHeIdx = colIdx(unQHeCol);
    const unAHeIdx = colIdx(unAHeCol);

    const updates: Array<{ range: string; values: string[][] }> = [];
    const statusUpdates: Array<{ range: string; values: string[][] }> = [];

    let written = 0;
    let skippedExisting = 0;
    let notFound = 0;
    let missingHeb = 0;

    for (let i = 2; i <= unmatched.length; i++) {
      const row = unmatched[i - 1] ?? [];

      const masterRowNumRaw = String(row[unMasterRowIdx] ?? "").trim();
      const masterRowNum = Number.parseInt(masterRowNumRaw, 10);

      const qEn = normalize(String(row[unQEnIdx] ?? ""));
      const matchedQHe = String(row[unQHeIdx] ?? "").trim();
      const matchedAHe = String(row[unAHeIdx] ?? "").trim();

      if (!matchedAHe) {
        missingHeb++;
        if (writeStatus) {
          statusUpdates.push({
            range: `${unmatchedTab}!${statusCol}${i}`,
            values: [[`skip_missing_hebrew`]],
          });
        }
        continue;
      }

      // Prefer master_row, fallback to exact question match
      let targetRow = Number.isFinite(masterRowNum) && masterRowNum >= 2 ? masterRowNum : 0;
      if (!targetRow && qEn) {
        targetRow = (qToRow.get(qEn)?.[0] ?? 0) as number;
      }

      if (!targetRow || targetRow > master.length) {
        notFound++;
        if (writeStatus) {
          statusUpdates.push({
            range: `${unmatchedTab}!${statusCol}${i}`,
            values: [[`not_found_in_master`]],
          });
        }
        continue;
      }

      const masterRow = master[targetRow - 1] ?? [];
      const existingAHe = String(masterRow[masterAHeIdx] ?? "").trim();
      const existingQHe = String(masterRow[masterQHeIdx] ?? "").trim();

      let didWrite = false;

      // Write answer hebrew (F)
      if (overwrite || !existingAHe) {
        updates.push({
          range: `${masterTab}!${masterAHeCol}${targetRow}`,
          values: [[matchedAHe]],
        });
        didWrite = true;
      }

      // Optional: write question hebrew (E)
      if (copyQHe && matchedQHe && (overwrite || !existingQHe)) {
        updates.push({
          range: `${masterTab}!${masterQHeCol}${targetRow}`,
          values: [[matchedQHe]],
        });
        didWrite = true;
      }

      if (didWrite) written++;
      else skippedExisting++;

      if (writeStatus) {
        statusUpdates.push({
          range: `${unmatchedTab}!${statusCol}${i}`,
          values: [[didWrite ? `written(${targetRow})` : `skipped_existing(${targetRow})`]],
        });
      }
    }

    // 3) Apply updates
    await this.sheets.batchWriteValues(cfg.masterSpreadsheetId, updates);

    if (writeStatus) {
      await this.sheets.batchWriteValues(cfg.masterSpreadsheetId, statusUpdates);
    }

    console.log(
      chalk.green(
        `✅ VLOOKUP done. written=${written}, skipped_existing=${skippedExisting}, not_found=${notFound}, missing_hebrew=${missingHeb}`
      )
    );
  }
}