// src/jobs/meta-schema-from-sheet.ts
import { AIAgent } from "../core/agent.js"; // kept for compatibility (not used)
import { SheetsService } from "../services/sheets.js";
import { HOTEL_NAME_HE_MAP } from "./subjobs/hotel-name-hebrew-map.js";

type HotelNameMapConfig = {
  spreadsheetId: string; // ID (not URL)
  tabName?: string; // default: first tab
  rangeA1?: string; // default: "A:B"
  englishColIndex?: number; // default: 0 (A)
  localizedColIndex?: number; // default: 1 (B)
  headerRows?: number; // default: 1
};

type MetaSchemaJobConfig = {
  spreadsheetId: string;
  sourceTab?: string; // which tab to read/write
  metaRow?: number; // default: 70
  schemaRow?: number; // default: metaRow + 3
  metaStartCol?: string; // default: "A"
  schemaCol?: string; // default: "E"

  lang?: string; // default: "en". Example: "he", "de"
  hotelNameMap?: HotelNameMapConfig; // required for he
};

type QAItem = { q: string; a: string };

export class MetaSchemaFromSheetJob {
  constructor(private _agent: AIAgent, private sheets: SheetsService) {}

  private sanitizeHotelTitle(raw: string): string {
    const s0 = (raw ?? "").trim();

    // Remove trailing (...) / [...] / {...}
    let s = s0.replace(/\s*[\(\[\{](?:[^)\]\}]{0,40})[\)\]\}]\s*$/gi, "");

    // Remove trailing markers (supports hyphen, underscore, dot, and unicode dashes)
    s = s.replace(
      new RegExp(
        String.raw`\s*[-_.\u2013\u2014]\s*(updated|edited|final|copy|duplicate|draft|temp|bak|backup|ver\s*\d+|v\d+)\s*$`,
        "gi"
      ),
      ""
    );

    // Remove language/workflow suffixes like "- DE", "- he rewritten", "- english translation"
    s = s.replace(
      new RegExp(
        String.raw`\s*[-_.\u2013\u2014]\s*((?:[a-z]{2,3})|hebrew|english|german|french|spanish|italian|polish|dutch|arabic|russian)\s*(rewritten|rewrite|translated|translation)?\s*$`,
        "gi"
      ),
      ""
    );

    // Hebrew trailing markers
    s = s.replace(/\s*(נערך|מעודכן|עותק|העתק|מתוקן|טיוטה)\s*$/g, "");

    // Remove empty trailing brackets
    s = s.replace(/\s*(\(\s*\)|\[\s*\]|\{\s*\})\s*$/g, "");

    return s.trim();
  }

  private sanitizeOneLine(s: string): string {
    return (s ?? "").replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  private quoteA1Sheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

 private normalizeHotelKey(s: string): string {
  return this.sanitizeHotelTitle(String(s ?? ""))
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

  private extractLangFromTabTitle(title: string): string | null {
    const t = (title ?? "").trim();
    const m = t.match(/[\s]*[-\u2013\u2014][\s]*([A-Za-z]{2,3})\s*$/);
    return m?.[1]?.toLowerCase() ?? null;
  }

  private findTabByLangSuffix(titles: string[], lang: string): string | null {
    const code = (lang ?? "").trim().toLowerCase();
    if (!code) return null;

    const codeUpper = code.toUpperCase();
    const re = new RegExp(String.raw`[\s]*[-\u2013\u2014][\s]*${codeUpper}\s*$`, "i");

    const match = titles.find((t) => re.test(t.trim()));
    return match ?? null;
  }

  private collectQA(rows: string[][]): QAItem[] {
    const Q_COL = 1; // B
    const A_COL = 2; // C
    const out: QAItem[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const q = (row[Q_COL] ?? "").toString().trim();
      const a = (row[A_COL] ?? "").toString().trim();
      if (!q || !a) continue;
      out.push({ q, a });
    }

    return out;
  }

  private buildFaqJsonLd(qa: QAItem[]): object {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qa.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };
  }

  private enforceMaxMetaDescLenHebrew(desc: string, maxLen = 160): string {
    let s = this.sanitizeOneLine(desc);

    // Step 1: remove "Wi-Fi"
    if (s.length > maxLen) {
      s = s.replace(/,\s*Wi-Fi\s*,/g, ",");
      s = s.replace(/\s*Wi-Fi\s*,/g, "");
    }

    // Step 2: remove "חניה"
    if (s.length > maxLen) {
      s = s.replace(/,\s*חניה\s*,/g, ",");
      s = s.replace(/\s*חניה\s*,/g, "");
    }

    // Step 3: hard cut
    if (s.length > maxLen) {
      s = s.slice(0, maxLen).trim();
    }

    return s;
  }

  private enforceMaxMetaDescLenEnglish(desc: string, maxLen = 160): string {
    let s = this.sanitizeOneLine(desc);

    // Step 1: remove Wi-Fi
    if (s.length > maxLen) {
      s = s.replace(" Wi-Fi,", "");
    }

    // Step 2: remove parking
    if (s.length > maxLen) {
      s = s.replace(" parking,", "");
    }

    // Step 3: hard cut
    if (s.length > maxLen) {
      s = s.slice(0, maxLen).trim();
    }

    return s;
  }

  private resolveHebrewHotelName(englishHotelName: string): string | null {
    const targetKey = this.normalizeHotelKey(englishHotelName);

    for (const [enName, heName] of Object.entries(HOTEL_NAME_HE_MAP)) {
      if (this.normalizeHotelKey(enName) === targetKey) {
        return this.sanitizeOneLine(heName);
      }
    }

    return null;
  }

  private buildMetaByLang(params: {
    lang: string;
    hotelNameEn: string;
    hotelNameHe?: string;
  }): { metaTitle: string; metaDesc: string; h1: string } {
    const lang = (params.lang ?? "en").toLowerCase();
    const hotelNameEn = this.sanitizeOneLine(params.hotelNameEn);

    if (lang.startsWith("he")) {
      const hotelNameHe = this.sanitizeOneLine(params.hotelNameHe ?? "");
      if (!hotelNameHe) {
        throw new Error(`Missing Hebrew hotel name for lang="${lang}"`);
      }

      const metaTitle = this.sanitizeOneLine(`שאלות נפוצות | ${hotelNameHe}`);

      const metaDescRaw = this.sanitizeOneLine(
    `מחפשים מידע לקראת החופשה ב${hotelNameHe}? ריכזנו עבורכם את כל השאלות הנפוצות: מידע על סוגי החדרים, המתקנים, החניה ושירותי המלון.`
  );


      const metaDesc = this.enforceMaxMetaDescLenHebrew(metaDescRaw, 160);
      const h1 = this.sanitizeOneLine(`שאלות נפוצות על ${hotelNameHe}`);

      return { metaTitle, metaDesc, h1 };
    }

    if (lang.startsWith("de")) {
  const metaTitle = this.sanitizeOneLine(`FAQ | ${hotelNameEn}`);

  const metaDescRaw = this.sanitizeOneLine(
    `Antworten auf die wichtigsten Fragen zum ${hotelNameEn} - von Zimmern und Anreise bis zu Ausstattung und Serviceleistungen.`
  );

  const metaDesc = this.enforceMaxMetaDescLenEnglish(metaDescRaw, 160);

  const h1 = this.sanitizeOneLine(`FAQ zum ${hotelNameEn}`);

  return { metaTitle, metaDesc, h1 };
}

    // Default: English
    const metaTitle = this.sanitizeOneLine(`FAQ | ${hotelNameEn}`);
    const h1 = this.sanitizeOneLine(`FAQ about ${hotelNameEn}`);

    const metaDescRaw =
      `Find answers to frequently asked questions about ${hotelNameEn}. ` +
      `Learn about check-in times, parking, Wi-Fi, location, amenities, and more.`;

    const metaDesc = this.enforceMaxMetaDescLenEnglish(metaDescRaw, 160);

    return { metaTitle, metaDesc, h1 };
  }

  private async resolveTargetTabTitle(cfg: MetaSchemaJobConfig, lang: string): Promise<string> {
    const titles = await this.sheets.listSheetTitles(cfg.spreadsheetId);
    if (!titles.length) throw new Error(`No sheets found in ${cfg.spreadsheetId}`);

    // If user explicitly provided a tab, use it (and validate it exists)
    if (cfg.sourceTab && cfg.sourceTab.trim()) {
      const wanted = cfg.sourceTab.trim();
      const exists = titles.includes(wanted);
      if (!exists) {
        throw new Error(`sourceTab "${wanted}" not found. Available tabs: ${titles.join(", ")}`);
      }
      return wanted;
    }

    const l = (lang ?? "en").toLowerCase();

    // If lang is not EN, try to find a tab by suffix: " - DE", " - FR", etc.
    if (!l.startsWith("en")) {
      const bySuffix = this.findTabByLangSuffix(titles, l);
      if (bySuffix) return bySuffix;
    }

    // Backward compatibility: Hebrew used to be the second tab
    if (l.startsWith("he")) {
      if (titles.length >= 2) return titles[1];
    }

    // Default: first tab
    return titles[0];
  }

  async run(cfg: MetaSchemaJobConfig): Promise<void> {
    const metaRow = cfg.metaRow ?? 70;
    const schemaRow = cfg.schemaRow ?? metaRow + 3;
    const metaStartCol = cfg.metaStartCol ?? "A";
    const schemaCol = cfg.schemaCol ?? "E";

    let lang = (cfg.lang ?? "en").toLowerCase();

    // Decide which tab we read/write
    const targetTabTitle = await this.resolveTargetTabTitle(cfg, lang);
    const tabA1 = this.quoteA1Sheet(targetTabTitle);

    // If lang not provided explicitly and tab has suffix like " - DE", infer it
    if (!cfg.lang) {
      const inferred = this.extractLangFromTabTitle(targetTabTitle);
      if (inferred) lang = inferred;
    }

    // IMPORTANT: if tab already has tags/schema, clear everything from metaRow and below
    // This removes old Meta/Schema blocks before writing new ones
    await this.sheets.clearValuesRange(cfg.spreadsheetId, `${tabA1}!A${metaRow}:Z`);

    // Read rows FROM THE TARGET TAB
    const rows = await this.sheets.readValues(cfg.spreadsheetId, `${tabA1}!A:Z`);
    if (rows.length === 0) throw new Error(`Source tab "${targetTabTitle}" is empty`);

    // English hotel name from spreadsheet title (file name)
    const rawTitle = await this.sheets.getSpreadsheetTitle(cfg.spreadsheetId);
    const hotelNameEn = this.sanitizeHotelTitle(rawTitle);

    // Collect Q/A FROM THE TARGET TAB
    const qa = this.collectQA(rows);
    if (qa.length === 0) throw new Error(`No Q/A rows found in tab "${targetTabTitle}"`);

     let hotelNameHe: string | undefined = undefined;
    if (lang.startsWith("he")) {
      hotelNameHe = this.resolveHebrewHotelName(hotelNameEn) ?? undefined;

      if (!hotelNameHe) {
        throw new Error(
          `Hebrew hotel name not found in HOTEL_NAME_HE_MAP for: "${hotelNameEn}".`
        );
      }
    }

    // Build meta
    const { metaTitle, metaDesc, h1 } = this.buildMetaByLang({
      lang,
      hotelNameEn,
      hotelNameHe,
    });

    // Build schema
    const schemaObj = this.buildFaqJsonLd(qa);
    const schemaPretty = JSON.stringify(schemaObj, null, 2);
    const schemaWrapped = `<script type="application/ld+json">\n${schemaPretty}\n</script>`;

    // Write meta INTO THE TARGET TAB ONLY
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${metaStartCol}${metaRow}`, [
      ["Meta Title", "Meta Description", "H1"],
    ]);
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${metaStartCol}${metaRow + 1}`, [
      [metaTitle, metaDesc, h1],
    ]);

    // Spacer
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${schemaCol}${schemaRow - 1}`, [[""]]);

    // Write schema INTO THE TARGET TAB ONLY
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${schemaCol}${schemaRow}`, [
      ["FAQ Schema (JSON-LD)"],
    ]);
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${schemaCol}${schemaRow + 1}`, [
      [schemaWrapped],
    ]);

    // Format ONLY THE TARGET TAB
    await this.sheets.formatSheetLikeFAQ(cfg.spreadsheetId, targetTabTitle);
  }
}