import { google, sheets_v4, drive_v3 } from "googleapis";

/**
 * Google Sheets helper – creates a sheet and uploads TSV data.
 * If an e‑mail is provided, the sheet is automatically shared with that user.
 */
export class SheetsService {
  private sheets: sheets_v4.Sheets;
  private drive: drive_v3.Drive;
  private shareWith: string | null;

  constructor(emailToShare?: string) {
    const auth = new google.auth.GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file", // needed for permissions.create
      ],
    });

    this.sheets = google.sheets({ version: "v4", auth });
    this.drive = google.drive({ version: "v3", auth });
    this.shareWith = emailToShare ?? null;
  }

  /** יוצר גיליון חדש בשם המלון, משתף (אם צריך) ומחזיר את ה‑ID */
  async createSpreadsheet(title: string): Promise<string> {
    const { data } = await this.sheets.spreadsheets.create({
      requestBody: { properties: { title } },
      fields: "spreadsheetId",
    });

    if (!data.spreadsheetId) throw new Error("No spreadsheetId");

    // Share with personal Gmail (one‑time, no email notification)
    if (this.shareWith) {
      await this.drive.permissions.create({
        fileId: data.spreadsheetId,
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress: this.shareWith,
        },
        sendNotificationEmail: false,
      });
    }

    return data.spreadsheetId;
  }

  /** ממיר מחרוזת TSV לרשימת מערכים דו‑ממדית */
  private tsvToRows(tsv: string): string[][] {
    return tsv.trim().split("\n").map((row) => row.split("\t"));
  }

  /** כותב את כל הנתונים לגיליון (Sheet1!A1) */
  async uploadTsv(spreadsheetId: string, tsv: string): Promise<void> {
    const values = this.tsvToRows(tsv);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  /** מעצב את הגיליון לפי כללים קבועים (A-D) */
async formatSheet(spreadsheetId: string): Promise<void> {
  const sheetId = 0;                 // הגיליון הראשון
  const categoryCol = 0;             // עמודת קטגוריה = A (0-based)
  const questionCol = 1;             // B
  const answerCol   = 2;             // C
  const freqCol     = 3;             // D

  /* ----------------------------------------------------------------
   * 1. מביאים את כל הנתונים כדי לאתר קבוצות קטגוריה
   * ---------------------------------------------------------------- */
  const { data } = await this.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A:D",
  });
  const rows = data.values ?? [];
  if (rows.length < 2) return;       // אין מה לעצב

  /* חישוב קבוצות */
  const groups: Array<[number, number]> = [];
  let current = rows[1][categoryCol] ?? "";
  let start   = 2;                   // Row index בגיליונות = 1-based

  for (let r = 3; r <= rows.length; r++) {
    const next = rows[r - 1]?.[categoryCol];
    if (next && next !== current) {
      groups.push([start, r - 1]);
      start   = r;
      current = next;
    }
  }
  groups.push([start, rows.length]);

  /* ----------------------------------------------------------------
   * 2. בונים בקשות batchUpdate
   * ---------------------------------------------------------------- */
  const requests: any[] = [];

  /* 2.1 Header – שורה 1, A-D */
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.24, green: 0.52, blue: 0.78 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
          horizontalAlignment: "CENTER",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
    },
  },
  { updateDimensionProperties: {           // גובה כותרת = 31px
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 31 },
      fields: "pixelSize",
  }});

  /* 2.2 Wrap + vertical middle לכל השורות 2-* (A-D) */
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
      cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } },
      fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
    },
  });

  /* 2.3 Center לעמודת D (Frequency) */
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: freqCol, endColumnIndex: freqCol + 1 },
      cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
      fields: "userEnteredFormat(horizontalAlignment)",
    },
  });

  /* 2.4 Column widths – B & C פי-3 */
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: questionCol, endIndex: answerCol + 1 },
      properties: { pixelSize: 500 },
      fields: "pixelSize",
    },
  });

  /* 2.5 Auto-resize A & D */
  [categoryCol, freqCol].forEach((idx) => {
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
      properties: { pixelSize: 200 },
      fields: "pixelSize",
    },
  });
});

  /* 2.6 פנימי: גבולות שחורים ושורות ריקות */
  let rowsInserted = 0;
  for (let i = 0; i < groups.length; i++) {
    const [start, end] = groups[i].map(r => r - 1 + rowsInserted); // התאמת אינדקס אחרי Insert

    // גבולות
    requests.push({
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: start,
          endRowIndex: end + 1,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        top:    { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
        bottom: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
        left:   { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
        right:  { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
        innerHorizontal: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
        innerVertical:   { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
      },
    });

    // שורה ריקה אחרי הקבוצה (לא בקבוצה האחרונה)
    if (i < groups.length - 1) {
      requests.push({
        insertDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: end + 1, endIndex: end + 2 },
          inheritFromBefore: false,
        },
      });
      rowsInserted += 1;
    }
  }

  /* ----------------------------------------------------------------
   * 3. שליחה ב-batch
   * ---------------------------------------------------------------- */
  await this.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

}