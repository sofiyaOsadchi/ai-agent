// src/jobs/meta-tags-job.ts
// Code in English. Comments can be Hebrew.

import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

export type MetaTagsPayload = {
  mode?: "template" | "ai";
  generationMode?: "template" | "ai";
  sourceType?: "manual" | "sheet" | "folder";
  brandName?: string;
  domain?: string;
  pageList?: string;
  spreadsheetId?: string;
  folderId?: string;
  folderRecursive?: boolean;
  folderMaxFiles?: number;
  language?: string;
  languages?: string[];
  pageType?: string;
  intent?: string;
  titleMax?: number;
  descMax?: number;
  variantCount?: number;
  titleTemplate?: string;
  descTemplate?: string;
  voice?: string;
  primaryKeyword?: string;
  aiBrief?: string;
  outputMode?: "preview" | "newTab" | "firstTabRange" | "existingRange";
  outputTabName?: string;
  outputStartCell?: string;
  activeRules?: string[];
};

export type MetaTagsResultRow = {
  language?: string;
  page: string;
  url: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  ogTitle: string;
  ogDescription: string;
  titleLength: number;
  descriptionLength: number;
  status: "good" | "warn" | "bad";
};

export type MetaTagsResult = {
  mode: "template" | "ai";
  sourceType: "manual" | "sheet" | "folder";
  rows: MetaTagsResultRow[];
  summary: {
    pages: number;
    rows: number;
    language: string;
    generatedBy: "template" | "ai";
    writeback?: {
      enabled: boolean;
      writes: number;
      tabName: string;
      startCell: string;
      error?: string;
    };
  };
};

type PageInput = {
  raw: string;
  page: string;
  path: string;
  spreadsheetId?: string;
};

export class MetaTagsJob {
  constructor(private agent: AIAgent, private sheets?: SheetsService) {}

  async run(payload: MetaTagsPayload): Promise<MetaTagsResult> {
    const normalized = this.normalizePayload(payload);
    const pages = await this.resolvePages(normalized);

    console.log(chalk.cyan(`META_TAGS_MODE=${normalized.mode}`));
    console.log(chalk.cyan(`META_TAGS_SOURCE=${normalized.sourceType}`));
    console.log(chalk.cyan(`META_TAGS_PAGES=${pages.length}`));

    const result = normalized.mode === "ai"
      ? await this.runAi(normalized, pages)
      : this.runTemplate(normalized, pages);

    try {
      result.summary.writeback = await this.writeBackIfNeeded(normalized, pages, result.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.summary.writeback = {
        enabled: normalized.outputMode !== "preview",
        writes: 0,
        tabName: normalized.outputTabName,
        startCell: normalized.outputStartCell,
        error: message,
      };
      console.log(chalk.yellow(`⚠️ meta-tags writeback failed: ${message}`));
    }

    console.log("META_TAGS_RESULT_JSON_START");
    console.log(JSON.stringify(result, null, 2));
    console.log("META_TAGS_RESULT_JSON_END");
    console.log(chalk.green(`✅ meta-tags completed | Rows: ${result.rows.length}`));

    return result;
  }

  private async runAi(payload: Required<MetaTagsPayload>, pages: PageInput[]): Promise<MetaTagsResult> {
    const system = [
      "You are an expert SEO metadata editor.",
      "Create concise, search-friendly metadata for real website pages.",
      "Return strict JSON only. Do not include markdown or commentary.",
      "Every row must respect the requested maximum character lengths.",
      "Avoid clickbait, keyword stuffing, unsupported claims and generic filler.",
      "Never invent a brand. If brandName is empty, do not use the domain as a brand name.",
      "The requested language is mandatory. All visible copy must be in that target language.",
    ].join("\n");

    const outputRows: MetaTagsResultRow[] = [];

    for (const language of payload.languages) {
      const prompt = JSON.stringify({
        task: "Generate metadata rows",
        targetLanguage: {
          code: language,
          name: this.languageName(language),
          rule: `Every visible field must be written in ${this.languageName(language)}. Do not return English unless the language code is en.`,
        },
        outputContract: {
          rows: [
            {
              language,
              page: "string",
              url: "string",
              metaTitle: "string",
              metaDescription: "string",
              h1: "string",
              ogTitle: "string",
              ogDescription: "string",
            },
          ],
        },
        constraints: {
          language,
          titleMax: payload.titleMax,
          descriptionMax: payload.descMax,
          variantsPerPage: payload.variantCount,
          voice: payload.voice,
          primaryKeyword: payload.primaryKeyword,
          activeRules: payload.activeRules,
          requiredRows: pages.length * payload.variantCount,
        },
        context: {
          brandName: payload.brandName || null,
          domain: payload.domain && payload.domain !== "example.com" ? payload.domain : null,
          aiBrief: payload.aiBrief,
          pages,
        },
        qualityBar: [
          "Do not use placeholder words such as Example unless the user provided them.",
          "Use natural SEO copy, not generic filler.",
          "Titles should be specific to the page/topic.",
          "Descriptions should sound useful and human, not like a template.",
        ],
      });

      console.log(chalk.blue(`Requesting AI metadata draft (${language})...`));
      const raw = await this.agent.runWithSystem(prompt, system, "gpt-5.4");
      const parsed = this.parseAiJson(raw);
      const rows = Array.isArray(parsed.rows) ? parsed.rows : [];

      rows.forEach((row: Partial<MetaTagsResultRow>, index: number) => {
        const sourcePage = pages[Math.floor(index / payload.variantCount) % Math.max(pages.length, 1)] || { page: "Page", path: "page", raw: "Page" };
        const page = String(row.page || sourcePage.page);
        const url = String(row.url || this.makeUrl(payload.domain, this.slugify(sourcePage.page)));
        const metaTitle = this.limit(String(row.metaTitle || page), payload.titleMax);
        const metaDescription = this.limit(String(row.metaDescription || ""), payload.descMax);
        const h1 = payload.activeRules.includes("includeH1") ? String(row.h1 || page) : "";
        const ogTitle = payload.activeRules.includes("openGraph") ? String(row.ogTitle || metaTitle) : "";
        const ogDescription = payload.activeRules.includes("openGraph") ? String(row.ogDescription || metaDescription) : "";

        outputRows.push(this.finalizeRow(payload, { ...sourcePage, page, path: sourcePage.path || this.slugify(page) }, metaTitle, metaDescription, h1, ogTitle, ogDescription, url, language));
      });
    }

    return {
      mode: "ai",
      sourceType: payload.sourceType,
      rows: outputRows,
      summary: {
        pages: pages.length,
        rows: outputRows.length,
        language: payload.language,
        generatedBy: "ai",
      },
    };
  }

  private runTemplate(payload: Required<MetaTagsPayload>, pages: PageInput[]): MetaTagsResult {
    const rows: MetaTagsResultRow[] = [];

    for (const page of pages) {
      for (const language of payload.languages) {
      for (let i = 0; i < payload.variantCount; i++) {
        const data = {
          page: page.page,
          brand: payload.brandName,
          intent: payload.intent,
          type: payload.pageType,
          domain: payload.domain,
        };

        let title = this.fillTemplate(payload.titleTemplate, data);
        let description = this.fillTemplate(payload.descTemplate, data);
        if (language !== "en") {
          title = this.localizeTemplateTitle(language, page.page, title);
          description = this.localizeTemplateDescription(language, page.page, description);
        }

        if (i === 1) {
          title = payload.activeRules.includes("brandInTitle")
            ? `${page.page} - ${payload.brandName}`
            : page.page;
          description = `Useful information about ${page.page}, including details, services and next steps for visitors.`;
        }

        if (i === 2) {
          title = `${page.page}: Guide and Details`;
          description = `Review ${page.page} with clear, practical guidance from ${payload.brandName}.`;
        }

        const metaTitle = this.limit(title, payload.titleMax);
        const metaDescription = this.limit(description, payload.descMax);
        const h1 = payload.activeRules.includes("includeH1") ? page.page : "";
        const ogTitle = payload.activeRules.includes("openGraph") ? metaTitle : "";
        const ogDescription = payload.activeRules.includes("openGraph") ? metaDescription : "";
        rows.push(this.finalizeRow(payload, page, metaTitle, metaDescription, h1, ogTitle, ogDescription, undefined, language));
      }
      }
    }

    return {
      mode: "template",
      sourceType: payload.sourceType,
      rows,
      summary: {
        pages: pages.length,
        rows: rows.length,
        language: payload.language,
        generatedBy: "template",
      },
    };
  }

  private normalizePayload(payload: MetaTagsPayload): Required<MetaTagsPayload> {
    const mode = payload.generationMode === "ai" || payload.mode === "ai" ? "ai" : "template";
    const sourceType = payload.sourceType === "folder" || payload.sourceType === "sheet" ? payload.sourceType : "manual";
    const variantCount = mode === "ai" ? this.clamp(Number(payload.variantCount) || 1, 1, 3) : 1;
    const languages = this.normalizeLanguages(payload.languages, payload.language);
    const outputMode =
      payload.outputMode === "newTab" ||
      payload.outputMode === "firstTabRange" ||
      payload.outputMode === "existingRange"
        ? payload.outputMode
        : "preview";

    return {
      mode,
      generationMode: mode,
      sourceType,
      brandName: String(payload.brandName || "").trim(),
      domain: String(payload.domain || "example.com").trim(),
      pageList: String(payload.pageList || "Homepage").trim(),
      spreadsheetId: String(payload.spreadsheetId || "").trim(),
      folderId: String(payload.folderId || "").trim(),
      folderRecursive: payload.folderRecursive === true,
      folderMaxFiles: this.clamp(Number(payload.folderMaxFiles) || 50, 1, 200),
      language: languages[0],
      languages,
      pageType: String(payload.pageType || "general").trim(),
      intent: String(payload.intent || "search").trim(),
      titleMax: this.clamp(Number(payload.titleMax) || 60, 35, 80),
      descMax: this.clamp(Number(payload.descMax) || 155, 110, 180),
      variantCount,
      titleTemplate: String(payload.titleTemplate || "{{page}} | FAQ"),
      descTemplate: String(payload.descTemplate || "Explore {{page}}."),
      voice: String(payload.voice || "clear"),
      primaryKeyword: String(payload.primaryKeyword || "").trim(),
      aiBrief: String(payload.aiBrief || "").trim(),
      outputMode,
      outputTabName: String(payload.outputTabName || "Meta Tags").trim() || "Meta Tags",
      outputStartCell: String(payload.outputStartCell || "A1").trim() || "A1",
      activeRules: Array.isArray(payload.activeRules) ? payload.activeRules : ["brandInTitle", "includeH1", "openGraph"],
    };
  }

  private async resolvePages(payload: Required<MetaTagsPayload>): Promise<PageInput[]> {
    if (payload.sourceType === "sheet") {
      return this.pagesFromSingleSheet(payload);
    }

    if (payload.sourceType === "folder") {
      return this.pagesFromFolder(payload);
    }

    return this.pagesFromPayload(payload);
  }

  private async pagesFromFolder(payload: Required<MetaTagsPayload>): Promise<PageInput[]> {
    if (!this.sheets) {
      throw new Error("meta-tags: Drive folder source requires SheetsService.");
    }

    if (!payload.folderId) {
      throw new Error("meta-tags: Drive folder source requires folderId.");
    }

    const folderId = this.extractFolderId(payload.folderId);
    const files = payload.folderRecursive
      ? await this.sheets.listSpreadsheetsInFolderWithNamesRecursive(folderId)
      : await this.sheets.listSpreadsheetsInFolderWithNames(folderId);

    const limited = files.slice(0, payload.folderMaxFiles);

    console.log(chalk.cyan(`META_TAGS_FOLDER_FILES=${files.length}`));
    if (files.length > limited.length) {
      console.log(chalk.yellow(`Using first ${limited.length} files due to maxFiles limit.`));
    }

    return limited.map((file) => {
      const page = this.cleanFileTopic(file.name);
      return {
        raw: file.name,
        page,
        path: this.slugify(page),
        spreadsheetId: file.id,
      };
    });
  }

  private async pagesFromSingleSheet(payload: Required<MetaTagsPayload>): Promise<PageInput[]> {
    if (!this.sheets) {
      throw new Error("meta-tags: Single Sheet source requires SheetsService.");
    }

    if (!payload.spreadsheetId) {
      throw new Error("meta-tags: Single Sheet source requires spreadsheetId.");
    }

    const spreadsheetId = this.sheets.parseSpreadsheetId(payload.spreadsheetId);
    const title = await this.sheets.getSpreadsheetTitle(spreadsheetId);
    const page = this.cleanFileTopic(title);

    console.log(chalk.cyan(`META_TAGS_SPREADSHEET=${title}`));
    return [{
      raw: title,
      page,
      path: this.slugify(page),
      spreadsheetId,
    }];
  }

  private pagesFromPayload(payload: Required<MetaTagsPayload>): PageInput[] {
    return payload.pageList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((raw) => {
        const urlMatch = raw.match(/^https?:\/\/[^/]+\/?(.*)$/i);
        const path = urlMatch ? urlMatch[1].replace(/\/$/, "") : this.slugify(raw);
        const page = this.cleanPageName(urlMatch && path ? path.split("/").filter(Boolean).pop() || raw : raw);

        return { raw, page, path };
      });
  }

  private extractFolderId(input: string): string {
    return input.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? input.trim();
  }

  private async writeBackIfNeeded(
    payload: Required<MetaTagsPayload>,
    pages: PageInput[],
    rows: MetaTagsResultRow[]
  ): Promise<MetaTagsResult["summary"]["writeback"]> {
    if (payload.outputMode === "preview") {
      return {
        enabled: false,
        writes: 0,
        tabName: payload.outputTabName,
        startCell: payload.outputStartCell,
      };
    }

    if (!this.sheets) {
      throw new Error("meta-tags: Writing output requires SheetsService.");
    }

    if (payload.sourceType === "manual") {
      throw new Error("meta-tags: Manual topics cannot be written back. Choose Single Sheet or Drive folder.");
    }

    const grouped = new Map<string, MetaTagsResultRow[]>();
    rows.forEach((row, index) => {
      const page = pages[index % Math.max(pages.length, 1)];
      const spreadsheetId = page?.spreadsheetId;
      if (!spreadsheetId) return;
      if (!grouped.has(spreadsheetId)) grouped.set(spreadsheetId, []);
      grouped.get(spreadsheetId)!.push(row);
    });

    let writes = 0;
    for (const [spreadsheetId, spreadsheetRows] of grouped) {
      const targetTab = payload.outputMode === "firstTabRange"
        ? await this.sheets.getFirstSheetTitle(spreadsheetId)
        : payload.outputTabName || "Meta Tags";

      await this.sheets.ensureTab(spreadsheetId, targetTab);

      const values = [
        ["Language", "Page", "Meta Title", "Meta Description", "H1"],
        ...spreadsheetRows.map((row) => [
          row.language || payload.language,
          row.page,
          row.metaTitle,
          row.metaDescription,
          row.h1,
        ]),
      ];
      const range = this.makeWriteRange(targetTab, payload.outputStartCell, values.length, values[0].length);
      await this.sheets.writeValues(spreadsheetId, range, values);
      writes += 1;
      console.log(chalk.green(`Wrote ${spreadsheetRows.length} metadata row(s) to ${spreadsheetId} ${range}`));
    }

    return {
      enabled: true,
      writes,
      tabName: payload.outputTabName,
      startCell: payload.outputStartCell,
    };
  }

  private cleanFileTopic(input: string): string {
    return this.cleanPageName(
      input
        .replace(/\s*[\(\[\{](?:copy|draft|final|updated|edited|backup|bak|v\d+|ver\s*\d+)[\)\]\}]\s*$/i, "")
        .replace(/\s*[-_.\u2013\u2014]\s*(copy|draft|final|updated|edited|backup|bak|v\d+|ver\s*\d+)\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  private finalizeRow(
    payload: Required<MetaTagsPayload>,
    page: PageInput,
    metaTitle: string,
    metaDescription: string,
    h1: string,
    ogTitle: string,
    ogDescription: string,
    url = this.makeUrl(payload.domain, page.path),
    language = payload.language
  ): MetaTagsResultRow {
    return {
      language,
      page: page.page,
      url,
      metaTitle,
      metaDescription,
      h1,
      ogTitle,
      ogDescription,
      titleLength: metaTitle.length,
      descriptionLength: metaDescription.length,
      status: this.score(payload, metaTitle, metaDescription),
    };
  }

  private score(payload: Required<MetaTagsPayload>, title: string, description: string): "good" | "warn" | "bad" {
    if (title.length > payload.titleMax || description.length > payload.descMax) return "bad";
    if (title.length < 30 || description.length < 80) return "warn";
    return "good";
  }

  private parseAiJson(raw: string): any {
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("meta-tags: AI response did not contain JSON.");
      return JSON.parse(match[0]);
    }
  }

  private fillTemplate(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{\s*(page|brand|intent|type|domain)\s*\}\}/g, (_, key) => data[key] || "");
  }

  private limit(input: string, max: number): string {
    const s = input.replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    return s.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[,.:\- ]+$/, "").trim();
  }

  private cleanPageName(input: string): string {
    return input
      .replace(/^https?:\/\/[^/]+\/?/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/^https?:\/\/[^/]+\/?/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page";
  }

  private makeUrl(domain: string, path: string): string {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const cleanPath = path.replace(/^\/+/, "") || "page";
    return `https://${cleanDomain}/${cleanPath}`;
  }

  private quoteSheet(tabName: string): string {
    return `'${tabName.replace(/'/g, "''")}'`;
  }

  private cleanStartCell(input: string): string {
    const value = input.trim().toUpperCase();
    return /^[A-Z]+[1-9][0-9]*$/.test(value) ? value : "A1";
  }

  private normalizeLanguages(languages?: string[], language?: string): string[] {
    const allowed = new Set(["en", "he", "de", "fr", "es", "it"]);
    const values = Array.isArray(languages) ? languages : [language || "en"];
    const normalized = values
      .map((value) => String(value || "").trim())
      .filter((value) => allowed.has(value));
    return Array.from(new Set(normalized.length ? normalized : ["en"]));
  }

  private languageName(language: string): string {
    return {
      en: "English",
      he: "Hebrew",
      de: "German",
      fr: "French",
      es: "Spanish",
      it: "Italian",
    }[language] || language;
  }

  private localizeTemplateTitle(language: string, page: string, currentTitle: string): string {
    const defaultLike = currentTitle === page || currentTitle === `${page} | FAQ`;
    if (!defaultLike) return currentTitle;
    return {
      he: `${page} | שאלות נפוצות`,
      de: `${page} | FAQ`,
      fr: `${page} | FAQ`,
      es: `${page} | Preguntas frecuentes`,
      it: `${page} | FAQ`,
    }[language] || currentTitle;
  }

  private localizeTemplateDescription(language: string, page: string, currentDescription: string): string {
    if (!currentDescription.toLowerCase().startsWith("explore ")) return currentDescription;
    return {
      he: `גלו מידע שימושי על ${page}, כולל פרטים חשובים, שירותים, מיקום והכוונה מעשית לפני ההזמנה.`,
      de: `Entdecken Sie nuetzliche Informationen zu ${page}, darunter wichtige Details, Services, Lage und praktische Hinweise vor der Buchung.`,
      fr: `Decouvrez les informations utiles sur ${page}, avec les details essentiels, les services, la localisation et les conseils pratiques avant de reserver.`,
      es: `Descubre informacion util sobre ${page}, incluidos detalles clave, servicios, ubicacion y orientacion practica antes de reservar.`,
      it: `Scopri informazioni utili su ${page}, inclusi dettagli importanti, servizi, posizione e indicazioni pratiche prima di prenotare.`,
    }[language] || currentDescription;
  }

  private makeWriteRange(tabName: string, startCell: string, rowCount: number, colCount: number): string {
    const start = this.parseCell(this.cleanStartCell(startCell));
    const endCol = this.columnName(start.col + Math.max(colCount, 1) - 1);
    const endRow = start.row + Math.max(rowCount, 1) - 1;
    return `${this.quoteSheet(tabName)}!${this.columnName(start.col)}${start.row}:${endCol}${endRow}`;
  }

  private parseCell(cell: string): { col: number; row: number } {
    const match = cell.match(/^([A-Z]+)([1-9][0-9]*)$/);
    if (!match) return { col: 1, row: 1 };
    return {
      col: this.columnNumber(match[1]),
      row: Number(match[2]),
    };
  }

  private columnNumber(name: string): number {
    return name.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
  }

  private columnName(index: number): string {
    let n = Math.max(1, index);
    let out = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
