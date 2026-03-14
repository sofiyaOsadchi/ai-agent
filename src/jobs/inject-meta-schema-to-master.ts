// src/jobs/inject-meta-schema-to-master.ts
import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type InjectMetaSchemaToMasterConfig = {
  masterSpreadsheetId: string;
  masterTabName?: string;

  // example: "de", "en", "fr"
  targetLocale: string;

  // Drive folder with hotel FAQ spreadsheets (file name == hotel name)
  hotelsFolderId: string;

  // Optional: if some file names differ from master hotel name
  hotelNameAliases?: Record<string, string>;

  // Source positions inside each hotel sheet
  sourceTabName?: string; // example: "Sheet1 - DE"
  metaRow?: number;       // default: 71 (values row)
  metaStartCol?: string;  // default: "A" (A71:C71)
  schemaCellA1?: string;  // default: "E74" (schema content)

  // Safety
  dryRun?: boolean;            // default: false
  overwriteExisting?: boolean; // default: false

  // Reporting
  unmatchedTabName?: string;   // default: "Unmatched (Meta/Schema Injection)"
};

type HotelMetaPayload = {
  hotelName: string; // resolved name used for matching
  metaTitle: string;
  metaDescription: string;
  h1: string;
  schemaJsonLd: string;
  sourceSpreadsheetId: string;
  sourceTab: string;
};

export class InjectMetaSchemaToMasterJob {
  constructor(private sheets: SheetsService) {}

  private extractIdFromFolderUrl(urlOrId: string): string {
    const m = urlOrId.match(/\/folders\/([A-Za-z0-9_-]+)/);
    return (m?.[1] ?? urlOrId).trim();
  }

  private quoteA1Sheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  private normalizeHotelName(input: string): string {
    return (input ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–−—]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private hotelNameFromMasterSeoTitle(seoTitle: string): string {
    const s = (seoTitle ?? "").replace(/\u00A0/g, " ").trim();
    return s.replace(/^FAQ\s*\|\s*/i, "").trim();
  }

  private findHeaderIndex(headers: string[], headerName: string): number {
    const norm = (x: string) =>
      (x ?? "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const target = norm(headerName);
    const idx = headers.findIndex(h => norm(String(h ?? "")) === target);
    if (idx === -1) {
      throw new Error(`Master is missing required column header: "${headerName}"`);
    }
    return idx;
  }

  private tryFindHeaderIndex(headers: string[], headerName: string): number | null {
    const norm = (x: string) =>
      (x ?? "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const target = norm(headerName);
    const idx = headers.findIndex(h => norm(String(h ?? "")) === target);
    return idx === -1 ? null : idx;
  }

  private resolveLocalizedHeader(headers: string[], base: string, lang: string): { name: string; idx: number } {
    const l = (lang ?? "").trim().toLowerCase();

    // en uses base without suffix
    if (!l || l === "en") {
      return { name: base, idx: this.findHeaderIndex(headers, base) };
    }

    const candidates = [
      `${base} ${l}`,   // "seo_title de"
      `${base}_${l}`,   // "seo_title_de"
      `${base}-${l}`,   // just in case
    ];

    for (const c of candidates) {
      const idx = this.tryFindHeaderIndex(headers, c);
      if (idx != null) return { name: c, idx };
    }

    throw new Error(`Master is missing localized column for "${base}" and lang "${l}". Tried: ${candidates.join(", ")}`);
  }

  private indexToColumnLetter(index0: number): string {
    let n = index0 + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  private normalizeTabTitle(input: string): string {
  return (input ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[–−—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

private async resolveTabOrFirst(spreadsheetId: string, tabName?: string): Promise<string> {
  const all = await this.sheets.getSheetTitles(spreadsheetId); // צריך פונקציה כזו ב-SheetsService
  if (!all.length) throw new Error(`No tabs found in spreadsheet ${spreadsheetId}`);

  if (tabName && tabName.trim()) {
    const desired = this.normalizeTabTitle(tabName);

    // 1) exact (case-sensitive) first
    const exact = all.find(t => t === tabName.trim());
    if (exact) return exact;

    // 2) normalized match (handles "-" vs "–")
    const normalizedMatch = all.find(t => this.normalizeTabTitle(t) === desired);
    if (normalizedMatch) return normalizedMatch;

    console.warn(`Tab "${tabName}" not found in ${spreadsheetId}. Using first tab: "${all[0]}". Available: [${all.join(", ")}]`);
    return all[0];
  }

  return all[0];
}

  private async readHotelPayload(cfg: InjectMetaSchemaToMasterConfig, spreadsheetId: string, hotelFileName: string): Promise<HotelMetaPayload> {
    const sourceTab = await this.resolveTabOrFirst(spreadsheetId, cfg.sourceTabName);
    const tabA1 = this.quoteA1Sheet(sourceTab);

    const metaRow = cfg.metaRow ?? 71;
    const metaStartCol = (cfg.metaStartCol ?? "A").toUpperCase();
    const schemaCellA1 = (cfg.schemaCellA1 ?? "E74").toUpperCase();

    // A71:C71 (based on metaStartCol)
    const startCode = metaStartCol.charCodeAt(0);
    const endCol = String.fromCharCode(startCode + 2);
    const metaRange = `${tabA1}!${metaStartCol}${metaRow}:${endCol}${metaRow}`;
    const meta = await this.sheets.readValues(spreadsheetId, metaRange);
    const metaRowValues = meta?.[0] ?? [];

    const metaTitle = String(metaRowValues[0] ?? "").trim();
    const metaDescription = String(metaRowValues[1] ?? "").trim();
    const h1 = String(metaRowValues[2] ?? "").trim();

    const schemaRange = `${tabA1}!${schemaCellA1}`;
    const schema = await this.sheets.readValues(spreadsheetId, schemaRange);
    const schemaJsonLd = String(schema?.[0]?.[0] ?? "").trim();

    return {
      hotelName: hotelFileName.trim(),
      metaTitle,
      metaDescription,
      h1,
      schemaJsonLd,
      sourceSpreadsheetId: spreadsheetId,
      sourceTab,
    };
  }

  async run(cfg: InjectMetaSchemaToMasterConfig): Promise<void> {
    const folderId = this.extractIdFromFolderUrl(cfg.hotelsFolderId);
    const unmatchedTabName = cfg.unmatchedTabName ?? "Unmatched (Meta/Schema Injection)";
    const overwriteExisting = cfg.overwriteExisting ?? false;
    const dryRun = cfg.dryRun ?? false;

    // 1) Read master
    const masterTab = await this.resolveTabOrFirst(cfg.masterSpreadsheetId, cfg.masterTabName);
    const masterTabA1 = this.quoteA1Sheet(masterTab);

    const masterRows = await this.sheets.readValues(cfg.masterSpreadsheetId, `${masterTabA1}!A:AZ`);
    if (!masterRows.length) throw new Error("Master sheet is empty");

    const headers = (masterRows[0] ?? []).map(x => String(x ?? ""));

    const seoTitleBaseIdx = this.findHeaderIndex(headers, "seo_title"); // matching source: always base EN

    const seoTitleWrite = this.resolveLocalizedHeader(headers, "seo_title", cfg.targetLocale);
    const seoDescWrite = this.resolveLocalizedHeader(headers, "seo_description", cfg.targetLocale);
    const seoSchemaWrite = this.resolveLocalizedHeader(headers, "seo_head_after", cfg.targetLocale);
    const h1Write = this.resolveLocalizedHeader(headers, "title", cfg.targetLocale);

    console.log(
      chalk.gray(
        `Locale="${cfg.targetLocale}" -> columns: ${seoTitleWrite.name}, ${seoDescWrite.name}, ${seoSchemaWrite.name}, ${h1Write.name}`
      )
    );

    // Build lookup: normalized hotel name -> master sheet row number (1-based)
    const masterLookup = new Map<string, number>();
    for (let r = 1; r < masterRows.length; r++) {
      const row = masterRows[r] ?? [];
      const seoTitle = String(row[seoTitleBaseIdx] ?? "").trim();
      if (!seoTitle) continue;

      const hotelName = this.hotelNameFromMasterSeoTitle(seoTitle);
      if (!hotelName) continue;

      const key = this.normalizeHotelName(hotelName);
      if (!masterLookup.has(key)) masterLookup.set(key, r + 1);
    }

    console.log(chalk.cyan(`Master lookup size: ${masterLookup.size}`));

    // 2) List hotel sheets in folder
    const files = await this.sheets.listSpreadsheetsInFolderWithNamesRecursive(folderId);
    console.log(chalk.cyan(`Hotel sheets found in folder: ${files.length}`));

    const updates: Array<{ range: string; values: string[][] }> = [];
    const unmatched: Array<{
      fileName: string;
      resolvedHotelName: string;
      reason: string;
      source_spreadsheet_id: string;
    }> = [];

    let matchedCount = 0;
    let plannedWrites = 0;
    let skippedBecauseExists = 0;
    let skippedBecauseEmptyPayload = 0;

    const colLetter = (idx0: number) => this.indexToColumnLetter(idx0);

    const canWrite = (sheetRow1: number, colIdx0: number, valueToWrite: string): boolean => {
      if (!valueToWrite.trim()) return false;
      if (overwriteExisting) return true;

      const row0 = sheetRow1 - 1;
      const existing = String(masterRows[row0]?.[colIdx0] ?? "").trim();
      return !existing;
    };

    for (const f of files) {
      const fileName = (f.name ?? "").trim();
      if (!fileName) continue;

      const alias = cfg.hotelNameAliases?.[fileName];
      const resolvedHotelName = (alias ?? fileName).trim();
      const key = this.normalizeHotelName(resolvedHotelName);

      const masterRow1 = masterLookup.get(key);
      if (!masterRow1) {
        unmatched.push({
          fileName,
          resolvedHotelName,
          reason: "No matching master row by seo_title (FAQ | {Hotel Name})",
          source_spreadsheet_id: f.id,
        });
        continue;
      }

      const payload = await this.readHotelPayload(cfg, f.id, resolvedHotelName);

      if (!payload.metaTitle.trim() && !payload.metaDescription.trim() && !payload.h1.trim() && !payload.schemaJsonLd.trim()) {
        skippedBecauseEmptyPayload++;
        unmatched.push({
          fileName,
          resolvedHotelName,
          reason: `Source payload empty (A${cfg.metaRow ?? 71}:C${cfg.metaRow ?? 71} and ${cfg.schemaCellA1 ?? "E74"})`,
          source_spreadsheet_id: f.id,
        });
        continue;
      }

      matchedCount++;

      const writeIfAllowed = (targetColIdx0: number, value: string) => {
        if (!value.trim()) return;
        if (!canWrite(masterRow1, targetColIdx0, value)) {
          skippedBecauseExists++;
          return;
        }
        const a1 = `${masterTabA1}!${colLetter(targetColIdx0)}${masterRow1}`;
        updates.push({ range: a1, values: [[value]] });
        plannedWrites++;
      };

      writeIfAllowed(seoTitleWrite.idx, payload.metaTitle);
      writeIfAllowed(seoDescWrite.idx, payload.metaDescription);
      writeIfAllowed(h1Write.idx, payload.h1);
      writeIfAllowed(seoSchemaWrite.idx, payload.schemaJsonLd);
    }

    console.log(chalk.cyan(`Matched hotels: ${matchedCount}`));
    console.log(chalk.cyan(`Planned cell writes: ${plannedWrites}`));
    console.log(chalk.gray(`Skipped (existing values, overwriteExisting=false): ${skippedBecauseExists}`));
    console.log(chalk.gray(`Skipped (empty payload): ${skippedBecauseEmptyPayload}`));
    console.log(chalk.yellow(`Unmatched count: ${unmatched.length}`));

    if (dryRun) {
      console.log(chalk.yellow("dryRun=true -> no writes performed"));
    } else {
      if (updates.length) {
        await this.sheets.batchWriteValues(cfg.masterSpreadsheetId, updates, "RAW");
      }
    }

    // 3) Unmatched report tab
    await this.sheets.ensureTab(cfg.masterSpreadsheetId, unmatchedTabName);
    await this.sheets.clearTabValues(cfg.masterSpreadsheetId, unmatchedTabName);

    const reportRows: string[][] = [
      ["file_name", "resolved_hotel_name", "reason", "source_spreadsheet_id"],
      ...unmatched.map(u => [u.fileName, u.resolvedHotelName, u.reason, u.source_spreadsheet_id]),
    ];

    await this.sheets.writeValues(cfg.masterSpreadsheetId, `${this.quoteA1Sheet(unmatchedTabName)}!A1`, reportRows);

    console.log(chalk.green(`Done. Unmatched report written to tab: "${unmatchedTabName}"`));
  }
}