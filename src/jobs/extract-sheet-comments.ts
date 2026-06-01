import { inflateRawSync } from "zlib";
import chalk from "chalk";
import type { drive_v3, sheets_v4 } from "googleapis";
import { SheetsService } from "../services/sheets.js";

export type ExtractSheetCommentsConfig = {
  spreadsheetId: string;
  sourceTabName: string;
  sourceColumn: string;
  outputColumn?: string;
  startRow?: number;
  outputHeader?: string;
  includeReplies?: boolean;
  includeResolved?: boolean;
  writeBehavior?: {
    mode?: "overwrite" | "skip_existing" | "first_empty";
    maxSearchColumns?: number;
  };
  dryRun?: boolean;
};

export type ExtractSheetCommentsResult = {
  commentsFound: number;
  commentsMapped: number;
  rowsWithComments: number;
  outputColumn: string;
  cellsChanged: number;
  dryRun: boolean;
};

type SheetComment = {
  content: string;
  rowNumber: number | null;
  columnLetter: string | null;
  sheetTitle: string | null;
  sheetId: number | null;
  sheetIdSource: "sheetId" | "gid" | "uid" | null;
  anchorRaw: string;
  quotedText: string;
  matchStrategy: string;
};

type ParsedAnchor = {
  rowNumber: number | null;
  columnLetter: string | null;
  sheetTitle: string | null;
  sheetId: number | null;
  sheetIdSource: "sheetId" | "gid" | "uid" | null;
  strategy: string;
};

type TargetSheetInfo = {
  title: string;
  sheetId: number | null;
};

type SourceCell = {
  rowNumber: number;
  columnLetter: string;
  value: string;
};

type MappedSheetComment = SheetComment & {
  outputColumn: string;
};

type ZipEntryMap = Map<string, Buffer>;

type ParsedRelationship = {
  id: string;
  type: string;
  target: string;
};

type NormalizedWriteBehavior = {
  mode: "overwrite" | "skip_existing" | "first_empty";
  maxSearchColumns: number;
};

export class ExtractSheetCommentsJob {
  constructor(private sheets: SheetsService) {}

  async run(config: ExtractSheetCommentsConfig): Promise<ExtractSheetCommentsResult> {
    const spreadsheetId = this.normalizeSpreadsheetId(config.spreadsheetId);
    const sourceTabName = config.sourceTabName.trim();
    const sourceColumns = this.normalizeColumnSelection(config.sourceColumn, "sourceColumn");
    const outputColumns = config.outputColumn?.trim()
      ? this.normalizeColumnSelection(config.outputColumn, "outputColumn")
      : this.getDefaultOutputColumns(sourceColumns);
    const sourceColumnLabel = this.formatColumnSelection(sourceColumns);
    const outputColumnLabel = this.formatColumnSelection(outputColumns);
    const startRow = config.startRow ?? 2;
    const outputHeader = config.outputHeader || "Comment";
    const includeReplies = config.includeReplies !== false;
    const includeResolved = config.includeResolved === true;
    const writeBehavior = this.normalizeWriteBehavior(config.writeBehavior);
    const dryRun = config.dryRun === true;

    if (!spreadsheetId) throw new Error("Missing spreadsheetId");
    if (!sourceTabName) throw new Error("Missing sourceTabName");
    if (!sourceColumns.length) throw new Error("Missing sourceColumn");
    if (sourceColumns.length !== outputColumns.length) {
      throw new Error(
        `Source and output ranges must have the same width. Source: ${sourceColumnLabel}, output: ${outputColumnLabel}`
      );
    }

    const overlappingColumns = sourceColumns.filter((column) => outputColumns.includes(column));

    if (overlappingColumns.length > 0) {
      throw new Error(`Source and output columns must not overlap: ${overlappingColumns.join(", ")}`);
    }

    const outputBySourceColumn = new Map(
      sourceColumns.map((sourceColumn, index) => [sourceColumn, outputColumns[index]])
    );
    const sourceColumnSet = new Set(sourceColumns);

    console.log(chalk.blue("🚀 Starting Sheet Comments Extraction"));
    console.log(chalk.gray(`Source column(s): ${sourceColumnLabel}`));
    console.log(chalk.gray(`Output column(s): ${outputColumnLabel}`));
    console.log(chalk.gray(`Include replies: ${includeReplies ? "YES" : "NO"}`));
    console.log(chalk.gray(`Write behavior: ${this.describeWriteBehavior(writeBehavior)}`));
    console.log(chalk.gray(`Dry run: ${dryRun ? "YES" : "NO"}`));

    const targetSheet = await this.getTargetSheetInfo(spreadsheetId, sourceTabName);
    const comments = await this.listDriveComments(spreadsheetId);
    const sourceCells = await this.readSourceColumnCells(spreadsheetId, sourceTabName, sourceColumns, startRow);

    console.log(chalk.gray(`Drive comments found: ${comments.length}`));

    const mappedComments: MappedSheetComment[] = [];
    const unmappedAnchors: string[] = [];
    const skipStats = {
      resolved: 0,
      emptyContent: 0,
      otherSheet: 0,
      missingCell: 0,
      outsideSourceColumns: 0,
      beforeStartRow: 0,
    };

    for (const comment of comments) {
      if (!includeResolved && comment.resolved) {
        skipStats.resolved += 1;
        continue;
      }

      const mappedComment = this.mapComment(comment, includeReplies);

      if (!mappedComment.content) {
        skipStats.emptyContent += 1;
        continue;
      }

      if (!this.isCommentOnTargetSheet(mappedComment, targetSheet)) {
        skipStats.otherSheet += 1;
        continue;
      }

      const resolvedComment = this.resolveMissingRowFromQuotedText(
        mappedComment,
        sourceCells,
        sourceColumns
      );

      if (!resolvedComment.rowNumber) {
        skipStats.missingCell += 1;
        unmappedAnchors.push(resolvedComment.anchorRaw || "(empty anchor)");
        continue;
      }

      const resolvedSourceColumn =
        resolvedComment.columnLetter || (sourceColumns.length === 1 ? sourceColumns[0] : null);

      if (!resolvedSourceColumn) {
        skipStats.missingCell += 1;
        unmappedAnchors.push(resolvedComment.anchorRaw || "(missing source column)");
        continue;
      }

      if (!sourceColumnSet.has(resolvedSourceColumn)) {
        skipStats.outsideSourceColumns += 1;
        continue;
      }

      const outputColumn = outputBySourceColumn.get(resolvedSourceColumn);

      if (!outputColumn) {
        continue;
      }

      if (resolvedComment.rowNumber < startRow) {
        skipStats.beforeStartRow += 1;
        continue;
      }

      mappedComments.push({
        ...resolvedComment,
        columnLetter: resolvedSourceColumn,
        outputColumn,
      });
    }

    if (!mappedComments.length && skipStats.missingCell > 0) {
      try {
        console.log(
          chalk.yellow(
            "Drive comment anchors use internal workbook-range IDs. Trying XLSX export fallback for cell locations..."
          )
        );

        const xlsxComments = await this.listXlsxComments(spreadsheetId, sourceTabName);
        console.log(chalk.gray(`XLSX comments found on tab: ${xlsxComments.length}`));

        let fallbackMappedCount = 0;

        for (const xlsxComment of xlsxComments) {
          if (!xlsxComment.content) {
            skipStats.emptyContent += 1;
            continue;
          }

          if (!this.isCommentOnTargetSheet(xlsxComment, targetSheet)) {
            skipStats.otherSheet += 1;
            continue;
          }

          if (!xlsxComment.rowNumber) {
            skipStats.missingCell += 1;
            unmappedAnchors.push(xlsxComment.anchorRaw || "(empty XLSX anchor)");
            continue;
          }

          const resolvedSourceColumn =
            xlsxComment.columnLetter || (sourceColumns.length === 1 ? sourceColumns[0] : null);

          if (!resolvedSourceColumn) {
            skipStats.missingCell += 1;
            unmappedAnchors.push(xlsxComment.anchorRaw || "(missing XLSX source column)");
            continue;
          }

          if (!sourceColumnSet.has(resolvedSourceColumn)) {
            skipStats.outsideSourceColumns += 1;
            continue;
          }

          const outputColumn = outputBySourceColumn.get(resolvedSourceColumn);

          if (!outputColumn) {
            continue;
          }

          if (xlsxComment.rowNumber < startRow) {
            skipStats.beforeStartRow += 1;
            continue;
          }

          mappedComments.push({
            ...xlsxComment,
            columnLetter: resolvedSourceColumn,
            outputColumn,
          });
          fallbackMappedCount += 1;
        }

        if (fallbackMappedCount > 0) {
          unmappedAnchors.length = 0;
          console.log(chalk.gray(`Comments mapped through XLSX fallback: ${fallbackMappedCount}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`XLSX comments fallback failed: ${this.getErrorMessage(error)}`));
      }
    }

    if (!mappedComments.length) {
      console.log(chalk.yellow("⚠️ No comments found for the selected range."));
      console.log(chalk.yellow(`Skip details: ${JSON.stringify(skipStats)}`));

      const anchorsPreview = (unmappedAnchors.length ? unmappedAnchors : comments.map((comment) => String(comment.anchor || "(empty anchor)")))
        .slice(0, 10)
        .map((anchor, index) => `${index + 1}. ${anchor}`)
        .join("\n");

      if (anchorsPreview) {
        console.log(chalk.yellow("Anchor preview for debugging:"));
        console.log(anchorsPreview);
      }

      return {
        commentsFound: comments.length,
        commentsMapped: 0,
        rowsWithComments: 0,
        outputColumn: outputColumnLabel,
        cellsChanged: 0,
        dryRun,
      };
    }

    const commentsByOutputColumn = new Map<string, Map<number, string[]>>();

    for (const comment of mappedComments) {
      if (!comment.rowNumber) continue;

      const commentsByRow = commentsByOutputColumn.get(comment.outputColumn) || new Map<number, string[]>();
      const existing = commentsByRow.get(comment.rowNumber) || [];
      commentsByRow.set(comment.rowNumber, [...existing, comment.content]);
      commentsByOutputColumn.set(comment.outputColumn, commentsByRow);
    }

    const rowWritesByOutputColumn = new Map<string, Array<{ rowNumber: number; value: string }>>();

    for (const [outputColumn, commentsByRow] of commentsByOutputColumn.entries()) {
      rowWritesByOutputColumn.set(
        outputColumn,
        Array.from(commentsByRow.entries())
          .map(([rowNumber, values]) => ({
            rowNumber,
            value: values.filter(Boolean).join("\n\n"),
          }))
          .sort((a, b) => a.rowNumber - b.rowNumber)
      );
    }

    const writePlan = await this.planCommentWrites({
      spreadsheetId,
      sourceTabName,
      rowWritesByOutputColumn,
      outputColumns,
      outputHeader,
      writeBehavior,
    });

    const rowsWithComments = Array.from(writePlan.rowWritesByOutputColumn.values())
      .reduce((total, writes) => total + writes.length, 0);

    const cellsChanged = rowsWithComments + writePlan.headerColumns.length;

    console.log(chalk.gray(`Comments mapped to rows: ${mappedComments.length}`));
    console.log(chalk.gray(`Output cells with comments: ${rowsWithComments}`));
    if (writePlan.skippedExisting > 0) {
      console.log(chalk.yellow(`Skipped existing target cells: ${writePlan.skippedExisting}`));
    }
    if (writePlan.skippedNoEmptyCell > 0) {
      console.log(chalk.yellow(`Skipped rows without an empty output cell nearby: ${writePlan.skippedNoEmptyCell}`));
    }

    if (unmappedAnchors.length > 0) {
      console.log(chalk.yellow(`Unmapped comments skipped: ${unmappedAnchors.length}`));
    }

    console.log(chalk.gray(`Skip details: ${JSON.stringify(skipStats)}`));

    if (dryRun) {
      console.log(
        chalk.yellow(
          `[DRY RUN] Would write ${rowsWithComments} comment cell(s) to ${sourceTabName}!${outputColumnLabel}`
        )
      );

      return {
        commentsFound: comments.length,
        commentsMapped: mappedComments.length,
        rowsWithComments,
        outputColumn: outputColumnLabel,
        cellsChanged,
        dryRun,
      };
    }

    if (outputHeader) {
      for (const outputColumn of writePlan.headerColumns) {
        await this.sheets.writeValues(
          spreadsheetId,
          `${this.quoteSheetName(sourceTabName)}!${outputColumn}1:${outputColumn}1`,
          [[outputHeader]]
        );
      }
    }

    for (const [outputColumn, rowWrites] of writePlan.rowWritesByOutputColumn.entries()) {
      await this.writeSparseRows(spreadsheetId, sourceTabName, outputColumn, rowWrites);
    }

    console.log(chalk.green(`✅ Wrote ${mappedComments.length} comments to column(s) ${outputColumnLabel}`));
    console.log(chalk.underline(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`));

    return {
      commentsFound: comments.length,
      commentsMapped: mappedComments.length,
      rowsWithComments,
      outputColumn: outputColumnLabel,
      cellsChanged,
      dryRun,
    };
  }

  private normalizeWriteBehavior(config?: ExtractSheetCommentsConfig["writeBehavior"]): NormalizedWriteBehavior {
    const requestedMode = config?.mode || "overwrite";
    const mode = ["overwrite", "skip_existing", "first_empty"].includes(requestedMode)
      ? requestedMode
      : "overwrite";
    const maxSearchColumns = Math.max(1, Math.min(Number(config?.maxSearchColumns || 6), 25));

    return { mode: mode as "overwrite" | "skip_existing" | "first_empty", maxSearchColumns };
  }

  private describeWriteBehavior(behavior: NormalizedWriteBehavior): string {
    if (behavior.mode === "overwrite") {
      return "overwrite existing target values";
    }

    if (behavior.mode === "first_empty") {
      return `find first empty cell to the right (up to ${behavior.maxSearchColumns} columns)`;
    }

    return "skip target cells that already have values";
  }

  private isBlankCellValue(value: unknown): boolean {
    return String(value ?? "").trim() === "";
  }

  private async planCommentWrites(args: {
    spreadsheetId: string;
    sourceTabName: string;
    rowWritesByOutputColumn: Map<string, Array<{ rowNumber: number; value: string }>>;
    outputColumns: string[];
    outputHeader: string;
    writeBehavior: NormalizedWriteBehavior;
  }): Promise<{
    rowWritesByOutputColumn: Map<string, Array<{ rowNumber: number; value: string }>>;
    headerColumns: string[];
    skippedExisting: number;
    skippedNoEmptyCell: number;
  }> {
    if (args.writeBehavior.mode === "overwrite") {
      return {
        rowWritesByOutputColumn: args.rowWritesByOutputColumn,
        headerColumns: args.outputHeader ? args.outputColumns : [],
        skippedExisting: 0,
        skippedNoEmptyCell: 0,
      };
    }

    const allWrites = Array.from(args.rowWritesByOutputColumn.entries())
      .flatMap(([outputColumn, rowWrites]) => rowWrites.map((write) => ({ ...write, outputColumn })));

    if (!allWrites.length) {
      return {
        rowWritesByOutputColumn: new Map(),
        headerColumns: [],
        skippedExisting: 0,
        skippedNoEmptyCell: 0,
      };
    }

    const minRow = Math.min(...allWrites.map((write) => write.rowNumber));
    const maxRow = Math.max(...allWrites.map((write) => write.rowNumber));
    const startColumnIndex = Math.min(...args.outputColumns.map((column) => this.columnLetterToIndex(column)));
    const baseEndColumnIndex = Math.max(...args.outputColumns.map((column) => this.columnLetterToIndex(column)));
    const endColumnIndex = args.writeBehavior.mode === "first_empty"
      ? baseEndColumnIndex + args.writeBehavior.maxSearchColumns - 1
      : baseEndColumnIndex;
    const startColumn = this.indexToColumnLetter(startColumnIndex);
    const endColumn = this.indexToColumnLetter(endColumnIndex);
    const values = await this.sheets.readValues(
      args.spreadsheetId,
      `${this.quoteSheetName(args.sourceTabName)}!${startColumn}${minRow}:${endColumn}${maxRow}`
    );
    const headerValues = await this.sheets.readValues(
      args.spreadsheetId,
      `${this.quoteSheetName(args.sourceTabName)}!${startColumn}1:${endColumn}1`
    );
    const headerRow = headerValues[0] || [];
    const rowOffsetByNumber = (rowNumber: number) => rowNumber - minRow;
    const existingAt = (rowNumber: number, columnIndex: number): string => {
      const row = values[rowOffsetByNumber(rowNumber)] || [];
      return String(row[columnIndex - startColumnIndex] ?? "");
    };
    const plannedByColumn = new Map<string, Array<{ rowNumber: number; value: string }>>();
    const plannedCells = new Set<string>();
    const usedColumnIndexes = new Set<number>();
    let skippedExisting = 0;
    let skippedNoEmptyCell = 0;

    const pushPlannedWrite = (columnIndex: number, rowNumber: number, value: string): void => {
      const columnLetter = this.indexToColumnLetter(columnIndex);
      const writes = plannedByColumn.get(columnLetter) || [];
      writes.push({ rowNumber, value });
      plannedByColumn.set(columnLetter, writes);
      plannedCells.add(`${rowNumber}:${columnIndex}`);
      usedColumnIndexes.add(columnIndex);
    };

    for (const write of allWrites) {
      const baseColumnIndex = this.columnLetterToIndex(write.outputColumn);

      if (args.writeBehavior.mode === "skip_existing") {
        if (!this.isBlankCellValue(existingAt(write.rowNumber, baseColumnIndex))) {
          skippedExisting += 1;
          continue;
        }

        pushPlannedWrite(baseColumnIndex, write.rowNumber, write.value);
        continue;
      }

      let destinationIndex = -1;
      const searchEndIndex = baseColumnIndex + args.writeBehavior.maxSearchColumns - 1;

      for (let columnIndex = baseColumnIndex; columnIndex <= searchEndIndex; columnIndex += 1) {
        if (this.isBlankCellValue(existingAt(write.rowNumber, columnIndex)) && !plannedCells.has(`${write.rowNumber}:${columnIndex}`)) {
          destinationIndex = columnIndex;
          break;
        }
      }

      if (destinationIndex < 0) {
        skippedNoEmptyCell += 1;
        continue;
      }

      pushPlannedWrite(destinationIndex, write.rowNumber, write.value);
    }

    for (const writes of plannedByColumn.values()) {
      writes.sort((a, b) => a.rowNumber - b.rowNumber);
    }

    const headerColumns = Array.from(usedColumnIndexes)
      .filter((columnIndex) => {
        if (!args.outputHeader) return false;
        const header = String(headerRow[columnIndex - startColumnIndex] ?? "");
        return this.isBlankCellValue(header);
      })
      .map((columnIndex) => this.indexToColumnLetter(columnIndex));

    return {
      rowWritesByOutputColumn: plannedByColumn,
      headerColumns,
      skippedExisting,
      skippedNoEmptyCell,
    };
  }

  private async listDriveComments(fileId: string): Promise<drive_v3.Schema$Comment[]> {
    const driveClient = (this.sheets as any).drive as drive_v3.Drive;

    if (!driveClient) {
      throw new Error("Could not access Google Drive client from SheetsService");
    }

    const allComments: drive_v3.Schema$Comment[] = [];
    let pageToken: string | undefined = undefined;

    // חשוב: לא לבנות את fields עם array join.
    // Google Drive API לא מקבל פסיק אחרי פתיחת comments( או לפני הסגירה.
    const fields =
      "nextPageToken," +
      "comments(" +
      "id," +
      "content," +
      "htmlContent," +
      "anchor," +
      "resolved," +
      "quotedFileContent," +
      "replies(content,htmlContent,action,deleted)" +
      ")";

    do {
      const response = await driveClient.comments.list({
        fileId,
        pageSize: 100,
        pageToken,
        includeDeleted: false,
        fields,
      });

      const data = response.data as drive_v3.Schema$CommentList;

      allComments.push(...(data.comments ?? []));
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return allComments;
  }

  private async listXlsxComments(spreadsheetId: string, sourceTabName: string): Promise<SheetComment[]> {
    const xlsxBuffer = await this.exportSpreadsheetAsXlsx(spreadsheetId);
    const entries = this.readZipEntries(xlsxBuffer);
    const worksheetPath = this.findWorksheetPath(entries, sourceTabName);

    if (!worksheetPath) {
      return [];
    }

    const relationships = this.readRelationshipsForPart(entries, worksheetPath);
    const comments: SheetComment[] = [];

    for (const relationship of relationships) {
      const type = relationship.type.toLowerCase();

      if (!type.includes("comment")) {
        continue;
      }

      const targetPath = this.resolveZipTarget(worksheetPath, relationship.target);
      const xml = entries.get(targetPath)?.toString("utf8");

      if (!xml) {
        continue;
      }

      if (type.includes("threadedcomment")) {
        comments.push(
          ...this.parseThreadedXlsxComments(xml, sourceTabName, targetPath)
        );
        continue;
      }

      if (type.endsWith("/comments") || targetPath.includes("/comments")) {
        comments.push(...this.parseLegacyXlsxComments(xml, sourceTabName, targetPath));
      }
    }

    return comments;
  }

  private async exportSpreadsheetAsXlsx(spreadsheetId: string): Promise<Buffer> {
    const driveClient = (this.sheets as any).drive as drive_v3.Drive;

    if (!driveClient) {
      throw new Error("Could not access Google Drive client from SheetsService");
    }

    const response = await driveClient.files.export(
      {
        fileId: spreadsheetId,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      {
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data as unknown as ArrayBuffer);
  }

  private findWorksheetPath(entries: ZipEntryMap, sourceTabName: string): string | null {
    const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8");
    const workbookRelationships = this.readRelationshipsForPart(entries, "xl/workbook.xml");

    if (!workbookXml) {
      return null;
    }

    const relationshipsById = new Map(workbookRelationships.map((relationship) => [relationship.id, relationship]));
    const normalizedTarget = this.normalizeSheetTitle(sourceTabName);
    const sheetRegex = /<sheet\b([^>]*)\/?>/gi;
    let match: RegExpExecArray | null;

    while ((match = sheetRegex.exec(workbookXml)) !== null) {
      const attrs = this.parseXmlAttributes(match[1] || "");
      const sheetName = attrs.name || "";

      if (this.normalizeSheetTitle(sheetName) !== normalizedTarget) {
        continue;
      }

      const relationshipId = attrs["r:id"] || attrs.id;
      const relationship = relationshipId ? relationshipsById.get(relationshipId) : null;

      if (!relationship?.target) {
        return null;
      }

      const path = relationship.target.startsWith("/")
        ? relationship.target.slice(1)
        : `xl/${relationship.target}`;

      return this.normalizeZipPath(path);
    }

    return null;
  }

  private readRelationshipsForPart(entries: ZipEntryMap, partPath: string): ParsedRelationship[] {
    const normalizedPartPath = this.normalizeZipPath(partPath);
    const slashIndex = normalizedPartPath.lastIndexOf("/");
    const directory = slashIndex >= 0 ? normalizedPartPath.slice(0, slashIndex) : "";
    const fileName = slashIndex >= 0 ? normalizedPartPath.slice(slashIndex + 1) : normalizedPartPath;
    const relationshipPath = this.normalizeZipPath(
      `${directory ? `${directory}/` : ""}_rels/${fileName}.rels`
    );
    const relationshipXml = entries.get(relationshipPath)?.toString("utf8");

    return relationshipXml ? this.parseRelationships(relationshipXml) : [];
  }

  private parseRelationships(xml: string): ParsedRelationship[] {
    const relationships: ParsedRelationship[] = [];
    const relationshipRegex = /<Relationship\b([^>]*)\/?>/gi;
    let match: RegExpExecArray | null;

    while ((match = relationshipRegex.exec(xml)) !== null) {
      const attrs = this.parseXmlAttributes(match[1] || "");

      if (!attrs.Id && !attrs.id) {
        continue;
      }

      relationships.push({
        id: attrs.Id || attrs.id || "",
        type: attrs.Type || attrs.type || "",
        target: attrs.Target || attrs.target || "",
      });
    }

    return relationships;
  }

  private parseLegacyXlsxComments(xml: string, sourceTabName: string, anchorPrefix: string): SheetComment[] {
    const comments: SheetComment[] = [];
    const commentRegex = /<comment\b([^>]*)>([\s\S]*?)<\/comment>/gi;
    let match: RegExpExecArray | null;

    while ((match = commentRegex.exec(xml)) !== null) {
      const attrs = this.parseXmlAttributes(match[1] || "");
      const ref = attrs.ref || attrs.Ref || "";
      const parsedRef = this.parseA1FromText(ref);
      const content = this.cleanXlsxCommentContent(this.xmlTextContent(match[2] || ""));

      if (!content || !parsedRef.rowNumber || !parsedRef.columnLetter) {
        continue;
      }

      comments.push({
        content,
        rowNumber: parsedRef.rowNumber,
        columnLetter: parsedRef.columnLetter,
        sheetTitle: sourceTabName,
        sheetId: null,
        sheetIdSource: null,
        anchorRaw: `${anchorPrefix}#${ref}`,
        quotedText: "",
        matchStrategy: "xlsx-comments",
      });
    }

    return comments;
  }

  private parseThreadedXlsxComments(xml: string, sourceTabName: string, anchorPrefix: string): SheetComment[] {
    const comments: SheetComment[] = [];
    const commentRegex = /<threadedComment\b([^>]*)>([\s\S]*?)<\/threadedComment>/gi;
    let match: RegExpExecArray | null;

    while ((match = commentRegex.exec(xml)) !== null) {
      const attrs = this.parseXmlAttributes(match[1] || "");
      const ref = attrs.ref || attrs.Ref || "";
      const parsedRef = this.parseA1FromText(ref);
      const content = this.cleanXlsxCommentContent(this.xmlTextContent(match[2] || ""));

      if (!content || !parsedRef.rowNumber || !parsedRef.columnLetter) {
        continue;
      }

      comments.push({
        content,
        rowNumber: parsedRef.rowNumber,
        columnLetter: parsedRef.columnLetter,
        sheetTitle: sourceTabName,
        sheetId: null,
        sheetIdSource: null,
        anchorRaw: `${anchorPrefix}#${ref}`,
        quotedText: "",
        matchStrategy: "xlsx-threaded-comments",
      });
    }

    return comments;
  }

  private mapComment(comment: drive_v3.Schema$Comment, includeReplies: boolean): SheetComment {
    const mainComment = this.cleanText(comment.content || comment.htmlContent || "");

    const replies = includeReplies && Array.isArray(comment.replies) ? comment.replies : [];

    const replyText = replies
      .filter((reply) => !reply.deleted)
      .filter((reply) => reply.action !== "resolve" && reply.action !== "reopen")
      .map((reply) => this.cleanText(reply.content || reply.htmlContent || ""))
      .filter(Boolean)
      .join("\n");

    const content = [mainComment, replyText].filter(Boolean).join("\n");

    const anchorRaw = String(comment.anchor || "");
    const parsedAnchor = this.parseAnchor(anchorRaw);
    const quotedText = this.cleanText(comment.quotedFileContent?.value || "");

    return {
      content,
      rowNumber: parsedAnchor.rowNumber,
      columnLetter: parsedAnchor.columnLetter,
      sheetTitle: parsedAnchor.sheetTitle,
      sheetId: parsedAnchor.sheetId,
      sheetIdSource: parsedAnchor.sheetIdSource,
      anchorRaw,
      quotedText,
      matchStrategy: parsedAnchor.strategy,
    };
  }

  private parseAnchor(anchorRaw: string): ParsedAnchor {
    const anchor = String(anchorRaw || "");
    const defaults: ParsedAnchor = {
      rowNumber: null,
      columnLetter: null,
      sheetTitle: null,
      sheetId: null,
      sheetIdSource: null,
      strategy: "unmapped",
    };

    const fromA1 = this.parseA1FromText(anchor);
    if (fromA1.rowNumber && fromA1.columnLetter) {
      return {
        ...defaults,
        ...fromA1,
        strategy: "a1-anchor",
      };
    }

    const fromUrl = this.parseUrlLikeAnchor(anchor);
    if (fromUrl.rowNumber || fromUrl.sheetId !== null) {
      return {
        ...defaults,
        ...fromUrl,
        strategy: fromUrl.rowNumber ? "url-range-anchor" : "url-sheet-anchor",
      };
    }

    const parsedJson = this.parseAnchorJson(anchor);
    if (parsedJson) {
      const fromJson = this.extractAnchorFromJson(parsedJson);
      if (fromJson.rowNumber || fromJson.sheetId !== null || fromJson.sheetTitle) {
        return {
          ...defaults,
          ...fromJson,
          strategy: fromJson.rowNumber ? "json-grid-anchor" : "json-sheet-anchor",
        };
      }
    }

    return defaults;
  }

  private parseUrlLikeAnchor(anchor: string): ParsedAnchor {
    const decoded = this.safeDecodeURIComponent(anchor);
    const gidMatch = decoded.match(/[?&#]gid=(\d+)/i);
    const rangeMatch = decoded.match(/[?&#]range=([^&#]+)/i);
    const range = rangeMatch?.[1] ? this.safeDecodeURIComponent(rangeMatch[1]) : "";
    const a1 = range ? this.parseA1FromText(range) : this.emptyParsedAnchor();

    return {
      ...a1,
      sheetId: gidMatch?.[1] ? Number(gidMatch[1]) : a1.sheetId,
      sheetIdSource: gidMatch?.[1] ? "gid" : a1.sheetIdSource,
      strategy: "url-range-anchor",
    };
  }

  private parseA1FromText(text: string): ParsedAnchor {
    const candidates = [String(text || ""), this.safeDecodeURIComponent(String(text || ""))];
    const a1Regex =
      /(?:^|[^A-Z0-9_$])(?:(?:'((?:[^']|'')+)'|([A-Z0-9_ .()[\]\-–—]+))!)?\$?([A-Z]{1,3})\$?([1-9]\d{0,6})(?:\s*:\s*\$?[A-Z]{1,3}\$?[1-9]\d{0,6})?(?=$|[^A-Z0-9_])/gi;

    for (const candidate of candidates) {
      a1Regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = a1Regex.exec(candidate)) !== null) {
        const sheetTitle = match[1] || match[2] || null;
        const columnLetter = match[3]?.toUpperCase() || null;
        const rowNumber = match[4] ? Number(match[4]) : null;

        if (!columnLetter || !rowNumber) {
          continue;
        }

        return {
          ...this.emptyParsedAnchor(),
          rowNumber,
          columnLetter,
          sheetTitle: sheetTitle ? sheetTitle.replace(/''/g, "'").trim() : null,
          strategy: "a1-anchor",
        };
      }
    }

    return this.emptyParsedAnchor();
  }

  private extractAnchorFromJson(value: unknown): ParsedAnchor {
    const result = this.emptyParsedAnchor();

    const applyA1 = (text: string) => {
      const parsed = this.parseA1FromText(text);
      if (parsed.rowNumber && !result.rowNumber) result.rowNumber = parsed.rowNumber;
      if (parsed.columnLetter && !result.columnLetter) result.columnLetter = parsed.columnLetter;
      if (parsed.sheetTitle && !result.sheetTitle) result.sheetTitle = parsed.sheetTitle;
      if (parsed.sheetId !== null && result.sheetId === null) {
        result.sheetId = parsed.sheetId;
        result.sheetIdSource = parsed.sheetIdSource;
      }
    };

    const visit = (item: unknown, path: string[] = []) => {
      if (!item || typeof item !== "object") {
        return;
      }

      if (Array.isArray(item)) {
        item.forEach((entry) => visit(entry, path));
        return;
      }

      for (const [rawKey, rawValue] of Object.entries(item as Record<string, unknown>)) {
        const key = rawKey.toLowerCase();
        const nextPath = [...path, key];
        const isMatrixCoordinate = path.includes("matrix");

        if (typeof rawValue === "string") {
          if (["sheettitle", "sheetname", "tabname", "title"].includes(key) && !result.sheetTitle) {
            result.sheetTitle = rawValue.trim();
          }

          if (["range", "a1range", "cell", "cellrange", "location"].includes(key) || /[A-Z]{1,3}\d+/i.test(rawValue)) {
            applyA1(rawValue);
          }
        }

        if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
          if (key === "sheetid" && result.sheetId === null) {
            result.sheetId = rawValue;
            result.sheetIdSource = "sheetId";
          }

          if (key === "gid" && result.sheetId === null) {
            result.sheetId = rawValue;
            result.sheetIdSource = "gid";
          }

          if (key === "uid" && result.sheetId === null) {
            result.sheetId = rawValue;
            result.sheetIdSource = "uid";
          }

          if (["startrowindex", "rowindex"].includes(key) && !result.rowNumber) {
            result.rowNumber = rawValue + 1;
          }

          if (key === "r" && isMatrixCoordinate && !result.rowNumber) {
            result.rowNumber = rawValue + 1;
          }

          if (key === "row" && !result.rowNumber) {
            result.rowNumber = rawValue + 1;
          }

          if (["rownumber", "rownum"].includes(key) && !result.rowNumber) {
            result.rowNumber = rawValue;
          }

          if (["startcolumnindex", "columnindex"].includes(key) && !result.columnLetter) {
            result.columnLetter = this.indexToColumnLetter(rawValue);
          }

          if (key === "c" && isMatrixCoordinate && !result.columnLetter) {
            result.columnLetter = this.indexToColumnLetter(rawValue);
          }

          if (key === "column" && !result.columnLetter) {
            result.columnLetter = this.indexToColumnLetter(rawValue);
          }
        }

        visit(rawValue, nextPath);
      }
    };

    visit(value);
    return result;
  }

  private parseAnchorJson(anchor: string): unknown | null {
    const raw = String(anchor || "").trim();
    if (!raw) return null;

    const tryParse = (value: string): unknown | null => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const parsed = tryParse(raw) || tryParse(this.safeDecodeURIComponent(raw));

    if (typeof parsed === "string") {
      return tryParse(parsed);
    }

    return parsed;
  }

  private emptyParsedAnchor(): ParsedAnchor {
    return {
      rowNumber: null,
      columnLetter: null,
      sheetTitle: null,
      sheetId: null,
      sheetIdSource: null,
      strategy: "unmapped",
    };
  }

  private resolveMissingRowFromQuotedText(
    comment: SheetComment,
    sourceCells: SourceCell[],
    sourceColumns: string[]
  ): SheetComment {
    if (comment.rowNumber && comment.columnLetter) {
      return comment;
    }

    const matchedCell = this.findUniqueSourceCellByQuotedText(comment.quotedText, sourceCells);

    if (!matchedCell) {
      if (comment.rowNumber && sourceColumns.length === 1) {
        return {
          ...comment,
          columnLetter: sourceColumns[0],
        };
      }
      return comment;
    }

    return {
      ...comment,
      rowNumber: comment.rowNumber || matchedCell.rowNumber,
      columnLetter: comment.columnLetter || matchedCell.columnLetter,
      matchStrategy: "quoted-file-content",
    };
  }

  private findUniqueSourceCellByQuotedText(quotedText: string, sourceCells: SourceCell[]): SourceCell | null {
    const quoted = this.normalizeForMatch(quotedText);

    if (quoted.length < 8) {
      return null;
    }

    const exactMatches = sourceCells.filter((cell) => this.normalizeForMatch(cell.value) === quoted);

    if (exactMatches.length === 1) {
      return exactMatches[0];
    }

    const partialMatches = sourceCells.filter((cell) => {
      const value = this.normalizeForMatch(cell.value);

      if (value.length < 8) {
        return false;
      }

      return value.includes(quoted) || quoted.includes(value);
    });

    return partialMatches.length === 1 ? partialMatches[0] : null;
  }

  private isCommentOnTargetSheet(comment: SheetComment, targetSheet: TargetSheetInfo): boolean {
    if (comment.sheetTitle && this.normalizeSheetTitle(comment.sheetTitle) !== this.normalizeSheetTitle(targetSheet.title)) {
      return false;
    }

    if (
      comment.sheetId !== null &&
      targetSheet.sheetId !== null &&
      comment.sheetIdSource !== "uid" &&
      comment.sheetId !== targetSheet.sheetId
    ) {
      return false;
    }

    return true;
  }

  private async getTargetSheetInfo(spreadsheetId: string, sourceTabName: string): Promise<TargetSheetInfo> {
    const sheetsClient = (this.sheets as any).sheets as sheets_v4.Sheets | undefined;

    if (!sheetsClient?.spreadsheets?.get) {
      return {
        title: sourceTabName,
        sheetId: null,
      };
    }

    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    const sheets = response.data.sheets || [];
    const normalizedTarget = this.normalizeSheetTitle(sourceTabName);
    const match = sheets.find(
      (sheet) => this.normalizeSheetTitle(sheet.properties?.title || "") === normalizedTarget
    );

    if (!match?.properties) {
      const titles = sheets.map((sheet) => sheet.properties?.title).filter(Boolean).join(", ");
      throw new Error(`Tab "${sourceTabName}" not found. Available tabs: ${titles}`);
    }

    return {
      title: String(match.properties.title || sourceTabName),
      sheetId: match.properties.sheetId ?? null,
    };
  }

  private async readSourceColumnCells(
    spreadsheetId: string,
    sourceTabName: string,
    sourceColumns: string[],
    startRow: number
  ): Promise<SourceCell[]> {
    const sourceColumnSet = new Set(sourceColumns);
    const firstColumn = sourceColumns[0];
    const lastColumn = sourceColumns[sourceColumns.length - 1];
    const values = await this.sheets.readValues(
      spreadsheetId,
      `${this.quoteSheetName(sourceTabName)}!${firstColumn}${startRow}:${lastColumn}`
    );
    const firstColumnIndex = this.columnLetterToIndex(firstColumn);
    const cells: SourceCell[] = [];

    values.forEach((row, rowIndex) => {
      row.forEach((value, columnOffset) => {
        const columnLetter = this.indexToColumnLetter(firstColumnIndex + columnOffset);

        if (!sourceColumnSet.has(columnLetter)) {
          return;
        }

        cells.push({
          rowNumber: startRow + rowIndex,
          columnLetter,
          value: String(value || ""),
        });
      });
    });

    return cells;
  }

  private async writeSparseRows(
    spreadsheetId: string,
    sourceTabName: string,
    outputColumn: string,
    rowWrites: Array<{ rowNumber: number; value: string }>
  ): Promise<void> {
    if (!rowWrites.length) return;

    let batchStart = rowWrites[0].rowNumber;
    let previousRow = batchStart;
    let batchValues: string[][] = [[rowWrites[0].value]];

    const flush = async () => {
      await this.sheets.writeValues(
        spreadsheetId,
        `${this.quoteSheetName(sourceTabName)}!${outputColumn}${batchStart}:${outputColumn}${previousRow}`,
        batchValues
      );
    };

    for (const item of rowWrites.slice(1)) {
      if (item.rowNumber === previousRow + 1) {
        batchValues.push([item.value]);
        previousRow = item.rowNumber;
        continue;
      }

      await flush();

      batchStart = item.rowNumber;
      previousRow = item.rowNumber;
      batchValues = [[item.value]];
    }

    await flush();
  }

  private xmlTextContent(value: string): string {
    const richTextMatches = Array.from(value.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi));

    if (richTextMatches.length > 0) {
      return this.cleanText(
        richTextMatches
          .map((match) => this.decodeXmlEntities(match[1] || ""))
          .join("")
      );
    }

    return this.cleanText(
      this.decodeXmlEntities(String(value || "").replace(/<[^>]*>/g, " "))
    );
  }

  private cleanXlsxCommentContent(value: string): string {
    const text = this.cleanText(value);

    if (/^\[Threaded comment\]/i.test(text)) {
      const commentIndex = text.indexOf("Comment:");

      if (commentIndex >= 0) {
        return this.cleanText(text.slice(commentIndex + "Comment:".length));
      }
    }

    return text;
  }

  private readZipEntries(buffer: Buffer): ZipEntryMap {
    const entries: ZipEntryMap = new Map();
    const endOfCentralDirectoryOffset = this.findEndOfCentralDirectory(buffer);
    const totalEntries = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
    const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);
    let cursor = centralDirectoryOffset;

    for (let index = 0; index < totalEntries; index++) {
      const signature = buffer.readUInt32LE(cursor);

      if (signature !== 0x02014b50) {
        throw new Error("Invalid XLSX central directory");
      }

      const compressionMethod = buffer.readUInt16LE(cursor + 10);
      const compressedSize = buffer.readUInt32LE(cursor + 20);
      const fileNameLength = buffer.readUInt16LE(cursor + 28);
      const extraFieldLength = buffer.readUInt16LE(cursor + 30);
      const fileCommentLength = buffer.readUInt16LE(cursor + 32);
      const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
      const rawName = buffer.slice(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");
      const fileName = this.normalizeZipPath(rawName);
      const localSignature = buffer.readUInt32LE(localHeaderOffset);

      if (localSignature !== 0x04034b50) {
        throw new Error(`Invalid XLSX local header for ${fileName}`);
      }

      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
      const compressedData = buffer.slice(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        entries.set(fileName, Buffer.from(compressedData));
      } else if (compressionMethod === 8) {
        entries.set(fileName, inflateRawSync(compressedData));
      }

      cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }

    return entries;
  }

  private findEndOfCentralDirectory(buffer: Buffer): number {
    const minimumOffset = Math.max(0, buffer.length - 0xffff - 22);

    for (let offset = buffer.length - 22; offset >= minimumOffset; offset--) {
      if (buffer.readUInt32LE(offset) === 0x06054b50) {
        return offset;
      }
    }

    throw new Error("Invalid XLSX archive: missing central directory");
  }

  private parseXmlAttributes(value: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(value)) !== null) {
      const key = match[1];
      const rawValue = match[2] ?? match[3] ?? "";

      attrs[key] = this.decodeXmlEntities(rawValue);
    }

    return attrs;
  }

  private decodeXmlEntities(value: string): string {
    return String(value || "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
  }

  private resolveZipTarget(fromPartPath: string, target: string): string {
    const normalizedTarget = String(target || "").replace(/\\/g, "/");

    if (normalizedTarget.startsWith("/")) {
      return this.normalizeZipPath(normalizedTarget.slice(1));
    }

    const fromDirectory = fromPartPath.slice(0, fromPartPath.lastIndexOf("/") + 1);

    return this.normalizeZipPath(`${fromDirectory}${normalizedTarget}`);
  }

  private normalizeZipPath(value: string): string {
    const parts: string[] = [];

    for (const part of String(value || "").replace(/\\/g, "/").split("/")) {
      if (!part || part === ".") {
        continue;
      }

      if (part === "..") {
        parts.pop();
        continue;
      }

      parts.push(part);
    }

    return parts.join("/");
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private cleanText(value: string): string {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  private normalizeForMatch(value: string): string {
    return this.cleanText(value)
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalizeSheetTitle(value: string): string {
    return String(value || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private safeDecodeURIComponent(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private getNextColumn(columnLetter: string): string {
    const index = this.columnLetterToIndex(columnLetter);
    return this.indexToColumnLetter(index + 1);
  }

  private normalizeColumnSelection(input: string, fieldName: string): string[] {
    const raw = String(input || "").trim().toUpperCase().replace(/\s+/g, "");

    if (!raw) {
      throw new Error(`Missing ${fieldName}`);
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

    return Array.from({ length: end - start + 1 }, (_, offset) => this.indexToColumnLetter(start + offset));
  }

  private getDefaultOutputColumns(sourceColumns: string[]): string[] {
    const lastSourceIndex = Math.max(...sourceColumns.map((column) => this.columnLetterToIndex(column)));
    return sourceColumns.map((_, offset) => this.indexToColumnLetter(lastSourceIndex + offset + 1));
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

  private columnLetterToIndex(columnLetter: string): number {
    const letters = this.normalizeColumnLetter(columnLetter);
    let index = 0;

    for (let i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.charCodeAt(i) - 64);
    }

    return index - 1;
  }

  private indexToColumnLetter(index: number): string {
    let value = index + 1;
    let column = "";

    while (value > 0) {
      const remainder = (value - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      value = Math.floor((value - 1) / 26);
    }

    return column;
  }

  private quoteSheetName(sheetName: string): string {
    return `'${sheetName.replace(/'/g, "''")}'`;
  }

  private normalizeSpreadsheetId(input: string): string {
    const raw = String(input || "").trim();

    if (!raw) return "";
    if (!raw.includes("/")) return raw;

    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] || raw;
  }
}
