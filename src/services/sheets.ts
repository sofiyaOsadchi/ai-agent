import { google, sheets_v4, drive_v3 } from "googleapis";
import dotenv from "dotenv";
import serviceAccount from "../credentials/service-account.json";
dotenv.config();

/**
 * Google Sheets helper – creates a sheet and uploads TSV data.
 * If an e‑mail is provided, the sheet is automatically shared with that user.
 */
export class SheetsService {
  private sheets: sheets_v4.Sheets;
  private drive: drive_v3.Drive;
  private shareWith: string | null;

 constructor(emailToShare?: string) {
    const auth = new google.auth.JWT({
      email:  serviceAccount.client_email,
      key:    serviceAccount.private_key,
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/documents",
      ],
      subject: process.env.OWNER_EMAIL,   // ← האימפרסונציה
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

  // === Helpers for translate mode: ID parsing, read/write, duplicate tab ===

  /** Parse spreadsheetId from URL or return as-is if already an ID */
  parseSpreadsheetId(input: string): string {
    if (/^[A-Za-z0-9-_]{20,}$/.test(input)) return input.trim(); // looks like an ID
    const match = input.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
    if (!match) throw new Error(`Cannot parse spreadsheetId from: ${input}`);
    return match[1];
  }

 /** Get a sheet's numeric ID by its tab title (normalize spaces/NBSP; fallback to first tab) */
async getSheetIdByTitle(spreadsheetId: string, title: string): Promise<number> {
  // נירמול רווחים/‏NBSP כדי לתפוס "Sheet1" גם אם יש תווים סמויים
  const normalize = (s: string) =>
    (s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

  const target = normalize(title);
  const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
  const sheets = meta.data.sheets ?? [];

  // ניסיון התאמה מדויקת (אחרי נירמול)
  const match = sheets.find(s => normalize(s.properties?.title ?? "") === target);
  if (match?.properties?.sheetId != null) {
    return match.properties.sheetId!;
  }

  // Fallback: אם אין התאמה — לא מפילים ריצה, פשוט חוזרים לטאב הראשון
  const first = sheets[0]?.properties;
  const titles = sheets.map(s => s.properties?.title).filter(Boolean).join(", ");
  console.warn(
    `getSheetIdByTitle: "${title}" not found. Falling back to first tab: "${first?.title}". Available: [${titles}]`
  );
  if (first?.sheetId == null) throw new Error(`No sheets found in ${spreadsheetId}`);
  return first.sheetId!;
}

  /** Duplicate an existing tab (preserves formatting 1:1) */
  async duplicateSheet(spreadsheetId: string, sourceSheetId: number, newTitle: string): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          duplicateSheet: {
            sourceSheetId,
            insertSheetIndex: 999,
            newSheetName: newTitle
          }
        }]
      }
    });
  }

  /** Read values (2D array) from an A1 range */
  async readValues(spreadsheetId: string, rangeA1: string): Promise<string[][]> {
    const res = await this.sheets.spreadsheets.values.get({ spreadsheetId, range: rangeA1 });
    return res.data.values ?? [];
  }

  /** Write values (2D array) to an A1 range with RAW input */
  async writeValues(spreadsheetId: string, rangeA1: string, values: string[][]): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: rangeA1,
      valueInputOption: "RAW",
      requestBody: { values }
    });
  }

  /** Return the first tab title (fallback if source tab not provided or missing) */
  async getFirstSheetTitle(spreadsheetId: string): Promise<string> {
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
    const first = meta.data.sheets?.[0]?.properties?.title;
    if (!first) throw new Error(`No sheets found in ${spreadsheetId}`);
    return first;
  }

    /** שם הקובץ (Spreadsheet title) */
  async getSpreadsheetTitle(spreadsheetId: string): Promise<string> {
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
    return meta.data.properties?.title ?? spreadsheetId;
  }

  /** כל קבצי ה-Sheets שבתיקייה */
async listSpreadsheetIdsInFolder(folderId: string): Promise<string[]> {
  const q = [
    `'${folderId}' in parents`,
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "trashed = false",
  ].join(" and ");

  const ids: string[] = [];
  let pageToken: string | undefined = undefined;

  do {
    // לא לעשות destructuring ל-data — זה גרם לשגיאת ts7022
    const res = await this.drive.files.list({
      q,
      pageSize: 1000,
      pageToken,
      fields: "nextPageToken, files(id, name)",
    });

    // טיפוס מפורש – פותר ts7022/ts7006
    const data: drive_v3.Schema$FileList = res.data;
    const files: drive_v3.Schema$File[] = data.files ?? [];

    for (const f of files) {
      if (f.id) ids.push(f.id);
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return ids;
}

  /** רשימת כל הטאבים בגיליון */
  async listSheetTitles(spreadsheetId: string): Promise<string[]> {
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
    return (meta.data.sheets ?? [])
      .map(s => s.properties?.title)
      .filter((t): t is string => !!t);
  }

  /** מעצב את הגיליון לפי כללים קבועים (A‑G) */
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
    range: "A:G",
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
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
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
      range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
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



  [4, 5, 6].forEach((idx) => {
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
          endColumnIndex: 7,
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

  /**
   * NEW – writes a single column of data (with header) into an existing sheet.
   * @param spreadsheetId Google Sheet ID.
   * @param columnLetter  Target column letter, e.g. "E".
   * @param header        Header to place in row 1.
   * @param values        Array with one element per data‑row (row 2 → …).
   */
  async writeColumn(
    spreadsheetId: string,
    columnLetter: string,
    header: string,
    values: string[]
  ): Promise<void> {
    // Build a 2‑D array: first row is header, then one cell per value
    const body: string[][] = [[header], ...values.map((v) => [v])];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${columnLetter}1`,
      valueInputOption: "RAW",
      requestBody: { values: body },
    });
  }

  /**
   * מחיל את אותה תבנית עיצוב כמו בשאלונים (formatSheet) על טאב קיים לפי שם.
   * שומר על:
   * - כותרת בשורה 1 מעוצבת (A:G)
   * - עטיפת טקסט + Vertical middle לכל התאים (משורה 2 והלאה)
   * - יישור Center לעמודת Frequency (D)
   * - רוחבי עמודות: B,C = 500px; A,D,E,F,G = 200px
   * - גבולות לכל קבוצה לפי שינוי קטגוריה בעמודה A
   * הערה: בניגוד ל-formatSheet המקורי – כאן **לא** מוסיפים שורות ריקות בין קבוצות,
   * כדי לא לשנות את מבנה הגיליון הקיים.
   */
  async formatSheetLikeFAQ(spreadsheetId: string, sheetTitle: string): Promise<void> {
    const sheetId = await this.getSheetIdByTitle(spreadsheetId, sheetTitle);

    // נקרא את הנתונים של הטאב הספציפי לצורך זיהוי קבוצות קטגוריה
    const { data } = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!A:G`,
    });
    const rows = data.values ?? [];
    if (rows.length < 2) return;

    // חישוב קבוצות לפי שינוי בקטגוריה (עמודה A)
    const categoryCol = 0, questionCol = 1, answerCol = 2, freqCol = 3;
    const groups: Array<[number, number]> = [];
    let current = rows[1][categoryCol] ?? "";
    let start   = 2; // 1-based row index

    for (let r = 3; r <= rows.length; r++) {
      const next = rows[r - 1]?.[categoryCol];
      if (next && next !== current) {
        groups.push([start, r - 1]);
        start   = r;
        current = next;
      }
    }
    groups.push([start, rows.length]);

    const requests: any[] = [];

    // 1) Header styling A:G בשורה 1
    requests.push(
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
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
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 31 },
          fields: "pixelSize",
        },
      }
    );

    // 2) עטיפת טקסט + Vertical middle לכל התאים משורה 2 והלאה (A:G)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
        cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    });

    // 3) יישור Center לעמודת D (Frequency)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: freqCol, endColumnIndex: freqCol + 1 },
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
        fields: "userEnteredFormat(horizontalAlignment)",
      },
    });

    // 4) רוחבי עמודות — כמו בתבנית FAQ
    requests.push(
      // B & C רחבות
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: questionCol, endIndex: answerCol + 1 },
          properties: { pixelSize: 500 },
          fields: "pixelSize",
        },
      },
      // A, D, E, F, G = 200px
      ...[categoryCol, freqCol, 4, 5, 6].map((idx) => ({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize: 200 },
          fields: "pixelSize",
        },
      }))
    );

    // 5) גבולות שחורים סביב כל קבוצה (A:G), ללא הוספת שורות ריקות
    for (const [startRow, endRow] of groups) {
      requests.push({
        updateBorders: {
          range: {
            sheetId,
            startRowIndex: startRow - 1,
            endRowIndex: endRow,
            startColumnIndex: 0,
            endColumnIndex: 7,
          },
          top:    { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
          bottom: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
          left:   { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
          right:  { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
          innerHorizontal: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
          innerVertical:   { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
        },
      });
    }

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}
