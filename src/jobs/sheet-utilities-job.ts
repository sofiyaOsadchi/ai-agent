// src/jobs/sheet-utilities-job.ts
// Code in English. Comments can be Hebrew if needed.

import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type SheetUtilitiesOperationType =
  | "lookup_copy"
  | "folder_to_master_injection"
  | "cross_check"
  | "coverage_report"
  | "copy_columns"
  | "build_work_file";

export type RunStats = {
  filesProcessed: number;
  rowsRead: number;
  rowsMatched: number;
  rowsUpdated: number;
  rowsSkipped: number;
  rowsReported: number;
  errors: number;
};

type BaseOperation = {
  type: SheetUtilitiesOperationType;
  headerRow?: number;
  overwriteExisting?: boolean;
  trimValues?: boolean;
  caseSensitive?: boolean;
};

export type LookupCopyOperation = BaseOperation & {
  type: "lookup_copy";
  sourceSpreadsheetId: string;
  sourceTab: string;
  sourceKeyColumn: string;
  sourceValueColumn: string;
  targetSpreadsheetId: string;
  targetTab: string;
  targetKeyColumn: string;
  targetWriteColumn: string;
};

export type FolderToMasterInjectionOperation = BaseOperation & {
  type: "folder_to_master_injection";
  sourceFolderId: string;
  sourceTabName: string;
  sourceKeyColumns: string[];
  sourceValueColumns: string[];
  masterSpreadsheetId: string;
  masterTab: string;
  masterKeyColumns: string[];
  masterWriteColumns: string[];
  matchStrategy?: "exact" | "normalized_text" | "hotel_question" | "translatable_id";
  writeStatusColumn?: boolean;
  statusColumn?: string;
};

export type CrossCheckOperation = BaseOperation & {
  type: "cross_check";
  sourceType: "sheet" | "folder";
  sourceSpreadsheetId?: string;
  sourceFolderId?: string;
  sourceTab: string;
  masterSpreadsheetId: string;
  masterTab: string;
  keyColumns: string[];
  comparisonColumns?: string[];
  outputReportTabName?: string;
  reportMode?: "missing_only" | "mismatches_only" | "full_audit";
};

export type CoverageReportOperation = BaseOperation & {
  type: "coverage_report";
  sourceFolderId: string;
  sourceTabName: string;
  sourceKeyColumns: string[];
  masterSpreadsheetId: string;
  masterTab: string;
  masterKeyColumns: string[];
  outputReportTabName?: string;
};

export type CopyColumnsOperation = BaseOperation & {
  type: "copy_columns";
  copyMode: "by_row_index" | "by_key_match";
  sourceSpreadsheetId: string;
  sourceTab: string;
  sourceColumns: string[];
  sourceKeyColumn?: string;
  targetSpreadsheetId: string;
  targetTab: string;
  targetColumns: string[];
  targetKeyColumn?: string;
};

export type BuildWorkFileOperation = BaseOperation & {
  type: "build_work_file";
  sourceFolderId: string;
  sourceTab: string;
  columnsToCollect: string[];
  outputSpreadsheetId: string;
  outputTabName: string;
  includeSourceFileName?: boolean;
};

export type SheetUtilitiesOperation =
  | LookupCopyOperation
  | FolderToMasterInjectionOperation
  | CrossCheckOperation
  | CoverageReportOperation
  | CopyColumnsOperation
  | BuildWorkFileOperation;

export type SheetUtilitiesPayload = {
  mode?: "sheet-utilities";
  operation: SheetUtilitiesOperation;
  dryRun?: boolean;
  createBackup?: boolean;
};

type SheetData = {
  spreadsheetId: string;
  spreadsheetName?: string;
  tabName: string;
  rows: string[][];
  headers: string[];
  headerRow: number;
};

type KeyIndex = {
  map: Map<string, IndexedRow[]>;
  duplicateKeys: Set<string>;
  emptyKeyRows: number;
};

type IndexedRow = {
  row: string[];
  rowIndex0: number;
  rowNumber: number;
  key: string;
  spreadsheetId?: string;
  spreadsheetName?: string;
};

type PlannedWrite = {
  range: string;
  values: string[][];
  rowNumber: number;
  key: string;
  currentValue: string;
  newValue: string;
  reason: string;
};

export class SheetUtilitiesJob {
  constructor(private sheets: SheetsService) {}

  async run(payload: SheetUtilitiesPayload): Promise<RunStats> {
    const stats = this.createStats();

    if (!payload?.operation?.type) {
      throw new Error("sheet-utilities: Missing operation.type");
    }

    const dryRun = payload.dryRun ?? true;

    console.log(chalk.blue("🚀 Starting Sheet Utilities job"));
    console.log(chalk.gray(`Operation: ${payload.operation.type}`));
    console.log(chalk.gray(`Dry Run: ${dryRun}`));
    console.log(chalk.gray(`Create Backup: ${payload.createBackup ?? false}`));

    if (payload.createBackup) {
      console.log(chalk.yellow("⚠️ Backup was requested, but backup creation is not implemented yet in this job."));
    }

    switch (payload.operation.type) {
      case "lookup_copy":
        return this.runLookupCopy(payload.operation, dryRun, stats);

      case "folder_to_master_injection":
        return this.runFolderToMasterInjection(payload.operation, dryRun, stats);

      case "cross_check":
        return this.runCrossCheck(payload.operation, dryRun, stats);

      case "coverage_report":
        return this.runCoverageReport(payload.operation, dryRun, stats);

      case "copy_columns":
        return this.runCopyColumns(payload.operation, dryRun, stats);

      case "build_work_file":
        return this.runBuildWorkFile(payload.operation, dryRun, stats);

      default:
        throw new Error(`Unsupported operation: ${(payload.operation as any).type}`);
    }
  }

  private async runLookupCopy(
    op: LookupCopyOperation,
    dryRun: boolean,
    stats: RunStats
  ): Promise<RunStats> {
    this.assertRequired(op.sourceSpreadsheetId, "sourceSpreadsheetId");
    this.assertRequired(op.targetSpreadsheetId, "targetSpreadsheetId");
    this.assertRequired(op.sourceKeyColumn, "sourceKeyColumn");
    this.assertRequired(op.sourceValueColumn, "sourceValueColumn");
    this.assertRequired(op.targetKeyColumn, "targetKeyColumn");
    this.assertRequired(op.targetWriteColumn, "targetWriteColumn");

    const headerRow = this.headerRow(op);
    const source = await this.readSheet(op.sourceSpreadsheetId, op.sourceTab, headerRow);
    const target = await this.readSheet(op.targetSpreadsheetId, op.targetTab, headerRow);

    stats.filesProcessed = source.spreadsheetId === target.spreadsheetId ? 1 : 2;
    stats.rowsRead = source.rows.length + target.rows.length;

    const sourceKeyIndex = this.resolveColumnIndex(op.sourceKeyColumn, source.headers);
    const sourceValueIndex = this.resolveColumnIndex(op.sourceValueColumn, source.headers);
    const targetKeyIndex = this.resolveColumnIndex(op.targetKeyColumn, target.headers);
    const targetWriteIndex = this.resolveColumnIndex(op.targetWriteColumn, target.headers);

    const sourceIndex = this.buildKeyIndex(source, [sourceKeyIndex], op);
    this.logKeyIndex("Source", sourceIndex);

    const writes: PlannedWrite[] = [];
    let missingInSource = 0;
    let existingValueSkips = 0;
    let emptyValueSkips = 0;

    for (let i = headerRow; i < target.rows.length; i++) {
      const targetRow = target.rows[i] ?? [];
      const key = this.buildKeyFromRow(targetRow, [targetKeyIndex], op);

      if (!key) {
        stats.rowsSkipped++;
        continue;
      }

      const sourceMatches = sourceIndex.map.get(key) ?? [];

      if (!sourceMatches.length) {
        missingInSource++;
        stats.rowsSkipped++;
        continue;
      }

      stats.rowsMatched++;

      const firstSource = sourceMatches[0];
      const newValue = this.cell(firstSource.row, sourceValueIndex, op.trimValues);
      const currentValue = this.cell(targetRow, targetWriteIndex, false);

      if (!newValue) {
        emptyValueSkips++;
        stats.rowsSkipped++;
        continue;
      }

      if (currentValue && !op.overwriteExisting) {
        existingValueSkips++;
        stats.rowsSkipped++;
        continue;
      }

      if (currentValue === newValue) {
        stats.rowsSkipped++;
        continue;
      }

      const targetCell = `${this.indexToColumnLetter(targetWriteIndex)}${i + 1}`;

      writes.push({
        range: `${this.quoteA1Sheet(target.tabName)}!${targetCell}`,
        values: [[newValue]],
        rowNumber: i + 1,
        key,
        currentValue,
        newValue,
        reason: `matched source row ${firstSource.rowNumber}`,
      });
    }

    stats.rowsUpdated = writes.length;

    console.log(chalk.cyan("📊 Lookup Copy Summary"));
    console.log(chalk.gray(`Rows matched: ${stats.rowsMatched}`));
    console.log(chalk.gray(`Rows planned for update: ${writes.length}`));
    console.log(chalk.gray(`Rows skipped: ${stats.rowsSkipped}`));
    console.log(chalk.gray(`Missing in source: ${missingInSource}`));
    console.log(chalk.gray(`Existing values skipped: ${existingValueSkips}`));
    console.log(chalk.gray(`Empty source values skipped: ${emptyValueSkips}`));

    this.printWritePreview(writes);

    if (!dryRun) {
      await this.applyWrites(target.spreadsheetId, writes);
    } else {
      console.log(chalk.yellow("🧪 Dry run enabled. No values were written."));
    }

    this.printFinalStats(stats);
    return stats;
  }

  private async runCopyColumns(
    op: CopyColumnsOperation,
    dryRun: boolean,
    stats: RunStats
  ): Promise<RunStats> {
    this.assertRequired(op.sourceSpreadsheetId, "sourceSpreadsheetId");
    this.assertRequired(op.targetSpreadsheetId, "targetSpreadsheetId");

    if (!op.sourceColumns?.length) throw new Error("sourceColumns is required");
    if (!op.targetColumns?.length) throw new Error("targetColumns is required");
    if (op.sourceColumns.length !== op.targetColumns.length) {
      throw new Error("sourceColumns and targetColumns must have the same length");
    }

    const headerRow = this.headerRow(op);
    const source = await this.readSheet(op.sourceSpreadsheetId, op.sourceTab, headerRow);
    const target = await this.readSheet(op.targetSpreadsheetId, op.targetTab, headerRow);

    stats.filesProcessed = source.spreadsheetId === target.spreadsheetId ? 1 : 2;
    stats.rowsRead = source.rows.length + target.rows.length;

    const sourceColIndexes = op.sourceColumns.map((col) => this.resolveColumnIndex(col, source.headers));
    const targetColIndexes = op.targetColumns.map((col) => this.resolveColumnIndex(col, target.headers));

    const writes: PlannedWrite[] = [];

    if (op.copyMode === "by_row_index") {
      const maxRows = Math.min(source.rows.length, target.rows.length);

      for (let i = headerRow; i < maxRows; i++) {
        sourceColIndexes.forEach((sourceColIndex, idx) => {
          const targetColIndex = targetColIndexes[idx];
          const newValue = this.cell(source.rows[i], sourceColIndex, op.trimValues);
          const currentValue = this.cell(target.rows[i], targetColIndex, false);

          if (!newValue) {
            stats.rowsSkipped++;
            return;
          }

          if (currentValue && !op.overwriteExisting) {
            stats.rowsSkipped++;
            return;
          }

          if (currentValue === newValue) {
            stats.rowsSkipped++;
            return;
          }

          writes.push({
            range: `${this.quoteA1Sheet(target.tabName)}!${this.indexToColumnLetter(targetColIndex)}${i + 1}`,
            values: [[newValue]],
            rowNumber: i + 1,
            key: String(i + 1),
            currentValue,
            newValue,
            reason: "row index copy",
          });
        });
      }

      stats.rowsMatched = Math.max(0, maxRows - headerRow);
    } else {
      this.assertRequired(op.sourceKeyColumn, "sourceKeyColumn");
      this.assertRequired(op.targetKeyColumn, "targetKeyColumn");

      const sourceKeyIndex = this.resolveColumnIndex(op.sourceKeyColumn!, source.headers);
      const targetKeyIndex = this.resolveColumnIndex(op.targetKeyColumn!, target.headers);
      const sourceIndex = this.buildKeyIndex(source, [sourceKeyIndex], op);

      this.logKeyIndex("Source", sourceIndex);

      for (let i = headerRow; i < target.rows.length; i++) {
        const targetRow = target.rows[i] ?? [];
        const key = this.buildKeyFromRow(targetRow, [targetKeyIndex], op);

        if (!key) {
          stats.rowsSkipped++;
          continue;
        }

        const sourceMatches = sourceIndex.map.get(key) ?? [];

        if (!sourceMatches.length) {
          stats.rowsSkipped++;
          continue;
        }

        stats.rowsMatched++;

        const sourceRow = sourceMatches[0].row;

        sourceColIndexes.forEach((sourceColIndex, idx) => {
          const targetColIndex = targetColIndexes[idx];
          const newValue = this.cell(sourceRow, sourceColIndex, op.trimValues);
          const currentValue = this.cell(targetRow, targetColIndex, false);

          if (!newValue) {
            stats.rowsSkipped++;
            return;
          }

          if (currentValue && !op.overwriteExisting) {
            stats.rowsSkipped++;
            return;
          }

          if (currentValue === newValue) {
            stats.rowsSkipped++;
            return;
          }

          writes.push({
            range: `${this.quoteA1Sheet(target.tabName)}!${this.indexToColumnLetter(targetColIndex)}${i + 1}`,
            values: [[newValue]],
            rowNumber: i + 1,
            key,
            currentValue,
            newValue,
            reason: "key match copy",
          });
        });
      }
    }

    stats.rowsUpdated = writes.length;

    console.log(chalk.cyan("📊 Copy Columns Summary"));
    console.log(chalk.gray(`Rows matched: ${stats.rowsMatched}`));
    console.log(chalk.gray(`Cells planned for update: ${writes.length}`));
    console.log(chalk.gray(`Skipped checks: ${stats.rowsSkipped}`));

    this.printWritePreview(writes);

    if (!dryRun) {
      await this.applyWrites(target.spreadsheetId, writes);
    } else {
      console.log(chalk.yellow("🧪 Dry run enabled. No values were written."));
    }

    this.printFinalStats(stats);
    return stats;
  }

  private async runFolderToMasterInjection(
    op: FolderToMasterInjectionOperation,
    dryRun: boolean,
    stats: RunStats
  ): Promise<RunStats> {
    this.assertRequired(op.sourceFolderId, "sourceFolderId");
    this.assertRequired(op.masterSpreadsheetId, "masterSpreadsheetId");

    if (!op.sourceKeyColumns?.length) throw new Error("sourceKeyColumns is required");
    if (!op.sourceValueColumns?.length) throw new Error("sourceValueColumns is required");
    if (!op.masterKeyColumns?.length) throw new Error("masterKeyColumns is required");
    if (!op.masterWriteColumns?.length) throw new Error("masterWriteColumns is required");
    if (op.sourceValueColumns.length !== op.masterWriteColumns.length) {
      throw new Error("sourceValueColumns and masterWriteColumns must have the same length");
    }

    const headerRow = this.headerRow(op);
    const master = await this.readSheet(op.masterSpreadsheetId, op.masterTab, headerRow);
    const folderId = this.parseFolderId(op.sourceFolderId);
    const files = await this.sheets.listSpreadsheetsInFolderWithNames(folderId);

    stats.filesProcessed = files.length + 1;
    stats.rowsRead += master.rows.length;

    console.log(chalk.cyan(`📁 Source files found: ${files.length}`));

    const sourceLookup = new Map<string, IndexedRow>();
    const duplicateSourceKeys = new Set<string>();

    for (const file of files) {
      try {
        const source = await this.readSheet(file.id, op.sourceTabName, headerRow, file.name);
        stats.rowsRead += source.rows.length;

        const sourceKeyIndexes = op.sourceKeyColumns.map((col) => this.resolveColumnIndex(col, source.headers));
        const sourceIndex = this.buildKeyIndex(source, sourceKeyIndexes, op);

        for (const [key, rows] of sourceIndex.map.entries()) {
          if (sourceLookup.has(key)) {
            duplicateSourceKeys.add(key);
            continue;
          }

          if (rows[0]) {
            sourceLookup.set(key, rows[0]);
          }
        }
      } catch (error) {
        stats.errors++;
        console.log(chalk.red(`❌ Failed reading source file "${file.name}": ${this.errorMessage(error)}`));
      }
    }

    if (duplicateSourceKeys.size) {
      console.log(chalk.yellow(`⚠️ Duplicate source keys across folder: ${duplicateSourceKeys.size}`));
    }

    const masterKeyIndexes = op.masterKeyColumns.map((col) => this.resolveColumnIndex(col, master.headers));
    const masterWriteIndexes = op.masterWriteColumns.map((col) => this.resolveColumnIndex(col, master.headers));
    const statusIndex =
      op.writeStatusColumn && op.statusColumn
        ? this.resolveColumnIndex(op.statusColumn, master.headers)
        : null;

    const sourceValueIndexesByFileCache = new Map<string, number[]>();
    const writes: PlannedWrite[] = [];

    for (let i = headerRow; i < master.rows.length; i++) {
      const masterRow = master.rows[i] ?? [];
      const key = this.buildKeyFromRow(masterRow, masterKeyIndexes, op);

      if (!key) {
        stats.rowsSkipped++;
        continue;
      }

      const sourceMatch = sourceLookup.get(key);

      if (!sourceMatch) {
        stats.rowsSkipped++;
        if (statusIndex != null) {
          writes.push(this.makeSingleWrite(master, statusIndex, i, key, this.cell(masterRow, statusIndex), "missing in source", "status"));
        }
        continue;
      }

      stats.rowsMatched++;

      const sourceFileKey = sourceMatch.spreadsheetId || "";
      let sourceValueIndexes = sourceValueIndexesByFileCache.get(sourceFileKey);

      if (!sourceValueIndexes) {
        const source = await this.readSheet(
          sourceMatch.spreadsheetId || "",
          op.sourceTabName,
          headerRow,
          sourceMatch.spreadsheetName
        );

        sourceValueIndexes = op.sourceValueColumns.map((col) => this.resolveColumnIndex(col, source.headers));
        sourceValueIndexesByFileCache.set(sourceFileKey, sourceValueIndexes);
      }

      sourceValueIndexes.forEach((sourceValueIndex, idx) => {
        const targetColIndex = masterWriteIndexes[idx];
        const newValue = this.cell(sourceMatch.row, sourceValueIndex, op.trimValues);
        const currentValue = this.cell(masterRow, targetColIndex, false);

        if (!newValue) {
          stats.rowsSkipped++;
          return;
        }

        if (currentValue && !op.overwriteExisting) {
          stats.rowsSkipped++;
          return;
        }

        if (currentValue === newValue) {
          stats.rowsSkipped++;
          return;
        }

        writes.push(this.makeSingleWrite(master, targetColIndex, i, key, currentValue, newValue, "folder injection"));
      });

      if (statusIndex != null) {
        const currentStatus = this.cell(masterRow, statusIndex, false);
        writes.push(this.makeSingleWrite(master, statusIndex, i, key, currentStatus, "matched", "status"));
      }
    }

    stats.rowsUpdated = writes.length;

    console.log(chalk.cyan("📊 Folder to Master Injection Summary"));
    console.log(chalk.gray(`Source keys collected: ${sourceLookup.size}`));
    console.log(chalk.gray(`Rows matched: ${stats.rowsMatched}`));
    console.log(chalk.gray(`Cells planned for update: ${writes.length}`));
    console.log(chalk.gray(`Rows skipped: ${stats.rowsSkipped}`));

    this.printWritePreview(writes);

    if (!dryRun) {
      await this.applyWrites(master.spreadsheetId, writes);
    } else {
      console.log(chalk.yellow("🧪 Dry run enabled. No values were written."));
    }

    this.printFinalStats(stats);
    return stats;
  }

  private async runCrossCheck(
    op: CrossCheckOperation,
    dryRun: boolean,
    stats: RunStats
  ): Promise<RunStats> {
    this.assertRequired(op.masterSpreadsheetId, "masterSpreadsheetId");

    if (!op.keyColumns?.length) throw new Error("keyColumns is required");

    const headerRow = this.headerRow(op);
    const master = await this.readSheet(op.masterSpreadsheetId, op.masterTab, headerRow);
    const masterKeyIndexes = op.keyColumns.map((col) => this.resolveColumnIndex(col, master.headers));
    const masterIndex = this.buildKeyIndex(master, masterKeyIndexes, op);

    const sourceRows: SheetData[] = [];

    if (op.sourceType === "folder") {
      this.assertRequired(op.sourceFolderId, "sourceFolderId");

      const files = await this.sheets.listSpreadsheetsInFolderWithNames(this.parseFolderId(op.sourceFolderId!));
      stats.filesProcessed = files.length + 1;

      for (const file of files) {
        try {
          sourceRows.push(await this.readSheet(file.id, op.sourceTab, headerRow, file.name));
        } catch (error) {
          stats.errors++;
          console.log(chalk.red(`❌ Failed reading source file "${file.name}": ${this.errorMessage(error)}`));
        }
      }
    } else {
      this.assertRequired(op.sourceSpreadsheetId, "sourceSpreadsheetId");
      sourceRows.push(await this.readSheet(op.sourceSpreadsheetId!, op.sourceTab, headerRow));
      stats.filesProcessed = 2;
    }

    const sourceIndex = new Map<string, IndexedRow[]>();
    const sourceDuplicateKeys = new Set<string>();
    let sourceEmptyKeys = 0;

    for (const source of sourceRows) {
      stats.rowsRead += source.rows.length;
      const sourceKeyIndexes = op.keyColumns.map((col) => this.resolveColumnIndex(col, source.headers));
      const partialIndex = this.buildKeyIndex(source, sourceKeyIndexes, op);

      sourceEmptyKeys += partialIndex.emptyKeyRows;

      for (const duplicateKey of partialIndex.duplicateKeys) {
        sourceDuplicateKeys.add(duplicateKey);
      }

      for (const [key, rows] of partialIndex.map.entries()) {
        const existing = sourceIndex.get(key) ?? [];
        if (existing.length) sourceDuplicateKeys.add(key);
        sourceIndex.set(key, [...existing, ...rows]);
      }
    }

    stats.rowsRead += master.rows.length;

    const report: string[][] = [
      [
        "Issue Type",
        "Key",
        "Source File",
        "Source Row",
        "Master Row",
        "Column",
        "Source Value",
        "Master Value",
        "Note",
      ],
    ];

    const reportMode = op.reportMode ?? "full_audit";

    for (const [key, sourceItems] of sourceIndex.entries()) {
      const masterItems = masterIndex.map.get(key) ?? [];

      if (!masterItems.length && reportMode !== "mismatches_only") {
        report.push(["MISSING_IN_MASTER", key, sourceItems[0]?.spreadsheetName ?? "", String(sourceItems[0]?.rowNumber ?? ""), "", "", "", "", "Exists in source but missing in master"]);
      }
    }

    for (const [key, masterItems] of masterIndex.map.entries()) {
      const sourceItems = sourceIndex.get(key) ?? [];

      if (!sourceItems.length && reportMode !== "mismatches_only") {
        report.push(["MISSING_IN_SOURCE", key, "", "", String(masterItems[0]?.rowNumber ?? ""), "", "", "", "Exists in master but missing in source"]);
      }
    }

    for (const key of sourceDuplicateKeys) {
      if (reportMode !== "mismatches_only") {
        report.push(["DUPLICATE_SOURCE_KEY", key, "", "", "", "", "", "", "Duplicate key found in source data"]);
      }
    }

    for (const key of masterIndex.duplicateKeys) {
      if (reportMode !== "mismatches_only") {
        report.push(["DUPLICATE_MASTER_KEY", key, "", "", "", "", "", "", "Duplicate key found in master data"]);
      }
    }

    if (sourceEmptyKeys && reportMode !== "mismatches_only") {
      report.push(["EMPTY_SOURCE_KEYS", String(sourceEmptyKeys), "", "", "", "", "", "", "Rows with empty source keys"]);
    }

    if (masterIndex.emptyKeyRows && reportMode !== "mismatches_only") {
      report.push(["EMPTY_MASTER_KEYS", String(masterIndex.emptyKeyRows), "", "", "", "", "", "", "Rows with empty master keys"]);
    }

    if (op.comparisonColumns?.length && reportMode !== "missing_only") {
      for (const [key, sourceItems] of sourceIndex.entries()) {
        const masterItems = masterIndex.map.get(key) ?? [];
        if (!masterItems.length) continue;

        const sourceItem = sourceItems[0];
        const masterItem = masterItems[0];

        for (const col of op.comparisonColumns) {
          const sourceData = sourceRows.find((item) => item.spreadsheetId === sourceItem.spreadsheetId);
          if (!sourceData) continue;

          const sourceColIndex = this.resolveColumnIndex(col, sourceData.headers);
          const masterColIndex = this.resolveColumnIndex(col, master.headers);

          const sourceValue = this.normalizeCompareValue(this.cell(sourceItem.row, sourceColIndex, true));
          const masterValue = this.normalizeCompareValue(this.cell(masterItem.row, masterColIndex, true));

          if (sourceValue !== masterValue) {
            report.push([
              "MISMATCH",
              key,
              sourceItem.spreadsheetName ?? "",
              String(sourceItem.rowNumber),
              String(masterItem.rowNumber),
              col,
              this.cell(sourceItem.row, sourceColIndex, false),
              this.cell(masterItem.row, masterColIndex, false),
              "Comparison column mismatch",
            ]);
          }
        }
      }
    }

    stats.rowsReported = Math.max(0, report.length - 1);
    stats.rowsMatched = Array.from(sourceIndex.keys()).filter((key) => masterIndex.map.has(key)).length;

    console.log(chalk.cyan("📊 Cross-check Summary"));
    console.log(chalk.gray(`Source keys: ${sourceIndex.size}`));
    console.log(chalk.gray(`Master keys: ${masterIndex.map.size}`));
    console.log(chalk.gray(`Matched keys: ${stats.rowsMatched}`));
    console.log(chalk.gray(`Report rows: ${stats.rowsReported}`));

    await this.writeReportIfNeeded(
      master.spreadsheetId,
      op.outputReportTabName || "Cross-check Report",
      report,
      dryRun
    );

    this.printFinalStats(stats);
    return stats;
  }

  private async runCoverageReport(
    op: CoverageReportOperation,
    dryRun: boolean,
    stats: RunStats
  ): Promise<RunStats> {
    this.assertRequired(op.sourceFolderId, "sourceFolderId");
    this.assertRequired(op.masterSpreadsheetId, "masterSpreadsheetId");

    if (!op.sourceKeyColumns?.length) throw new Error("sourceKeyColumns is required");
    if (!op.masterKeyColumns?.length) throw new Error("masterKeyColumns is required");

    const headerRow = this.headerRow(op);
    const master = await this.readSheet(op.masterSpreadsheetId, op.masterTab, headerRow);
    const masterKeyIndexes = op.masterKeyColumns.map((col) => this.resolveColumnIndex(col, master.headers));
    const masterIndex = this.buildKeyIndex(master, masterKeyIndexes, op);

    const files = await this.sheets.listSpreadsheetsInFolderWithNames(this.parseFolderId(op.sourceFolderId));
    stats.filesProcessed = files.length + 1;
    stats.rowsRead += master.rows.length;

    const sourceIndex = new Map<string, IndexedRow[]>();
    const fileSummary: string[][] = [
      ["Source File", "Spreadsheet ID", "Rows Read", "Unique Keys", "Duplicate Keys", "Empty Key Rows"],
    ];

    for (const file of files) {
      try {
        const source = await this.readSheet(file.id, op.sourceTabName, headerRow, file.name);
        stats.rowsRead += source.rows.length;

        const sourceKeyIndexes = op.sourceKeyColumns.map((col) => this.resolveColumnIndex(col, source.headers));
        const partialIndex = this.buildKeyIndex(source, sourceKeyIndexes, op);

        fileSummary.push([
          file.name,
          file.id,
          String(source.rows.length),
          String(partialIndex.map.size),
          String(partialIndex.duplicateKeys.size),
          String(partialIndex.emptyKeyRows),
        ]);

        for (const [key, rows] of partialIndex.map.entries()) {
          const existing = sourceIndex.get(key) ?? [];
          sourceIndex.set(key, [...existing, ...rows]);
        }
      } catch (error) {
        stats.errors++;
        fileSummary.push([file.name, file.id, "ERROR", "0", "0", this.errorMessage(error)]);
      }
    }

    const sourceKeys = new Set(sourceIndex.keys());
    const masterKeys = new Set(masterIndex.map.keys());

    const missingInMaster = Array.from(sourceKeys).filter((key) => !masterKeys.has(key));
    const missingInSource = Array.from(masterKeys).filter((key) => !sourceKeys.has(key));
    const covered = Array.from(sourceKeys).filter((key) => masterKeys.has(key));

    const report: string[][] = [
      ["Section", "Metric", "Value", "Key"],
      ["Summary", "Source unique keys", String(sourceKeys.size), ""],
      ["Summary", "Master unique keys", String(masterKeys.size), ""],
      ["Summary", "Covered keys", String(covered.length), ""],
      ["Summary", "Missing in master", String(missingInMaster.length), ""],
      ["Summary", "Missing in source", String(missingInSource.length), ""],
      ["Summary", "Master duplicate keys", String(masterIndex.duplicateKeys.size), ""],
      ["Summary", "Master empty key rows", String(masterIndex.emptyKeyRows), ""],
      [],
      ["Missing in Master", "Key", "", ""],
      ...missingInMaster.map((key) => ["Missing in Master", "", "", key]),
      [],
      ["Missing in Source", "Key", "", ""],
      ...missingInSource.map((key) => ["Missing in Source", "", "", key]),
      [],
      ...fileSummary,
    ];

    stats.rowsMatched = covered.length;
    stats.rowsReported = report.length - 1;

    console.log(chalk.cyan("📊 Master Coverage Summary"));
    console.log(chalk.gray(`Source keys: ${sourceKeys.size}`));
    console.log(chalk.gray(`Master keys: ${masterKeys.size}`));
    console.log(chalk.gray(`Covered keys: ${covered.length}`));
    console.log(chalk.gray(`Missing in master: ${missingInMaster.length}`));
    console.log(chalk.gray(`Missing in source: ${missingInSource.length}`));

    await this.writeReportIfNeeded(
      master.spreadsheetId,
      op.outputReportTabName || "Master Coverage Report",
      report,
      dryRun
    );

    this.printFinalStats(stats);
    return stats;
  }

  private async runBuildWorkFile(
    op: BuildWorkFileOperation,
    dryRun: boolean,
    stats: RunStats
  ): Promise<RunStats> {
    this.assertRequired(op.sourceFolderId, "sourceFolderId");
    this.assertRequired(op.outputSpreadsheetId, "outputSpreadsheetId");

    if (!op.columnsToCollect?.length) throw new Error("columnsToCollect is required");

    const headerRow = this.headerRow(op);
    const outputSpreadsheetId = this.parseSpreadsheetId(op.outputSpreadsheetId);
    const files = await this.sheets.listSpreadsheetsInFolderWithNames(this.parseFolderId(op.sourceFolderId));

    stats.filesProcessed = files.length;

    const outputRows: string[][] = [];
    const header = op.includeSourceFileName
      ? ["Source File", "Source Spreadsheet ID", ...op.columnsToCollect]
      : [...op.columnsToCollect];

    outputRows.push(header);

    for (const file of files) {
      try {
        const source = await this.readSheet(file.id, op.sourceTab, headerRow, file.name);
        stats.rowsRead += source.rows.length;

        const columnIndexes = op.columnsToCollect.map((col) => this.resolveColumnIndex(col, source.headers));

        for (let i = headerRow; i < source.rows.length; i++) {
          const row = source.rows[i] ?? [];
          const collected = columnIndexes.map((idx) => this.cell(row, idx, true));

          if (collected.every((value) => !value)) {
            stats.rowsSkipped++;
            continue;
          }

          outputRows.push(op.includeSourceFileName ? [file.name, file.id, ...collected] : collected);
        }
      } catch (error) {
        stats.errors++;
        console.log(chalk.red(`❌ Failed reading source file "${file.name}": ${this.errorMessage(error)}`));
      }
    }

    stats.rowsUpdated = Math.max(0, outputRows.length - 1);

    console.log(chalk.cyan("📊 Build Work File Summary"));
    console.log(chalk.gray(`Source files: ${files.length}`));
    console.log(chalk.gray(`Rows collected: ${stats.rowsUpdated}`));
    console.log(chalk.gray(`Rows skipped: ${stats.rowsSkipped}`));

    if (dryRun) {
      console.log(chalk.yellow("🧪 Dry run enabled. Work file was not written."));
      this.printReportPreview(outputRows);
    } else {
      await this.writeReport(outputSpreadsheetId, op.outputTabName || "Work File", outputRows);
      console.log(chalk.green(`✅ Work file written to tab "${op.outputTabName || "Work File"}"`));
    }

    this.printFinalStats(stats);
    return stats;
  }

  private createStats(): RunStats {
    return {
      filesProcessed: 0,
      rowsRead: 0,
      rowsMatched: 0,
      rowsUpdated: 0,
      rowsSkipped: 0,
      rowsReported: 0,
      errors: 0,
    };
  }

  private async readSheet(
    spreadsheetIdOrUrl: string,
    tabName: string,
    headerRow: number,
    spreadsheetName?: string
  ): Promise<SheetData> {
    const spreadsheetId = this.parseSpreadsheetId(spreadsheetIdOrUrl);
    const cleanTab = this.requiredText(tabName || "Sheet1", "tabName");

    console.log(chalk.gray(`📄 Reading: ${spreadsheetName ? `${spreadsheetName} ` : ""}${spreadsheetId} / ${cleanTab}`));

    const rows = await this.sheets.readValues(spreadsheetId, `${this.quoteA1Sheet(cleanTab)}!A:ZZZ`);
    const headers = rows[headerRow - 1] ?? [];

    if (!headers.length) {
      throw new Error(`No headers found in ${spreadsheetId} / ${cleanTab} at row ${headerRow}`);
    }

    return {
      spreadsheetId,
      spreadsheetName,
      tabName: cleanTab,
      rows,
      headers: headers.map((value) => String(value ?? "")),
      headerRow,
    };
  }

  private buildKeyIndex(sheet: SheetData, keyIndexes: number[], op: BaseOperation): KeyIndex {
    const map = new Map<string, IndexedRow[]>();
    const duplicateKeys = new Set<string>();
    let emptyKeyRows = 0;

    for (let i = sheet.headerRow; i < sheet.rows.length; i++) {
      const row = sheet.rows[i] ?? [];
      const key = this.buildKeyFromRow(row, keyIndexes, op);

      if (!key) {
        emptyKeyRows++;
        continue;
      }

      const item: IndexedRow = {
        row,
        rowIndex0: i,
        rowNumber: i + 1,
        key,
        spreadsheetId: sheet.spreadsheetId,
        spreadsheetName: sheet.spreadsheetName,
      };

      const current = map.get(key) ?? [];
      if (current.length) duplicateKeys.add(key);

      map.set(key, [...current, item]);
    }

    return { map, duplicateKeys, emptyKeyRows };
  }

  private buildKeyFromRow(row: string[], indexes: number[], op: BaseOperation): string {
    const parts = indexes.map((idx) => this.cell(row, idx, op.trimValues));
    const joined = parts.join(" | ");
    return this.normalizeKey(joined, op);
  }

  private normalizeKey(value: string, op: BaseOperation): string {
    let out = String(value ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ");

    if (op.trimValues ?? true) out = out.trim();
    if (!(op.caseSensitive ?? false)) out = out.toLowerCase();

    return out;
  }

  private normalizeCompareValue(value: string): string {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private cell(row: string[] | undefined, index: number, trim = false): string {
    const value = String((row ?? [])[index] ?? "");
    return trim ? value.trim() : value;
  }

  private resolveColumnIndex(columnRef: string, headers: string[]): number {
    const ref = this.requiredText(columnRef, "columnRef");

    if (/^[A-Za-z]+$/.test(ref)) {
      return this.columnLetterToIndex(ref);
    }

    const target = this.normalizeHeader(ref);
    const idx = headers.findIndex((header) => this.normalizeHeader(header) === target);

    if (idx === -1) {
      throw new Error(`Column not found: "${columnRef}". Use exact header or column letter.`);
    }

    return idx;
  }

  private normalizeHeader(value: string): string {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private makeSingleWrite(
    sheet: SheetData,
    colIndex: number,
    rowIndex0: number,
    key: string,
    currentValue: string,
    newValue: string,
    reason: string
  ): PlannedWrite {
    return {
      range: `${this.quoteA1Sheet(sheet.tabName)}!${this.indexToColumnLetter(colIndex)}${rowIndex0 + 1}`,
      values: [[newValue]],
      rowNumber: rowIndex0 + 1,
      key,
      currentValue,
      newValue,
      reason,
    };
  }

  private async applyWrites(spreadsheetId: string, writes: PlannedWrite[]): Promise<void> {
    if (!writes.length) {
      console.log(chalk.yellow("No writes to apply."));
      return;
    }

    await this.sheets.batchWriteValues(
      spreadsheetId,
      writes.map((write) => ({
        range: write.range,
        values: write.values,
      })),
      "RAW"
    );

    console.log(chalk.green(`✅ Applied ${writes.length} writes.`));
  }

  private async writeReportIfNeeded(
    spreadsheetId: string,
    tabName: string,
    rows: string[][],
    dryRun: boolean
  ): Promise<void> {
    if (dryRun) {
      console.log(chalk.yellow(`🧪 Dry run enabled. Report "${tabName}" was not written.`));
      this.printReportPreview(rows);
      return;
    }

    await this.writeReport(spreadsheetId, tabName, rows);
    console.log(chalk.green(`✅ Report written to tab "${tabName}".`));
  }

  private async writeReport(spreadsheetId: string, tabName: string, rows: string[][]): Promise<void> {
    await this.sheets.ensureTab(spreadsheetId, tabName);
    await this.sheets.clearTabValues(spreadsheetId, tabName);
    await this.sheets.writeValues(spreadsheetId, `${this.quoteA1Sheet(tabName)}!A1`, rows);
  }

  private printWritePreview(writes: PlannedWrite[], limit = 20): void {
    if (!writes.length) {
      console.log(chalk.yellow("No planned writes."));
      return;
    }

    console.log(chalk.cyan("👀 Planned write preview:"));

    writes.slice(0, limit).forEach((write) => {
      console.log(
        chalk.gray(
          `   ${write.range} | key="${write.key}" | "${this.preview(write.currentValue)}" -> "${this.preview(write.newValue)}" | ${write.reason}`
        )
      );
    });

    if (writes.length > limit) {
      console.log(chalk.gray(`   ...and ${writes.length - limit} more planned writes`));
    }
  }

  private printReportPreview(rows: string[][], limit = 15): void {
    console.log(chalk.cyan("👀 Report preview:"));

    rows.slice(0, limit).forEach((row) => {
      console.log(chalk.gray(`   ${row.map((cell) => this.preview(cell, 80)).join(" | ")}`));
    });

    if (rows.length > limit) {
      console.log(chalk.gray(`   ...and ${rows.length - limit} more report rows`));
    }
  }

  private logKeyIndex(label: string, index: KeyIndex): void {
    console.log(chalk.cyan(`🔎 ${label} index`));
    console.log(chalk.gray(`Unique keys: ${index.map.size}`));
    console.log(chalk.gray(`Duplicate keys: ${index.duplicateKeys.size}`));
    console.log(chalk.gray(`Rows with empty key: ${index.emptyKeyRows}`));

    if (index.duplicateKeys.size) {
      Array.from(index.duplicateKeys)
        .slice(0, 10)
        .forEach((key) => console.log(chalk.yellow(`   Duplicate key: ${key}`)));
    }
  }

  private printFinalStats(stats: RunStats): void {
    console.log(chalk.green("✅ Sheet Utilities completed"));
    console.log(chalk.gray(`Files processed: ${stats.filesProcessed}`));
    console.log(chalk.gray(`Rows read: ${stats.rowsRead}`));
    console.log(chalk.gray(`Rows matched: ${stats.rowsMatched}`));
    console.log(chalk.gray(`Rows updated/planned: ${stats.rowsUpdated}`));
    console.log(chalk.gray(`Rows skipped: ${stats.rowsSkipped}`));
    console.log(chalk.gray(`Rows reported: ${stats.rowsReported}`));
    console.log(chalk.gray(`Errors: ${stats.errors}`));
  }

  private parseSpreadsheetId(input: string): string {
    const value = this.requiredText(input, "spreadsheetId");
    const match = value.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
    return (match?.[1] ?? value).trim();
  }

  private parseFolderId(input: string): string {
    const value = this.requiredText(input, "folderId");
    const match = value.match(/\/folders\/([A-Za-z0-9-_]+)/);
    return (match?.[1] ?? value).trim();
  }

  private quoteA1Sheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  private columnLetterToIndex(letter: string): number {
    const clean = String(letter ?? "").trim().toUpperCase();

    if (!/^[A-Z]+$/.test(clean)) {
      throw new Error(`Invalid column letter: "${letter}"`);
    }

    let index = 0;

    for (let i = 0; i < clean.length; i++) {
      index = index * 26 + (clean.charCodeAt(i) - 64);
    }

    return index - 1;
  }

  private indexToColumnLetter(index0: number): string {
    let n = index0 + 1;
    let output = "";

    while (n > 0) {
      const remainder = (n - 1) % 26;
      output = String.fromCharCode(65 + remainder) + output;
      n = Math.floor((n - 1) / 26);
    }

    return output;
  }

  private headerRow(op: BaseOperation): number {
    const value = Number(op.headerRow ?? 1);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  private requiredText(value: string | undefined, fieldName: string): string {
    const out = String(value ?? "").trim();

    if (!out) {
      throw new Error(`Missing required field: ${fieldName}`);
    }

    return out;
  }

  private assertRequired(value: string | undefined, fieldName: string): void {
    this.requiredText(value, fieldName);
  }

  private preview(value: string, limit = 70): string {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit)}...`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}