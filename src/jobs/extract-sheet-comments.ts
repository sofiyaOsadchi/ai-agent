import chalk from "chalk";
import type { drive_v3 } from "googleapis";
import { SheetsService } from "../services/sheets.js";

export type ExtractSheetCommentsConfig = {
  spreadsheetId: string;
  sourceTabName: string;
  sourceColumn: string;
  outputColumn?: string;
  startRow?: number;
  outputHeader?: string;
  includeReplies?: boolean;
};

type SheetComment = {
  content: string;
  rowNumber: number | null;
  columnLetter: string | null;
  anchorRaw: string;
};

export class ExtractSheetCommentsJob {
  constructor(private sheets: SheetsService) {}

  async run(config: ExtractSheetCommentsConfig): Promise<void> {
    const spreadsheetId = this.normalizeSpreadsheetId(config.spreadsheetId);
    const sourceTabName = config.sourceTabName.trim();
    const sourceColumn = this.normalizeColumnLetter(config.sourceColumn);
    const outputColumn = this.normalizeColumnLetter(config.outputColumn || this.getNextColumn(sourceColumn));
    const startRow = config.startRow ?? 2;
    const outputHeader = config.outputHeader || "Comment";
    const includeReplies = config.includeReplies !== false;

    if (!spreadsheetId) throw new Error("Missing spreadsheetId");
    if (!sourceTabName) throw new Error("Missing sourceTabName");
    if (!sourceColumn) throw new Error("Missing sourceColumn");

    console.log(chalk.blue("🚀 Starting Sheet Comments Extraction"));
    console.log(chalk.gray(`Source column: ${sourceColumn}`));
    console.log(chalk.gray(`Output column: ${outputColumn}`));
    console.log(chalk.gray(`Include replies: ${includeReplies ? "YES" : "NO"}`));

    const comments = await this.listDriveComments(spreadsheetId);

    console.log(chalk.gray(`Drive comments found: ${comments.length}`));

    const mappedComments = comments
      .map((comment) => this.mapComment(comment, includeReplies))
      .filter((comment) => {
        if (!comment.content) return false;
        if (!comment.rowNumber) return false;

        if (comment.columnLetter && comment.columnLetter !== sourceColumn) return false;

        return comment.rowNumber >= startRow;
      });

    if (!mappedComments.length) {
      console.log(chalk.yellow("⚠️ No comments found for the selected range."));

      const anchorsPreview = comments
        .slice(0, 10)
        .map((comment, index) => `${index + 1}. ${String(comment.anchor || "(empty anchor)")}`)
        .join("\n");

      if (anchorsPreview) {
        console.log(chalk.yellow("Anchor preview for debugging:"));
        console.log(anchorsPreview);
      }

      return;
    }

    const maxRow = Math.max(...mappedComments.map((comment) => comment.rowNumber || 0));
    const outputValues: string[][] = Array.from({ length: maxRow }, () => [""]);

    outputValues[0] = [outputHeader];

    for (const comment of mappedComments) {
      if (!comment.rowNumber) continue;

      const rowIndex = comment.rowNumber - 1;
      const existingValue = outputValues[rowIndex]?.[0] || "";

      outputValues[rowIndex] = [
        existingValue ? `${existingValue}\n${comment.content}` : comment.content,
      ];
    }

    const range = `${this.quoteSheetName(sourceTabName)}!${outputColumn}1:${outputColumn}${maxRow}`;

    await this.sheets.writeValues(spreadsheetId, range, outputValues);

    console.log(chalk.green(`✅ Wrote ${mappedComments.length} comments to column ${outputColumn}`));
    console.log(chalk.underline(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`));
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
      "quotedFileContent," +
      "replies(content,htmlContent,action)" +
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

  private mapComment(comment: drive_v3.Schema$Comment, includeReplies: boolean): SheetComment {
    const mainComment = this.cleanText(comment.content || comment.htmlContent || "");

    const replies = includeReplies && Array.isArray(comment.replies) ? comment.replies : [];

    const replyText = replies
      .filter((reply) => reply.action !== "resolve" && reply.action !== "reopen")
      .map((reply) => this.cleanText(reply.content || reply.htmlContent || ""))
      .filter(Boolean)
      .join("\n");

    const content = [mainComment, replyText].filter(Boolean).join("\n");

    const anchorRaw = String(comment.anchor || "");
    const parsedAnchor = this.parseAnchor(anchorRaw);

    return {
      content,
      rowNumber: parsedAnchor.rowNumber,
      columnLetter: parsedAnchor.columnLetter,
      anchorRaw,
    };
  }

  private parseAnchor(anchorRaw: string): {
    rowNumber: number | null;
    columnLetter: string | null;
  } {
    const anchor = String(anchorRaw || "");

    const a1Match = anchor.match(/(?:^|[^A-Z])([A-Z]{1,3})(\d{1,7})(?:$|[^0-9])/i);

    if (a1Match?.[1] && a1Match?.[2]) {
      return {
        columnLetter: a1Match[1].toUpperCase(),
        rowNumber: Number(a1Match[2]),
      };
    }

    const startRowIndexMatch = anchor.match(/"startRowIndex"\s*:\s*(\d+)/i);
    const startColumnIndexMatch = anchor.match(/"startColumnIndex"\s*:\s*(\d+)/i);

    if (startRowIndexMatch?.[1]) {
      const rowNumber = Number(startRowIndexMatch[1]) + 1;
      const columnIndex = startColumnIndexMatch?.[1] ? Number(startColumnIndexMatch[1]) : null;

      return {
        rowNumber,
        columnLetter: columnIndex !== null ? this.indexToColumnLetter(columnIndex) : null,
      };
    }

    const rowMatch = anchor.match(/"row"\s*:\s*(\d+)/i);
    const colMatch = anchor.match(/"column"\s*:\s*(\d+)/i);

    const rowNumber = rowMatch?.[1] ? Number(rowMatch[1]) + 1 : null;
    const columnIndex = colMatch?.[1] ? Number(colMatch[1]) : null;

    return {
      rowNumber,
      columnLetter: columnIndex !== null ? this.indexToColumnLetter(columnIndex) : null,
    };
  }

  private cleanText(value: string): string {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  private getNextColumn(columnLetter: string): string {
    const index = this.columnLetterToIndex(columnLetter);
    return this.indexToColumnLetter(index + 1);
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
