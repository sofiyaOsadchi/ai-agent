// src/jobs/validate-lite.ts
import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

type ValidateLiteConfig = {
  spreadsheetIds?: string[]; // URL או ID
  driveFolderId?: string;    // תיקיית Drive (לא חובה)
  controlSheet?: {           // גיליון "בקר" (לא חובה)
    spreadsheetId: string;
    rangeA1: string;
  };
  tabs?: "ALL" | string[];   // "ALL" או רשימת טאבים
  writeCol?: string;         // ברירת־מחדל "G"  → Issue
  fixCol?: string;           // ברירת־מחדל "H"  → Fix (Suggested)
  writeBack?: boolean;       // ברירת־מחדל true
};

type Item = {
  rowIndex1Based: number; // שורת גוגל־שיט (1-based)
  category: string;
  question: string;
  answer: string;
  frequency: string;
};

export class ValidateLiteJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  /** פרומפט: סימון בעיות בלבד + תיקון מוצע, JSON לפי rowIndex1Based */
  private createFlagAndFixPrompt(items: Item[]): string {
    return `Hotel FAQ Validation (Flag only when CLEAR) + Provide a concise fix.

You receive an array of rows with: rowIndex1Based, category, question, answer, frequency.

FLAG ONLY if one of these is DEFINITELY true:
- MISMATCH — answer doesn't provide the specifics the question requests.
- TOO_SHORT — answer is extremely short/unhelpful for a factual FAQ (about < 5 words).
- GRAMMAR — obvious grammar/spelling error that would be unacceptable publicly.
- CONTRADICTS — answer contradicts the question, itself, or other info in the row.
NOTE - between different categories there's a blank line; do NOT flag as mising question and answer.

When NOT SURE → do NOT flag. No nitpicking. Keep it minimal.

If flagged, provide a FIX (replacement answer) following ALL rules:
- Tone: professional, welcoming, luxury-hospitality; third person.
- Do NOT repeat the hotel name.
- For yes/no questions: start with "Yes, …", "No, …", or "Currently, …".
- Otherwise: start with a clear factual statement.
- 10–16 words; clear, decisive; no links, no marketing fluff; publication-ready English.
- 

OUTPUT (STRICT JSON, no markdown):
{"rows":[
  {"rowIndex1Based": <number>,
   "issue": "-",                // "-" if OK; or "MISMATCH – short reason", etc.
   "fix": ""}                   // empty if OK; otherwise the full corrected answer
]}

Return ONE object per input item, SAME order, SAME rowIndex1Based.

INPUT
${JSON.stringify({ items }, null, 2)}`;
  }

  /** פרסינג JSON קשיח (כמו ב-rewrite) */
  private parseRowsOrThrow(text: string): { rowIndex1Based: number; issue: string; fix: string }[] {
    const first = text.indexOf("{");
    const last  = text.lastIndexOf("}");
    const slice = (first >= 0 && last > first) ? text.slice(first, last + 1) : text;
    let obj: any;
    try { obj = JSON.parse(slice); } catch { throw new Error("Model did not return valid JSON for validation output"); }
    if (!obj || !Array.isArray(obj.rows)) throw new Error("Validation JSON must contain a 'rows' array");
    for (const r of obj.rows) {
      if (typeof r.rowIndex1Based !== "number") throw new Error("rowIndex1Based must be a number");
      if (typeof r.issue !== "string") throw new Error("issue must be a string");
      if (typeof r.fix   !== "string") throw new Error("fix must be a string");
    }
    return obj.rows;
  }

  /** אוסף IDs מכל המקורות (רשימה/תיקייה/גיליון בקר) */
  private async resolveSpreadsheetIds(cfg: ValidateLiteConfig): Promise<string[]> {
    const out = new Set<string>();
    if (cfg.spreadsheetIds?.length) {
      for (const s of cfg.spreadsheetIds) out.add(this.sheets.parseSpreadsheetId(s));
    }
    if (cfg.driveFolderId) {
      const fromFolder = await this.sheets.listSpreadsheetIdsInFolder(cfg.driveFolderId);
      fromFolder.forEach(id => out.add(id));
    }
    if (cfg.controlSheet) {
      const matrix = await this.sheets.readValues(cfg.controlSheet.spreadsheetId, cfg.controlSheet.rangeA1);
      for (const row of matrix) for (const cell of row) {
        if (!cell) continue;
        try { out.add(this.sheets.parseSpreadsheetId(cell)); } catch {}
      }
    }
    return [...out];
  }

  /** זיהוי [VERIFY] בשורה (בכל תא) – לדוח בלבד */
  private rowHasVerifyToken(cells: string[]): boolean {
    return cells.some((c) => (c ?? "").toString().includes("[VERIFY]"));
  }

  /** בונה מערך Items + מחזיר גם מיפוי שורות */
  private buildItems(rows: string[][]): { items: Item[]; dataRowCount: number } {
    const h = rows.length;
    const dataRowCount = Math.max(0, h - 1); // row2..h
    const items: Item[] = [];
    for (let r = 2; r <= h; r++) {
      const row = rows[r - 1] ?? [];
      items.push({
        rowIndex1Based: r,
        category:  (row[0] ?? "").toString(),
        question:  (row[1] ?? "").toString(),
        answer:    (row[2] ?? "").toString(),
        frequency: (row[3] ?? "").toString(),
      });
    }
    return { items, dataRowCount };
  }

  async run(cfg: ValidateLiteConfig): Promise<void> {
    const ids = await this.resolveSpreadsheetIds(cfg);
    if (ids.length === 0) {
      console.log(chalk.yellow("ℹ️ No spreadsheets to validate."));
      return;
    }

    const writeIssueCol = (cfg.writeCol ?? "G").toUpperCase(); // Issue
    const writeFixCol   = (cfg.fixCol   ?? "H").toUpperCase(); // Fix (Suggested)
    const writeBack     = cfg.writeBack ?? true;

    console.log(chalk.green(`🧪 Lite validation (flags+fix) on ${ids.length} spreadsheet(s)…`));

    type ReportItem = {
      fileId: string;
      fileName: string;
      tab: string;
      issues: number;         // כמה שורות שסומנו כבעיה
      total: number;          // מספר שורות דאטה
      issueRows: number[];    // מספרי שורות (עד 10 לתצוגה)
      verifyCount: number;    // כמה שורות עם [VERIFY]
      verifyRows: number[];   // מספרי שורות (עד 10)
      issueColumn: string;    // עמודת פלט ל-Issue
      fixColumn: string;      // עמודת פלט ל-Fix
    };

    const report: ReportItem[] = [];

    for (const spreadsheetId of ids) {
      let titles: string[];
      try {
        titles = cfg.tabs === "ALL"
          ? await this.sheets.listSheetTitles(spreadsheetId)
          : (Array.isArray(cfg.tabs) && cfg.tabs.length
              ? cfg.tabs
              : [await this.sheets.getFirstSheetTitle(spreadsheetId)]);
      } catch (e) {
        console.error(chalk.red(`⚠️ Could not load tabs for ${spreadsheetId}`), e);
        continue;
      }

      const fileName = await this.sheets.getSpreadsheetTitle(spreadsheetId);

      for (const title of titles) {
        try {
          const rows = await this.sheets.readValues(spreadsheetId, `${title}!A:Z`);
          if ((rows?.length ?? 0) < 2) {
            console.log(chalk.gray(`… ${fileName} / "${title}" skipped (empty or header only)`));
            continue;
          }

          // בונים Items לפי rowIndex1Based → כמו rewrite (אין הסטות)
          const { items, dataRowCount } = this.buildItems(rows);

          // קריאה אחת למודל לכל טאב
          const json = await this.agent.run(this.createFlagAndFixPrompt(items));
          const out  = this.parseRowsOrThrow(json);

          // מיפוי לפי מספר שורה
          const issueByRow = new Map<number, string>();
          const fixByRow   = new Map<number, string>();
          out.forEach(r => {
            issueByRow.set(r.rowIndex1Based, r.issue ?? "-");
            fixByRow.set(r.rowIndex1Based,   r.fix   ?? "");
          });

          // בניית עמודות פלט באורך מדויק (row2..)
          const issueCol: string[] = [];
          const fixCol:   string[] = [];
          for (let i = 0; i < dataRowCount; i++) {
            const sheetRow = i + 2; // 2..h
            issueCol.push(issueByRow.get(sheetRow) ?? "-");
            fixCol.push(fixByRow.get(sheetRow) ?? "");
          }

          // VERIFY – רק לדוח
          const verifyRows: number[] = [];
          for (let i = 1; i < rows.length; i++) {
            const rowCells = (rows[i] ?? []).map((c) => (c ?? "").toString());
            if (this.rowHasVerifyToken(rowCells)) verifyRows.push(i + 1);
          }

          // שורות שסומנו כבעיה
          const issueRows: number[] = [];
          issueCol.forEach((v, idx) => {
            const x = (v ?? "").trim();
            if (x && x !== "-" && !/^OK$/i.test(x)) issueRows.push(idx + 2);
          });

          // כתיבה חזרה (רק Issue/Fix), לא כותבים VERIFY לגיליון
          if (writeBack) {
            await this.sheets.writeColumn(spreadsheetId, writeIssueCol, "Issue", issueCol);
            // כותבים Fix רק אם יש לפחות תיקון אחד לא-ריק
            if (fixCol.some(v => (v ?? "").trim() !== "")) {
              await this.sheets.writeColumn(spreadsheetId, writeFixCol, "Fix (Suggested)", fixCol);
            }
            await this.sheets.formatSheetLikeFAQ(spreadsheetId, title);
          }

          report.push({
            fileId: spreadsheetId,
            fileName,
            tab: title,
            issues: issueRows.length,
            total: dataRowCount,
            issueRows: issueRows.slice(0, 10),
            verifyCount: verifyRows.length,
            verifyRows: verifyRows.slice(0, 10),
            issueColumn: writeIssueCol,
            fixColumn: writeFixCol,
          });

          const badge =
            issueRows.length || verifyRows.length
              ? chalk.yellow(
                  `⚑ ${fileName} / "${title}": issues ${issueRows.length}/${dataRowCount}, VERIFY ${verifyRows.length} → ${writeIssueCol}/${writeFixCol}`
                )
              : chalk.green(`✓ ${fileName} / "${title}": all good`);
          console.log(badge);
        } catch (e) {
          console.error(chalk.red(`Tab "${title}" failed`), e);
          continue;
        }
      }
    }

    // === דוח מרכזי אחד לכל ההרצה (כל הקבצים/טאבים יחד) ===
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const reportTitle = `FAQ Validation Report – ${ts}`;
    const reportId = await this.sheets.createSpreadsheet(reportTitle);

    const header = [
      "File Name", "File URL", "Tab",
      "Issues", "Total Rows", "Issue Rows (first 10)",
      "VERIFY Count", "VERIFY Rows (first 10)",
      "Issue Column", "Fix Column"
    ];
    const values = [header, ...report.map(r => [
      r.fileName,
      `https://docs.google.com/spreadsheets/d/${r.fileId}`,
      r.tab,
      String(r.issues),
      String(r.total),
      r.issueRows.join(", "),
      String(r.verifyCount),
      r.verifyRows.join(", "),
      r.issueColumn,
      r.fixColumn
    ])];

    await this.sheets.writeValues(reportId, "A1", values);
    console.log(chalk.cyan(`📊 Report: https://docs.google.com/spreadsheets/d/${reportId}`));
  }
}