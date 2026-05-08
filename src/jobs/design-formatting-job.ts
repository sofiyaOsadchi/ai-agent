// src/jobs/design-formatting-job.ts
// Code in English. Comments can be Hebrew.

import chalk from "chalk";
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

type DesignFormattingPayload = {
  sourceType: SourceType;
  targetId: string;
  tabName?: string;
  maxFiles?: number;
  dryRun?: boolean;
  createBackup?: boolean;
  range?: RangeConfig;
  operation: DesignFormattingOperation;
};

type DesignFormattingOperation =
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
  | AddColumnOperation
  | RenameColumnOperation
  | ReorderColumnsOperation
  | DuplicateTabTemplateOperation;

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
  dryRun: boolean;
};

type ChangedCellInfo = {
  before: string;
  after: string;
};

export class DesignFormattingJob {
  private previewEmitted = false;
  private previewSpreadsheetId: string | null = null;

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
    console.log(chalk.gray(`Source type: ${payload.sourceType}`));
    console.log(chalk.gray(`Operation: ${payload.operation.type}`));
    console.log(chalk.gray(`Tab: ${tabName}`));
    console.log(chalk.gray(`Dry run: ${dryRun ? "YES" : "NO"}`));
    console.log(chalk.gray(`Targets found: ${targets.length}`));

    for (const target of targets) {
      try {
        console.log(chalk.cyan(`\n➡ Processing: ${target.name}`));

        if (payload.createBackup && !dryRun && this.operationUsesSourceTab(payload.operation)) {
          await this.createBackupTab(target.id, tabName);
        }

        const changed = await this.applyOperation({
          spreadsheetId: target.id,
          fileName: target.name,
          tabName,
          range: payload.range ?? {},
          operation: payload.operation,
          dryRun,
        });

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

    if (!payload.operation?.type) {
      throw new Error("Missing operation type");
    }

    if (payload.sourceType === "folder" && payload.operation.type === "extract_comments") {
      throw new Error("extract_comments currently supports only a single Google Sheet, not folders.");
    }

    if (payload.operation.type === "text_replace") {
      if (!payload.operation.find) {
        throw new Error("Text replace requires a find value");
      }

      if (!payload.operation.allowEmptyReplace && payload.operation.replaceWith === "") {
        throw new Error("Empty replace value is blocked by operation settings");
      }
    }

    if (payload.operation.type === "extract_comments") {
      if (!payload.operation.sourceColumn?.trim()) {
        throw new Error("Extract comments requires a source column");
      }

      if (!payload.operation.outputColumn?.trim()) {
        throw new Error("Extract comments requires an output column");
      }
    }
  }

  private async resolveTargets(payload: DesignFormattingPayload): Promise<TargetSheet[]> {
    const maxFiles = Math.max(1, Math.min(Number(payload.maxFiles || 30), 200));

    if (payload.sourceType === "sheet") {
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

  private async applyOperation(args: ApplyOperationArgs): Promise<number> {
    const { spreadsheetId, fileName, tabName, range, operation, dryRun } = args;

    if (operation.type === "extract_comments") {
      const sourceColumn = this.normalizeColumnLetter(operation.sourceColumn || "B");
      const outputColumn = this.normalizeColumnLetter(operation.outputColumn || "C");
      const startRow = Number(operation.startRow || 2);
      const outputHeader = operation.outputHeader || "Comment";

      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Extract sheet comments", [
        `Comments will be read from column ${sourceColumn}`,
        `Comment text will be written to column ${outputColumn}`,
        `Starting from row ${startRow}`,
        operation.includeReplies === false ? "Replies will be skipped" : "Replies will be included",
      ]);

      if (dryRun) {
        console.log(
          chalk.yellow(
            `[DRY RUN] Would extract comments from ${tabName}!${sourceColumn} and write them to ${outputColumn}`
          )
        );

        return 1;
      }

      const commentsJob = new ExtractSheetCommentsJob(this.sheets);

      await commentsJob.run({
        spreadsheetId,
        sourceTabName: tabName,
        sourceColumn,
        outputColumn,
        startRow,
        outputHeader,
        includeReplies: operation.includeReplies !== false,
      });

      return 1;
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

      return this.addColumn(spreadsheetId, tabName, operation, dryRun);
    }

    if (operation.type === "rename_column") {
      this.emitPreviewPlanIfNeeded(spreadsheetId, fileName, tabName, "Rename column header", [
        `Column ${operation.columnLetter} header will be changed to "${operation.header}"`,
        "Only the first row will be changed",
      ]);

      return this.renameColumn(spreadsheetId, tabName, operation, dryRun);
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

    return 0;
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
    dryRun: boolean
  ): Promise<number> {
    const col = this.normalizeColumnLetter(operation.columnLetter);
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
    dryRun: boolean
  ): Promise<number> {
    const col = this.normalizeColumnLetter(operation.columnLetter);
    const range = `${this.quoteSheet(tabName)}!${col}1:${col}1`;

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

  private async createBackupTab(spreadsheetId: string, tabName: string): Promise<void> {
    const sourceSheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, tabName);
    const backupName = `${tabName} Backup ${new Date().toISOString().slice(0, 10)}`;

    console.log(chalk.gray(`Creating backup tab: ${backupName}`));
    await this.sheets.duplicateSheet(spreadsheetId, sourceSheetId, backupName);
  }

  private operationUsesSourceTab(operation: DesignFormattingOperation): boolean {
    return operation.type !== "duplicate_tab_template";
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
    if (range.columnScope === "sheet") {
      return {
        startCol: "A",
        endCol: "ZZ",
      };
    }

    const raw = String(range.columns || "C").trim().toUpperCase();

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
    if (range.rowScope === "all") {
      return {
        startRow: 1,
        endRow: undefined,
      };
    }

    const raw = String(range.rows || "2:").trim();

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
