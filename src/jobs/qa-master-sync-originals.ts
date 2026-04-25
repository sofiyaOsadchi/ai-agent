import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type QaMasterSyncOriginalsConfig = {
  spreadsheetId: string;

  // Triage tab
  triageTabName: string;

  // Language
  targetLang: string;

  // Root folder that contains all original hotel spreadsheets, including subfolders
  originalsRootFolderId: string;

  // Tabs in original spreadsheets
  originalEnglishTabName?: string; // default: "Sheet1"
  originalTargetTabName?: string; // optional explicit override
  originalTargetTabBaseName?: string; // default: "Sheet1"

  // Marker used in triage
  emptyCellMarker?: string;

  // Safety
  maxRowsToProcess?: number;

  // Update switches
  updateOriginalEnglish?: boolean;
  updateOriginalTarget?: boolean;
  updateMasterAfterSync?: boolean;

  // Master update options, only if updateMasterAfterSync=true
  masterTabName?: string;
};

type TriageSyncRow = {
  hotel: string;
  questionEnFull: string;
  answerEnFull: string;
  questionTargetFull: string;
  answerTargetFull: string;
  whyIssue: string;
  fixQuestionTarget: string;
  fixAnswerTarget: string;
  sourceSeverity: string;
  sourceType: string;
  sourceRow: number;
};

type SpreadsheetRef = {
  spreadsheetId: string;
  title: string;
};

export class QaMasterSyncOriginalsJob {
  constructor(private sheets: SheetsService) {}

  private normHeader(s: string): string {
    return String(s ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private normCell(s: string): string {
    return String(s ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalizeCompareText(s: string): string {
    return String(s ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&#\d+;/g, " ")
      .replace(/&#x[0-9a-f]+;/gi, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, "\"")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private normalizeHotelKey(s: string): string {
    return this.normalizeCompareText(s)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isEmptyOrMarker(v: string, marker: string): boolean {
    const x = this.normCell(v);
    if (!x) return true;
    if (x === marker) return true;
    return false;
  }

  private colToA1(colIndex0: number): string {
    let n = colIndex0 + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  private quoteTabName(tabName: string): string {
  const escaped = String(tabName ?? "").replace(/'/g, "''");
  return `'${escaped}'`;
}

  private extractFolderId(input: string): string {
    const s = String(input ?? "").trim();
    const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/);
    return m?.[1] ?? s;
  }

  private async listOriginalSpreadsheetsRecursive(folderInput: string): Promise<SpreadsheetRef[]> {
    const folderId = this.extractFolderId(folderInput);
    const anySheets = this.sheets as any;

    let ids: string[] = [];

    if (typeof anySheets.listSpreadsheetIdsInFolderRecursive === "function") {
      ids = await anySheets.listSpreadsheetIdsInFolderRecursive(folderId);
    } else if (typeof anySheets.listSpreadsheetIdsInFolder === "function") {
      ids = await anySheets.listSpreadsheetIdsInFolder(folderId);
    } else {
      throw new Error("SheetsService does not support folder spreadsheet listing.");
    }

    const uniqueIds = [...new Set(ids)];
    const out: SpreadsheetRef[] = [];

    for (const spreadsheetId of uniqueIds) {
      let title = spreadsheetId;
      try {
        title = await this.sheets.getSpreadsheetTitle(spreadsheetId);
      } catch {
        title = spreadsheetId;
      }
      out.push({ spreadsheetId, title });
    }

    return out;
  }

  private findTriageHeader(rows: string[][], lang: string): { headerRowIndex: number; idx: any } | null {
    const qTargetKey = `question_${lang}_full`;
    const aTargetKey = `answer_${lang}_full`;
    const fixQKey = `fix_question_${lang}`;
    const fixAKey = `fix_answer_${lang}`;

    for (let r = 0; r < rows.length; r++) {
      const n = (rows[r] ?? []).map((c) => this.normHeader(c));

      const hotelIdx = n.indexOf("hotel");
      const qEnIdx = n.indexOf("question_en_full");
      const aEnIdx = n.indexOf("answer_en_full");
      const qTIdx = n.indexOf(qTargetKey);
      const aTIdx = n.indexOf(aTargetKey);
      const whyIdx = n.indexOf("why_issue");
      const fixQIdx = n.indexOf(fixQKey);
      const fixAIdx = n.indexOf(fixAKey);
      const sourceSeverityIdx = n.indexOf("source_severity");
      const sourceTypeIdx = n.indexOf("source_type");
      const sourceRowIdx = n.indexOf("source_row");

      if (
        hotelIdx >= 0 &&
        qEnIdx >= 0 &&
        aEnIdx >= 0 &&
        qTIdx >= 0 &&
        aTIdx >= 0 &&
        fixQIdx >= 0 &&
        fixAIdx >= 0 &&
        sourceRowIdx >= 0
      ) {
        return {
          headerRowIndex: r,
          idx: {
            hotelIdx,
            qEnIdx,
            aEnIdx,
            qTIdx,
            aTIdx,
            whyIdx,
            fixQIdx,
            fixAIdx,
            sourceSeverityIdx,
            sourceTypeIdx,
            sourceRowIdx,
          },
        };
      }
    }

    return null;
  }

  private parseTriageRows(rows: string[][], lang: string, marker: string, maxRows: number): TriageSyncRow[] {
    const found = this.findTriageHeader(rows, lang);
    if (!found) {
      throw new Error(
        `Could not find triage header. Expected columns like question_en_full, answer_en_full, question_${lang}_full, answer_${lang}_full, fix_question_${lang}, fix_answer_${lang}, source_row.`
      );
    }

    const { headerRowIndex, idx } = found;
    const out: TriageSyncRow[] = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      if (out.length >= maxRows) break;

      const row = rows[r] ?? [];

      const hotel = this.normCell(row[idx.hotelIdx] ?? "");
      const questionEnFull = this.normCell(row[idx.qEnIdx] ?? "");
      const answerEnFull = this.normCell(row[idx.aEnIdx] ?? "");
      const questionTargetFull = this.normCell(row[idx.qTIdx] ?? "");
      const answerTargetFull = this.normCell(row[idx.aTIdx] ?? "");
      const whyIssue = idx.whyIdx >= 0 ? this.normCell(row[idx.whyIdx] ?? "") : "";
      const fixQuestionTarget = this.normCell(row[idx.fixQIdx] ?? "");
      const fixAnswerTarget = this.normCell(row[idx.fixAIdx] ?? "");
      const sourceSeverity = idx.sourceSeverityIdx >= 0 ? this.normCell(row[idx.sourceSeverityIdx] ?? "") : "";
      const sourceType = idx.sourceTypeIdx >= 0 ? this.normCell(row[idx.sourceTypeIdx] ?? "") : "";
      const sourceRowRaw = this.normCell(row[idx.sourceRowIdx] ?? "");

      if (!hotel && !questionEnFull && !answerEnFull && !sourceRowRaw) continue;

      const sourceRow = parseInt(sourceRowRaw, 10);
      if (!Number.isFinite(sourceRow) || sourceRow <= 0) continue;

      const hasAnyFix =
        !this.isEmptyOrMarker(fixQuestionTarget, marker) ||
        !this.isEmptyOrMarker(fixAnswerTarget, marker);

      if (!hasAnyFix) continue;

      out.push({
        hotel,
        questionEnFull,
        answerEnFull,
        questionTargetFull,
        answerTargetFull,
        whyIssue,
        fixQuestionTarget,
        fixAnswerTarget,
        sourceSeverity,
        sourceType,
        sourceRow,
      });
    }

    return out;
  }

  private matchSpreadsheetByHotel(hotel: string, spreadsheets: SpreadsheetRef[]): SpreadsheetRef | null {
    const hotelKey = this.normalizeHotelKey(hotel);
    if (!hotelKey) return null;

    const exact = spreadsheets.filter((s) => this.normalizeHotelKey(s.title) === hotelKey);
    if (exact.length === 1) return exact[0];

    const contains = spreadsheets.filter((s) => {
      const titleKey = this.normalizeHotelKey(s.title);
      return titleKey.includes(hotelKey) || hotelKey.includes(titleKey);
    });
    if (contains.length === 1) return contains[0];

    return null;
  }

  private async resolveExistingTabOrThrow(spreadsheetId: string, preferredTabName: string): Promise<string> {
    const anySheets = this.sheets as any;
    if (typeof anySheets.getSheetIdByTitle === "function") {
      await anySheets.getSheetIdByTitle(spreadsheetId, preferredTabName);
      return preferredTabName;
    }

    const rows = await this.sheets.readValues(spreadsheetId, `${preferredTabName}!A:C`);
    if (!rows) throw new Error(`Tab "${preferredTabName}" was not found in spreadsheet ${spreadsheetId}`);
    return preferredTabName;
  }

  private getTargetTabName(cfg: QaMasterSyncOriginalsConfig, lang: string): string {
    if (cfg.originalTargetTabName?.trim()) return cfg.originalTargetTabName.trim();
    const base = cfg.originalTargetTabBaseName?.trim() || "Sheet1";
    return `${base} - ${lang.toUpperCase()}`;
  }

  private findQaColumnsInSheet(rows: string[][]): { headerRowIndex: number; qIdx: number; aIdx: number } {
    for (let r = 0; r < rows.length; r++) {
      const n = (rows[r] ?? []).map((c) => this.normHeader(c));

      const qIdx =
        n.indexOf("question") >= 0
          ? n.indexOf("question")
          : n.indexOf("question en") >= 0
          ? n.indexOf("question en")
          : n.indexOf("question_he") >= 0
          ? n.indexOf("question_he")
          : n.indexOf("question he");

      const aIdx =
        n.indexOf("answer") >= 0
          ? n.indexOf("answer")
          : n.indexOf("answer en") >= 0
          ? n.indexOf("answer en")
          : n.indexOf("answer_he") >= 0
          ? n.indexOf("answer_he")
          : n.indexOf("answer he");

      if (qIdx >= 0 && aIdx >= 0) {
        return { headerRowIndex: r, qIdx, aIdx };
      }
    }

    // fallback למבנה הקבוע שלך: B=Question, C=Answer
    return { headerRowIndex: 0, qIdx: 1, aIdx: 2 };
  }

  private findRowByEnglishQuestion(rows: string[][], questionEn: string, qIdx: number, headerRowIndex: number): number | null {
    const wanted = this.normalizeCompareText(questionEn);
    if (!wanted) return null;

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const current = this.normalizeCompareText(row[qIdx] ?? "");
      if (!current) continue;
      if (current === wanted) return r + 1; // 1-based row number
    }

    return null;
  }

 private stripHtmlToText(s: string): string {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&euro;/gi, "€")
    .replace(/&pound;/gi, "£")
    .replace(/&dollar;/gi, "$")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&hellip;/gi, "...")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&szlig;/gi, "ß")
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : " ";
    })
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

  private async writeCell(spreadsheetId: string, tabName: string, colIdx: number, rowNumber1: number, value: string) {
  const col = this.colToA1(colIdx);
  const safeTab = this.quoteTabName(tabName);
  await this.sheets.writeValues(spreadsheetId, `${safeTab}!${col}${rowNumber1}`, [[value]]);
}

  private findMasterHeader(rows: string[][], lang: string): { qIdx: number; aIdx: number } {
    const qKey = `question_${lang}`;
    const aKey = `answer_${lang}`;

    for (let r = 0; r < rows.length; r++) {
      const n = (rows[r] ?? []).map((c) => this.normHeader(c));
      const qIdx = n.indexOf(qKey);
      const aIdx = n.indexOf(aKey);
      if (qIdx >= 0 && aIdx >= 0) return { qIdx, aIdx };
    }

    for (let r = 0; r < rows.length; r++) {
      const n = (rows[r] ?? []).map((c) => this.normHeader(c));
      const qIdx = n.indexOf(`question ${lang}`);
      const aIdx = n.indexOf(`answer ${lang}`);
      if (qIdx >= 0 && aIdx >= 0) return { qIdx, aIdx };
    }

    throw new Error(`Could not find master header columns question_${lang} and answer_${lang}.`);
  }

  async run(cfg: QaMasterSyncOriginalsConfig): Promise<void> {
    const lang = String(cfg.targetLang ?? "").trim().toLowerCase();
    if (!lang) throw new Error("targetLang is required");

    const triageTabName = String(cfg.triageTabName ?? "").trim();
    if (!triageTabName) throw new Error("triageTabName is required");

    const originalsRootFolderId = String(cfg.originalsRootFolderId ?? "").trim();
    if (!originalsRootFolderId) throw new Error("originalsRootFolderId is required");

    const marker = cfg.emptyCellMarker ?? "∅";
    const maxRows = cfg.maxRowsToProcess ?? 500;

    const updateOriginalEnglish = cfg.updateOriginalEnglish !== false;
    const updateOriginalTarget = cfg.updateOriginalTarget !== false;
    const updateMasterAfterSync = cfg.updateMasterAfterSync === true;

    const originalEnglishTabName = cfg.originalEnglishTabName?.trim() || "Sheet1";
    const originalTargetTabName = this.getTargetTabName(cfg, lang);

    console.log(chalk.blue(`Starting QA originals sync (${lang.toUpperCase()})...`));
    console.log(chalk.gray(`Triage tab: "${triageTabName}"`));
    console.log(chalk.gray(`Originals root folder: "${originalsRootFolderId}"`));

    const triageRows = await this.sheets.readValues(cfg.spreadsheetId, `${triageTabName}!A:Z`);
    if (triageRows.length < 2) {
      throw new Error("Triage tab has no data.");
    }

    const triageItems = this.parseTriageRows(triageRows, lang, marker, maxRows);

    console.log(chalk.cyan(`Parsed triage rows with actual fixes: ${triageItems.length}`));

    if (triageItems.length === 0) {
      console.log(chalk.yellow("No triage rows with actual fixes were found."));
      return;
    }

    const originals = await this.listOriginalSpreadsheetsRecursive(originalsRootFolderId);
    console.log(chalk.cyan(`Original spreadsheets discovered: ${originals.length}`));

for (const s of originals) {
  console.log(chalk.gray(` - ${s.title} | ${s.spreadsheetId}`));
}
    console.log(chalk.cyan(`Original spreadsheets discovered: ${originals.length}`));

    let syncedOriginalRows = 0;
    let updatedEnglishCells = 0;
    let updatedTargetCells = 0;
    let updatedMasterCells = 0;
    let skippedNoSpreadsheet = 0;
    let skippedNoQuestionMatch = 0;
    let skippedTabErrors = 0;

    let masterQIdx: number | null = null;
    let masterAIdx: number | null = null;
    let masterTabName = cfg.masterTabName?.trim() || "";

    if (updateMasterAfterSync) {
      if (!masterTabName) {
        throw new Error("masterTabName is required when updateMasterAfterSync=true");
      }
      const masterRows = await this.sheets.readValues(cfg.spreadsheetId, `${masterTabName}!A:Z`);
      const masterHeader = this.findMasterHeader(masterRows, lang);
      masterQIdx = masterHeader.qIdx;
      masterAIdx = masterHeader.aIdx;
    }

    for (const item of triageItems) {
      const matchedSpreadsheet = this.matchSpreadsheetByHotel(item.hotel, originals);

      if (!matchedSpreadsheet) {
        skippedNoSpreadsheet++;
        console.log(chalk.yellow(`No original spreadsheet match for hotel: ${item.hotel}`));
        continue;
      }

      let englishTab = originalEnglishTabName;
      let targetTab = originalTargetTabName;

      try {
        englishTab = await this.resolveExistingTabOrThrow(matchedSpreadsheet.spreadsheetId, originalEnglishTabName);
        targetTab = await this.resolveExistingTabOrThrow(matchedSpreadsheet.spreadsheetId, originalTargetTabName);
      } catch (err) {
        skippedTabErrors++;
        console.log(
          chalk.yellow(
            `Tab resolution failed for "${matchedSpreadsheet.title}" (${matchedSpreadsheet.spreadsheetId}): ${String(err)}`
          )
        );
        continue;
      }

const englishRows = await this.sheets.readValues(
  matchedSpreadsheet.spreadsheetId,
  `${this.quoteTabName(englishTab)}!A:Z`
);
      if (englishRows.length < 2) {
        skippedNoQuestionMatch++;
        console.log(chalk.yellow(`English tab has no usable data for "${matchedSpreadsheet.title}"`));
        continue;
      }

      const englishHeader = this.findQaColumnsInSheet(englishRows);
      const originalRowNumber = this.findRowByEnglishQuestion(
        englishRows,
        item.questionEnFull,
        englishHeader.qIdx,
        englishHeader.headerRowIndex
      );

      if (!originalRowNumber) {
        skippedNoQuestionMatch++;
        console.log(
          chalk.yellow(`Could not match English question in "${matchedSpreadsheet.title}" for hotel "${item.hotel}"`)
        );
        continue;
      }

     if (updateOriginalEnglish) {
  const cleanQuestionEn = this.stripHtmlToText(item.questionEnFull);
  const cleanAnswerEn = this.stripHtmlToText(item.answerEnFull);

  await this.writeCell(
    matchedSpreadsheet.spreadsheetId,
    englishTab,
    englishHeader.qIdx,
    originalRowNumber,
    cleanQuestionEn
  );
  await this.writeCell(
    matchedSpreadsheet.spreadsheetId,
    englishTab,
    englishHeader.aIdx,
    originalRowNumber,
    cleanAnswerEn
  );
  updatedEnglishCells += 2;
}

      if (updateOriginalTarget) {
const targetRows = await this.sheets.readValues(
  matchedSpreadsheet.spreadsheetId,
  `${this.quoteTabName(targetTab)}!A:Z`
);
        const targetHeader = this.findQaColumnsInSheet(targetRows);

        if (!this.isEmptyOrMarker(item.fixQuestionTarget, marker)) {
          await this.writeCell(
            matchedSpreadsheet.spreadsheetId,
            targetTab,
            targetHeader.qIdx,
            originalRowNumber,
            item.fixQuestionTarget
          );
          updatedTargetCells++;
        }

        if (!this.isEmptyOrMarker(item.fixAnswerTarget, marker)) {
          await this.writeCell(
            matchedSpreadsheet.spreadsheetId,
            targetTab,
            targetHeader.aIdx,
            originalRowNumber,
            item.fixAnswerTarget
          );
          updatedTargetCells++;
        }
      }

      if (updateMasterAfterSync && masterTabName && masterQIdx != null && masterAIdx != null) {
        if (!this.isEmptyOrMarker(item.fixQuestionTarget, marker)) {
          await this.writeCell(cfg.spreadsheetId, masterTabName, masterQIdx, item.sourceRow, item.fixQuestionTarget);
          updatedMasterCells++;
        }

        if (!this.isEmptyOrMarker(item.fixAnswerTarget, marker)) {
          await this.writeCell(cfg.spreadsheetId, masterTabName, masterAIdx, item.sourceRow, item.fixAnswerTarget);
          updatedMasterCells++;
        }
      }

      syncedOriginalRows++;
      console.log(
        chalk.green(
          `Synced hotel "${item.hotel}" -> file "${matchedSpreadsheet.title}" | original row ${originalRowNumber}`
        )
      );
    }

    console.log(chalk.green(`QA originals sync completed.`));
    console.log(
      chalk.gray(
        `Rows synced: ${syncedOriginalRows} | English cells: ${updatedEnglishCells} | Target cells: ${updatedTargetCells} | Master cells: ${updatedMasterCells}`
      )
    );
    console.log(
      chalk.gray(
        `Skipped - no spreadsheet: ${skippedNoSpreadsheet} | no question match: ${skippedNoQuestionMatch} | tab errors: ${skippedTabErrors}`
      )
    );
  }
}