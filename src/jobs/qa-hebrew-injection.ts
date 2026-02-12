// src/jobs/qa-hebrew-injection.ts
import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";
import { AIAgent } from "../core/agent.js";

export type HebrewInjectionQaConfig = {
  processedSpreadsheetId: string;
  processedTabName?: string;

  originalSpreadsheetId: string;
  originalTabName?: string;

  // Output (Deterministic tab)
  outputTabName?: string; // default: "QA - Hebrew Injection"

  // Output (AI tab)
  aiOutputTabName?: string; // default: "${outputTabName} - AI"

  // Use existing styled template tab (will duplicate it each run)
  templateTabName?: string; // default: "QA - TEMPLATE"

  unmatchedTabName?: string; // default: "Unmatched (Hebrew Injection)"

  processedIsSubsetOfOriginal?: boolean; // default: true

  // Compare text, but avoid noisy minor diffs
  compareEnglishText?: boolean; // default: true
  checkMissingHebrew?: boolean; // default: true
  checkInternalConsistency?: boolean; // default: true
  checkContentDuplicates?: boolean; // default: true

  // AI semantic check (runs after deterministic)
  aiSemanticCheck?: boolean; // default: false
  aiModel?: string; // default: "o3"
  aiBatchSize?: number; // default: 20
  aiMinScore?: number; // kept for backward compatibility (not used when scores are disabled)
  aiMaxRows?: number; // default: 3000

  // Cap by number of AI calls (useful for call limits)
  aiMaxCalls?: number; // default: 60 (60*batchSize rows max)

  maxIssuesInReport?: number; // default: 500
  maxDuplicateRowsInReport?: number; // default: 400
  maxAiRowsInReport?: number; // default: 2000
};

type IssueType =
  | "DUPLICATE_ID_PROCESSED"
  | "DUPLICATE_ID_ORIGINAL"
  | "MISSING_IN_ORIGINAL"
  | "MISSING_IN_PROCESSED"
  | "HOTEL_MISMATCH"
  | "COUNTRY_MISMATCH"
  | "TRANSLATABLE_ID_MISMATCH"
  | "QUESTION_EN_MISMATCH"
  | "ANSWER_EN_MISMATCH"
  | "MISSING_HEBREW_QUESTION"
  | "MISSING_HEBREW_ANSWER"
  | "INTERNAL_MISSING_EN_QUESTION"
  | "INTERNAL_MISSING_EN_ANSWER"
  | "UNMATCHED_FLAG"
  | "DUPLICATE_HEBREW_QUESTION"
  | "DUPLICATE_HEBREW_ANSWER"
  | "DUPLICATE_ENGLISH_QUESTION"
  | "AI_PARSE_FAILED";

type Issue = {
  severity: "ERROR" | "WARN";
  type: IssueType;
  id: string;

  processedRow?: number;
  originalRow?: number;

  processedHotel?: string;
  originalHotel?: string;

  processedCountry?: string;
  originalCountry?: string;

  processedQuestionEn?: string;
  originalQuestionEn?: string;

  processedAnswerEn?: string;
  originalAnswerEn?: string;

  processedQuestionHe?: string;
  processedAnswerHe?: string;

  processedTranslatableId?: string;
  originalTranslatableId?: string;

  field?: string;
  note?: string;
};

type MissingHebrewRow = {
  id: string;
  processedRow: number;
  hotel: string;
  country: string;
  translatableId: string;
  questionEn: string;
  answerEn: string;
  questionHe: string;
  answerHe: string;
  missingQuestionHebrew: boolean;
  missingAnswerHebrew: boolean;
};

type UnmatchedFlagRow = {
  id: string;
  processedRow: number;
  hotel: string;
  country: string;
  questionEn: string;
  answerEn: string;
  status: string;
};

type AiReviewRow = {
  id: string;
  processedRow: number;
  hotel: string;
  translatableId: string;
  questionEn: string;
  answerEn: string;
  questionHe: string;
  answerHe: string;
  qVerdict: string;
  aVerdict: string;
  flags: string;
  reason: string;
};

type RowRef = { rowNumber: number; row: string[] };

export class HebrewInjectionQaJob {
  constructor(private sheets: SheetsService, private agent?: AIAgent) {}

  private normHeader(s: string): string {
    return String(s ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private normCell(s: string): string {
    return String(s ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private findCol(headers: string[], desired: string[]): number | null {
    const set = new Set(desired.map(d => this.normHeader(d)));
    for (let i = 0; i < headers.length; i++) {
      if (set.has(this.normHeader(headers[i] ?? ""))) return i;
    }
    return null;
  }

  private getCell(row: string[], col: number | null): string {
    if (col == null) return "";
    return this.normCell(String(row[col] ?? ""));
  }

  private async resolveTabOrFirst(spreadsheetId: string, tabName?: string): Promise<string> {
    if (tabName && tabName.trim()) {
      try {
        await this.sheets.getSheetIdByTitle(spreadsheetId, tabName.trim());
        return tabName.trim();
      } catch {
        const fallback = await this.sheets.getFirstSheetTitle(spreadsheetId);
        console.warn(`Tab "${tabName}" not found in ${spreadsheetId}. Using first tab: "${fallback}"`);
        return fallback;
      }
    }
    return await this.sheets.getFirstSheetTitle(spreadsheetId);
  }

  private detectColumns(rows: string[][]) {
    const headers = (rows[0] ?? []).map(h => String(h ?? ""));

    const idCol = this.findCol(headers, ["id", "question_id", "qid"]);

    const translatableIdCol = this.findCol(headers, [
      "translatable_id",
      "translatable id",
      "translatableid",
      "processed_translatable_id",
      "original_translatable_id",
    ]);

    const hotelCol = this.findCol(headers, [
  "enriched hotel name",
  "enriched_hotel_name",
  "hotel",
  "hotel name",
  "hotel_name",
  "hoteltitle",
  "hotel_title",
  "property",
  "property name",
  "property_title",
  "processed_hotel",
  "original_hotel",
  "שם מלון",
]);

    const countryCol = this.findCol(headers, [
      "country",
      "country name",
      "country_name",
      "location country",
      "country_code",
      "processed_country",
      "original_country",
      "מדינה",
    ]);

    const qEnCol = this.findCol(headers, [
      "question",
      "question en",
      "question (en)",
      "question_en",
      "question english",
      "original_question_en",
      "processed_question_en",
    ]);

    const aEnCol = this.findCol(headers, [
      "answer",
      "answer en",
      "answer (en)",
      "answer_en",
      "answer english",
      "original_answer_en",
      "processed_answer_en",
    ]);

    const qHeCol = this.findCol(headers, [
      "question hebrew",
      "hebrew question",
      "question_he",
      "question_hebrew",
      "שאלה בעברית",
    ]);

    const aHeCol = this.findCol(headers, [
      "answer hebrew",
      "hebrew answer",
      "answer_he",
      "answer_hebrew",
      "תשובה בעברית",
    ]);

    if (idCol == null) {
      throw new Error(`Cannot find "id" column by header. Headers seen: ${headers.join(" | ")}`);
    }

    return {
      headers,
      idCol,
      translatableIdCol,
      hotelCol,
      countryCol,
      qEnCol,
      aEnCol,
      qHeCol,
      aHeCol,
    };
  }

  private countByType(issues: Issue[]) {
    const m = new Map<string, number>();
    for (const it of issues) {
      const k = `${it.severity}::${it.type}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }

    const out: Array<{ severity: "ERROR" | "WARN"; type: IssueType; count: number }> = [];
    for (const [k, count] of m.entries()) {
      const [severity, type] = k.split("::") as ["ERROR" | "WARN", IssueType];
      out.push({ severity, type, count });
    }

    out.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "ERROR" ? -1 : 1;
      return b.count - a.count;
    });

    return out;
  }

  private shouldFlagUnmatchedStatus(status: string): boolean {
    const s = this.normHeader(status);
    return s.includes("low_score") || s.includes("skip_missing_hebrew") || s.includes("no_match");
  }

  // Noise reduction: ignore minor typography/HTML differences unless meaning changes
  private stripHtml(s: string): string {
    return String(s ?? "").replace(/<[^>]*>/g, " ");
  }

  private decodeCommonEntities(s: string): string {
    return String(s ?? "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&rsquo;|&lsquo;/gi, "'")
      .replace(/&ldquo;|&rdquo;/gi, "\"")
      .replace(/&mdash;|&ndash;/gi, "-");
  }

  private normalizeForCompare(s: string): string {
    const t = this.decodeCommonEntities(this.stripHtml(s))
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, "\"")
      .replace(/[‐-‒–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return t;
  }

  private extractNumbers(s: string): string[] {
    const t = this.normalizeForCompare(s);
    const m = t.match(/\d+(?:[\.,]\d+)?/g);
    return m ?? [];
  }

  private tokenSet(s: string): Set<string> {
    const t = this.normalizeForCompare(s)
      .replace(/[^a-z0-9\u0590-\u05FF\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const parts = t.split(" ").filter(Boolean);
    return new Set(parts);
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const union = a.size + b.size - inter;
    return union === 0 ? 1 : inter / union;
  }

  private isMeaningfulTextMismatch(a: string, b: string): boolean {
    const na = this.normalizeForCompare(a);
    const nb = this.normalizeForCompare(b);

    if (!na || !nb) return false;
    if (na === nb) return false;

    const numsA = this.extractNumbers(a);
    const numsB = this.extractNumbers(b);
    if (numsA.join("|") !== numsB.join("|")) return true;

    const sim = this.jaccard(this.tokenSet(a), this.tokenSet(b));

    if (sim >= 0.985) return false;

    const lenDelta = Math.abs(na.length - nb.length);
    if (sim >= 0.96 && lenDelta <= 25) return false;

    return true;
  }

  // AI JSON parsing
  private parseJsonFromModel(text: string): any | null {
    const t = String(text ?? "").trim();

    const fenced = t.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {}
    }

    const firstArr = t.indexOf("[");
    const lastArr = t.lastIndexOf("]");
    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
      const slice = t.slice(firstArr, lastArr + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }

    const firstObj = t.indexOf("{");
    const lastObj = t.lastIndexOf("}");
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      const slice = t.slice(firstObj, lastObj + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }

    return null;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private buildContentDuplicateIssues(
    pMap: Map<string, RowRef>,
    pCols: ReturnType<HebrewInjectionQaJob["detectColumns"]>
  ): Issue[] {
    const issues: Issue[] = [];

    const byHeQ = new Map<string, string[]>();
    const byHeA = new Map<string, string[]>();
    const byEnQ = new Map<string, string[]>();

    const add = (m: Map<string, string[]>, key: string, id: string) => {
      const k = this.normCell(key);
      if (!k) return;
      const arr = m.get(k) ?? [];
      arr.push(id);
      m.set(k, arr);
    };

    for (const [id, ref] of pMap.entries()) {
      const r = ref.row;
      add(byHeQ, this.getCell(r, pCols.qHeCol), id);
      add(byHeA, this.getCell(r, pCols.aHeCol), id);
      add(byEnQ, this.getCell(r, pCols.qEnCol), id);
    }

    const pushGroup = (type: IssueType, groups: Map<string, string[]>) => {
      for (const [, ids] of groups.entries()) {
        if (ids.length < 2) continue;

        // Reduce noise for Hebrew duplicates: only flag if English context differs
        let useful = true;
        if (type === "DUPLICATE_HEBREW_QUESTION" || type === "DUPLICATE_HEBREW_ANSWER") {
          const enContext = new Set<string>();
          for (const id of ids) {
            const rr = pMap.get(id)?.row ?? [];
            enContext.add(this.getCell(rr, pCols.qEnCol) + "||" + this.getCell(rr, pCols.aEnCol));
          }
          useful = enContext.size > 1;
        }

        if (!useful) continue;

        for (const id of ids) {
          const ref = pMap.get(id);
          if (!ref) continue;
          const row = ref.row;

          issues.push({
            severity: "WARN",
            type,
            id,
            processedRow: ref.rowNumber,
            processedHotel: this.getCell(row, pCols.hotelCol),
            processedCountry: this.getCell(row, pCols.countryCol),
            processedTranslatableId: this.getCell(row, pCols.translatableIdCol),
            processedQuestionEn: this.getCell(row, pCols.qEnCol),
            processedAnswerEn: this.getCell(row, pCols.aEnCol),
            processedQuestionHe: this.getCell(row, pCols.qHeCol),
            processedAnswerHe: this.getCell(row, pCols.aHeCol),
            note: `Duplicate group size: ${ids.length}. Group IDs: ${ids.slice(0, 20).join(", ")}${
              ids.length > 20 ? "..." : ""
            }`,
          });
        }
      }
    };

    pushGroup("DUPLICATE_HEBREW_QUESTION", byHeQ);
    pushGroup("DUPLICATE_HEBREW_ANSWER", byHeA);
    pushGroup("DUPLICATE_ENGLISH_QUESTION", byEnQ);

    return issues;
  }

  private async prepareReportTab(spreadsheetId: string, tabName: string, templateTabName: string) {
    const anySheets = this.sheets as any;
    if (typeof anySheets.recreateTabFromTemplate === "function") {
      await anySheets.recreateTabFromTemplate(spreadsheetId, tabName, templateTabName);
    } else {
      await this.sheets.ensureTab(spreadsheetId, tabName);
    }

    await this.sheets.clearTabValues(spreadsheetId, tabName);
  }

  async run(cfg: HebrewInjectionQaConfig): Promise<void> {
    const processedIsSubsetOfOriginal = cfg.processedIsSubsetOfOriginal ?? true;
    const compareEnglishText = cfg.compareEnglishText ?? true;
    const checkMissingHebrew = cfg.checkMissingHebrew ?? true;
    const checkInternalConsistency = cfg.checkInternalConsistency ?? true;
    const checkContentDuplicates = cfg.checkContentDuplicates ?? true;

    const aiSemanticCheck = cfg.aiSemanticCheck ?? false;
    const aiModel = cfg.aiModel ?? "o3";
    const aiBatchSize = cfg.aiBatchSize ?? 20;
    const aiMaxRows = cfg.aiMaxRows ?? 3000;
    const aiMaxCalls = cfg.aiMaxCalls ?? 60;

    const detTabName = cfg.outputTabName ?? "QA - Hebrew Injection";
    const aiTabName = cfg.aiOutputTabName ?? `${detTabName} - AI`;
    const templateTabName = cfg.templateTabName ?? "QA - TEMPLATE";

    const unmatchedTabName = cfg.unmatchedTabName ?? "Unmatched (Hebrew Injection)";

    const maxIssuesInReport = cfg.maxIssuesInReport ?? 500;
    const maxDuplicateRowsInReport = cfg.maxDuplicateRowsInReport ?? 400;
    const maxAiRowsInReport = cfg.maxAiRowsInReport ?? 2000;

    if (aiSemanticCheck && !this.agent) {
      throw new Error("aiSemanticCheck is enabled but AIAgent was not provided to HebrewInjectionQaJob constructor.");
    }

    console.log(chalk.blue("Starting Hebrew Injection QA..."));

    const processedTab = await this.resolveTabOrFirst(cfg.processedSpreadsheetId, cfg.processedTabName);
    const originalTab = await this.resolveTabOrFirst(cfg.originalSpreadsheetId, cfg.originalTabName);

    const processedRows = await this.sheets.readValues(cfg.processedSpreadsheetId, `${processedTab}!A:AZ`);
    const originalRows = await this.sheets.readValues(cfg.originalSpreadsheetId, `${originalTab}!A:AZ`);

    if (processedRows.length < 2) throw new Error("Processed sheet has no data rows.");
    if (originalRows.length < 2) throw new Error("Original sheet has no data rows.");

    const pCols = this.detectColumns(processedRows);
    const oCols = this.detectColumns(originalRows);

    const issues: Issue[] = [];
    const missingHebrew: MissingHebrewRow[] = [];
    const unmatchedFlags: UnmatchedFlagRow[] = [];
    const aiReview: AiReviewRow[] = [];

    const pIdCounts = new Map<string, number>();
    const oIdCounts = new Map<string, number>();

    const pMap = new Map<string, RowRef>();
    const oMap = new Map<string, RowRef>();

    for (let i = 1; i < processedRows.length; i++) {
      const row = processedRows[i] ?? [];
      const id = this.getCell(row, pCols.idCol);
      if (!id) continue;
      pIdCounts.set(id, (pIdCounts.get(id) ?? 0) + 1);
      if (!pMap.has(id)) pMap.set(id, { rowNumber: i + 1, row });
    }

    for (let i = 1; i < originalRows.length; i++) {
      const row = originalRows[i] ?? [];
      const id = this.getCell(row, oCols.idCol);
      if (!id) continue;
      oIdCounts.set(id, (oIdCounts.get(id) ?? 0) + 1);
      if (!oMap.has(id)) oMap.set(id, { rowNumber: i + 1, row });
    }

    // Duplicate IDs
    for (const [id, c] of pIdCounts.entries()) {
      if (c > 1) {
        const pref = pMap.get(id);
        const prow = pref?.row ?? [];
        issues.push({
          severity: "ERROR",
          type: "DUPLICATE_ID_PROCESSED",
          id,
          processedRow: pref?.rowNumber,
          processedHotel: this.getCell(prow, pCols.hotelCol),
          processedCountry: this.getCell(prow, pCols.countryCol),
          processedTranslatableId: this.getCell(prow, pCols.translatableIdCol),
          processedQuestionEn: this.getCell(prow, pCols.qEnCol),
          processedAnswerEn: this.getCell(prow, pCols.aEnCol),
          processedQuestionHe: this.getCell(prow, pCols.qHeCol),
          processedAnswerHe: this.getCell(prow, pCols.aHeCol),
          note: `Duplicate id in processed sheet: ${c} occurrences`,
        });
      }
    }

    for (const [id, c] of oIdCounts.entries()) {
      if (c > 1) {
        const oref = oMap.get(id);
        const orow = oref?.row ?? [];
        issues.push({
          severity: "ERROR",
          type: "DUPLICATE_ID_ORIGINAL",
          id,
          originalRow: oref?.rowNumber,
          originalHotel: this.getCell(orow, oCols.hotelCol),
          originalCountry: this.getCell(orow, oCols.countryCol),
          originalTranslatableId: this.getCell(orow, oCols.translatableIdCol),
          originalQuestionEn: this.getCell(orow, oCols.qEnCol),
          originalAnswerEn: this.getCell(orow, oCols.aEnCol),
          note: `Duplicate id in original sheet: ${c} occurrences`,
        });
      }
    }

    // ID existence checks (Processed must exist in Original)
    for (const [id, pref] of pMap.entries()) {
      if (!oMap.has(id)) {
        const pRow = pref.row;
        issues.push({
          severity: "ERROR",
          type: "MISSING_IN_ORIGINAL",
          id,
          processedRow: pref.rowNumber,
          processedHotel: this.getCell(pRow, pCols.hotelCol),
          processedCountry: this.getCell(pRow, pCols.countryCol),
          processedTranslatableId: this.getCell(pRow, pCols.translatableIdCol),
          processedQuestionEn: this.getCell(pRow, pCols.qEnCol),
          processedAnswerEn: this.getCell(pRow, pCols.aEnCol),
          processedQuestionHe: this.getCell(pRow, pCols.qHeCol),
          processedAnswerHe: this.getCell(pRow, pCols.aHeCol),
          note: "ID exists in processed but missing from original",
        });
      }
    }

    if (!processedIsSubsetOfOriginal) {
      for (const [id, oref] of oMap.entries()) {
        if (!pMap.has(id)) {
          const oRow = oref.row;
          issues.push({
            severity: "ERROR",
            type: "MISSING_IN_PROCESSED",
            id,
            originalRow: oref.rowNumber,
            originalHotel: this.getCell(oRow, oCols.hotelCol),
            originalCountry: this.getCell(oRow, oCols.countryCol),
            originalTranslatableId: this.getCell(oRow, oCols.translatableIdCol),
            originalQuestionEn: this.getCell(oRow, oCols.qEnCol),
            originalAnswerEn: this.getCell(oRow, oCols.aEnCol),
            note: "ID exists in original but missing from processed",
          });
        }
      }
    }

    // Compare shared IDs: processed -> original
    for (const [id, pref] of pMap.entries()) {
      const oref = oMap.get(id);
      if (!oref) continue;

      const pRow = pref.row;
      const oRow = oref.row;

      const pHotel = this.getCell(pRow, pCols.hotelCol);
      const oHotel = this.getCell(oRow, oCols.hotelCol);

      const pCountry = this.getCell(pRow, pCols.countryCol);
      const oCountry = this.getCell(oRow, oCols.countryCol);

      const pTid = this.getCell(pRow, pCols.translatableIdCol);
      const oTid = this.getCell(oRow, oCols.translatableIdCol);

      const pQen = this.getCell(pRow, pCols.qEnCol);
      const oQen = this.getCell(oRow, oCols.qEnCol);

      const pAen = this.getCell(pRow, pCols.aEnCol);
      const oAen = this.getCell(oRow, oCols.aEnCol);

      const pQhe = this.getCell(pRow, pCols.qHeCol);
      const pAhe = this.getCell(pRow, pCols.aHeCol);

      if (pHotel && oHotel && this.normHeader(pHotel) !== this.normHeader(oHotel)) {
        issues.push({
          severity: "ERROR",
          type: "HOTEL_MISMATCH",
          id,
          processedRow: pref.rowNumber,
          originalRow: oref.rowNumber,
          processedHotel: pHotel,
          originalHotel: oHotel,
          processedCountry: pCountry,
          originalCountry: oCountry,
          processedTranslatableId: pTid,
          originalTranslatableId: oTid,
          processedQuestionEn: pQen,
          originalQuestionEn: oQen,
          processedAnswerEn: pAen,
          originalAnswerEn: oAen,
          note: "Hotel differs for same id",
        });
      }

      if (pCountry && oCountry && this.normHeader(pCountry) !== this.normHeader(oCountry)) {
        issues.push({
          severity: "ERROR",
          type: "COUNTRY_MISMATCH",
          id,
          processedRow: pref.rowNumber,
          originalRow: oref.rowNumber,
          processedHotel: pHotel,
          originalHotel: oHotel,
          processedCountry: pCountry,
          originalCountry: oCountry,
          processedTranslatableId: pTid,
          originalTranslatableId: oTid,
          processedQuestionEn: pQen,
          originalQuestionEn: oQen,
          processedAnswerEn: pAen,
          originalAnswerEn: oAen,
          note: "Country differs for same id",
        });
      }

      if (pTid && oTid && pTid !== oTid) {
        issues.push({
          severity: "ERROR",
          type: "TRANSLATABLE_ID_MISMATCH",
          id,
          processedRow: pref.rowNumber,
          originalRow: oref.rowNumber,
          processedHotel: pHotel,
          originalHotel: oHotel,
          processedCountry: pCountry,
          originalCountry: oCountry,
          processedTranslatableId: pTid,
          originalTranslatableId: oTid,
          processedQuestionEn: pQen,
          originalQuestionEn: oQen,
          processedAnswerEn: pAen,
          originalAnswerEn: oAen,
          field: "translatable_id",
          note: "translatable_id differs for same id",
        });
      }

      if (compareEnglishText) {
        if (pQen && oQen && this.isMeaningfulTextMismatch(pQen, oQen)) {
          issues.push({
            severity: "ERROR",
            type: "QUESTION_EN_MISMATCH",
            id,
            processedRow: pref.rowNumber,
            originalRow: oref.rowNumber,
            processedHotel: pHotel,
            originalHotel: oHotel,
            processedCountry: pCountry,
            originalCountry: oCountry,
            processedTranslatableId: pTid,
            originalTranslatableId: oTid,
            processedQuestionEn: pQen,
            originalQuestionEn: oQen,
            processedAnswerEn: pAen,
            originalAnswerEn: oAen,
            field: "question_en",
            note: "English question differs (meaningful) for same id",
          });
        }

        if (pAen && oAen && this.isMeaningfulTextMismatch(pAen, oAen)) {
          issues.push({
            severity: "ERROR",
            type: "ANSWER_EN_MISMATCH",
            id,
            processedRow: pref.rowNumber,
            originalRow: oref.rowNumber,
            processedHotel: pHotel,
            originalHotel: oHotel,
            processedCountry: pCountry,
            originalCountry: oCountry,
            processedTranslatableId: pTid,
            originalTranslatableId: oTid,
            processedQuestionEn: pQen,
            originalQuestionEn: oQen,
            processedAnswerEn: pAen,
            originalAnswerEn: oAen,
            field: "answer_en",
            note: "English answer differs (meaningful) for same id",
          });
        }
      }

      if (checkMissingHebrew) {
        const missingQ = pCols.qHeCol != null && !pQhe;
        const missingA = pCols.aHeCol != null && !pAhe;

        if (missingQ || missingA) {
          if (missingQ) {
            issues.push({
              severity: "WARN",
              type: "MISSING_HEBREW_QUESTION",
              id,
              processedRow: pref.rowNumber,
              originalRow: oref.rowNumber,
              processedHotel: pHotel,
              processedCountry: pCountry,
              processedTranslatableId: pTid,
              processedQuestionEn: pQen,
              processedAnswerEn: pAen,
              processedQuestionHe: pQhe,
              processedAnswerHe: pAhe,
              note: "Missing Hebrew question in processed sheet",
            });
          }

          if (missingA) {
            issues.push({
              severity: "WARN",
              type: "MISSING_HEBREW_ANSWER",
              id,
              processedRow: pref.rowNumber,
              originalRow: oref.rowNumber,
              processedHotel: pHotel,
              processedCountry: pCountry,
              processedTranslatableId: pTid,
              processedQuestionEn: pQen,
              processedAnswerEn: pAen,
              processedQuestionHe: pQhe,
              processedAnswerHe: pAhe,
              note: "Missing Hebrew answer in processed sheet",
            });
          }

          missingHebrew.push({
            id,
            processedRow: pref.rowNumber,
            hotel: pHotel,
            country: pCountry,
            translatableId: pTid,
            questionEn: pQen,
            answerEn: pAen,
            questionHe: pQhe,
            answerHe: pAhe,
            missingQuestionHebrew: missingQ,
            missingAnswerHebrew: missingA,
          });
        }
      }

      if (checkInternalConsistency) {
        if (pCols.qEnCol != null && !pQen) {
          issues.push({
            severity: "WARN",
            type: "INTERNAL_MISSING_EN_QUESTION",
            id,
            processedRow: pref.rowNumber,
            processedHotel: pHotel,
            processedCountry: pCountry,
            processedTranslatableId: pTid,
            processedQuestionEn: pQen,
            processedAnswerEn: pAen,
            note: "Processed row missing English question",
          });
        }

        if (pCols.aEnCol != null && !pAen) {
          issues.push({
            severity: "WARN",
            type: "INTERNAL_MISSING_EN_ANSWER",
            id,
            processedRow: pref.rowNumber,
            processedHotel: pHotel,
            processedCountry: pCountry,
            processedTranslatableId: pTid,
            processedQuestionEn: pQen,
            processedAnswerEn: pAen,
            note: "Processed row missing English answer",
          });
        }
      }
    }

    const duplicateIssues = checkContentDuplicates ? this.buildContentDuplicateIssues(pMap, pCols) : [];

    // Optional: Unmatched tab flags
    try {
      const titles = await this.sheets.listSheetTitles(cfg.processedSpreadsheetId);
      const exists = titles.some(t => this.normHeader(t) === this.normHeader(unmatchedTabName));
      if (exists) {
        const uRows = await this.sheets.readValues(cfg.processedSpreadsheetId, `${unmatchedTabName}!A:AZ`);
        if (uRows.length > 1) {
          const uHeaders = (uRows[0] ?? []).map(h => String(h ?? ""));
          const uIdCol = this.findCol(uHeaders, ["id", "question_id", "qid"]);
          const uStatusCol = this.findCol(uHeaders, ["status", "match_status", "result", "injection_status"]);

          if (uIdCol != null) {
            for (let i = 1; i < uRows.length; i++) {
              const r = uRows[i] ?? [];
              const id = this.normCell(String(r[uIdCol] ?? ""));
              if (!id) continue;

              const pref = pMap.get(id);
              if (!pref) continue;

              const status = uStatusCol != null ? this.normCell(String(r[uStatusCol] ?? "")) : "";
              if (!status) continue;

              if (this.shouldFlagUnmatchedStatus(status)) {
                const pRow = pref.row;
                const hotel = this.getCell(pRow, pCols.hotelCol);
                const country = this.getCell(pRow, pCols.countryCol);
                const qEn = this.getCell(pRow, pCols.qEnCol);
                const aEn = this.getCell(pRow, pCols.aEnCol);

                unmatchedFlags.push({
                  id,
                  processedRow: pref.rowNumber,
                  hotel,
                  country,
                  questionEn: qEn,
                  answerEn: aEn,
                  status,
                });

                issues.push({
                  severity: "WARN",
                  type: "UNMATCHED_FLAG",
                  id,
                  processedRow: pref.rowNumber,
                  processedHotel: hotel,
                  processedCountry: country,
                  processedQuestionEn: qEn,
                  processedAnswerEn: aEn,
                  field: "unmatched_status",
                  note: "Flag in Unmatched tab (review recommended)",
                });
              }
            }
          }
        }
      }
    } catch {
      // optional
    }

    // AI semantic review (separate tab) - no country, no q_score/a_score by default
    if (aiSemanticCheck && this.agent) {
      const candidates: Array<{
        id: string;
        processedRow: number;
        hotel: string;
        translatableId: string;
        questionEn: string;
        answerEn: string;
        questionHe: string;
        answerHe: string;
      }> = [];

      for (const [id, pref] of pMap.entries()) {
        const row = pref.row;

        const qEn = this.getCell(row, pCols.qEnCol);
        const aEn = this.getCell(row, pCols.aEnCol);
        const qHe = this.getCell(row, pCols.qHeCol);
        const aHe = this.getCell(row, pCols.aHeCol);

        if (!qEn || !aEn || !qHe || !aHe) continue;

        candidates.push({
          id,
          processedRow: pref.rowNumber,
          hotel: this.getCell(row, pCols.hotelCol),
          translatableId: this.getCell(row, pCols.translatableIdCol),
          questionEn: qEn,
          answerEn: aEn,
          questionHe: qHe,
          answerHe: aHe,
        });
      }

      const maxRowsByCalls = Math.max(0, aiMaxCalls) * Math.max(1, aiBatchSize);
      const effectiveMaxRows = Math.min(aiMaxRows, maxRowsByCalls);

      const limited = candidates.slice(0, effectiveMaxRows);
      const batches = this.chunk(limited, Math.max(1, aiBatchSize));

      const system = [
        "You are a QA validator for Hebrew translations of hotel FAQs.",
        "You will be given rows with English and Hebrew question and answer.",
        "Check semantic equivalence and that numbers, dates, times, amounts, and policies are preserved.",
        "Return ONLY valid JSON: an array where each item matches the input id.",
        "Fields per item:",
        "- id (string)",
        "- q_verdict ('OK'|'MINOR'|'BAD')",
        "- a_verdict ('OK'|'MINOR'|'BAD')",
        "- flags (array of strings, examples: ['numbers_mismatch','missing_key_info','wrong_meaning','too_generic','language_wrong'])",
        "- reason (short, max 140 chars)",
      ].join("\n");

      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];

        const payload = batch.map(x => ({
          id: x.id,
          hotel: x.hotel,
          question_en: x.questionEn,
          answer_en: x.answerEn,
          question_he: x.questionHe,
          answer_he: x.answerHe,
        }));

        const user = `Validate translation alignment for these rows:\n${JSON.stringify(payload)}`;
        const raw = await this.agent.runWithSystem(user, system, aiModel);
        const parsed = this.parseJsonFromModel(raw);

        if (!Array.isArray(parsed)) {
          issues.push({
            severity: "WARN",
            type: "AI_PARSE_FAILED",
            id: `BATCH_${bi + 1}`,
            note: `AI batch ${bi + 1}/${batches.length} returned non-JSON. Skipped.`,
          });
          continue;
        }

        const byId = new Map<string, any>();
        for (const it of parsed) {
          if (it && typeof it.id === "string") byId.set(it.id, it);
        }

        for (const row of batch) {
          const r = byId.get(row.id);
          if (!r) continue;

          const qVerdict = String(r.q_verdict ?? "");
          const aVerdict = String(r.a_verdict ?? "");
          const flagsArr = Array.isArray(r.flags) ? r.flags.map((x: any) => String(x)) : [];
          const reason = String(r.reason ?? "");

          const needsReview =
            qVerdict === "BAD" ||
            aVerdict === "BAD" ||
            qVerdict === "MINOR" ||
            aVerdict === "MINOR" ||
            flagsArr.length > 0;

          if (!needsReview) continue;

          aiReview.push({
            id: row.id,
            processedRow: row.processedRow,
            hotel: row.hotel,
            translatableId: row.translatableId,
            questionEn: row.questionEn,
            answerEn: row.answerEn,
            questionHe: row.questionHe,
            answerHe: row.answerHe,
            qVerdict: qVerdict || "N/A",
            aVerdict: aVerdict || "N/A",
            flags: flagsArr.join(", "),
            reason,
          });
        }
      }
    }

    // Sort for usability
    missingHebrew.sort(
      (a, b) => a.hotel.localeCompare(b.hotel) || a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    unmatchedFlags.sort(
      (a, b) => a.hotel.localeCompare(b.hotel) || a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    duplicateIssues.sort(
      (a, b) =>
        (a.processedHotel ?? "").localeCompare(b.processedHotel ?? "") ||
        a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    aiReview.sort((a, b) => a.hotel.localeCompare(b.hotel) || a.id.localeCompare(b.id, undefined, { numeric: true }));

    const now = new Date().toISOString();

    const totals = {
      processedCount: pMap.size,
      originalCount: oMap.size,
      errors: issues.filter(x => x.severity === "ERROR").length,
      warns: issues.filter(x => x.severity === "WARN").length,
      missingHebrewCount: missingHebrew.length,
      unmatchedFlagCount: unmatchedFlags.length,
      duplicateIssueCount: duplicateIssues.length,
      aiReviewCount: aiReview.length,
    };

    const allDetIssues = [...issues, ...duplicateIssues];
    const counts = this.countByType(allDetIssues);

    const detIssuesSorted = [...issues].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "ERROR" ? -1 : 1;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    const trimmedIssues = detIssuesSorted.slice(0, Math.max(0, maxIssuesInReport));
    const trimmedDupes = duplicateIssues.slice(0, Math.max(0, maxDuplicateRowsInReport));
    const trimmedAi = aiReview.slice(0, Math.max(0, maxAiRowsInReport));

    // Deterministic report tab
    const detValues: string[][] = [];

    detValues.push(["QA - Hebrew Injection (Deterministic)"]);
    detValues.push(["Run at", now]);
    detValues.push(["Processed tab", processedTab]);
    detValues.push(["Original tab", originalTab]);
    detValues.push(["Processed IDs", String(totals.processedCount)]);
    detValues.push(["Original IDs", String(totals.originalCount)]);
    detValues.push(["Processed is subset of original", String(processedIsSubsetOfOriginal)]);
    detValues.push(["Errors", String(totals.errors)]);
    detValues.push(["Warnings", String(totals.warns)]);
    detValues.push(["Missing Hebrew rows", String(totals.missingHebrewCount)]);
    detValues.push(["Unmatched flags rows", String(totals.unmatchedFlagCount)]);
    detValues.push(["Duplicate content rows", String(totals.duplicateIssueCount)]);
    detValues.push(["AI review rows (in AI tab)", String(totals.aiReviewCount)]);
    detValues.push([""]);

    detValues.push(["Counts by type"]);
    detValues.push(["severity", "type", "count"]);
    for (const c of counts) detValues.push([c.severity, c.type, String(c.count)]);
    detValues.push([""]);

    detValues.push(["To Fix - Missing Hebrew (full list)"]);
    detValues.push([
      "processed_row",
      "hotel",
      "country",
      "id",
      "translatable_id",
      "missing_question_hebrew",
      "missing_answer_hebrew",
      "question_en",
      "answer_en",
      "question_hebrew",
      "answer_hebrew",
    ]);
    for (const r of missingHebrew) {
      detValues.push([
        String(r.processedRow),
        r.hotel,
        r.country,
        r.id,
        r.translatableId,
        r.missingQuestionHebrew ? "TRUE" : "FALSE",
        r.missingAnswerHebrew ? "TRUE" : "FALSE",
        r.questionEn,
        r.answerEn,
        r.questionHe,
        r.answerHe,
      ]);
    }
    detValues.push([""]);

    detValues.push(["To Review - Unmatched Flags (full list)"]);
    detValues.push(["processed_row", "hotel", "country", "id", "question_en", "answer_en", "status"]);
    for (const r of unmatchedFlags) {
      detValues.push([String(r.processedRow), r.hotel, r.country, r.id, r.questionEn, r.answerEn, r.status]);
    }
    detValues.push([""]);

    detValues.push([`To Review - Duplicates (showing up to ${maxDuplicateRowsInReport})`]);
    detValues.push([
      "type",
      "processed_row",
      "hotel",
      "country",
      "id",
      "translatable_id",
      "question_en",
      "answer_en",
      "question_hebrew",
      "answer_hebrew",
      "note",
    ]);
    for (const it of trimmedDupes) {
      detValues.push([
        it.type,
        it.processedRow ? String(it.processedRow) : "",
        it.processedHotel ?? "",
        it.processedCountry ?? "",
        it.id,
        it.processedTranslatableId ?? "",
        it.processedQuestionEn ?? "",
        it.processedAnswerEn ?? "",
        it.processedQuestionHe ?? "",
        it.processedAnswerHe ?? "",
        it.note ?? "",
      ]);
    }
    detValues.push([""]);

    detValues.push([`Issues (showing up to ${maxIssuesInReport} rows)`]);
    detValues.push([
      "severity",
      "type",
      "id",
      "processed_row",
      "original_row",
      "processed_hotel",
      "processed_country",
      "original_hotel",
      "original_country",
      "processed_translatable_id",
      "original_translatable_id",
      "processed_question_en",
      "original_question_en",
      "processed_answer_en",
      "original_answer_en",
      "processed_question_he",
      "processed_answer_he",
      "field",
      "note",
    ]);
    for (const it of trimmedIssues) {
      detValues.push([
        it.severity,
        it.type,
        it.id,
        it.processedRow ? String(it.processedRow) : "",
        it.originalRow ? String(it.originalRow) : "",
        it.processedHotel ?? "",
        it.processedCountry ?? "",
        it.originalHotel ?? "",
        it.originalCountry ?? "",
        it.processedTranslatableId ?? "",
        it.originalTranslatableId ?? "",
        it.processedQuestionEn ?? "",
        it.originalQuestionEn ?? "",
        it.processedAnswerEn ?? "",
        it.originalAnswerEn ?? "",
        it.processedQuestionHe ?? "",
        it.processedAnswerHe ?? "",
        it.field ?? "",
        it.note ?? "",
      ]);
    }

    // AI report tab (minimal columns, no country, no scores)
    const aiValues: string[][] = [];
    aiValues.push(["QA - Hebrew Injection (AI Semantic Review)"]);
    aiValues.push(["Run at", now]);
    aiValues.push(["Processed tab", processedTab]);
    aiValues.push(["AI model", aiModel]);
    aiValues.push(["AI batch size", String(aiBatchSize)]);
    aiValues.push(["AI max calls", String(aiMaxCalls)]);
    aiValues.push(["AI max rows", String(aiMaxRows)]);
    aiValues.push(["AI rows flagged", String(trimmedAi.length)]);
    aiValues.push([""]);

    aiValues.push(["To Review - AI Semantic (showing up to cap)"]);
    aiValues.push([
      "processed_row",
      "hotel",
      "id",
      "translatable_id",
      "q_verdict",
      "a_verdict",
      "flags",
      "reason",
      "question_en",
      "question_hebrew",
      "answer_en",
      "answer_hebrew",
    ]);

    for (const r of trimmedAi) {
      aiValues.push([
        String(r.processedRow),
        r.hotel,
        r.id,
        r.translatableId,
        r.qVerdict,
        r.aVerdict,
        r.flags,
        r.reason,
        r.questionEn,
        r.questionHe,
        r.answerEn,
        r.answerHe,
      ]);
    }

    // Write tabs (with template formatting)
    await this.prepareReportTab(cfg.processedSpreadsheetId, detTabName, templateTabName);
    await this.sheets.writeValues(cfg.processedSpreadsheetId, `${detTabName}!A1`, detValues);

    await this.prepareReportTab(cfg.processedSpreadsheetId, aiTabName, templateTabName);
    await this.sheets.writeValues(cfg.processedSpreadsheetId, `${aiTabName}!A1`, aiValues);

    console.log(chalk.green(`QA completed. Deterministic -> "${detTabName}", AI -> "${aiTabName}".`));
    console.log(
      chalk.gray(
        `Errors: ${totals.errors} | Warnings: ${totals.warns} | Duplicates: ${totals.duplicateIssueCount} | AI flagged: ${totals.aiReviewCount}`
      )
    );
  }
}