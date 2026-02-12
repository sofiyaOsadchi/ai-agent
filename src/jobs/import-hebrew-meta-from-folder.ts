// src/jobs/import-hebrew-meta-tags.ts
import chalk from "chalk";

export type ImportHebrewMetaTagsConfig = {
  masterSpreadsheetId: string; // URL or ID
  masterTabName: string;
  masterHotelColIndex: number;

  questionnairesFolderId: string; // folder URL or ID

  hotelNameMap: {
    spreadsheetId: string; // URL or ID
    tabName?: string;
    rangeA1?: string; // default A:B
    englishColIndex?: number; // default 0
    localizedColIndex?: number; // default 1
    headerRows?: number; // default 1
  };

  sourceTabIndex0: number; // 1 = second tab (0-based)

  pull: {
    metaTitleA1: string;        // A71
    metaDescriptionA1: string;  // B71
    h1A1: string;               // C71
    schemaA1: string;           // E74
  };

  writeBack: {
    schemaCol: string;       // I
    titleCol: string;        // M
    descriptionCol: string;  // O
    h1Col: string;           // W
  };

  dryRun?: boolean;
};

type SheetsServiceLike = {
  parseSpreadsheetId(input: string): string;
  readValues(spreadsheetId: string, rangeA1: string): Promise<string[][]>;
  batchWriteValues(
    spreadsheetId: string,
    data: Array<{ range: string; values: string[][] }>,
    valueInputOption?: "RAW" | "USER_ENTERED"
  ): Promise<void>;

  listSpreadsheetsInFolderWithNames(folderId: string): Promise<Array<{ id: string; name: string }>>;
  listSheetTitles(spreadsheetId: string): Promise<string[]>;
  getSpreadsheetTitle(spreadsheetId: string): Promise<string>;
};

const normalize = (s: string) =>
  (s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function extractSingleCell(values: string[][]): string {
  return values?.[0]?.[0] ? String(values[0][0]) : "";
}

function normalizeKey(s: string): string {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function detectHotelEnFromText(
  text: string,
  heToEn: Map<string, string>,
  enToHe: Map<string, string>
): string | null {
  const t = normalizeKey(text);
  if (!t) return null;

  // Prefer longer names first to avoid partial collisions
  const enKeys = Array.from(enToHe.keys()).sort((a, b) => b.length - a.length);
  for (const en of enKeys) {
    if (t.includes(normalizeKey(en))) return en;
  }

  const heKeys = Array.from(heToEn.keys()).sort((a, b) => b.length - a.length);
  for (const he of heKeys) {
    if (t.includes(normalizeKey(he))) return heToEn.get(normalizeKey(he)) ?? null;
  }

  return null;
}

async function buildHotelNameMaps(
  sheets: SheetsServiceLike,
  cfg: ImportHebrewMetaTagsConfig["hotelNameMap"]
): Promise<{
  heToEn: Map<string, string>;
  enToHe: Map<string, string>;
}> {
  const spreadsheetId = sheets.parseSpreadsheetId(cfg.spreadsheetId);
  const tab = cfg.tabName ?? "Sheet1";
  const range = cfg.rangeA1 ?? "A:B";
  const englishIdx = cfg.englishColIndex ?? 0;
  const localizedIdx = cfg.localizedColIndex ?? 1;
  const headerRows = cfg.headerRows ?? 1;

  

  const rows = await sheets.readValues(spreadsheetId, `${tab}!${range}`);
  console.log("[debug] hotelNameMap sheet:", spreadsheetId);
  console.log("[debug] hotelNameMap tab:", tab);
  console.log("[debug] hotelNameMap range:", range);
  console.log("[debug] hotelNameMap header row:", rows?.[0]);
  console.log("[debug] hotelNameMap first rows:", rows?.slice(0, 6));
  console.log("[debug] hotelNameMap total rows:", rows?.length);


  
  const heToEn = new Map<string, string>();
  const enToHe = new Map<string, string>();

  
  for (let i = headerRows; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const en = (r[englishIdx] ?? "").toString().trim();
    const he = (r[localizedIdx] ?? "").toString().trim();
    if (!en && !he) continue;

    if (en && he) {
      enToHe.set(normalize(en), he);
      heToEn.set(normalize(he), en);
    }
  }

  

  return { heToEn, enToHe };
  
}



export class ImportHebrewMetaTagsJob {
  constructor(private sheets: SheetsServiceLike) {}

  async run(config: ImportHebrewMetaTagsConfig): Promise<{
    updatedRows: number;
    updatedCells: number;
    unmatchedHotels: Array<{ row: number; hotel: string }>;
    missingTabs: Array<{ row: number; hotel: string; fileId: string }>;
  }> {
    const masterId = this.sheets.parseSpreadsheetId(config.masterSpreadsheetId);

    const { heToEn, enToHe } = await buildHotelNameMaps(this.sheets, config.hotelNameMap);

    const folderId = config.questionnairesFolderId.includes("folders/")
      ? (config.questionnairesFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? config.questionnairesFolderId)
      : config.questionnairesFolderId;

    const files = await this.sheets.listSpreadsheetsInFolderWithNames(folderId);
    const byTitle = new Map<string, { id: string; name: string }>();
    for (const f of files) byTitle.set(normalize(f.name), f);

    const masterRows = await this.sheets.readValues(masterId, `${config.masterTabName}!A:Z`);


    console.log("[debug] master sheet id:", masterId);
console.log("[debug] master tab:", config.masterTabName);
console.log("[debug] masterHotelColIndex:", config.masterHotelColIndex);

console.log("[debug] master header:", masterRows?.[0]);
console.log("[debug] master first data rows (col A):", masterRows?.slice(1, 8).map(r => r?.[config.masterHotelColIndex] ?? ""));
console.log("[debug] master total rows:", masterRows?.length);

 const header = masterRows?.[0] ?? [];
  const idxHeader = header.indexOf("header");
  const idxSeoTitle = header.indexOf("seo_title");
  const idxSeoTitleHe = header.indexOf("seo_title he");
  const idxTitle = header.indexOf("title");
  const idxTitleHe = header.indexOf("title he");

  const masterHotelIndex = new Map<string, number[]>();
  let masterHotelDetected = 0;

  for (let r = 1; r < masterRows.length; r++) {
    const row = masterRows[r] ?? [];

    const parts = [
      idxHeader >= 0 ? row[idxHeader] : "",
      idxSeoTitle >= 0 ? row[idxSeoTitle] : "",
      idxSeoTitleHe >= 0 ? row[idxSeoTitleHe] : "",
      idxTitle >= 0 ? row[idxTitle] : "",
      idxTitleHe >= 0 ? row[idxTitleHe] : "",
    ];

    const haystack = parts.filter(Boolean).join(" | ");
    const hotelEn = detectHotelEnFromText(haystack, heToEn, enToHe);
    if (!hotelEn) continue;

    masterHotelDetected++;
    const key = normalizeKey(hotelEn);
    const arr = masterHotelIndex.get(key) ?? [];
    arr.push(r);
    masterHotelIndex.set(key, arr);
  }

  console.log("[debug] master detected hotels:", masterHotelDetected);
  console.log("[debug] master unique hotels:", masterHotelIndex.size);


    const updates: Array<{ range: string; values: string[][] }> = [];
    const unmatchedHotels: Array<{ row: number; hotel: string }> = [];
    
    const missingTabs: Array<{ row: number; hotel: string; fileId: string }> = [];

    let updatedRows = 0;

   for (const file of files) {
  // 1) קח את הטאב השני
  const tabTitles = await this.sheets.listSheetTitles(file.id);
  const tabName = tabTitles[config.sourceTabIndex0];
  if (!tabName) {
    missingTabs.push({ row: -1, hotel: file.name, fileId: file.id });
    continue;
  }

  // 2) משוך את הערכים מהתאים
  const metaTitle = extractSingleCell(
    await this.sheets.readValues(file.id, `${tabName}!${config.pull.metaTitleA1}`)
  );
  const metaDesc = extractSingleCell(
    await this.sheets.readValues(file.id, `${tabName}!${config.pull.metaDescriptionA1}`)
  );
  const h1 = extractSingleCell(
    await this.sheets.readValues(file.id, `${tabName}!${config.pull.h1A1}`)
  );
  const schema = extractSingleCell(
    await this.sheets.readValues(file.id, `${tabName}!${config.pull.schemaA1}`)
  );

  // 3) מזהים מלון מתוך התוכן עצמו (זה מה שחסר אצלך)
  const haystack = [metaTitle, metaDesc, h1, schema].filter(Boolean).join(" | ");
  const hotelEnFromQuestionnaire = detectHotelEnFromText(haystack, heToEn, enToHe);

  if (!hotelEnFromQuestionnaire) {
    unmatchedHotels.push({ row: -1, hotel: file.name });
    continue;
  }

  // 4) פה בדיוק נכנס הקוד ששאלת עליו - קישור למאסטר
  const hotelKey = normalizeKey(hotelEnFromQuestionnaire);
  const candidateRows = masterHotelIndex.get(hotelKey) ?? [];

  if (candidateRows.length === 0) {
    unmatchedHotels.push({ row: -1, hotel: hotelEnFromQuestionnaire });
    continue;
  }

  if (candidateRows.length > 1) {
    console.log("[warn] multiple master rows for hotel:", hotelEnFromQuestionnaire, candidateRows);
  }

  const masterRowIndex = candidateRows[0];
  const masterRowNum = masterRowIndex + 1; // שורה אמיתית בגיליון

  // 5) כתיבה למאסטר לשורה שמצאנו
  updates.push({ range: `${config.masterTabName}!${config.writeBack.schemaCol}${masterRowNum}`, values: [[schema]] });
  updates.push({ range: `${config.masterTabName}!${config.writeBack.titleCol}${masterRowNum}`, values: [[metaTitle]] });
  updates.push({ range: `${config.masterTabName}!${config.writeBack.descriptionCol}${masterRowNum}`, values: [[metaDesc]] });
  updates.push({ range: `${config.masterTabName}!${config.writeBack.h1Col}${masterRowNum}`, values: [[h1]] });

  updatedRows++;
  console.log(
    chalk.gray(
      `Master row ${masterRowNum}: "${hotelEnFromQuestionnaire}" <- file "${file.name}" tab "${tabName}"`
    )
  );
}

    if (config.dryRun) {
      console.log(chalk.yellow(`DRY RUN: prepared ${updates.length} cell updates, not writing.`));
      return { updatedRows, updatedCells: updates.length, unmatchedHotels, missingTabs };
    }

    if (updates.length) {
      await this.sheets.batchWriteValues(masterId, updates, "RAW");
    }

    console.log(chalk.green(`✅ Updated rows: ${updatedRows}, cells: ${updates.length}`));
    if (unmatchedHotels.length) console.log(chalk.yellow(`⚠️ Unmatched hotels: ${unmatchedHotels.length}`));
    if (missingTabs.length) console.log(chalk.yellow(`⚠️ Missing second tab: ${missingTabs.length}`));

    return { updatedRows, updatedCells: updates.length, unmatchedHotels, missingTabs };
  }
}