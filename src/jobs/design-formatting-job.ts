// src/jobs/design-formatting-job.ts
// Code in English. Comments can be Hebrew.

import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SafetyManager } from "../config/safety.js";
import { SheetsService } from "../services/sheets.js";
import { printPreviewEvent } from "./subjobs/preview-events.js";
import { ExtractSheetCommentsJob } from "./extract-sheet-comments.js";

type SourceType = "sheet" | "folder";

type RangeConfig = {
  columnScope?: "column" | "columns" | "sheet";
  columns?: string;
  rowScope?: "range" | "all";
  rows?: string;
};

type WriteBehaviorMode = "overwrite" | "skip_existing" | "first_empty";

type WriteBehaviorConfig = {
  mode?: WriteBehaviorMode;
  maxSearchColumns?: number;
};

type OperationWriteBehavior = {
  writeBehavior?: WriteBehaviorConfig;
};

type DesignFormattingPayload = {
  sourceType: SourceType;
  targetId: string;
  tabName?: string;
  maxFiles?: number;
  dryRun?: boolean;
  createBackup?: boolean;
  previewOnly?: boolean;
  listTabsOnly?: boolean;
  previewRows?: number;
  previewColumns?: number;
  range?: RangeConfig;
  writeBehavior?: WriteBehaviorConfig;
  operations?: DesignFormattingOperation[];
  operation: DesignFormattingOperation;
  assistantInstruction?: string;
  assistantSourceUrl?: string;
  selectedOperation?: string;
};

type DesignFormattingOperation = OperationWriteBehavior & (
  | TextReplaceOperation
  | WrapHtmlOperation
  | NormalizeSpacesOperation
  | NormalizeLineBreaksOperation
  | PlainToHtmlParagraphsOperation
  | CaseTransformOperation
  | FormatTableOperation
  | HeaderStyleOperation
  | WrapTextOperation
  | AlignCellsOperation
  | SetColumnWidthsOperation
  | SetRowHeightsOperation
  | ExtractCommentsOperation
  | ReplaceColumnWhenValueOperation
  | AddColumnOperation
  | RenameColumnOperation
  | ReorderColumnsOperation
  | DuplicateTabTemplateOperation
  | RestoreBackupOperation
  | FaqAiEditOperation
);

type TextReplaceOperation = {
  type: "text_replace";
  find: string;
  replaceWith: string;
  matchMode: "contains" | "exact" | "regex";
  allowEmptyReplace?: boolean;
};

type WrapHtmlOperation = {
  type: "wrap_html";
  tag: string;
  skipExisting?: boolean;
  emptyCells?: "skip" | "wrap";
};

type NormalizeSpacesOperation = {
  type: "normalize_spaces";
};

type NormalizeLineBreaksOperation = {
  type: "normalize_line_breaks";
  replacement: "space" | "br" | "paragraph";
};

type PlainToHtmlParagraphsOperation = {
  type: "plain_to_html_paragraphs";
  splitBy: "line_breaks" | "double_line_breaks";
};

type CaseTransformOperation = {
  type: "case_transform";
  mode: "lower" | "upper" | "title" | "sentence";
};

type FormatTableOperation = {
  type: "format_table";
  preset: "clean" | "compact" | "content";
  freezeHeader?: boolean;
  headerStyle?: boolean;
  borders?: boolean;
  wrapText?: boolean;
  autoResize?: boolean;
};

type HeaderStyleOperation = {
  type: "header_style";
  bold?: boolean;
  freeze?: boolean;
  wrapText?: boolean;
};

type WrapTextOperation = {
  type: "wrap_text";
  mode: "WRAP" | "CLIP" | "OVERFLOW_CELL";
};

type AlignCellsOperation = {
  type: "align_cells";
  horizontal: "LEFT" | "CENTER" | "RIGHT";
  vertical: "TOP" | "MIDDLE" | "BOTTOM";
};

type SetColumnWidthsOperation = {
  type: "set_column_widths";
  widthPx: number;
};

type SetRowHeightsOperation = {
  type: "set_row_heights";
  heightPx: number;
};

type ExtractCommentsOperation = {
  type: "extract_comments";
  sourceColumn: string;
  outputColumn?: string;
  startRow?: number;
  outputHeader?: string;
  includeReplies?: boolean;
};

type ReplaceColumnWhenValueOperation = {
  type: "replace_column_when_value";
  sourceColumn: string;
  targetColumn: string;
  startRow?: number;
  targetHeader?: string;
};

type AddColumnOperation = {
  type: "add_column";
  columnLetter: string;
  header: string;
};

type RenameColumnOperation = {
  type: "rename_column";
  columnLetter: string;
  header: string;
};

type ReorderColumnsOperation = {
  type: "reorder_columns";
  columns: string[];
  outputTabName: string;
};

type DuplicateTabTemplateOperation = {
  type: "duplicate_tab_template";
  templateTabName: string;
  newTabName: string;
};

type RestoreBackupOperation = {
  type: "restore_backup";
  backupTabName?: string;
};

type FaqAiEditOperationType =
  | "faq_ai_edit"
  | "faq_apply_client_comments"
  | "faq_language_review"
  | "faq_question_review"
  | "faq_name_injection"
  | "faq_answer_research"
  | "faq_missing_questions";

type FaqAiEditOperation = {
  type: FaqAiEditOperationType;
  model?: string;
  categoryCol?: string;
  questionCol?: string;
  answerCol?: string;
  commentCol?: string;
  targetCol?: string;
  targetHeader?: string;
  questionFixCol?: string;
  questionFixHeader?: string;
  qaNoteCol?: string;
  qaNoteHeader?: string;
  hotelNameCol?: string;
  hotelNameHeader?: string;
  hotelName?: string;
  checkOriginalGrammar?: boolean;
  commentMode?: "rewrite_if_needed" | "use_comment_as_answer";
  languageDepth?: "light" | "publication";
  languageTone?: "clear_hospitality" | "concise" | "warm";
  detectDuplicates?: boolean;
  nameScope?: "questions" | "answers" | "both";
  nameOutputMode?: "final_answer" | "original_answer";
  missingRequirements?: string;
  sourcePolicy?: string;
  answerPlaceholder?: string;
  editorInstruction?: string;
  useWebSearch?: boolean;
  replaceOriginal?: boolean;
  formatAfterWrite?: boolean;
};

type TargetSheet = {
  id: string;
  name: string;
};

type RunStats = {
  filesProcessed: number;
  cellsChanged: number;
  errors: number;
};

type GridRange = {
  startColumnIndex: number;
  endColumnIndex: number;
  startRowIndex: number;
  endRowIndex?: number;
};

type ValueRange = {
  startCol: string;
  endCol: string;
  startRow: number;
  endRow?: number;
};

type ApplyOperationArgs = {
  spreadsheetId: string;
  fileName: string;
  tabName: string;
  range: RangeConfig;
  operation: DesignFormattingOperation;
  writeBehavior: WriteBehaviorConfig;
  dryRun: boolean;
};

type ChangedCellInfo = {
  before: string;
  after: string;
};

export class DesignFormattingJob {
  private previewEmitted = false;
  private previewSpreadsheetId: string | null = null;
  private aiAgent: AIAgent | null = null;

  constructor(private sheets: SheetsService) {}

  async run(payload: DesignFormattingPayload): Promise<RunStats> {
    this.validatePayload(payload);

    this.previewEmitted = false;
    this.previewSpreadsheetId = null;

    const dryRun = payload.dryRun !== false;
    const tabName = payload.tabName?.trim() || "Sheet1";
    const targets = await this.resolveTargets(payload);

    const stats: RunStats = {
      filesProcessed: 0,
      cellsChanged: 0,
      errors: 0,
    };

    console.log(chalk.blue("🎨 Design Formatting Job started"));
    console.log(chalk.gray(`Source type: ${this.resolveSourceType(payload)}`));
    console.log(chalk.gray(`Tab: ${tabName}`));
    console.log(chalk.gray(`Dry run: ${dryRun ? "YES" : "NO"}`));
    console.log(chalk.gray(`Targets found: ${targets.length}`));

    if (payload.listTabsOnly) {
      console.log(chalk.blue("📑 Loading sheet tabs"));

      for (const target of targets.slice(0, 1)) {
        await this.emitSheetTabs({
          spreadsheetId: target.id,
          fileName: target.name,
          selectedTabName: tabName,
        });

        stats.filesProcessed += 1;
      }

      console.log(chalk.green("✅ Sheet tabs loaded"));
      this.printStats(stats);
      return stats;
    }

    if (payload.previewOnly) {
      console.log(chalk.blue("📄 Loading live sheet preview"));

      for (const target of targets.slice(0, 1)) {
        await this.emitLiveSheetPreview({
          spreadsheetId: target.id,
          fileName: target.name,
          tabName,
          range: payload.range ?? {},
          maxRows: payload.previewRows,
          maxColumns: payload.previewColumns,
        });

        stats.filesProcessed += 1;
      }

      console.log(chalk.green("✅ Live sheet preview loaded"));
      this.printStats(stats);
      return stats;
    }

    const operations = this.getOperations(payload);
    const writeBehavior = this.normalizeWriteBehavior(payload.writeBehavior);
    console.log(chalk.gray(`Operations: ${operations.map((operation) => operation.type).join(" → ")}`));
    console.log(chalk.gray(`Write behavior: ${this.describeWriteBehavior(writeBehavior)}`));

    for (const target of targets) {
      try {
        console.log(chalk.cyan(`\n➡ Processing: ${target.name}`));

        if (payload.createBackup && !dryRun && operations.some((operation) => this.shouldCreateBackupBeforeOperation(operation))) {
          await this.createBackupTab(target.id, tabName);
        }

        let changed = 0;

        for (let index = 0; index < operations.length; index++) {
          const operation = operations[index];

          console.log(chalk.blue(`   Step ${index + 1}/${operations.length}: ${operation.type}`));

          changed += await this.applyOperation({
            spreadsheetId: target.id,
            fileName: target.name,
            tabName,
            range: payload.range ?? {},
            operation,
            writeBehavior,
            dryRun,
          });
        }

        stats.filesProcessed += 1;
        stats.cellsChanged += changed;

        console.log(chalk.green(`✅ Done: ${target.name} | changed cells: ${changed}`));
      } catch (error) {
        stats.errors += 1;
        console.error(chalk.red(`❌ Failed: ${target.name}`));
        console.error(error instanceof Error ? error.message : String(error));
      }

      this.printStats(stats);
    }

    console.log(chalk.green("\n🎉 Design Formatting Job finished"));
    this.printStats(stats);

    return stats;
  }

  private validatePayload(payload: DesignFormattingPayload): void {
    if (!payload?.targetId?.trim()) {
      throw new Error("Missing targetId");
    }

    if (payload.previewOnly || payload.listTabsOnly) {
      return;
    }

    const operations = this.getOperations(payload);

    if (!operations.length) {
      throw new Error("Missing operation type");
    }

    for (const operation of operations) {
      if (operation.type === "text_replace") {
        if (!operation.find) {
          throw new Error("Text replace requires a find value");
        }

        if (!operation.allowEmptyReplace && operation.replaceWith === "") {
          throw new Error("Empty replace value is blocked by operation settings");
        }
      }

      if (operation.type === "extract_comments") {
        if (!operation.sourceColumn?.trim()) {
          throw new Error("Extract comments requires a source column");
        }

        const sourceColumns = this.normalizeColumnSelection(operation.sourceColumn);

        if (operation.outputColumn?.trim()) {
          const outputColumns = this.normalizeColumnSelection(operation.outputColumn);

          if (sourceColumns.length !== outputColumns.length) {
            throw new Error("Extract comments source and output ranges must have the same width");
          }

          const overlappingColumns = sourceColumns.filter((column) => outputColumns.includes(column));

          if (overlappingColumns.length > 0) {
            throw new Error(`Extract comments source and output columns must not overlap: ${overlappingColumns.join(", ")}`);
          }
        }
      }

      if (operation.type === "replace_column_when_value") {
        if (!operation.sourceColumn?.trim()) {
          throw new Error("Column replacement requires a source column");
        }

        if (!operation.targetColumn?.trim()) {
          throw new Error("Column replacement requires a target column");
        }

        const sourceColumn = this.normalizeColumnLetter(operation.sourceColumn);
        const targetColumn = this.normalizeColumnLetter(operation.targetColumn);

        if (sourceColumn === targetColumn) {
          throw new Error("Source column and target column must be different");
        }
      }
    }
  }

  private getOperations(payload: DesignFormattingPayload): DesignFormattingOperation[] {
    const operations = Array.isArray(payload.operations) ? payload.operations.filter((item) => item?.type) : [];
    const singleOperation = payload.operation?.type ? [payload.operation] : [];

    if (operations.length > 0) {
      if (singleOperation.length > 0) {
        const operationTypes = operations.map((operation) => operation.type).join(" → ");
        const singleType = singleOperation[0].type;

        if (!operations.some((operation) => operation.type === singleType)) {
          throw new Error(
            `Conflicting design-formatting payload: operation is ${singleType}, but operations contain ${operationTypes}.`
          );
        }
      }

      this.assertSupportedOperations(operations);
      this.assertInstructionMatchesOperation(payload, operations);
      return operations;
    }

    this.assertSupportedOperations(singleOperation);
    this.assertInstructionMatchesOperation(payload, singleOperation);
    return singleOperation;
  }

  private assertSupportedOperations(operations: DesignFormattingOperation[]): void {
    const supported = new Set([
      "text_replace",
      "wrap_html",
      "normalize_spaces",
      "normalize_line_breaks",
      "plain_to_html_paragraphs",
      "case_transform",
      "format_table",
      "header_style",
      "wrap_text",
      "align_cells",
      "set_column_widths",
      "set_row_heights",
      "extract_comments",
      "replace_column_when_value",
      "add_column",
      "rename_column",
      "reorder_columns",
      "duplicate_tab_template",
      "restore_backup",
      "faq_ai_edit",
      "faq_apply_client_comments",
      "faq_language_review",
      "faq_question_review",
      "faq_name_injection",
      "faq_answer_research",
      "faq_missing_questions",
    ]);

    for (const operation of operations) {
      if (!supported.has(operation.type)) {
        throw new Error(`Unsupported design-formatting operation: ${operation.type}`);
      }
    }
  }

  private assertInstructionMatchesOperation(payload: DesignFormattingPayload, operations: DesignFormattingOperation[]): void {
    const text = [
      payload.assistantInstruction || "",
      payload.selectedOperation || "",
      payload.operation?.type || "",
    ].join(" ");
    const asksForAnswerResearch =
      /\[verify\]|information is currently not available|missing answers|verify answers|search answers|find answers|source-backed|trusted sources|official sources/i.test(text) ||
      /לחפש\s+תשובות|למצוא\s+תשובות|להשלים\s+תשובות|תשובות\s+חסרות|תשובות\s+מאומתות|מקורות\s+מהימנים|לא\s+זמין|אימות|מאומת/.test(text);

    if (asksForAnswerResearch && !operations.some((operation) => operation.type === "faq_answer_research")) {
      throw new Error("The request asks for answer research/verification, but the payload operation is not faq_answer_research.");
    }
  }

  private normalizeWriteBehavior(
    config?: WriteBehaviorConfig,
    defaultMode: WriteBehaviorMode = "overwrite"
  ): Required<WriteBehaviorConfig> {
    const requestedMode = config?.mode || defaultMode;
    const mode: WriteBehaviorMode = ["overwrite", "skip_existing", "first_empty"].includes(requestedMode)
      ? requestedMode
      : defaultMode;
    const maxSearchColumns = Math.max(1, Math.min(Number(config?.maxSearchColumns || 6), 25));

    return { mode, maxSearchColumns };
  }

  private getEffectiveWriteBehavior(
    operation: DesignFormattingOperation,
    fallback: WriteBehaviorConfig
  ): Required<WriteBehaviorConfig> {
    const fallbackBehavior = this.normalizeWriteBehavior(fallback);
    const operationBehavior = operation.writeBehavior;

    if (!operationBehavior?.mode) {
      return fallbackBehavior;
    }

    return this.normalizeWriteBehavior(
      {
        mode: operationBehavior.mode,
        maxSearchColumns: operationBehavior.maxSearchColumns ?? fallbackBehavior.maxSearchColumns,
      },
      fallbackBehavior.mode
    );
  }

  private describeWriteBehavior(behavior: WriteBehaviorConfig): string {
    const normalized = this.normalizeWriteBehavior(behavior);

    if (normalized.mode === "overwrite") {
      return "overwrite existing target values";
    }

    if (normalized.mode === "first_empty") {
      return `find first empty cell to the right (up to ${normalized.maxSearchColumns} columns)`;
    }

    return "skip target cells that already have values";
  }

  private isBlankCellValue(value: unknown): boolean {
    return String(value ?? "").trim() === "";
  }

  private async resolveTargets(payload: DesignFormattingPayload): Promise<TargetSheet[]> {
    const maxFiles = Math.max(1, Math.min(Number(payload.maxFiles || 30), 200));
    const sourceType = this.resolveSourceType(payload);

    if (sourceType === "sheet") {
      const id = this.extractSpreadsheetId(payload.targetId);

      return [
        {
          id,
          name: id,
        },
      ];
    }

    const folderId = this.extractFolderId(payload.targetId);
    const files = await this.sheets.listSpreadsheetsInFolderWithNames(folderId);

    return files.slice(0, maxFiles).map((file) => ({
      id: file.id,
      name: file.name,
    }));
  }

  private resolveSourceType(payload: DesignFormattingPayload): SourceType {
    return payload.sourceType === "folder" || this.looksLikeFolderInput(payload.targetId)
      ? "folder"
      : "sheet";
  }

  private looksLikeFolderInput(input: string): boolean {
    const raw = String(input || "").toLowerCase();
    return raw.includes("/folders/") || raw.includes("drive.google.com/drive/folders");
  }

  private async applyOperation(args: ApplyOperationArgs): Promise<number> {
    const { spreadsheetId, fileName, tabName, range, operation, dryRun } = args;
    const writeBehavior = this.getEffectiveWriteBehavior(operation, args.writeBehavior);

    if (operation.type === "extract_comments") {
      const sourceColumns = this.normalizeColumnSelection(operation.sourceColumn || "D");
      const outputColumns = operation.outputColumn?.trim()
        ? this.normalizeColumnSelection(operation.outputColumn)
        : this.getDefaultOutputColumns(sourceColumns);
      const sourceColumn = this.formatColumnSelection(sourceColumns);
      const outputColumn = this.formatColumnSelection(outputColumns);
      const startRow = Number(operation.startRow || 2);
      const outputHeader = operation.outputHeader || "Comment";

      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Extract sheet comments", [
        `Comments will be read from column ${sourceColumn}`,
        `Comment text will be written to column ${outputColumn}`,
        `Starting from row ${startRow}`,
        operation.includeReplies === false ? "Replies will be skipped" : "Replies will be included",
        `Write behavior: ${this.describeWriteBehavior(writeBehavior)}`,
      ]);

      const commentsJob = new ExtractSheetCommentsJob(this.sheets);

      const result = await commentsJob.run({
        spreadsheetId,
        sourceTabName: tabName,
        sourceColumn,
        outputColumn,
        startRow,
        outputHeader,
        includeReplies: operation.includeReplies !== false,
        writeBehavior,
        dryRun,
      });

      return result.cellsChanged;
    }

    if (operation.type === "replace_column_when_value") {
      return this.replaceColumnWhenValue(spreadsheetId, fileName, tabName, range, operation, writeBehavior, dryRun);
    }

    if (this.isTextValueOperation(operation)) {
      return this.transformValues(spreadsheetId, fileName, tabName, range, operation, dryRun);
    }

    if (operation.type === "format_table") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Format table", [
        operation.headerStyle ? "Header style will be applied" : "Header style will be skipped",
        operation.borders ? "Borders will be applied" : "Borders will be skipped",
        operation.wrapText ? "Text wrapping will be enabled" : "Text wrapping will be skipped",
        operation.autoResize ? "Selected columns will be auto-resized" : "Column auto resize will be skipped",
        operation.freezeHeader ? "First row will be frozen" : "First row will not be frozen",
      ]);

      return this.formatTable(spreadsheetId, tabName, range, operation, dryRun);
    }

    if (operation.type === "header_style") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Header row style", [
        operation.bold ? "Header row will be bold" : "Bold header will be skipped",
        operation.freeze ? "First row will be frozen" : "First row will not be frozen",
        operation.wrapText ? "Header text will wrap" : "Header wrapping will be skipped",
      ]);

      return this.applyHeaderStyle(spreadsheetId, tabName, range, operation, dryRun);
    }

    if (operation.type === "wrap_text") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Text wrapping", [
        `Selected cells will use ${operation.mode} wrapping mode`,
      ]);

      return this.applyWrapText(spreadsheetId, tabName, range, operation, dryRun);
    }

    if (operation.type === "align_cells") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Cell alignment", [
        `Horizontal alignment: ${operation.horizontal}`,
        `Vertical alignment: ${operation.vertical}`,
      ]);

      return this.alignCells(spreadsheetId, tabName, range, operation, dryRun);
    }

    if (operation.type === "set_column_widths") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Column widths", [
        `Selected columns will be set to ${operation.widthPx}px`,
      ]);

      return this.setColumnWidths(spreadsheetId, tabName, range, operation, dryRun);
    }

    if (operation.type === "set_row_heights") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Row heights", [
        `Selected rows will be set to ${operation.heightPx}px`,
      ]);

      return this.setRowHeights(spreadsheetId, tabName, range, operation, dryRun);
    }

    if (operation.type === "add_column") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Add column header", [
        `Header "${operation.header}" will be written to column ${operation.columnLetter}`,
        "Existing columns will not be shifted",
      ]);

      return this.addColumn(spreadsheetId, tabName, operation, writeBehavior, dryRun);
    }

    if (operation.type === "rename_column") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Rename column header", [
        `Column ${operation.columnLetter} header will be changed to "${operation.header}"`,
        "Only the first row will be changed",
      ]);

      return this.renameColumn(spreadsheetId, tabName, operation, writeBehavior, dryRun);
    }

    if (operation.type === "reorder_columns") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Reorder columns", [
        `A new tab named "${operation.outputTabName}" will be created or rewritten`,
        `Columns will be copied in this order: ${operation.columns.join(", ")}`,
        "The source tab will not be destroyed",
      ]);

      return this.reorderColumns(spreadsheetId, tabName, operation, dryRun);
    }

    if (operation.type === "duplicate_tab_template") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, undefined, "Duplicate template tab", [
        `Template tab "${operation.templateTabName}" will be duplicated`,
        `New tab name: "${operation.newTabName}"`,
      ]);

      return this.duplicateTabTemplate(spreadsheetId, operation, dryRun);
    }

    if (operation.type === "restore_backup") {
      return this.restoreLatestBackup(spreadsheetId, fileName, tabName, operation, dryRun);
    }

    if (this.isFaqEditOperation(operation)) {
      return this.editFaqWithAi(spreadsheetId, fileName, tabName, operation, writeBehavior, dryRun);
    }

    throw new Error(`Unsupported design-formatting operation: ${String((operation as { type?: string }).type || "unknown")}`);
  }

  private isTextValueOperation(
    operation: DesignFormattingOperation
  ): operation is
    | TextReplaceOperation
    | WrapHtmlOperation
    | NormalizeSpacesOperation
    | NormalizeLineBreaksOperation
    | PlainToHtmlParagraphsOperation
    | CaseTransformOperation {
    return [
      "text_replace",
      "wrap_html",
      "normalize_spaces",
      "normalize_line_breaks",
      "plain_to_html_paragraphs",
      "case_transform",
    ].includes(operation.type);
  }

  private isFaqEditOperation(operation: DesignFormattingOperation): operation is FaqAiEditOperation {
    return operation.type.startsWith("faq_");
  }

  private async transformValues(
    spreadsheetId: string,
    fileName: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation:
      | TextReplaceOperation
      | WrapHtmlOperation
      | NormalizeSpacesOperation
      | NormalizeLineBreaksOperation
      | PlainToHtmlParagraphsOperation
      | CaseTransformOperation,
    dryRun: boolean
  ): Promise<number> {
    const valueRange = this.resolveValueRange(rangeConfig);
    const rangeA1 = this.buildA1Range(tabName, valueRange);
    const rows = await this.sheets.readValues(spreadsheetId, rangeA1);

    let changed = 0;

    const changedCells = new Map<string, ChangedCellInfo>();
    const startColIndex = this.columnLetterToIndex(valueRange.startCol);
    const width =
      this.columnLetterToIndex(valueRange.endCol) -
      this.columnLetterToIndex(valueRange.startCol) +
      1;

    const nextRows = rows.map((row, rowIndex) => {
      const rowNumber = valueRange.startRow + rowIndex;

      return Array.from({ length: width }, (_, colOffset) => {
        return String(row?.[colOffset] ?? "");
      }).map((oldValue, colOffset) => {
        const newValue = this.transformValue(oldValue, operation);

        if (newValue !== oldValue) {
          changed += 1;

          const absoluteColumnIndex = startColIndex + colOffset;
          const columnLetter = this.columnIndexToLetter(absoluteColumnIndex);
          const key = `${rowNumber}:${columnLetter}`;

          changedCells.set(key, {
            before: oldValue,
            after: newValue,
          });
        }

        return newValue;
      });
    });

    if (changed > 0) {
      this.emitSheetPreviewIfNeeded({
        spreadsheetId,
        fileName,
        tabName,
        rangeA1,
        valueRange,
        originalRows: rows,
        nextRows,
        changedCells,
        changedCellsCount: changed,
      });
    }

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would update ${changed} cells in ${rangeA1}`));
      return changed;
    }

    if (changed > 0) {
      await this.sheets.writeValues(spreadsheetId, rangeA1, nextRows);
    }

    return changed;
  }

  private async replaceColumnWhenValue(
    spreadsheetId: string,
    fileName: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation: ReplaceColumnWhenValueOperation,
    writeBehavior: Required<WriteBehaviorConfig>,
    dryRun: boolean
  ): Promise<number> {
    const sourceColumn = this.normalizeColumnLetter(operation.sourceColumn);
    const targetColumn = this.normalizeColumnLetter(operation.targetColumn);
    const sourceIndex = this.columnLetterToIndex(sourceColumn);
    const targetIndex = this.columnLetterToIndex(targetColumn);
    const searchEndIndex = writeBehavior.mode === "first_empty"
      ? targetIndex + writeBehavior.maxSearchColumns - 1
      : targetIndex;
    const readEndColumn = this.columnIndexToLetter(Math.max(sourceIndex, searchEndIndex));
    const allRows = await this.sheets.readValues(spreadsheetId, `${this.quoteSheet(tabName)}!A:${readEndColumn}`);
    const rowBounds = this.resolveRowBounds(rangeConfig);
    const operationStartRow = Math.max(1, Number(operation.startRow || 2));
    const startRow = Math.max(operationStartRow, rowBounds.startRow);
    const endRow = Math.min(rowBounds.endRow || allRows.length, allRows.length);
    const targetHeader = String(operation.targetHeader || "").trim();

    let changed = 0;
    let skippedExisting = 0;
    let skippedNoEmptyCell = 0;
    const changedCells = new Map<string, ChangedCellInfo>();
    const previewStartIndex = targetIndex;
    const previewEndIndex = Math.max(targetIndex, searchEndIndex);
    const previewWidth = previewEndIndex - previewStartIndex + 1;
    const originalPreviewRows: string[][] = [];
    const nextPreviewRows: string[][] = [];
    const cellWrites: Array<{ rowNumber: number; columnLetter: string; value: string }> = [];

    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
      const row = allRows[rowNumber - 1] || [];
      const sourceRaw = String(row[sourceIndex] ?? "");
      const originalPreviewRow = Array.from({ length: previewWidth }, (_, offset) => {
        return String(row[previewStartIndex + offset] ?? "");
      });
      const nextPreviewRow = [...originalPreviewRow];

      if (!sourceRaw.trim()) {
        originalPreviewRows.push(originalPreviewRow);
        nextPreviewRows.push(nextPreviewRow);
        continue;
      }

      let destinationIndex = targetIndex;

      if (writeBehavior.mode === "skip_existing" && !this.isBlankCellValue(row[targetIndex])) {
        skippedExisting += 1;
        originalPreviewRows.push(originalPreviewRow);
        nextPreviewRows.push(nextPreviewRow);
        continue;
      }

      if (writeBehavior.mode === "first_empty") {
        destinationIndex = -1;

        for (let index = targetIndex; index <= searchEndIndex; index += 1) {
          if (this.isBlankCellValue(row[index])) {
            destinationIndex = index;
            break;
          }
        }

        if (destinationIndex < 0) {
          skippedNoEmptyCell += 1;
          originalPreviewRows.push(originalPreviewRow);
          nextPreviewRows.push(nextPreviewRow);
          continue;
        }
      }

      const destinationRaw = String(row[destinationIndex] ?? "");

      if (sourceRaw !== destinationRaw) {
        changed += 1;
        const destinationColumn = this.columnIndexToLetter(destinationIndex);

        cellWrites.push({
          rowNumber,
          columnLetter: destinationColumn,
          value: sourceRaw,
        });
        changedCells.set(`${rowNumber}:${destinationColumn}`, {
          before: destinationRaw,
          after: sourceRaw,
        });
        nextPreviewRow[destinationIndex - previewStartIndex] = sourceRaw;
      }

      originalPreviewRows.push(originalPreviewRow);
      nextPreviewRows.push(nextPreviewRow);
    }

    const headerBefore = String(allRows[0]?.[targetIndex] ?? "");
    const shouldWriteHeader = Boolean(targetHeader) &&
      targetHeader !== headerBefore &&
      (writeBehavior.mode === "overwrite" || this.isBlankCellValue(headerBefore));
    const changedTotal = changed + (shouldWriteHeader ? 1 : 0);

    if (endRow < startRow) {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Replace target column from source column", [
        `No data rows were found from row ${startRow}`,
        shouldWriteHeader
          ? `Target header will be set to "${targetHeader}"`
          : "No target cells need replacement in the selected range",
        `Write behavior: ${this.describeWriteBehavior(writeBehavior)}`,
      ]);

      if (dryRun) {
        return shouldWriteHeader ? 1 : 0;
      }

      if (shouldWriteHeader) {
        await this.sheets.writeValues(spreadsheetId, `${this.quoteSheet(tabName)}!${targetColumn}1:${targetColumn}1`, [
          [targetHeader],
        ]);
      }

      return shouldWriteHeader ? 1 : 0;
    }

    const previewEndColumn = this.columnIndexToLetter(previewEndIndex);
    const rangeA1 = `${this.quoteSheet(tabName)}!${targetColumn}${startRow}:${previewEndColumn}${endRow}`;

    if (changed > 0) {
      this.emitSheetPreviewIfNeeded({
        spreadsheetId,
        fileName,
        tabName,
        rangeA1,
        valueRange: {
          startCol: targetColumn,
          endCol: previewEndColumn,
          startRow,
          endRow,
        },
        originalRows: originalPreviewRows,
        nextRows: nextPreviewRows,
        changedCells,
        changedCellsCount: changedTotal,
      });
    } else {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Replace target column from source column", [
        `Checked rows ${startRow}-${endRow || startRow}`,
        `Column ${targetColumn} will update only where column ${sourceColumn} has a value`,
        shouldWriteHeader
          ? `Target header will be set to "${targetHeader}"`
          : "No target cells need replacement in the selected range",
        `Write behavior: ${this.describeWriteBehavior(writeBehavior)}`,
      ]);
    }

    if (dryRun) {
      console.log(
        chalk.yellow(
          `[DRY RUN] Would write ${changed} value(s) from non-empty ${sourceColumn} cells`
        )
      );

      if (skippedExisting > 0) {
        console.log(chalk.yellow(`[DRY RUN] Would skip ${skippedExisting} row(s) because target cells already have values`));
      }

      if (skippedNoEmptyCell > 0) {
        console.log(chalk.yellow(`[DRY RUN] Would skip ${skippedNoEmptyCell} row(s) because no empty cell was found to the right`));
      }

      if (shouldWriteHeader) {
        console.log(chalk.yellow(`[DRY RUN] Would set ${targetColumn} header to "${targetHeader}"`));
      }

      return changedTotal;
    }

    if (shouldWriteHeader) {
      await this.sheets.writeValues(spreadsheetId, `${this.quoteSheet(tabName)}!${targetColumn}1:${targetColumn}1`, [
        [targetHeader],
      ]);
    }

    await this.writeSparseCellValues(spreadsheetId, tabName, cellWrites);

    return changedTotal;
  }

  private transformValue(
    value: string,
    operation:
      | TextReplaceOperation
      | WrapHtmlOperation
      | NormalizeSpacesOperation
      | NormalizeLineBreaksOperation
      | PlainToHtmlParagraphsOperation
      | CaseTransformOperation
  ): string {
    if (!value && operation.type !== "wrap_html") {
      return value;
    }

    switch (operation.type) {
      case "text_replace": {
        if (operation.matchMode === "exact") {
          return value === operation.find ? operation.replaceWith : value;
        }

        if (operation.matchMode === "regex") {
          return value.replace(new RegExp(operation.find, "g"), operation.replaceWith);
        }

        return value.split(operation.find).join(operation.replaceWith);
      }

      case "wrap_html": {
        if (!value && operation.emptyCells !== "wrap") {
          return value;
        }

        const tag = this.normalizeHtmlTag(operation.tag);
        const trimmed = value.trim();

        const startsWithTag = new RegExp(`^<${tag}(\\s|>)`, "i").test(trimmed);
        const endsWithTag = new RegExp(`</${tag}>$`, "i").test(trimmed);

        if (operation.skipExisting && startsWithTag && endsWithTag) {
          return value;
        }

        return `<${tag}>${trimmed}</${tag}>`;
      }

      case "normalize_spaces": {
        return value.replace(/[ \t]{2,}/g, " ").trim();
      }

      case "normalize_line_breaks": {
        if (operation.replacement === "br") {
          return value.replace(/\r?\n+/g, "<br>").trim();
        }

        if (operation.replacement === "paragraph") {
          return this.toHtmlParagraphs(value, "line_breaks");
        }

        return value.replace(/\r?\n+/g, " ").replace(/[ \t]{2,}/g, " ").trim();
      }

      case "plain_to_html_paragraphs": {
        return this.toHtmlParagraphs(value, operation.splitBy);
      }

      case "case_transform": {
        return this.transformCase(value, operation.mode);
      }

      default:
        return value;
    }
  }

  private transformCase(value: string, mode: CaseTransformOperation["mode"]): string {
    if (mode === "lower") {
      return value.toLowerCase();
    }

    if (mode === "upper") {
      return value.toUpperCase();
    }

    if (mode === "title") {
      return value.toLowerCase().replace(/\b\p{L}/gu, (char) => char.toUpperCase());
    }

    const trimmed = value.trim().toLowerCase();

    return trimmed.replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (match) => match.toUpperCase());
  }

  private toHtmlParagraphs(value: string, splitBy: "line_breaks" | "double_line_breaks"): string {
    const splitter = splitBy === "double_line_breaks" ? /\r?\n\s*\r?\n/g : /\r?\n+/g;

    return value
      .split(splitter)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        if (/^<p[\s>]/i.test(part) && /<\/p>$/i.test(part)) {
          return part;
        }

        return `<p>${part}</p>`;
      })
      .join("");
  }

  private async formatTable(
    spreadsheetId: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation: FormatTableOperation,
    dryRun: boolean
  ): Promise<number> {
    const sheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const gridRange = this.resolveGridRange(rangeConfig);
    const requests: any[] = [];

    if (operation.headerStyle) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: gridRange.startColumnIndex,
            endColumnIndex: gridRange.endColumnIndex,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 },
              },
              backgroundColor: { red: 0.31, green: 0.22, blue: 0.72 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              wrapStrategy: "WRAP",
            },
          },
          fields:
            "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      });
    }

    if (operation.wrapText) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            ...gridRange,
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: "WRAP",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      });
    }

    if (operation.borders) {
      requests.push({
        updateBorders: {
          range: {
            sheetId,
            ...gridRange,
          },
          top: this.borderStyle(),
          bottom: this.borderStyle(),
          left: this.borderStyle(),
          right: this.borderStyle(),
          innerHorizontal: this.borderStyle(),
          innerVertical: this.borderStyle(),
        },
      });
    }

    if (operation.freezeHeader) {
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: "gridProperties.frozenRowCount",
        },
      });
    }

    if (operation.autoResize) {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: gridRange.startColumnIndex,
            endIndex: gridRange.endColumnIndex,
          },
        },
      });
    }

    const presetHeight = operation.preset === "compact" ? 28 : operation.preset === "content" ? 72 : 44;

    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: gridRange.startRowIndex,
          endIndex: gridRange.endRowIndex ?? gridRange.startRowIndex + 2000,
        },
        properties: {
          pixelSize: presetHeight,
        },
        fields: "pixelSize",
      },
    });

    if (dryRun) {
      console.log(
        chalk.yellow(`[DRY RUN] Would format table range in "${tabName}" with ${requests.length} sheet requests`)
      );
      return requests.length;
    }

    await this.batchUpdate(spreadsheetId, requests);
    return requests.length;
  }

  private async applyHeaderStyle(
    spreadsheetId: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation: HeaderStyleOperation,
    dryRun: boolean
  ): Promise<number> {
    const sheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const gridRange = this.resolveGridRange(rangeConfig);
    const requests: any[] = [];

    if (operation.bold || operation.wrapText) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: gridRange.startColumnIndex,
            endColumnIndex: gridRange.endColumnIndex,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: Boolean(operation.bold),
                foregroundColor: { red: 1, green: 1, blue: 1 },
              },
              backgroundColor: { red: 0.31, green: 0.22, blue: 0.72 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              wrapStrategy: operation.wrapText ? "WRAP" : undefined,
            },
          },
          fields:
            "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      });
    }

    if (operation.freeze) {
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: "gridProperties.frozenRowCount",
        },
      });
    }

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would apply header style in "${tabName}"`));
      return requests.length;
    }

    await this.batchUpdate(spreadsheetId, requests);
    return requests.length;
  }

  private async applyWrapText(
    spreadsheetId: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation: WrapTextOperation,
    dryRun: boolean
  ): Promise<number> {
    const sheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const gridRange = this.resolveGridRange(rangeConfig);

    const requests = [
      {
        repeatCell: {
          range: {
            sheetId,
            ...gridRange,
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: operation.mode,
            },
          },
          fields: "userEnteredFormat.wrapStrategy",
        },
      },
    ];

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would set text wrapping to ${operation.mode}`));
      return 1;
    }

    await this.batchUpdate(spreadsheetId, requests);
    return 1;
  }

  private async alignCells(
    spreadsheetId: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation: AlignCellsOperation,
    dryRun: boolean
  ): Promise<number> {
    const sheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const gridRange = this.resolveGridRange(rangeConfig);

    const requests = [
      {
        repeatCell: {
          range: {
            sheetId,
            ...gridRange,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: operation.horizontal,
              verticalAlignment: operation.vertical,
            },
          },
          fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
        },
      },
    ];

    if (dryRun) {
      console.log(chalk.yellow("[DRY RUN] Would align selected cells"));
      return 1;
    }

    await this.batchUpdate(spreadsheetId, requests);
    return 1;
  }

  private async setColumnWidths(
    spreadsheetId: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation: SetColumnWidthsOperation,
    dryRun: boolean
  ): Promise<number> {
    const sheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const gridRange = this.resolveGridRange(rangeConfig);

    const requests = [
      {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: gridRange.startColumnIndex,
            endIndex: gridRange.endColumnIndex,
          },
          properties: {
            pixelSize: operation.widthPx,
          },
          fields: "pixelSize",
        },
      },
    ];

    const changed = gridRange.endColumnIndex - gridRange.startColumnIndex;

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would set ${changed} selected column width(s) to ${operation.widthPx}px`));
      return changed;
    }

    await this.batchUpdate(spreadsheetId, requests);
    return changed;
  }

  private async setRowHeights(
    spreadsheetId: string,
    tabName: string,
    rangeConfig: RangeConfig,
    operation: SetRowHeightsOperation,
    dryRun: boolean
  ): Promise<number> {
    const sheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const gridRange = this.resolveGridRange(rangeConfig);
    const endRowIndex = gridRange.endRowIndex ?? gridRange.startRowIndex + 2000;

    const requests = [
      {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: gridRange.startRowIndex,
            endIndex: endRowIndex,
          },
          properties: {
            pixelSize: operation.heightPx,
          },
          fields: "pixelSize",
        },
      },
    ];

    const changed = endRowIndex - gridRange.startRowIndex;

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would set ${changed} selected row height(s) to ${operation.heightPx}px`));
      return changed;
    }

    await this.batchUpdate(spreadsheetId, requests);
    return changed;
  }

  private async addColumn(
    spreadsheetId: string,
    tabName: string,
    operation: AddColumnOperation,
    writeBehavior: Required<WriteBehaviorConfig>,
    dryRun: boolean
  ): Promise<number> {
    let col = this.normalizeColumnLetter(operation.columnLetter);
    const startIndex = this.columnLetterToIndex(col);
    const searchEndIndex = writeBehavior.mode === "first_empty"
      ? startIndex + writeBehavior.maxSearchColumns - 1
      : startIndex;
    const searchEndColumn = this.columnIndexToLetter(searchEndIndex);
    const headerRows = await this.sheets.readValues(spreadsheetId, `${this.quoteSheet(tabName)}!${col}1:${searchEndColumn}1`);
    const headerRow = headerRows[0] || [];
    const headerBefore = String(headerRow[0] ?? "");

    if (writeBehavior.mode === "skip_existing" && !this.isBlankCellValue(headerBefore)) {
      console.log(chalk.yellow(`Skipped ${col} header because it already has a value.`));
      return 0;
    }

    if (writeBehavior.mode === "first_empty") {
      let destinationOffset = -1;

      for (let offset = 0; offset < writeBehavior.maxSearchColumns; offset += 1) {
        if (this.isBlankCellValue(headerRow[offset])) {
          destinationOffset = offset;
          break;
        }
      }

      if (destinationOffset < 0) {
        console.log(chalk.yellow(`Skipped header write because no empty header cell was found from ${col} to ${searchEndColumn}.`));
        return 0;
      }

      col = this.columnIndexToLetter(startIndex + destinationOffset);
    }

    const range = `${this.quoteSheet(tabName)}!${col}1:${col}1`;

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would write header "${operation.header}" to ${range}`));
      return 1;
    }

    await this.sheets.writeValues(spreadsheetId, range, [[operation.header]]);
    return 1;
  }

  private async renameColumn(
    spreadsheetId: string,
    tabName: string,
    operation: RenameColumnOperation,
    writeBehavior: Required<WriteBehaviorConfig>,
    dryRun: boolean
  ): Promise<number> {
    const col = this.normalizeColumnLetter(operation.columnLetter);
    const range = `${this.quoteSheet(tabName)}!${col}1:${col}1`;
    const headerRows = await this.sheets.readValues(spreadsheetId, range);
    const headerBefore = String(headerRows[0]?.[0] ?? "");

    if (writeBehavior.mode !== "overwrite" && !this.isBlankCellValue(headerBefore)) {
      console.log(chalk.yellow(`Skipped ${col} rename because the header already has a value.`));
      return 0;
    }

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would rename column ${col} header to "${operation.header}"`));
      return 1;
    }

    await this.sheets.writeValues(spreadsheetId, range, [[operation.header]]);
    return 1;
  }

  private async reorderColumns(
    spreadsheetId: string,
    tabName: string,
    operation: ReorderColumnsOperation,
    dryRun: boolean
  ): Promise<number> {
    const rows = await this.sheets.readValues(spreadsheetId, `${this.quoteSheet(tabName)}!A:ZZ`);
    const indexes = operation.columns.map((col) => this.columnLetterToIndex(this.normalizeColumnLetter(col)));

    const outputRows = rows.map((row) => {
      return indexes.map((idx) => String(row[idx] ?? ""));
    });

    const changed = outputRows.length * operation.columns.length;

    if (dryRun) {
      console.log(
        chalk.yellow(
          `[DRY RUN] Would create/rewrite "${operation.outputTabName}" with reordered columns: ${operation.columns.join(
            ", "
          )}`
        )
      );
      return changed;
    }

    await this.sheets.ensureTab(spreadsheetId, operation.outputTabName);
    await this.sheets.clearTabValues(spreadsheetId, operation.outputTabName);
    await this.sheets.writeValues(spreadsheetId, `${this.quoteSheet(operation.outputTabName)}!A1`, outputRows);

    return changed;
  }

  private async duplicateTabTemplate(
    spreadsheetId: string,
    operation: DuplicateTabTemplateOperation,
    dryRun: boolean
  ): Promise<number> {
    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would duplicate "${operation.templateTabName}" to "${operation.newTabName}"`));
      return 1;
    }

    const sourceSheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, operation.templateTabName);
    await this.sheets.duplicateSheet(spreadsheetId, sourceSheetId, operation.newTabName);

    return 1;
  }

  private async editFaqWithAi(
    spreadsheetId: string,
    fileName: string,
    tabName: string,
    operation: FaqAiEditOperation,
    writeBehavior: Required<WriteBehaviorConfig>,
    dryRun: boolean
  ): Promise<number> {
    const categoryCol = this.normalizeColumnLetter(operation.categoryCol || "A");
    const questionCol = this.normalizeColumnLetter(operation.questionCol || "B");
    const answerCol = this.normalizeColumnLetter(operation.answerCol || "C");
    const commentCol = this.normalizeColumnLetter(operation.commentCol || "D");
    const targetCol = this.normalizeColumnLetter(operation.targetCol || "F");
    const questionFixCol = this.normalizeColumnLetter(operation.questionFixCol || "G");
    const qaNoteCol = this.normalizeColumnLetter(operation.qaNoteCol || "H");
    const hotelNameCol = this.normalizeColumnLetter(operation.hotelNameCol || "I");
    const targetHeader = operation.targetHeader || "Agent Final Answer";
    const questionFixHeader = operation.questionFixHeader || "Question Correction";
    const qaNoteHeader = operation.qaNoteHeader || "QA Note";
    const hotelNameHeader = operation.hotelNameHeader || "Hotel Name Status";

    const rows = await this.sheets.readValues(spreadsheetId, `${this.quoteSheet(tabName)}!A:ZZ`);
    const dataRowCount = Math.max(0, rows.length - 1);

    const catIdx = this.columnLetterToIndex(categoryCol);
    const questionIdx = this.columnLetterToIndex(questionCol);
    const answerIdx = this.columnLetterToIndex(answerCol);
    const commentIdx = this.columnLetterToIndex(commentCol);
    const targetIdx = this.columnLetterToIndex(targetCol);
    const questionFixIdx = this.columnLetterToIndex(questionFixCol);
    const qaNoteIdx = this.columnLetterToIndex(qaNoteCol);
    const hotelNameIdx = this.columnLetterToIndex(hotelNameCol);

    let hotelName = operation.hotelName?.trim();

    if (!hotelName) {
      try {
        hotelName = (await this.sheets.getSpreadsheetTitle(spreadsheetId))
          .replace(/FAQ|Audit/gi, "")
          .trim();
      } catch {
        hotelName = "The property";
      }
    }

    const allRows: Array<{
      rowIndex1Based: number;
      category: string;
      question: string;
      originalAnswer: string;
      clientComment: string;
    }> = [];

    for (let rowNumber = 2; rowNumber <= rows.length; rowNumber++) {
      const row = rows[rowNumber - 1] ?? [];
      const category = String(row[catIdx] ?? "").trim();
      const question = String(row[questionIdx] ?? "").trim();
      const originalAnswer = String(row[answerIdx] ?? "").trim();
      const clientComment = String(row[commentIdx] ?? "").trim();

      if (!question && !originalAnswer && !clientComment) {
        continue;
      }

      allRows.push({ rowIndex1Based: rowNumber, category, question, originalAnswer, clientComment });
    }

    const operationLabel = this.getFaqOperationLabel(operation.type);
    const rowsWithComments = allRows.filter((row) => row.clientComment);
    const rowsWithAnswers = allRows.filter((row) => row.originalAnswer);
    const rowsWithQuestions = allRows.filter((row) => row.question);
    const rowsWithMissingAnswers = allRows.filter((row) => row.question && this.isMissingAnswerValue(row.originalAnswer, operation.answerPlaceholder));

    const inputCounts = {
      rewrite: operation.type === "faq_ai_edit" || operation.type === "faq_apply_client_comments" ? rowsWithComments.length : 0,
      qa:
        operation.type === "faq_ai_edit" && operation.checkOriginalGrammar === true
          ? rowsWithAnswers.filter((row) => !row.clientComment).length
          : operation.type === "faq_language_review"
            ? rowsWithAnswers.length
            : 0,
      questionFix: operation.type === "faq_ai_edit" || operation.type === "faq_question_review" ? rowsWithQuestions.length : 0,
      nameInject: operation.type === "faq_name_injection" ? rowsWithAnswers.length : 0,
      answerResearch: operation.type === "faq_answer_research" ? rowsWithMissingAnswers.length : 0,
      missing: operation.type === "faq_missing_questions" ? allRows.length : 0,
    };

    const estimatedInputRows =
      inputCounts.rewrite + inputCounts.qa + inputCounts.questionFix + inputCounts.nameInject + inputCounts.answerResearch + inputCounts.missing;

    this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, operationLabel, [
      `Rows available: ${dataRowCount}`,
      `Rows selected for this operation: ${estimatedInputRows}`,
      `Output columns: ${targetCol}, ${questionFixCol}, ${qaNoteCol}, ${hotelNameCol}`,
      `Write behavior: ${this.describeWriteBehavior(writeBehavior)}`,
      operation.type === "faq_answer_research" && operation.useWebSearch ? "Live run will use AI web search for missing/VERIFY answers" : "",
      dryRun ? "Dry run will not call AI or write cells" : "Real run will call AI and write output columns",
    ].filter(Boolean));

    if (dryRun) {
      console.log(
        chalk.yellow(`[DRY RUN] Would run "${operationLabel}" on ${estimatedInputRows} FAQ rows in ${tabName}`)
      );

      return estimatedInputRows;
    }

    if (estimatedInputRows === 0) {
      console.log(chalk.yellow(`No FAQ rows match "${operationLabel}" based on the selected settings.`));
      return 0;
    }

    const prompt = this.buildFaqEditPrompt(operation, allRows, hotelName);
    const model = operation.model || "o3";
    const aiOutput = await this.getAiAgent().run(prompt, model, { useWebSearch: operation.type === "faq_answer_research" && operation.useWebSearch === true });
    const parsed = this.parseFaqEditOutput(aiOutput);

    const rewriteMap = new Map<number, string>();
    parsed.rewrite.forEach((item) => rewriteMap.set(Number(item.rowIndex1Based), String(item.final_answer || "")));

    const qaMap = new Map<number, string>();
    parsed.qa.forEach((item) => qaMap.set(Number(item.rowIndex1Based), String(item.fixed || "")));

    const questionFixMap = new Map<number, string>();
    parsed.question_fix.forEach((item) => questionFixMap.set(Number(item.rowIndex1Based), String(item.fixed_question || "")));

    const qaNoteMap = new Map<number, string>();
    parsed.qa_note.forEach((item) => qaNoteMap.set(Number(item.rowIndex1Based), String(item.note || "")));

    const nameAnswerMap = new Map<number, string>();
    const nameQuestionMap = new Map<number, string>();
    const nameStatusMap = new Map<number, string>();
    parsed.name_inject.forEach((item) => {
      const rowIndex = Number(item.rowIndex1Based);
      nameAnswerMap.set(rowIndex, String(item.answer_with_name || ""));
      nameQuestionMap.set(rowIndex, String(item.question_with_name || ""));
      nameStatusMap.set(rowIndex, String(item.status || ""));
    });

    let changed = 0;
    let skippedExisting = 0;
    let skippedNoEmptyCell = 0;
    const sparseWrites: Array<{ rowNumber: number; columnLetter: string; value: string }> = [];
    const plannedCellsByRow = new Map<number, Set<number>>();

    const getExisting = (sheetRow: number, columnIndex: number): string => {
      return String(rows[sheetRow - 1]?.[columnIndex] ?? "");
    };

    const isPlannedCell = (sheetRow: number, columnIndex: number): boolean => {
      return plannedCellsByRow.get(sheetRow)?.has(columnIndex) === true;
    };

    const markPlannedCell = (sheetRow: number, columnIndex: number): void => {
      const planned = plannedCellsByRow.get(sheetRow) || new Set<number>();
      planned.add(columnIndex);
      plannedCellsByRow.set(sheetRow, planned);
    };

    const findFirstWritableColumn = (sheetRow: number, startIndex: number): number | null => {
      if (writeBehavior.mode === "overwrite") {
        return startIndex;
      }

      if (writeBehavior.mode === "skip_existing") {
        return this.isBlankCellValue(getExisting(sheetRow, startIndex)) ? startIndex : null;
      }

      const endIndex = startIndex + writeBehavior.maxSearchColumns - 1;

      for (let columnIndex = startIndex; columnIndex <= endIndex; columnIndex += 1) {
        if (this.isBlankCellValue(getExisting(sheetRow, columnIndex)) && !isPlannedCell(sheetRow, columnIndex)) {
          return columnIndex;
        }
      }

      return null;
    };

    const writeHeaderIfAllowed = async (columnIndex: number, header: string): Promise<number> => {
      const cleanHeader = String(header || "").trim();
      if (!cleanHeader) return 0;

      const headerBefore = getExisting(1, columnIndex);

      if (cleanHeader === headerBefore) {
        return 0;
      }

      if (writeBehavior.mode !== "overwrite" && !this.isBlankCellValue(headerBefore)) {
        return 0;
      }

      const columnLetter = this.columnIndexToLetter(columnIndex);
      await this.sheets.writeValues(spreadsheetId, `${this.quoteSheet(tabName)}!${columnLetter}1:${columnLetter}1`, [[cleanHeader]]);
      return 1;
    };

    const writeGeneratedColumn = async (
      columnIndex: number,
      columnLetter: string,
      header: string,
      valueForRow: (sheetRow: number) => string
    ): Promise<void> => {
      const usedColumns = new Set<number>();
      const columnValues: string[] = [];
      let columnChanged = false;

      for (let offset = 0; offset < dataRowCount; offset += 1) {
        const sheetRow = offset + 2;
        const existing = getExisting(sheetRow, columnIndex);
        const nextValue = String(valueForRow(sheetRow) || "");

        if (!nextValue) {
          columnValues.push(existing);
          continue;
        }

        if (writeBehavior.mode === "first_empty") {
          const destinationIndex = findFirstWritableColumn(sheetRow, columnIndex);

          if (destinationIndex === null) {
            skippedNoEmptyCell += 1;
            columnValues.push(existing);
            continue;
          }

          const destinationExisting = getExisting(sheetRow, destinationIndex);
          const destinationColumn = this.columnIndexToLetter(destinationIndex);

          if (nextValue !== destinationExisting) {
            changed += 1;
            sparseWrites.push({
              rowNumber: sheetRow,
              columnLetter: destinationColumn,
              value: nextValue,
            });
            markPlannedCell(sheetRow, destinationIndex);
            usedColumns.add(destinationIndex);
          }

          columnValues.push(existing);
          continue;
        }

        if (writeBehavior.mode === "skip_existing" && !this.isBlankCellValue(existing)) {
          skippedExisting += 1;
          columnValues.push(existing);
          continue;
        }

        if (nextValue !== existing) {
          changed += 1;
          columnChanged = true;
          columnValues.push(nextValue);
          continue;
        }

        columnValues.push(existing);
      }

      if (writeBehavior.mode === "first_empty") {
        for (const usedColumnIndex of usedColumns) {
          changed += await writeHeaderIfAllowed(usedColumnIndex, header);
        }
        return;
      }

      const headerBefore = getExisting(1, columnIndex);
      const cleanHeader = String(header || "").trim();
      const canWriteHeader = Boolean(cleanHeader) &&
        cleanHeader !== headerBefore &&
        (writeBehavior.mode === "overwrite" || this.isBlankCellValue(headerBefore));
      const headerChanged = canWriteHeader ? await writeHeaderIfAllowed(columnIndex, header) : 0;
      changed += headerChanged;

      if (columnChanged || headerChanged) {
        const headerForFullWrite = canWriteHeader ? cleanHeader : headerBefore;
        await this.writeColumnInTab(
          spreadsheetId,
          tabName,
          columnLetter,
          headerForFullWrite || cleanHeader || String(rows[0]?.[columnIndex] || ""),
          columnValues
        );
      }
    };

    const shouldWriteFinalAnswer = [
      "faq_ai_edit",
      "faq_apply_client_comments",
      "faq_language_review",
      "faq_name_injection",
      "faq_answer_research",
    ].includes(operation.type);
    const shouldWriteQuestionFix = [
      "faq_ai_edit",
      "faq_question_review",
      "faq_name_injection",
    ].includes(operation.type);
    const shouldWriteQaNote = [
      "faq_ai_edit",
      "faq_language_review",
      "faq_question_review",
      "faq_answer_research",
    ].includes(operation.type);
    const shouldWriteNameStatus = operation.type === "faq_ai_edit" || operation.type === "faq_name_injection";

    if (shouldWriteFinalAnswer) {
      await writeGeneratedColumn(targetIdx, targetCol, targetHeader, (sheetRow) => {
        if (operation.type === "faq_name_injection" && operation.nameOutputMode === "original_answer") {
          return "";
        }

        return rewriteMap.get(sheetRow) || qaMap.get(sheetRow) || nameAnswerMap.get(sheetRow) || "";
      });
    }

    if (operation.type === "faq_name_injection" && operation.nameOutputMode === "original_answer") {
      await writeGeneratedColumn(answerIdx, answerCol, String(rows[0]?.[answerIdx] || "Answer"), (sheetRow) => nameAnswerMap.get(sheetRow) || "");
    }

    if (shouldWriteQuestionFix) {
      await writeGeneratedColumn(questionFixIdx, questionFixCol, questionFixHeader, (sheetRow) => {
        return questionFixMap.get(sheetRow) || nameQuestionMap.get(sheetRow) || "";
      });
    }

    if (shouldWriteQaNote) {
      await writeGeneratedColumn(qaNoteIdx, qaNoteCol, qaNoteHeader, (sheetRow) => qaNoteMap.get(sheetRow) || "");
    }

    if (shouldWriteNameStatus) {
      await writeGeneratedColumn(hotelNameIdx, hotelNameCol, hotelNameHeader, (sheetRow) => {
        return nameStatusMap.get(sheetRow) || (operation.type === "faq_ai_edit" && hotelName ? `Checked for ${hotelName}` : "");
      });
    }

    await this.writeSparseCellValues(spreadsheetId, tabName, sparseWrites);

    if (skippedExisting > 0) {
      console.log(chalk.yellow(`Skipped ${skippedExisting} generated FAQ value(s) because target cells already had values.`));
    }

    if (skippedNoEmptyCell > 0) {
      console.log(chalk.yellow(`Skipped ${skippedNoEmptyCell} generated FAQ value(s) because no empty cell was found to the right.`));
    }

    if (parsed.missing_faq_to_add.length > 0) {
      const missingRows = parsed.missing_faq_to_add
        .map((item) => [
          String(item.category || "General Information"),
          String(item.question || ""),
          String(item.answer || ""),
          "",
          "",
          String(item.answer || ""),
          "",
          "Added by FAQ gap check",
          hotelName ? `Checked for ${hotelName}` : "",
        ])
        .filter((row) => row[1] && row[2]);

      if (missingRows.length > 0) {
        await this.sheets.appendRows(spreadsheetId, `${this.quoteSheet(tabName)}!A:I`, missingRows);
        changed += missingRows.length * 3;
      }
    }

    if (operation.formatAfterWrite !== false) {
      await this.sheets.formatSheetLikeFAQ(spreadsheetId, tabName);
    }

    return changed;
  }

  private isMissingAnswerValue(value: string, customPlaceholder?: string): boolean {
    const text = String(value || "").trim();
    if (!text) return true;
    const normalized = text.toLowerCase();
    const custom = String(customPlaceholder || "").trim().toLowerCase();

    return Boolean(custom && normalized.includes(custom)) ||
      normalized.includes("information is currently not available") ||
      normalized.includes("[verify]") ||
      normalized.includes("needs source confirmation") ||
      normalized.includes("not available") ||
      normalized.includes("לא זמין") ||
      normalized.includes("אין מידע") ||
      normalized.includes("דורש אימות");
  }

  private buildFaqEditPrompt(
    operation: FaqAiEditOperation,
    allRows: Array<{
      rowIndex1Based: number;
      category: string;
      question: string;
      originalAnswer: string;
      clientComment: string;
    }>,
    hotelName: string
  ): string {
    const answerResearchRows = operation.type === "faq_answer_research"
      ? allRows.filter((row) => row.question && this.isMissingAnswerValue(row.originalAnswer, operation.answerPlaceholder))
      : [];
    const rewriteRows =
      operation.type === "faq_ai_edit" || operation.type === "faq_apply_client_comments"
        ? allRows.filter((row) => row.clientComment)
        : [];
    const qaRows =
      operation.type === "faq_language_review"
        ? allRows.filter((row) => row.originalAnswer)
        : operation.type === "faq_ai_edit" && operation.checkOriginalGrammar === true
          ? allRows.filter((row) => row.originalAnswer && !row.clientComment)
          : [];
    const questionRows =
      operation.type === "faq_question_review" || operation.type === "faq_ai_edit"
        ? allRows.filter((row) => row.question)
        : [];
    const nameRows = operation.type === "faq_name_injection" ? allRows.filter((row) => row.originalAnswer) : [];
    const missingRows = operation.type === "faq_missing_questions" ? allRows : [];

    return `FAQ sheet editing task

ROLE
You are a senior hospitality FAQ editor and a strict QA reviewer.

CONTEXT
Property/product name: ${hotelName}
Operation: ${operation.type}
Additional user edit instruction: ${operation.editorInstruction || "None"}

TASKS
Use only the relevant task for the selected operation:
1. faq_apply_client_comments: rewrite rows that have a clientComment. The clientComment is the source of truth, but preserve verified facts from the original answer when useful.
2. faq_language_review: lightly improve grammar, clarity and hospitality tone. Do not change factual meaning. If an additional user edit instruction is provided, apply it to the answer text.
3. faq_question_review: suggest corrected questions only when the question is unsuitable for a public FAQ, duplicated, too vague, or mismatched with the answer.
4. faq_name_injection: add the property/product name only when it improves clarity. Avoid keyword stuffing. Check scope: ${operation.nameScope || "answers"}.
5. faq_missing_questions: propose practical missing FAQ rows using only the patterns and facts visible in the input.
6. faq_answer_research: research rows whose answer is blank, unavailable or marked VERIFY, then write a concise source-grounded replacement answer in rewrite[]. Add the source label or URL in qa_note[].

STRICT RULES
- Do not invent amenities, policies, times, facilities or prices.
- Keep the same language as the original answer.
- If a client comment is already publication-ready, keep it as close as possible.
- If the answer is Yes/No, start with Yes/No/Currently, or with the matching Hebrew wording.
- Avoid em dashes.
- Add missing FAQ rows only for faq_missing_questions.
- Keep QA notes short, practical and not accusatory.
- Return empty strings when no change is needed.
- If information is missing or not verified, say that it needs source confirmation instead of inventing.
- For faq_answer_research, use trustworthy sources. Prefer official sources when available. Put the best short source label or URL in qa_note.
- Source policy: ${operation.sourcePolicy || "Use trustworthy public sources; prefer official pages."}
- Additional edit instruction: ${operation.editorInstruction || "None"}

OUTPUT FORMAT
Return only valid JSON:
{
  "rewrite": [
    {"rowIndex1Based": 2, "final_answer": "publication-ready answer"}
  ],
  "qa": [
    {"rowIndex1Based": 3, "fixed": "fixed answer or empty string"}
  ],
  "question_fix": [
    {"rowIndex1Based": 4, "fixed_question": "fixed question or empty string"}
  ],
  "qa_note": [
    {"rowIndex1Based": 5, "note": "short note or empty string"}
  ],
  "name_inject": [
    {"rowIndex1Based": 6, "answer_with_name": "answer with natural name use or empty string", "question_with_name": "question with natural name use or empty string", "status": "short status"}
  ],
  "missing_faq_to_add": [
    {"category": "General Information", "question": "missing public FAQ question", "answer": "source-grounded answer or Needs source confirmation"}
  ]
}

INPUT
${JSON.stringify(
  {
    rewrite: rewriteRows,
    qa: qaRows,
    question_check: questionRows,
    name_inject: nameRows,
    missing_question_scan: missingRows,
    answer_research: answerResearchRows,
    options: {
      commentMode: operation.commentMode || "rewrite_if_needed",
      languageDepth: operation.languageDepth || "light",
      languageTone: operation.languageTone || "clear_hospitality",
      detectDuplicates: operation.detectDuplicates !== false,
      missingRequirements: operation.missingRequirements || "",
      sourcePolicy: operation.sourcePolicy || "",
      answerPlaceholder: operation.answerPlaceholder || "",
      editorInstruction: operation.editorInstruction || "",
    },
  },
  null,
  2
)}`;
  }

  private parseFaqEditOutput(text: string): {
    rewrite: Array<{ rowIndex1Based: number; final_answer: string }>;
    qa: Array<{ rowIndex1Based: number; fixed: string }>;
    question_fix: Array<{ rowIndex1Based: number; fixed_question: string }>;
    qa_note: Array<{ rowIndex1Based: number; note: string }>;
    name_inject: Array<{
      rowIndex1Based: number;
      answer_with_name: string;
      question_with_name: string;
      status: string;
    }>;
    missing_faq_to_add: Array<{ category: string; question: string; answer: string }>;
  } {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    const slice = first >= 0 && last > first ? text.slice(first, last + 1) : text;
    const parsed = JSON.parse(slice);

    return {
      rewrite: Array.isArray(parsed.rewrite) ? parsed.rewrite : [],
      qa: Array.isArray(parsed.qa) ? parsed.qa : [],
      question_fix: Array.isArray(parsed.question_fix) ? parsed.question_fix : [],
      qa_note: Array.isArray(parsed.qa_note) ? parsed.qa_note : [],
      name_inject: Array.isArray(parsed.name_inject) ? parsed.name_inject : [],
      missing_faq_to_add: Array.isArray(parsed.missing_faq_to_add) ? parsed.missing_faq_to_add : [],
    };
  }

  private getFaqOperationLabel(type: FaqAiEditOperationType): string {
    switch (type) {
      case "faq_apply_client_comments":
        return "FAQ client comment rewrite";
      case "faq_language_review":
        return "FAQ language review";
      case "faq_question_review":
        return "FAQ question QA";
      case "faq_name_injection":
        return "FAQ property name check";
      case "faq_answer_research":
        return "FAQ answer research";
      case "faq_missing_questions":
        return "FAQ missing question scan";
      default:
        return "FAQ AI edit";
    }
  }

  private getAiAgent(): AIAgent {
    if (!this.aiAgent) {
      this.aiAgent = new AIAgent(new SafetyManager("development"));
    }

    return this.aiAgent;
  }

  private async writeColumnInTab(
    spreadsheetId: string,
    tabName: string,
    columnLetter: string,
    header: string,
    values: string[]
  ): Promise<void> {
    const range = `${this.quoteSheet(tabName)}!${columnLetter}1:${columnLetter}${values.length + 1}`;
    await this.sheets.writeValues(spreadsheetId, range, [[header], ...values.map((value) => [value])]);
  }

  private async writeSparseCellValues(
    spreadsheetId: string,
    tabName: string,
    writes: Array<{ rowNumber: number; columnLetter: string; value: string }>
  ): Promise<void> {
    if (!writes.length) {
      return;
    }

    const writesByColumn = new Map<string, Array<{ rowNumber: number; value: string }>>();

    for (const write of writes) {
      const columnLetter = this.normalizeColumnLetter(write.columnLetter);
      const rows = writesByColumn.get(columnLetter) || [];
      rows.push({
        rowNumber: write.rowNumber,
        value: write.value,
      });
      writesByColumn.set(columnLetter, rows);
    }

    for (const [columnLetter, columnWrites] of writesByColumn.entries()) {
      const sorted = columnWrites.sort((a, b) => a.rowNumber - b.rowNumber);
      let batchStart = sorted[0].rowNumber;
      let previousRow = batchStart;
      let batchValues: string[][] = [[sorted[0].value]];

      for (const item of sorted.slice(1)) {
        if (item.rowNumber === previousRow + 1) {
          batchValues.push([item.value]);
          previousRow = item.rowNumber;
          continue;
        }

        await this.sheets.writeValues(
          spreadsheetId,
          `${this.quoteSheet(tabName)}!${columnLetter}${batchStart}:${columnLetter}${previousRow}`,
          batchValues
        );

        batchStart = item.rowNumber;
        previousRow = item.rowNumber;
        batchValues = [[item.value]];
      }

      await this.sheets.writeValues(
        spreadsheetId,
        `${this.quoteSheet(tabName)}!${columnLetter}${batchStart}:${columnLetter}${previousRow}`,
        batchValues
      );
    }
  }

  private async createBackupTab(spreadsheetId: string, tabName: string): Promise<void> {
    const sourceSheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const backupName = await this.makeUniqueBackupTabName(spreadsheetId, tabName);

    console.log(chalk.gray(`Creating backup tab: ${backupName}`));
    await this.sheets.duplicateSheet(spreadsheetId, sourceSheetId, backupName);
  }

  private shouldCreateBackupBeforeOperation(operation: DesignFormattingOperation): boolean {
    return operation.type !== "duplicate_tab_template" && operation.type !== "restore_backup";
  }

  private async makeUniqueBackupTabName(spreadsheetId: string, tabName: string): Promise<string> {
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 19).replace(/:/g, "-");
    const titles = await this.sheets.getSheetTitles(spreadsheetId);
    return this.getAvailableSheetTitle(titles, `${tabName} Backup ${stamp}`);
  }

  private getAvailableSheetTitle(existingTitles: string[], desiredTitle: string): string {
    const existing = new Set(existingTitles.map((title) => this.normalizeSheetTitle(title)));
    const safeDesired = String(desiredTitle || "Backup").trim().slice(0, 100);

    if (!existing.has(this.normalizeSheetTitle(safeDesired))) {
      return safeDesired;
    }

    for (let index = 2; index <= 99; index++) {
      const suffix = ` ${index}`;
      const candidate = `${safeDesired.slice(0, 100 - suffix.length)}${suffix}`;
      if (!existing.has(this.normalizeSheetTitle(candidate))) {
        return candidate;
      }
    }

    throw new Error(`Could not create a unique backup tab name for "${desiredTitle}".`);
  }

  private async restoreLatestBackup(
    spreadsheetId: string,
    fileName: string,
    tabName: string,
    operation: RestoreBackupOperation,
    dryRun: boolean
  ): Promise<number> {
    const tabs = await this.sheets.getSheetTitles(spreadsheetId);
    const backupName = this.findBackupTabName(tabs, tabName, operation.backupTabName);
    const currentExists = tabs.some((title) => this.sameSheetTitle(title, tabName));

    this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Restore latest backup", [
      `Backup tab "${backupName}" will become "${tabName}"`,
      currentExists
        ? `Current tab "${tabName}" will be removed before restore`
        : `Current tab "${tabName}" does not exist and will be recreated from backup`,
      "Use this only when you want to roll back the last applied edit.",
    ]);

    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would restore "${tabName}" from backup "${backupName}"`));
      return 0;
    }

    console.log(chalk.yellow(`Restoring "${tabName}" from backup tab "${backupName}"`));
    if (currentExists) {
      await this.sheets.deleteSheetByTitle(spreadsheetId, tabName);
    }
    await this.sheets.renameSheet(spreadsheetId, backupName, tabName);
    return 1;
  }

  private findBackupTabName(
    tabs: string[],
    tabName: string,
    requestedBackupName?: string
  ): string {
    const requested = String(requestedBackupName || "").trim();
    if (requested) {
      const match = tabs.find((title) => this.sameSheetTitle(title, requested));
      if (!match) throw new Error(`Backup tab "${requested}" was not found.`);
      return match;
    }

    const prefix = `${tabName} Backup`;
    const backups = tabs.filter((title) =>
      this.normalizeSheetTitle(title).startsWith(this.normalizeSheetTitle(prefix))
    );
    if (backups.length === 0) {
      throw new Error(`No backup tab was found for "${tabName}".`);
    }

    return backups.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1)!;
  }

  private sameSheetTitle(a: string, b: string): boolean {
    return this.normalizeSheetTitle(a) === this.normalizeSheetTitle(b);
  }

  private normalizeSheetTitle(value: string): string {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private async emitSheetTabs(args: {
    spreadsheetId: string;
    fileName: string;
    selectedTabName?: string;
  }): Promise<void> {
    const tabs = await this.sheets.getSheetTitles(args.spreadsheetId);
    const selectedTabName = tabs.includes(String(args.selectedTabName || ""))
      ? args.selectedTabName
      : tabs[0];

    printPreviewEvent({
      kind: "sheet_tabs",
      fileName: args.fileName,
      spreadsheetId: args.spreadsheetId,
      tabs,
      selectedTabName,
    });
  }

  private async emitLiveSheetPreview(args: {
    spreadsheetId: string;
    fileName: string;
    tabName: string;
    range: RangeConfig;
    maxRows?: number;
    maxColumns?: number;
  }): Promise<void> {
    const valueRange = this.resolvePreviewValueRange(args.range, args.maxRows, args.maxColumns);
    const rangeA1 = this.buildA1Range(args.tabName, valueRange);

    console.log(chalk.gray(`Reading preview range: ${rangeA1}`));

    const rows = await this.sheets.readValues(args.spreadsheetId, rangeA1);
    const width =
      this.columnLetterToIndex(valueRange.endCol) -
      this.columnLetterToIndex(valueRange.startCol) +
      1;

    const previewRows = rows.map((row) => {
      return Array.from({ length: width }, (_, colOffset) => String(row?.[colOffset] ?? ""));
    });

    this.emitSheetPreviewIfNeeded({
      spreadsheetId: args.spreadsheetId,
      fileName: args.fileName,
      tabName: args.tabName,
      rangeA1,
      valueRange,
      originalRows: rows,
      nextRows: previewRows,
      changedCells: new Map(),
      changedCellsCount: 0,
      badgeLabel: `${previewRows.length} שורות נטענו`,
    });
  }

  private emitSheetPreviewIfNeeded(args: {
    spreadsheetId: string;
    fileName: string;
    tabName: string;
    rangeA1: string;
    valueRange: ValueRange;
    originalRows: any[][];
    nextRows: string[][];
    changedCells: Map<string, ChangedCellInfo>;
    changedCellsCount: number;
    badgeLabel?: string;
  }): void {
    if (!this.canEmitPreviewForSpreadsheet(args.spreadsheetId)) {
      return;
    }

    if (this.previewEmitted) {
      return;
    }

    const maxPreviewRows = 20;
    const maxPreviewCols = 10;

    const startColIndex = this.columnLetterToIndex(args.valueRange.startCol);
    const width =
      this.columnLetterToIndex(args.valueRange.endCol) -
      this.columnLetterToIndex(args.valueRange.startCol) +
      1;

    const visibleWidth = Math.min(width, maxPreviewCols);
    const columns = Array.from({ length: visibleWidth }, (_, offset) => {
      return this.columnIndexToLetter(startColIndex + offset);
    });

    const visibleRows = args.nextRows.slice(0, maxPreviewRows).map((row, rowIndex) => {
      const rowNumber = args.valueRange.startRow + rowIndex;

      const cells = Array.from({ length: visibleWidth }, (_, colOffset) => {
        const column = this.columnIndexToLetter(startColIndex + colOffset);
        const key = `${rowNumber}:${column}`;
        const changedInfo = args.changedCells.get(key);

        return {
          column,
          value: String(row?.[colOffset] ?? ""),
          changed: Boolean(changedInfo),
          before: changedInfo?.before,
        };
      });

      return {
        rowNumber,
        cells,
      };
    });

    printPreviewEvent({
      kind: "sheet_preview",
      fileName: args.fileName,
      spreadsheetId: args.spreadsheetId,
      tabName: args.tabName,
      rangeA1: args.rangeA1,
      columns,
      rows: visibleRows,
      changedCellsCount: args.changedCellsCount,
      badgeLabel: args.badgeLabel,
    });

    this.previewEmitted = true;
  }

  private emitPreviewPlanIfNeeded(
    spreadsheetId: string,
    fileName: string,
    tabName: string | undefined,
    title: string,
    details: string[]
  ): void {
    if (!this.canEmitPreviewForSpreadsheet(spreadsheetId)) {
      return;
    }

    if (this.previewEmitted) {
      return;
    }

    printPreviewEvent({
      kind: "plan",
      fileName,
      spreadsheetId,
      tabName,
      title,
      details,
    });

    this.previewEmitted = true;
  }

  private canEmitPreviewForSpreadsheet(spreadsheetId: string): boolean {
    if (!this.previewSpreadsheetId) {
      this.previewSpreadsheetId = spreadsheetId;
      return true;
    }

    return this.previewSpreadsheetId === spreadsheetId;
  }

  private resolveValueRange(range: RangeConfig): ValueRange {
    const { startCol, endCol } = this.resolveColumnBounds(range);
    const { startRow, endRow } = this.resolveRowBounds(range);

    return {
      startCol,
      endCol,
      startRow,
      endRow,
    };
  }

  private resolvePreviewValueRange(range: RangeConfig, maxRowsRaw?: number, maxColumnsRaw?: number): ValueRange {
    const maxRows = Math.max(1, Math.min(Number(maxRowsRaw || 50), 200));
    const maxColumns = Math.max(1, Math.min(Number(maxColumnsRaw || 16), 40));
    const { startCol, endCol } = this.resolveColumnBounds(range);
    const { startRow, endRow } = this.resolveRowBounds(range);
    const startColIndex = this.columnLetterToIndex(startCol);
    const requestedEndColIndex = this.columnLetterToIndex(endCol);
    const cappedEndColIndex = Math.min(requestedEndColIndex, startColIndex + maxColumns - 1);
    const cappedEndRow = endRow ? Math.min(endRow, startRow + maxRows - 1) : startRow + maxRows - 1;

    return {
      startCol,
      endCol: this.columnIndexToLetter(cappedEndColIndex),
      startRow,
      endRow: cappedEndRow,
    };
  }

  private resolveGridRange(range: RangeConfig): GridRange {
    const { startCol, endCol } = this.resolveColumnBounds(range);
    const { startRow, endRow } = this.resolveRowBounds(range);

    return {
      startColumnIndex: this.columnLetterToIndex(startCol),
      endColumnIndex: this.columnLetterToIndex(endCol) + 1,
      startRowIndex: startRow - 1,
      endRowIndex: endRow,
    };
  }

  private resolveColumnBounds(range: RangeConfig): { startCol: string; endCol: string } {
    if (!range.columnScope || range.columnScope === "sheet") {
      return {
        startCol: "A",
        endCol: "ZZ",
      };
    }

    const raw = String(range.columns || "A:ZZ").trim().toUpperCase();

    if (raw.includes(":")) {
      const [start, end] = raw.split(":").map((item) => this.normalizeColumnLetter(item));

      return {
        startCol: start,
        endCol: end,
      };
    }

    const col = this.normalizeColumnLetter(raw);

    return {
      startCol: col,
      endCol: col,
    };
  }

  private resolveRowBounds(range: RangeConfig): { startRow: number; endRow?: number } {
    if (!range.rowScope || range.rowScope === "all") {
      return {
        startRow: 1,
        endRow: undefined,
      };
    }

    const raw = String(range.rows || "1:").trim();

    if (raw.includes(":")) {
      const [startRaw, endRaw] = raw.split(":");
      const startRow = Math.max(1, Number(startRaw || 1));
      const endRow = endRaw ? Math.max(startRow, Number(endRaw)) : undefined;

      return {
        startRow,
        endRow,
      };
    }

    const row = Math.max(1, Number(raw || 2));

    return {
      startRow: row,
      endRow: row,
    };
  }

  private buildA1Range(tabName: string, valueRange: ValueRange): string {
    const endRowPart = valueRange.endRow ? String(valueRange.endRow) : "";

    return `${this.quoteSheet(tabName)}!${valueRange.startCol}${valueRange.startRow}:${valueRange.endCol}${endRowPart}`;
  }

  private borderStyle() {
    return {
      style: "SOLID",
      width: 1,
      color: {
        red: 0.82,
        green: 0.86,
        blue: 0.9,
      },
    };
  }

  private async batchUpdate(spreadsheetId: string, requests: any[]): Promise<void> {
    if (!requests.length) {
      return;
    }

    const client = (this.sheets as any).sheets;

    if (!client?.spreadsheets?.batchUpdate) {
      throw new Error("SheetsService internal client is not accessible for batchUpdate");
    }

    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests,
      },
    });
  }

  private extractFolderId(input: string): string {
    const match = input.match(/\/folders\/([A-Za-z0-9_-]+)/);

    return (match?.[1] || input).trim();
  }

  private extractSpreadsheetId(input: string): string {
    const match = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);

    return (match?.[1] || input).trim();
  }

  private normalizeColumnSelection(input: string): string[] {
    const raw = String(input || "").trim().toUpperCase().replace(/\s+/g, "");

    if (!raw) {
      throw new Error("Missing column selection");
    }

    const parts = raw.includes(",")
      ? raw.split(",").filter(Boolean)
      : [raw];
    const columns: string[] = [];

    for (const part of parts) {
      const rangeMatch = part.match(/^([A-Z]+)[:\-–—]([A-Z]+)$/);

      if (rangeMatch?.[1] && rangeMatch?.[2]) {
        columns.push(...this.expandColumnRange(rangeMatch[1], rangeMatch[2]));
        continue;
      }

      columns.push(this.normalizeColumnLetter(part));
    }

    return Array.from(new Set(columns));
  }

  private expandColumnRange(startColumn: string, endColumn: string): string[] {
    const start = this.columnLetterToIndex(this.normalizeColumnLetter(startColumn));
    const end = this.columnLetterToIndex(this.normalizeColumnLetter(endColumn));

    if (end < start) {
      throw new Error(`Invalid column range: ${startColumn}-${endColumn}`);
    }

    return Array.from({ length: end - start + 1 }, (_, offset) => this.columnIndexToLetter(start + offset));
  }

  private getDefaultOutputColumns(sourceColumns: string[]): string[] {
    const lastSourceIndex = Math.max(...sourceColumns.map((column) => this.columnLetterToIndex(column)));
    return sourceColumns.map((_, offset) => this.columnIndexToLetter(lastSourceIndex + offset + 1));
  }

  private formatColumnSelection(columns: string[]): string {
    if (columns.length === 1) {
      return columns[0];
    }

    return `${columns[0]}:${columns[columns.length - 1]}`;
  }

  private normalizeColumnLetter(input: string): string {
    const col = String(input || "").trim().toUpperCase();

    if (!/^[A-Z]+$/.test(col)) {
      throw new Error(`Invalid column letter: ${input}`);
    }

    return col;
  }

  private normalizeHtmlTag(input: string): string {
    const tag = String(input || "p").trim().toLowerCase();

    if (!/^[a-z][a-z0-9-]*$/.test(tag)) {
      throw new Error(`Invalid HTML tag: ${input}`);
    }

    return tag;
  }

  private quoteSheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  private columnLetterToIndex(letter: string): number {
    let index = 0;

    for (const char of letter) {
      index = index * 26 + (char.charCodeAt(0) - 64);
    }

    return index - 1;
  }

  private columnIndexToLetter(index: number): string {
    let current = index + 1;
    let letter = "";

    while (current > 0) {
      const remainder = (current - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      current = Math.floor((current - 1) / 26);
    }

    return letter;
  }

  private printStats(stats: RunStats): void {
    console.log(`FILES_PROCESSED=${stats.filesProcessed}`);
    console.log(`CELLS_CHANGED=${stats.cellsChanged}`);
    console.log(`ERRORS=${stats.errors}`);
  }
}
