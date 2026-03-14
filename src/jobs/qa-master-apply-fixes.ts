// src/jobs/qa-master-apply-fixes.ts
import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type QaMasterApplyFixesConfig = {
  spreadsheetId: string;

  // Master tab to patch (e.g. "QA - DE Master")
  masterTabName: string;

  // Triage tab that contains fix columns (e.g. "QA - DE True Issues")
  triageTabName: string;

  // Target language (e.g. "de", "fr")
  targetLang: string;

  // Optional: marker used in triage outputs for empty cells (default: "∅")
  emptyCellMarker?: string;

  // Optional: if true, apply only fix_answer (skip fix_question)
  answersOnly?: boolean;

  // Optional: if true, apply only fix_question (skip fix_answer)
  questionsOnly?: boolean;

  // Optional: limit rows processed from triage (safety)
  maxRowsToProcess?: number;
};

type TriageFixRow = {
  sourceRow: number; // row index in MASTER sheet (1-based)
  fixQuestion: string;
  fixAnswer: string;
};

export class QaMasterApplyFixesJob {
  constructor(private sheets: SheetsService) {}

  private coerceSpreadsheetId(input: string): string {
    const s = String(input ?? "").trim();
    if (!s) return s;
    if (!s.includes("/")) return s;
    const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m?.[1]) return m[1];
    return s;
  }

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

  private isEmptyOrMarker(v: string, marker: string): boolean {
    const x = this.normCell(v);
    if (!x) return true;
    if (x === marker) return true;
    return false;
  }

  private colToA1(colIndex0: number): string {
    // 0 -> A
    let n = colIndex0 + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // -----------------------------------------
  // Parse TRIAGE tab (QA - XX True Issues)
  // -----------------------------------------

  private findTriageHeader(rows: string[][], lang: string): { headerRowIndex: number; idx: any } | null {
    const fixQ = `fix_question_${lang}`;
    const fixA = `fix_answer_${lang}`;

    for (let r = 0; r < rows.length; r++) {
      const n = (rows[r] ?? []).map((c) => this.normHeader(c));
      // Must have source_row and at least one of fix columns
      const sourceRowIdx = n.indexOf("source_row");
      const fixQIdx = n.indexOf(fixQ);
      const fixAIdx = n.indexOf(fixA);

      if (sourceRowIdx >= 0 && (fixQIdx >= 0 || fixAIdx >= 0)) {
        return {
          headerRowIndex: r,
          idx: { sourceRowIdx, fixQIdx, fixAIdx },
        };
      }
    }
    return null;
  }

  private parseTriageFixes(rows: string[][], lang: string, marker: string, maxRows: number): TriageFixRow[] {
    const found = this.findTriageHeader(rows, lang);
    if (!found) {
      throw new Error(
        `Could not find triage header. Expected columns: source_row and fix_question_${lang}/fix_answer_${lang}.`
      );
    }

    const { headerRowIndex, idx } = found;
    const out: TriageFixRow[] = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      if (out.length >= maxRows) break;

      const row = rows[r] ?? [];
      const srRaw = this.normCell(row[idx.sourceRowIdx] ?? "");
      if (!srRaw) continue;

      const sourceRow = parseInt(srRaw, 10);
      if (!Number.isFinite(sourceRow) || sourceRow <= 0) continue;

      const fixQuestion = idx.fixQIdx >= 0 ? this.normCell(row[idx.fixQIdx] ?? "") : "";
      const fixAnswer = idx.fixAIdx >= 0 ? this.normCell(row[idx.fixAIdx] ?? "") : "";

      const hasAny =
        !this.isEmptyOrMarker(fixQuestion, marker) || !this.isEmptyOrMarker(fixAnswer, marker);

      if (!hasAny) continue;

      out.push({ sourceRow, fixQuestion, fixAnswer });
    }

    return out;
  }

  // -----------------------------------------
  // Find MASTER tab columns (question_de / answer_de)
  // -----------------------------------------

  private findMasterHeader(rows: string[][], lang: string): { headerRowIndex: number; qIdx: number; aIdx: number } {
    // In your master screenshot: headers look like "question_de" and "answer_de"
    const qKey = `question_${lang}`;
    const aKey = `answer_${lang}`;

    for (let r = 0; r < rows.length; r++) {
      const n = (rows[r] ?? []).map((c) => this.normHeader(c));
      const qIdx = n.indexOf(qKey);
      const aIdx = n.indexOf(aKey);
      if (qIdx >= 0 && aIdx >= 0) return { headerRowIndex: r, qIdx, aIdx };
    }

    // fallback: sometimes "question de" / "answer de" (with space)
    for (let r = 0; r < rows.length; r++) {
      const n = (rows[r] ?? []).map((c) => this.normHeader(c));
      const qIdx = n.indexOf(`question ${lang}`);
      const aIdx = n.indexOf(`answer ${lang}`);
      if (qIdx >= 0 && aIdx >= 0) return { headerRowIndex: r, qIdx, aIdx };
    }

    throw new Error(`Could not find master header columns question_${lang} and answer_${lang}.`);
  }

  // -----------------------------------------
  // Apply patches
  // -----------------------------------------

  private async batchWriteIfSupported(
    spreadsheetId: string,
    updates: Array<{ rangeA1: string; values: string[][] }>
  ) {
    const anySheets = this.sheets as any;

    // If your SheetsService has a batch method - use it
    if (typeof anySheets.batchWriteValues === "function") {
      await anySheets.batchWriteValues(
        spreadsheetId,
        updates.map((u) => ({ range: u.rangeA1, values: u.values }))
      );
      return;
    }

    // Fallback: sequential writes
    for (const u of updates) {
      await this.sheets.writeValues(spreadsheetId, u.rangeA1, u.values);
    }
  }

  async run(cfg: QaMasterApplyFixesConfig): Promise<void> {
    const spreadsheetId = this.coerceSpreadsheetId(cfg.spreadsheetId);

    const lang = String(cfg.targetLang ?? "").trim().toLowerCase();
    if (!lang) throw new Error("targetLang is required");

    const masterTab = String(cfg.masterTabName ?? "").trim();
    const triageTab = String(cfg.triageTabName ?? "").trim();
    if (!masterTab) throw new Error("masterTabName is required");
    if (!triageTab) throw new Error("triageTabName is required");

    const marker = cfg.emptyCellMarker ?? "∅";
    const maxRows = cfg.maxRowsToProcess ?? 2000;

    const answersOnly = cfg.answersOnly === true;
    const questionsOnly = cfg.questionsOnly === true;

    console.log(chalk.blue(`Starting QA apply fixes (${lang.toUpperCase()})...`));
    console.log(chalk.gray(`Master: "${masterTab}" | Triage: "${triageTab}"`));

    // Read triage fixes
    const triageRows = await this.sheets.readValues(spreadsheetId, `${triageTab}!A:Z`);
    if (triageRows.length < 2) throw new Error("Triage tab has no data.");

    const fixes = this.parseTriageFixes(triageRows, lang, marker, maxRows);
    if (fixes.length === 0) {
      console.log(chalk.yellow("No fix rows found (nothing to apply)."));
      return;
    }

    // Read master header to find columns
    const masterRows = await this.sheets.readValues(spreadsheetId, `${masterTab}!A:Z`);
    if (masterRows.length < 1) throw new Error("Master tab has no data.");

    const { qIdx, aIdx } = this.findMasterHeader(masterRows, lang);
    const qCol = this.colToA1(qIdx);
    const aCol = this.colToA1(aIdx);

    // Build updates (cell-level)
    const updates: Array<{ rangeA1: string; values: string[][] }> = [];

    let appliedQ = 0;
    let appliedA = 0;

    for (const f of fixes) {
      if (!answersOnly) {
        if (!this.isEmptyOrMarker(f.fixQuestion, marker)) {
          updates.push({
            rangeA1: `${masterTab}!${qCol}${f.sourceRow}`,
            values: [[f.fixQuestion]],
          });
          appliedQ++;
        }
      }

      if (!questionsOnly) {
        if (!this.isEmptyOrMarker(f.fixAnswer, marker)) {
          updates.push({
            rangeA1: `${masterTab}!${aCol}${f.sourceRow}`,
            values: [[f.fixAnswer]],
          });
          appliedA++;
        }
      }
    }

    if (updates.length === 0) {
      console.log(chalk.yellow("Fix rows found, but all fix cells are empty/marker. Nothing to apply."));
      return;
    }

    console.log(chalk.cyan(`Fix rows: ${fixes.length} | Updates: ${updates.length} (Q: ${appliedQ}, A: ${appliedA})`));

    await this.batchWriteIfSupported(spreadsheetId, updates);

    console.log(chalk.green(`QA apply fixes completed -> "${masterTab}".`));
  }
}