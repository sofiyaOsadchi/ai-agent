import { google, sheets_v4, drive_v3 } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

/**
 * Google Sheets helper – creates a sheet and uploads TSV data.
 * If an e‑mail is provided, the sheet is automatically shared with that user.
 */

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

function loadServiceAccount(): GoogleServiceAccount {
  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./src/credentials/service-account.json";

  const raw = fs.readFileSync(credentialsPath, "utf8");
  return JSON.parse(raw) as GoogleServiceAccount;
}

export class SheetsService {
  async clearValuesRange(spreadsheetId: string, rangeA1: string): Promise<void> {
  await this.withBackoff(async () => {
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: rangeA1,
    });
  });

  }
  private sheets: sheets_v4.Sheets;
  private drive: drive_v3.Drive;
  private shareWith: string | null;

  // New: per-run cache for spreadsheet metadata
  private spreadsheetMetaCache = new Map<string, sheets_v4.Schema$Spreadsheet>();
  

 constructor(emailToShare?: string) {
  const serviceAccount = loadServiceAccount();

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents",
    ],
    subject: process.env.OWNER_EMAIL,
  });

    this.sheets = google.sheets({ version: "v4", auth });
    this.drive = google.drive({ version: "v3", auth });
    this.shareWith = emailToShare ?? null;
  }


// services/sheets.ts

async batchWriteValues(
  spreadsheetId: string,
  data: Array<{ range: string; values: string[][] }>,
  valueInputOption: "RAW" | "USER_ENTERED" = "RAW"
): Promise<void> {
  if (!data.length) return;

  await this.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption,
      data,
    },
  });
}

async appendRows(
  spreadsheetId: string,
  rangeA1: string,
  values: string[][]
): Promise<void> {
  if (!values.length) return;

  await this.withBackoff(async () => {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: rangeA1,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  });
}

async listSpreadsheetsInFolderWithNames(
  folderId: string
): Promise<Array<{ id: string; name: string }>> {
  const q = [
    `'${folderId}' in parents`,
    "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.shortcut')",
    "trashed = false",
  ].join(" and ");

  const out: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined = undefined;

  do {
    const res = await this.drive.files.list({
      q,
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: "nextPageToken, files(id, name, mimeType, shortcutDetails(targetId))",
    });

    const data: drive_v3.Schema$FileList = res.data as drive_v3.Schema$FileList;
    const files: drive_v3.Schema$File[] = (data.files ?? []) as drive_v3.Schema$File[];

    for (const f of files) {
      if (!f?.id) continue;

      if (f.mimeType === "application/vnd.google-apps.shortcut") {
        const targetId = f.shortcutDetails?.targetId;
        if (targetId) out.push({ id: targetId, name: String(f.name ?? targetId) });
        continue;
      }

      if (f.mimeType === "application/vnd.google-apps.spreadsheet") {
        out.push({ id: f.id, name: String(f.name ?? f.id) });
      }
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return out;
}

async listSpreadsheetsInFolderWithNamesRecursive(
  rootFolderId: string
): Promise<Array<{ id: string; name: string }>> {
  const MIME_FOLDER = "application/vnd.google-apps.folder";
  const MIME_SHEET = "application/vnd.google-apps.spreadsheet";

  const visitedFolders = new Set<string>();
  const out: Array<{ id: string; name: string }> = [];
  const queue: string[] = [rootFolderId];

  while (queue.length > 0) {
    const folderId = queue.shift()!;
    if (visitedFolders.has(folderId)) continue;
    visitedFolders.add(folderId);

    let pageToken: string | undefined = undefined;

    do {
      const res: { data: drive_v3.Schema$FileList } = await this.drive.files.list({
  q: [
    `'${folderId}' in parents`,
    "(mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.spreadsheet')",
    "trashed = false",
  ].join(" and "),
  pageSize: 1000,
  pageToken,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  fields: "nextPageToken, files(id, name, mimeType)",
});

const files: drive_v3.Schema$File[] = (res.data.files ?? []) as drive_v3.Schema$File[];


      for (const f of files) {
        if (!f?.id || !f?.mimeType) continue;

        if (f.mimeType === MIME_SHEET) {
          out.push({ id: f.id, name: String(f.name ?? f.id) });
          continue;
        }

        if (f.mimeType === MIME_FOLDER) {
          queue.push(f.id);
          continue;
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return out;
}

  // Finds sheetId by exact tab title (normalized). Returns null if not found.
private async findSheetIdExact(spreadsheetId: string, title: string): Promise<number | null> {
  const normalize = (s: string) =>
    (s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

  const target = normalize(title);
  const meta = await this.getSpreadsheetMeta(spreadsheetId);
  const sheets = meta.sheets ?? [];

  const match = sheets.find(s => normalize(s.properties?.title ?? "") === target);
  return match?.properties?.sheetId ?? null;
}

// Ensures a tab exists; creates it if missing.
async ensureTab(spreadsheetId: string, tabTitle: string): Promise<void> {
  const existingId = await this.findSheetIdExact(spreadsheetId, tabTitle);
  if (existingId != null) return;

  await this.withBackoff(async () => {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabTitle } } }],
      },
    });
  });
}

// Clears values in a tab (keeps formatting).
async clearTabValues(spreadsheetId: string, tabTitle: string): Promise<void> {
  await this.withBackoff(async () => {
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tabTitle}!A:Z`,
    });
  });
}

  private async withBackoff<T>(fn: () => Promise<T>, maxRetries = 8): Promise<T> {
  let attempt = 0;

  const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.code ?? err?.response?.status;
      if (status !== 429 || attempt >= maxRetries) throw err;

      const base = 1000; // 1s
      const delay = Math.min(60000, base * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 250);
      await sleep(delay + jitter);

      attempt++;
    }
  }
}

private clearMetaCache(spreadsheetId: string) {
    // spreadsheetMetaCache exists in your file
    this.spreadsheetMetaCache.delete(spreadsheetId);
  }

  async deleteSheetByTitle(spreadsheetId: string, title: string): Promise<void> {
    const sheetId = await this.getSheetIdByTitle(spreadsheetId, title);
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ deleteSheet: { sheetId } }] },
    });
    this.clearMetaCache(spreadsheetId);
  }

  // Duplicates a styled template tab into targetTitle (keeps formatting 1:1)
  async recreateTabFromTemplate(
    spreadsheetId: string,
    targetTitle: string,
    templateTitle: string
  ): Promise<void> {
    const titles = await this.listSheetTitles(spreadsheetId);
    const norm = (s: string) => String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

    const templateExists = titles.some(t => norm(t) === norm(templateTitle));
    if (!templateExists) {
      // fallback: just ensure target exists (no styling)
      await this.ensureTab(spreadsheetId, targetTitle);
      return;
    }

    const templateSheetId = await this.getSheetIdByTitle(spreadsheetId, templateTitle);

    const targetExists = titles.some(t => norm(t) === norm(targetTitle));
    if (targetExists) {
      await this.deleteSheetByTitle(spreadsheetId, targetTitle);
    }

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: templateSheetId,
              newSheetName: targetTitle,
            },
          },
        ],
      },
    });

    this.clearMetaCache(spreadsheetId);
  }


private async getSpreadsheetMeta(spreadsheetId: string): Promise<sheets_v4.Schema$Spreadsheet> {
  const cached = this.spreadsheetMetaCache.get(spreadsheetId);
  if (cached) return cached;

  const meta = await this.withBackoff(async () => {
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties(title),sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))",
    });
    return res.data;
  }, 12);

  this.spreadsheetMetaCache.set(spreadsheetId, meta);
  return meta;
}

private normalizeSheetText(s: string): string {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


private async getSheetPropertiesByTitle(
  spreadsheetId: string,
  sheetTitle: string
): Promise<sheets_v4.Schema$SheetProperties> {
  const meta = await this.getSpreadsheetMeta(spreadsheetId);
  const target = this.normalizeSheetText(sheetTitle);

  const sheet = (meta.sheets ?? []).find(
    (s) => this.normalizeSheetText(s.properties?.title ?? "") === target
  );

  if (!sheet?.properties) {
    throw new Error(`Sheet "${sheetTitle}" not found in spreadsheet ${spreadsheetId}`);
  }

  return sheet.properties;
}


async ensureMinColumns(
  spreadsheetId: string,
  sheetTitle: string,
  minColumnCount: number
): Promise<void> {
  const props = await this.getSheetPropertiesByTitle(spreadsheetId, sheetTitle);
  const sheetId = props.sheetId;
  const currentColumnCount = props.gridProperties?.columnCount ?? 0;

  if (sheetId == null) {
    throw new Error(`Missing sheetId for "${sheetTitle}" in spreadsheet ${spreadsheetId}`);
  }

  if (currentColumnCount >= minColumnCount) return;

  await this.withBackoff(async () => {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId,
              dimension: "COLUMNS",
              length: minColumnCount - currentColumnCount,
            },
          },
        ],
      },
    });
  }, 12);

  this.clearMetaCache(spreadsheetId);
}

async getSheetTitles(spreadsheetId: string): Promise<string[]> {
  const meta = await this.getSpreadsheetMeta(spreadsheetId);
  const sheets = meta.sheets ?? [];
  return sheets.map(s => String(s.properties?.title ?? "")).filter(Boolean);
}

  // Returns the first parent folder ID for a file (Spreadsheet)
  async getParentFolderId(fileId: string): Promise<string> {
    const res = await this.drive.files.get({
      fileId,
      fields: "parents",
      supportsAllDrives: true,
    });
    const parents = res.data.parents ?? [];
    if (!parents[0]) throw new Error(`No parent folder found for file: ${fileId}`);
    return parents[0];
  }

  // Copy a spreadsheet file into a specific folder with an optional new name
  async copySpreadsheetToFolder(sourceSpreadsheetId: string, folderId: string, newName?: string): Promise<string> {
    const res = await this.drive.files.copy({
      fileId: sourceSpreadsheetId,
      supportsAllDrives: true,
      requestBody: {
        name: newName,
        parents: [folderId],
      },
      fields: "id",
    });
    if (!res.data.id) throw new Error("Drive copy did not return file id");
    return res.data.id;
  }

  // Create a folder under a parent folder
  async createFolder(name: string, parentId: string): Promise<string> {
    const res = await this.drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    if (!res.data.id) throw new Error("Drive folder create did not return id");
    return res.data.id;
  }

  // Delete all sheets except a specific tab title
  async deleteAllSheetsExcept(spreadsheetId: string, keepTabTitle: string): Promise<void> {
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheets = meta.data.sheets ?? [];

    const normalize = (s: string) => (s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
    const keepTitleNorm = normalize(keepTabTitle);

    const keep = sheets.find((s) => normalize(s.properties?.title ?? "") === keepTitleNorm);
    if (!keep?.properties?.sheetId) {
      const titles = sheets.map((s) => s.properties?.title).filter(Boolean).join(", ");
      throw new Error(`keepTabTitle "${keepTabTitle}" not found in copied sheet. Tabs: ${titles}`);
    }

    const keepId = keep.properties.sheetId;
    const requests: any[] = [];

    for (const sh of sheets) {
      const id = sh.properties?.sheetId;
      if (id != null && id !== keepId) {
        requests.push({ deleteSheet: { sheetId: id } });
      }
    }

    if (!requests.length) return;

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
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

  // Delete all sheets except the one at a given index (0-based)
// This avoids issues with hidden unicode characters in tab titles.
async deleteAllSheetsExceptByIndex(spreadsheetId: string, keepIndex0: number): Promise<string> {
  const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
  const all = meta.data.sheets ?? [];
  if (!all.length) throw new Error(`No sheets found in ${spreadsheetId}`);

  const keep = all[keepIndex0];
  if (!keep?.properties?.sheetId) {
    const titles = all.map(s => s.properties?.title).filter(Boolean).join(", ");
    throw new Error(`keepIndex ${keepIndex0} out of range. Tabs: ${titles}`);
  }

  const keepId = keep.properties.sheetId;
  const keepTitle = keep.properties.title ?? "Sheet1";

  const requests: any[] = [];
  for (const sh of all) {
    const id = sh.properties?.sheetId;
    if (id != null && id !== keepId) {
      requests.push({ deleteSheet: { sheetId: id } });
    }
  }

  if (requests.length) {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  // Return the kept tab title (useful for ranges later)
  return keepTitle;
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
  const normalize = (s: string) =>
    (s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

  const target = normalize(title);
  const meta = await this.getSpreadsheetMeta(spreadsheetId);
  const sheets = meta.sheets ?? [];

  const match = sheets.find(s => normalize(s.properties?.title ?? "") === target);
  if (match?.properties?.sheetId != null) return match.properties.sheetId!;

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

  /** Rename an existing tab */
  async renameSheet(spreadsheetId: string, oldTitle: string, newTitle: string): Promise<void> {
    const sheetId = await this.getSheetIdByTitle(spreadsheetId, oldTitle);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                title: newTitle,
              },
              fields: "title",
            },
          },
        ],
      },
    });
  }

  /** Read values (2D array) from an A1 range */
 /** Read values (2D array) from an A1 range (with 429 backoff) */
async readValues(spreadsheetId: string, rangeA1: string): Promise<string[][]> {
  return this.withBackoff(async () => {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeA1,
    });
    return res.data.values ?? [];
  });
}

  /** Write values (2D array) to an A1 range with RAW input */
 /** Write values (2D array) to an A1 range with RAW input (with 429 backoff) */
async writeValues(spreadsheetId: string, rangeA1: string, values: string[][]): Promise<void> {
  await this.withBackoff(async () => {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: rangeA1,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  });
}

  /** Return the first tab title (fallback if source tab not provided or missing) */
  async getFirstSheetTitle(spreadsheetId: string): Promise<string> {
  const meta = await this.getSpreadsheetMeta(spreadsheetId);
  const first = meta.sheets?.[0]?.properties?.title;
  if (!first) throw new Error(`No sheets found in ${spreadsheetId}`);
  return first;
}

    /** שם הקובץ (Spreadsheet title) */
async getSpreadsheetTitle(spreadsheetId: string): Promise<string> {
  const meta = await this.getSpreadsheetMeta(spreadsheetId);
  return meta.properties?.title ?? spreadsheetId;
}

  /** כל קבצי ה-Sheets שבתיקייה */
async listSpreadsheetIdsInFolder(folderId: string): Promise<string[]> {
  const q = [
    `'${folderId}' in parents`,
    "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.shortcut')",
    "trashed = false",
  ].join(" and ");

  const ids: string[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const res = await this.drive.files.list({
      q,
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: "nextPageToken, files(id, name, mimeType, shortcutDetails(targetId))",
    });

    const data: drive_v3.Schema$FileList = res.data;
    const files: drive_v3.Schema$File[] = data.files ?? [];

    for (const f of files) {
      if (!f.id) continue;

      // Resolve shortcuts to their target spreadsheet id
      if (f.mimeType === "application/vnd.google-apps.shortcut") {
        const targetId = (f as any).shortcutDetails?.targetId as string | undefined;
        if (targetId) ids.push(targetId);
        continue;
      }

      if (f.mimeType === "application/vnd.google-apps.spreadsheet") {
        ids.push(f.id);
      }
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return ids;
}


async listSpreadsheetIdsInFolderRecursive(rootFolderId: string): Promise<string[]> {
  const MIME_FOLDER = "application/vnd.google-apps.folder";
  const MIME_SHEET = "application/vnd.google-apps.spreadsheet";

  const visitedFolders = new Set<string>();
  const resultSheetIds = new Set<string>();
  const queue: string[] = [rootFolderId];

  while (queue.length > 0) {
    const folderId = queue.shift()!;
    if (visitedFolders.has(folderId)) continue;
    visitedFolders.add(folderId);

    let pageToken: string | undefined = undefined;

    do {
      // הערה: this.drive צריך להיות ה-Drive client שלך (googleapis)
      const res: any = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: "nextPageToken, files(id, mimeType)",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = res.data.files ?? [];
      for (const f of files) {
        if (!f.id || !f.mimeType) continue;

        if (f.mimeType === MIME_SHEET) {
          resultSheetIds.add(f.id);
        } else if (f.mimeType === MIME_FOLDER) {
          queue.push(f.id);
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return Array.from(resultSheetIds);
}

  /** רשימת כל הטאבים בגיליון */
 async listSheetTitles(spreadsheetId: string): Promise<string[]> {
  const meta = await this.getSpreadsheetMeta(spreadsheetId);
  return (meta.sheets ?? [])
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

  await this.ensureMinColumns(spreadsheetId, sheetTitle, 7);

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

   await this.withBackoff(async () => {
  await this.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}, 12);
  }
}
