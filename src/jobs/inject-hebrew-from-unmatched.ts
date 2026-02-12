import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type InjectHebrewFromUnmatchedConfig = {
  masterSpreadsheetId: string;
  masterTabName?: string; // default first tab

  hotelsFolderId: string; // folder with hotel spreadsheets

  // Tab that holds unmatched rows (created earlier)
  unmatchedTabName?: string; // default "Unmatched (Hebrew Injection)"

  // Master columns (0-based)
  masterHebQuestionColIndex?: number; // default header match or 4
  masterHebAnswerColIndex?: number;   // default header match or 5

  // Unmatched tab columns (0-based) - defaults match your layout
  unmatchedHotelColIndex?: number;       // A (0)
  unmatchedMasterRowColIndex?: number;   // B (1) 1-based sheet row number in master
  unmatchedMatchedQColIndex?: number;    // F (5)
  unmatchedMatchedAColIndex?: number;    // G (6) optional
  unmatchedScoreColIndex?: number;       // H (7) optional
  unmatchedMatchedHotelColIndex?: number; // I (8) optional (if exists)

  // Hotel sheet tabs
  hotelEnglishTabName?: string; // usually "Sheet1"
  hotelHebrewTabName?: string;  // optional, auto-detect if empty

  // Hotel ranges (keep narrow)
  hotelRangeA1?: string; // default "B:C" (Question/Answer)

  // Safety rules
  strictHotelNameMatch?: boolean; // default true (A must equal I if I exists)
  minScoreToInject?: number;      // default 0.0 (if score column exists, can require threshold)

  // Write status back into Unmatched tab
  writeBackStatus?: boolean;      // default true
  statusColLetter?: string;       // default "K" (write status text)
  statusHeader?: string;          // default "hebrew_inject_status"
};

type TranslationPair = { hebQuestion: string; hebAnswer: string };

export class InjectHebrewFromUnmatchedJob {
  constructor(private sheets: SheetsService) {}

  private normalizeText(input: string): string {
    if (!input) return "";
    const s = input
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–−]/g, "-")
      .toLowerCase()
      .trim();

    return s
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async resolveTabOrFirst(spreadsheetId: string, tabName?: string): Promise<string> {
    if (tabName && tabName.trim()) {
      try {
        await this.sheets.getSheetIdByTitle(spreadsheetId, tabName.trim());
        return tabName.trim();
      } catch {
        return await this.sheets.getFirstSheetTitle(spreadsheetId);
      }
    }
    return await this.sheets.getFirstSheetTitle(spreadsheetId);
  }

  private async detectHebrewTab(spreadsheetId: string, preferred?: string): Promise<string> {
    if (preferred && preferred.trim()) return await this.resolveTabOrFirst(spreadsheetId, preferred);

    const titles = await this.sheets.listSheetTitles(spreadsheetId);
    const norm = (t: string) => (t ?? "").toLowerCase().replace(/\u00A0/g, " ").trim();

    const candidates = titles.filter(t => {
      const n = norm(t);
      return n.includes(" he") || n.includes("- he") || n.includes("– he") || n.includes("hebrew") || n.includes("עבר");
    });

    if (candidates.length > 0) return candidates[0];
    if (titles.length >= 2) return titles[1];
    if (titles.length === 1) return titles[0];

    throw new Error(`Cannot detect Hebrew tab in ${spreadsheetId}`);
  }

  private findColumnIndexByHeader(headers: string[], desired: string[]): number | null {
    const normalizeHeader = (x: string) =>
      (x ?? "").toLowerCase().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

    const set = new Set(desired.map(normalizeHeader));
    for (let i = 0; i < headers.length; i++) {
      const h = normalizeHeader(String(headers[i] ?? ""));
      if (set.has(h)) return i;
    }
    return null;
  }

  private buildTranslationsFromHotelTabs(
    enRows: string[][],
    heRows: string[][],
    enQIdx: number,
    heQIdx: number,
    heAIdx: number
  ): Map<string, TranslationPair> {
    const map = new Map<string, TranslationPair>();
    const max = Math.max(enRows.length, heRows.length);

    for (let r = 1; r < max; r++) {
      const enRow = enRows[r] ?? [];
      const heRow = heRows[r] ?? [];

      const enQ = String(enRow[enQIdx] ?? "").trim();
      if (!enQ) continue;

      const key = this.normalizeText(enQ);
      if (!key) continue;

      const heQ = String(heRow[heQIdx] ?? "").trim();
      const heA = String(heRow[heAIdx] ?? "").trim();

      if (!map.has(key)) map.set(key, { hebQuestion: heQ, hebAnswer: heA });
    }
    return map;
  }

  private indexToColumnLetter(index0: number): string {
    let n = index0 + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  async run(cfg: InjectHebrewFromUnmatchedConfig): Promise<void> {
    console.log(chalk.blue("🧩 Starting Inject Hebrew from Unmatched..."));

    const unmatchedTab = (cfg.unmatchedTabName?.trim() || "Unmatched (Hebrew Injection)");
    const strictHotel = cfg.strictHotelNameMatch ?? true;
    const minScore = cfg.minScoreToInject ?? 0;
    const rangeBC = cfg.hotelRangeA1?.trim() || "B:C";
    const writeBackStatus = cfg.writeBackStatus ?? true;
    const statusColLetter = (cfg.statusColLetter?.trim() || "K");
    const statusHeader = (cfg.statusHeader?.trim() || "hebrew_inject_status");

    const masterId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);
    const masterTab = await this.resolveTabOrFirst(masterId, cfg.masterTabName);

    // Read master once
    const masterRows = await this.sheets.readValues(masterId, `${masterTab}!A:Z`);
    if (masterRows.length === 0) throw new Error("Master is empty");

    const masterHeaders = (masterRows[0] ?? []).map(x => String(x ?? ""));
    const hebQCol = cfg.masterHebQuestionColIndex ??
      this.findColumnIndexByHeader(masterHeaders, ["question hebrew", "hebrew question", "שאלה בעברית"]) ?? 4;
    const hebACol = cfg.masterHebAnswerColIndex ??
      this.findColumnIndexByHeader(masterHeaders, ["answer hebrew", "hebrew answer", "תשובה בעברית"]) ?? 5;

    // Read unmatched tab
    const unmatchedRows = await this.sheets.readValues(masterId, `${unmatchedTab}!A:Z`);
    if (unmatchedRows.length <= 1) {
      console.log(chalk.yellow(`⚠️ No rows in ${unmatchedTab}`));
      return;
    }

    const uHotelCol = cfg.unmatchedHotelColIndex ?? 0;
    const uMasterRowCol = cfg.unmatchedMasterRowColIndex ?? 1;
    const uMatchedQCol = cfg.unmatchedMatchedQColIndex ?? 5;
    const uMatchedACol = cfg.unmatchedMatchedAColIndex ?? 6;
    const uScoreCol = cfg.unmatchedScoreColIndex ?? 7;
    const uMatchedHotelCol = cfg.unmatchedMatchedHotelColIndex ?? 8;

    // Build map hotelNameNormalized -> spreadsheetId using Drive list names
    const folderId = cfg.hotelsFolderId.includes("folders/")
      ? (cfg.hotelsFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? cfg.hotelsFolderId)
      : cfg.hotelsFolderId;

    // IMPORTANT: this assumes you already have a method returning names+ids.
    // If you don't, see section 2 below (small addition to SheetsService).
    const hotelFiles = await this.sheets.listSpreadsheetsInFolderWithNames(folderId);

    const hotelNameToId = new Map<string, string>();
    for (const f of hotelFiles) {
      const key = this.normalizeText(f.name);
      if (key && !hotelNameToId.has(key)) hotelNameToId.set(key, f.id);
    }

    // Cache per hotel translations (avoid repeated reads)
    const translationsCache = new Map<string, Map<string, TranslationPair>>();

    const statuses: string[] = []; // 1 cell per row in unmatched (including header)
    statuses.push(statusHeader);

    let injectedCount = 0;
    let skippedCount = 0;

    for (let r = 1; r < unmatchedRows.length; r++) {
      const row = unmatchedRows[r] ?? [];
      const hotel = String(row[uHotelCol] ?? "").trim();
      const masterRowStr = String(row[uMasterRowCol] ?? "").trim();
      const matchedQ = String(row[uMatchedQCol] ?? "").trim();
      const matchedHotel = String(row[uMatchedHotelCol] ?? "").trim();
      const scoreStr = String(row[uScoreCol] ?? "").trim();

      if (!hotel || !masterRowStr || !matchedQ) {
        statuses.push("skip: missing hotel/master_row/matched_question");
        skippedCount++;
        continue;
      }

      if (strictHotel && matchedHotel) {
        const a = this.normalizeText(hotel);
        const b = this.normalizeText(matchedHotel);
        if (a !== b) {
          statuses.push(`skip: hotel mismatch (A="${hotel}" vs matched="${matchedHotel}")`);
          skippedCount++;
          continue;
        }
      }

      const score = scoreStr ? Number(scoreStr) : NaN;
      if (!Number.isNaN(score) && score < minScore) {
        statuses.push(`skip: score ${score.toFixed(3)} < ${minScore}`);
        skippedCount++;
        continue;
      }

      const masterRow1Based = Number(masterRowStr);
      if (!Number.isFinite(masterRow1Based) || masterRow1Based < 2) {
        statuses.push("skip: bad master_row");
        skippedCount++;
        continue;
      }

      const masterIdx0 = masterRow1Based - 1; // sheet row -> array index
      if (masterIdx0 >= masterRows.length) {
        statuses.push("skip: master_row out of range");
        skippedCount++;
        continue;
      }

      const hotelId = hotelNameToId.get(this.normalizeText(hotel));
      if (!hotelId) {
        statuses.push("skip: hotel file not found in folder");
        skippedCount++;
        continue;
      }

      // Load translations for this hotel once
      let hotelTranslations = translationsCache.get(hotelId);
      if (!hotelTranslations) {
        const enTab = await this.resolveTabOrFirst(hotelId, cfg.hotelEnglishTabName);
        const heTab = await this.detectHebrewTab(hotelId, cfg.hotelHebrewTabName);

        const enRows = await this.sheets.readValues(hotelId, `${enTab}!${rangeBC}`);
        const heRows = await this.sheets.readValues(hotelId, `${heTab}!${rangeBC}`);

        if (enRows.length <= 1 || heRows.length <= 1) {
          statuses.push("skip: hotel sheet has insufficient rows");
          skippedCount++;
          continue;
        }

        // In B:C, question is index 0, answer is index 1
        hotelTranslations = this.buildTranslationsFromHotelTabs(
          enRows,
          heRows,
          0, // en question in B
          0, // he question in B
          1  // he answer in C
        );

        translationsCache.set(hotelId, hotelTranslations);
      }

      const key = this.normalizeText(matchedQ);
      const pair = hotelTranslations.get(key);

      if (!pair) {
        statuses.push("skip: matched_question not found in hotel map");
        skippedCount++;
        continue;
      }

      // Inject into master row
      masterRows[masterIdx0][hebQCol] = pair.hebQuestion;
      masterRows[masterIdx0][hebACol] = pair.hebAnswer;

      injectedCount++;
      statuses.push(`ok${!Number.isNaN(score) ? ` (score ${score.toFixed(3)})` : ""}`);
    }

    // Write back master columns (same strategy as your inject job: write full columns once)
    const hebQColLetter = this.indexToColumnLetter(hebQCol);
    const hebAColLetter = this.indexToColumnLetter(hebACol);

    const colHebQ: string[][] = masterRows.map((row, i) => {
      if (i === 0) return [masterHeaders[hebQCol] || "question hebrew"];
      return [String((row ?? [])[hebQCol] ?? "")];
    });

    const colHebA: string[][] = masterRows.map((row, i) => {
      if (i === 0) return [masterHeaders[hebACol] || "answer hebrew"];
      return [String((row ?? [])[hebACol] ?? "")];
    });

    await this.sheets.writeValues(masterId, `${masterTab}!${hebQColLetter}1`, colHebQ);
    await this.sheets.writeValues(masterId, `${masterTab}!${hebAColLetter}1`, colHebA);

    // Optional: write statuses back into unmatched tab
    if (writeBackStatus) {
      await this.sheets.writeValues(masterId, `${unmatchedTab}!${statusColLetter}1`, statuses.map(x => [x]));
    }

    console.log(chalk.green("✅ Inject Hebrew from Unmatched completed."));
    console.log(chalk.white(`- Injected: ${injectedCount}`));
    console.log(chalk.white(`- Skipped: ${skippedCount}`));
  }
}