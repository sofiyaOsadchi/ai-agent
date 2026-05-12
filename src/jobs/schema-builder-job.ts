// src/jobs/schema-builder-job.ts
// Code in English. Comments can be Hebrew.

import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";
import { printPreviewEvent } from "./subjobs/preview-events.js";

type SourceType = "sheet" | "folder";
type SchemaType = "FAQPage";

type SchemaBuilderPayload = {
  sourceType?: SourceType;
  targetId?: string;
  tabName?: string;
  recursive?: boolean;
  maxFiles?: number;
  schemaType?: SchemaType;
  questionColumn?: string;
  answerColumn?: string;
  startRow?: number;
  maxRows?: number;
  outputCell?: string;
  includeScriptTag?: boolean;
  previewOnly?: boolean;
  dryRun?: boolean;
};

type TargetSheet = {
  id: string;
  name: string;
};

type QAItem = {
  question: string;
  answer: string;
  rowNumber: number;
};

type SchemaBuilderResultItem = {
  spreadsheetId: string;
  fileName: string;
  tabName: string;
  outputCell: string;
  qaCount: number;
  schemaType: SchemaType;
  wroteToSheet: boolean;
  schemaText: string;
  previewQuestions: string[];
  status: "generated" | "skipped" | "error";
  message?: string;
};

export type SchemaBuilderResult = {
  schemaType: SchemaType;
  totalTargets: number;
  generated: number;
  skipped: number;
  errors: number;
  totalQuestions: number;
  results: SchemaBuilderResultItem[];
};

export class SchemaBuilderJob {
  constructor(private sheets: SheetsService) {}

  async run(payload: SchemaBuilderPayload): Promise<SchemaBuilderResult> {
    const normalized = this.normalizePayload(payload);
    const targets = await this.resolveTargets(normalized);
    const result: SchemaBuilderResult = {
      schemaType: normalized.schemaType,
      totalTargets: targets.length,
      generated: 0,
      skipped: 0,
      errors: 0,
      totalQuestions: 0,
      results: [],
    };

    console.log(chalk.cyan(`SCHEMA_BUILDER_TARGETS=${targets.length}`));

    for (const target of targets) {
      try {
        const item = await this.processTarget(target, normalized);
        result.results.push(item);

        if (item.status === "generated") {
          result.generated += 1;
          result.totalQuestions += item.qaCount;
        } else if (item.status === "skipped") {
          result.skipped += 1;
        } else {
          result.errors += 1;
        }
      } catch (error) {
        result.errors += 1;
        const message = error instanceof Error ? error.message : String(error);

        console.log(chalk.red(`❌ ${target.name}: ${message}`));
        result.results.push({
          spreadsheetId: target.id,
          fileName: target.name,
          tabName: normalized.tabName || "",
          outputCell: normalized.outputCell,
          qaCount: 0,
          schemaType: normalized.schemaType,
          wroteToSheet: false,
          schemaText: "",
          previewQuestions: [],
          status: "error",
          message,
        });
      }
    }

    console.log("SCHEMA_BUILDER_RESULT_JSON_START");
    console.log(JSON.stringify(result, null, 2));
    console.log("SCHEMA_BUILDER_RESULT_JSON_END");
    console.log(
      chalk.green(
        `✅ schema-builder completed | Generated: ${result.generated} | Skipped: ${result.skipped} | Errors: ${result.errors} | Questions: ${result.totalQuestions}`
      )
    );

    return result;
  }

  private normalizePayload(payload: SchemaBuilderPayload): Required<SchemaBuilderPayload> {
    const sourceType = payload.sourceType || "sheet";
    const targetId = String(payload.targetId || "").trim();

    if (!targetId) {
      throw new Error("Missing Google Sheet / Drive Folder URL or ID");
    }

    return {
      sourceType,
      targetId,
      tabName: String(payload.tabName || "").trim(),
      recursive: payload.recursive !== false,
      maxFiles: Math.max(1, Math.min(Number(payload.maxFiles || 30), 200)),
      schemaType: "FAQPage",
      questionColumn: this.normalizeColumnLetter(payload.questionColumn || "B"),
      answerColumn: this.normalizeColumnLetter(payload.answerColumn || "C"),
      startRow: Math.max(1, Number(payload.startRow || 2)),
      maxRows: Math.max(1, Math.min(Number(payload.maxRows || 500), 5000)),
      outputCell: this.normalizeOutputCell(payload.outputCell || "E73"),
      includeScriptTag: payload.includeScriptTag !== false,
      previewOnly: payload.previewOnly === true,
      dryRun: payload.dryRun === true,
    };
  }

  private async resolveTargets(payload: Required<SchemaBuilderPayload>): Promise<TargetSheet[]> {
    if (payload.sourceType === "sheet") {
      const id = this.extractSpreadsheetId(payload.targetId);
      let name = id;

      try {
        name = await this.sheets.getSpreadsheetTitle(id);
      } catch {
        // Title is helpful but not required for the job.
      }

      return [{ id, name }];
    }

    const folderId = this.extractFolderId(payload.targetId);
    const files = payload.recursive
      ? await this.sheets.listSpreadsheetsInFolderWithNamesRecursive(folderId)
      : await this.sheets.listSpreadsheetsInFolderWithNames(folderId);

    return files.slice(0, payload.maxFiles);
  }

  private async processTarget(
    target: TargetSheet,
    payload: Required<SchemaBuilderPayload>
  ): Promise<SchemaBuilderResultItem> {
    const tabName = await this.resolveTabName(target.id, payload.tabName);
    const rangeA1 = `${this.quoteA1Sheet(tabName)}!A1:ZZ${payload.maxRows}`;

    console.log(chalk.cyan(`📄 Processing ${target.name} / ${tabName}`));

    const rows = await this.sheets.readValues(target.id, rangeA1);
    const qa = this.collectQA(rows, payload);

    if (qa.length === 0) {
      const message = `No complete question/answer rows found in ${payload.questionColumn}/${payload.answerColumn}`;
      console.log(chalk.yellow(`⚠️ ${target.name}: ${message}`));

      return {
        spreadsheetId: target.id,
        fileName: target.name,
        tabName,
        outputCell: payload.outputCell,
        qaCount: 0,
        schemaType: payload.schemaType,
        wroteToSheet: false,
        schemaText: "",
        previewQuestions: [],
        status: "skipped",
        message,
      };
    }

    const schemaText = this.buildSchemaText(qa, payload);
    const wroteToSheet = !payload.previewOnly && !payload.dryRun;

    printPreviewEvent({
      kind: "plan",
      fileName: target.name,
      spreadsheetId: target.id,
      tabName,
      title: "FAQPage schema",
      details: [
        `${qa.length} Q/A rows will be converted to JSON-LD`,
        wroteToSheet
          ? `Schema will be written to ${tabName}!${payload.outputCell}`
          : "Preview only - sheet will not be changed",
        payload.includeScriptTag ? "Output includes script tag" : "Output is raw JSON-LD",
      ],
    });

    if (wroteToSheet) {
      await this.sheets.writeValues(
        target.id,
        `${this.quoteA1Sheet(tabName)}!${payload.outputCell}`,
        [[schemaText]]
      );
    }

    console.log(
      chalk.green(
        `${wroteToSheet ? "✅ Wrote" : "🧪 Planned"} FAQPage schema for ${target.name}: ${qa.length} questions`
      )
    );

    return {
      spreadsheetId: target.id,
      fileName: target.name,
      tabName,
      outputCell: payload.outputCell,
      qaCount: qa.length,
      schemaType: payload.schemaType,
      wroteToSheet,
      schemaText,
      previewQuestions: qa.slice(0, 5).map((item) => item.question),
      status: "generated",
    };
  }

  private async resolveTabName(spreadsheetId: string, requestedTab: string): Promise<string> {
    if (requestedTab) {
      const titles = await this.sheets.listSheetTitles(spreadsheetId);
      const exact = titles.find((title) => title.trim() === requestedTab.trim());
      if (exact) return exact;

      console.log(
        chalk.yellow(
          `⚠️ Tab "${requestedTab}" not found. Falling back to first tab. Available: ${titles.join(", ")}`
        )
      );
    }

    return this.sheets.getFirstSheetTitle(spreadsheetId);
  }

  private collectQA(rows: string[][], payload: Required<SchemaBuilderPayload>): QAItem[] {
    const questionIndex = this.columnLetterToIndex(payload.questionColumn);
    const answerIndex = this.columnLetterToIndex(payload.answerColumn);
    const out: QAItem[] = [];

    for (let rowIndex = payload.startRow - 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const question = this.cleanText(row[questionIndex]);
      const answer = this.cleanText(row[answerIndex]);

      if (!question || !answer) continue;

      out.push({
        question,
        answer,
        rowNumber: rowIndex + 1,
      });
    }

    return out;
  }

  private buildSchemaText(qa: QAItem[], payload: Required<SchemaBuilderPayload>): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qa.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    const json = JSON.stringify(schema, null, 2);

    if (!payload.includeScriptTag) {
      return json;
    }

    return `<script type="application/ld+json">\n${json}\n</script>`;
  }

  private cleanText(value: unknown): string {
    return String(value ?? "")
      .replace(/\r?\n+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private extractSpreadsheetId(input: string): string {
    const value = String(input || "").trim();
    const match = value.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
    return (match?.[1] ?? value).trim();
  }

  private extractFolderId(input: string): string {
    const value = String(input || "").trim();
    const match = value.match(/\/folders\/([A-Za-z0-9-_]+)/);
    return (match?.[1] ?? value).trim();
  }

  private quoteA1Sheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  private normalizeColumnLetter(value: string): string {
    const clean = String(value || "").trim().toUpperCase();
    if (!/^[A-Z]+$/.test(clean)) {
      throw new Error(`Invalid column letter: ${value}`);
    }

    return clean;
  }

  private columnLetterToIndex(letter: string): number {
    const clean = this.normalizeColumnLetter(letter);
    let index = 0;

    for (const char of clean) {
      index = index * 26 + (char.charCodeAt(0) - 64);
    }

    return index - 1;
  }

  private normalizeOutputCell(value: string): string {
    const clean = String(value || "").trim().toUpperCase();
    if (!/^[A-Z]+[1-9][0-9]*$/.test(clean)) {
      throw new Error(`Invalid output cell: ${value}`);
    }

    return clean;
  }
}
