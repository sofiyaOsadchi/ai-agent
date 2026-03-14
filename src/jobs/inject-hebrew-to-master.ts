import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type InjectLangToMasterConfig = {
  masterSpreadsheetId: string;
  masterTabName?: string;

  masterHotelColIndex?: number;
  masterQuestionColIndex?: number;

  // Target language columns in master (e.g. de/es/fr)
  masterTargetQuestionColIndex?: number;
  masterTargetAnswerColIndex?: number;

  hotelsFolderId: string;

  hotelNameAliases?: Record<string, string>;

  // Hotel sheet tabs
  hotelEnglishTabName?: string; // default: first tab
  targetLang: string; // "de", "fr", "es"...

  // If your hotel sheets follow "Sheet1 - DE" pattern:
  hotelLangTabBaseName?: string; // default: "Sheet1"
  // Optional override: if you want to force an exact tab name
  hotelLangTabName?: string;

  overwriteExisting?: boolean;
  dryRun?: boolean;

  enableFuzzyQuestionMatch?: boolean; // default: true
  fuzzyQuestionMatchThreshold?: number; // default: 0.93

  // Optional master columns (for unmatched report)
  masterAnswerColIndex?: number;
  masterQuestionIdColIndex?: number;

  // Unmatched report tab name
  unmatchedTabName?: string; // default: `Unmatched (${targetLang.toUpperCase()} Injection)`
};

type TranslationPair = {
  targetQuestion: string;
  targetAnswer: string;
};

export class InjectLangToMasterJob {
  constructor(private sheets: SheetsService) {}

  private normalizeText(input: string): string {
    if (!input) return "";

    const s = input
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–−]/g, "-")
      .toLowerCase()
      .trim();

    const cleaned = s
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned;
  }

  // Debug helpers: surface hidden Unicode chars that often break matching
  private showHiddenChars(s: string): string {
    return (s ?? "")
      .replace(/\u00A0/g, "[NBSP]")
      .replace(/\u200B/g, "[ZWSP]")
      .replace(/\u200E/g, "[LRM]")
      .replace(/\u200F/g, "[RLM]")
      .replace(/\u202A/g, "[LRE]")
      .replace(/\u202B/g, "[RLE]")
      .replace(/\u202C/g, "[PDF]");
  }

  private debugName(label: string, raw: string): void {
    const shown = this.showHiddenChars(raw);
    const norm = this.normalizeText(raw);
    console.log(chalk.gray(`   ${label}: raw="${shown}" | normalized="${norm}"`));
  }

  private extractIdFromFolderUrl(urlOrId: string): string {
    const m = urlOrId.match(/\/folders\/([A-Za-z0-9_-]+)/);
    return (m?.[1] ?? urlOrId).trim();
  }

  private async resolveTabOrFirst(spreadsheetId: string, tabName?: string): Promise<string> {
    if (tabName && tabName.trim()) {
      try {
        await this.sheets.getSheetIdByTitle(spreadsheetId, tabName.trim());
        return tabName.trim();
      } catch {
        const fallback = await this.sheets.getFirstSheetTitle(spreadsheetId);
        console.warn(`Tab "${tabName}" not found in ${spreadsheetId}. Using first tab: "${fallback}"`);
        return fallback;
      }
    }
    return await this.sheets.getFirstSheetTitle(spreadsheetId);
  }

  // Detect a language tab by convention: "{base} - {LANG}", e.g. "Sheet1 - DE"
  private async detectLangTab(
    spreadsheetId: string,
    cfg: { targetLang: string; hotelLangTabName?: string; hotelLangTabBaseName?: string }
  ): Promise<string> {
    const lang = (cfg.targetLang || "").trim().toLowerCase();
    if (!lang) throw new Error("targetLang is required");

    // Forced tab name
    if (cfg.hotelLangTabName && cfg.hotelLangTabName.trim()) {
      return await this.resolveTabOrFirst(spreadsheetId, cfg.hotelLangTabName.trim());
    }

   const base = (cfg.hotelLangTabBaseName?.trim() || "Sheet1");
const LANG = lang.toUpperCase();

const titles = await this.sheets.listSheetTitles(spreadsheetId);

const norm = (t: string) =>
  (t ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")          // NBSP
    .replace(/[–—−]/g, "-")           // כל סוגי המקפים ל־-
    .replace(/\s+/g, " ")
    .trim();

// מחזיר כל שם שנראה כמו "Sheet1 - DE" / "Sheet1 – DE" / "Sheet1- DE" וכו'
const baseN = norm(base);
const langN = norm(LANG);

const match = titles.find(t => {
  const n = norm(t);

  // "sheet1 - de"
  if (n === `${baseN} - ${langN}`) return true;

  // "sheet1- de" / "sheet1 -de" / "sheet1-de"
  if (n === `${baseN}-${langN}`) return true;
  if (n === `${baseN} -${langN}`) return true;
  if (n === `${baseN}- ${langN}`) return true;

  // מכיל את זה איפשהו, או מסתיים ב־"- de"
  if (n.includes(`${baseN} - ${langN}`)) return true;
  if (n.endsWith(`- ${langN}`)) return true;
  if (n.endsWith(`-${langN}`)) return true;

  return false;
});

if (match) return match;

// אין fallback ל־Sheet1 כי זה מסוכן (מזריק אנגלית במקום שפה)
throw new Error(
  `Lang tab not found. Expected something like "${base} - ${LANG}" (or with "–"). Tabs: ${titles.join(" | ")}`
);
  }

  private findColumnIndexByHeader(headers: string[], desired: string[]): number | null {
    const normalizeHeader = (x: string) =>
      (x ?? "")
        .toLowerCase()
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const set = new Set(desired.map(normalizeHeader));
    for (let i = 0; i < headers.length; i++) {
      const h = normalizeHeader(String(headers[i] ?? ""));
      if (set.has(h)) return i;
    }
    return null;
  }

  private detectHotelColumnIndices(rows: string[][], kind: "en" | "target"): { qIdx: number; aIdx: number } {
    const headers = (rows[0] ?? []).map(x => String(x ?? ""));

    const qDesired =
      kind === "en" ? ["question", "q", "question text"] : ["question", "q", "question text", "frage", "pergunta", "pregunta"];

    const aDesired =
      kind === "en" ? ["answer", "a", "answer text"] : ["answer", "a", "answer text", "antwort", "respuesta", "réponse"];

    const qIdx = this.findColumnIndexByHeader(headers, qDesired) ?? 0;
    const aIdx = this.findColumnIndexByHeader(headers, aDesired) ?? 1;

    return { qIdx, aIdx };
  }

  private buildTranslationsFromHotelTabs(
    enRows: string[][],
    targetRows: string[][],
    enQuestionIdx: number,
    targetQuestionIdx: number,
    targetAnswerIdx: number
  ): Map<string, TranslationPair> {
    const map = new Map<string, TranslationPair>();
    const max = Math.max(enRows.length, targetRows.length);

    for (let r = 1; r < max; r++) {
      const enRow = enRows[r] ?? [];
      const tRow = targetRows[r] ?? [];

      const enQ = String(enRow[enQuestionIdx] ?? "").trim();
      const tQ = String(tRow[targetQuestionIdx] ?? "").trim();
      const tA = String(tRow[targetAnswerIdx] ?? "").trim();

      if (!enQ) continue;

      const key = this.normalizeText(enQ);
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, { targetQuestion: tQ, targetAnswer: tA });
      }
    }

    return map;
  }

  // Levenshtein similarity: 1.0 = identical, 0.0 = totally different
  private levenshteinDistance(a: string, b: string): number {
    const s = a ?? "";
    const t = b ?? "";
    const n = s.length;
    const m = t.length;

    if (n === 0) return m;
    if (m === 0) return n;

    const dp = new Array<number>(m + 1);
    for (let j = 0; j <= m; j++) dp[j] = j;

    for (let i = 1; i <= n; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= m; j++) {
        const tmp = dp[j];
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[m];
  }

  private similarity(a: string, b: string): number {
    const x = this.normalizeText(a);
    const y = this.normalizeText(b);
    const maxLen = Math.max(x.length, y.length);
    if (maxLen === 0) return 1;
    const dist = this.levenshteinDistance(x, y);
    return 1 - dist / maxLen;
  }

  private findFuzzyMatch(
    key: string,
    translationKeys: string[],
    threshold: number
  ): { bestKey: string; score: number } | null {
    let bestKey = "";
    let bestScore = 0;

    const tokens = new Set(key.split(" ").filter(Boolean));

    for (const candidate of translationKeys) {
      const candTokens = candidate.split(" ");
      if (!candTokens.some(t => tokens.has(t))) continue;

      const score = this.similarity(key, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidate;
      }
    }

    if (bestScore >= threshold) return { bestKey, score: bestScore };
    return null;
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

  

  async run(cfg: InjectLangToMasterConfig): Promise<void> {
    const lang = (cfg.targetLang || "").trim().toLowerCase();
    if (!lang) throw new Error("targetLang is required");

    console.log(chalk.blue(`🚀 Starting ${lang.toUpperCase()} injection into master FAQ...`));

    const overwriteExisting = cfg.overwriteExisting ?? false;
    const dryRun = cfg.dryRun ?? false;

    const enableFuzzy = cfg.enableFuzzyQuestionMatch ?? true;
    const threshold = cfg.fuzzyQuestionMatchThreshold ?? 0.93;

    const masterId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);
    const masterTab = await this.resolveTabOrFirst(masterId, cfg.masterTabName);

    const folderId = this.extractIdFromFolderUrl(cfg.hotelsFolderId);
const hotelSheetIds = await this.sheets.listSpreadsheetIdsInFolderRecursive(folderId);


    console.log(chalk.cyan(`📂 Found ${hotelSheetIds.length} hotel spreadsheets in folder`));

    const masterRows = await this.sheets.readValues(masterId, `${masterTab}!A:Z`);
    if (masterRows.length === 0) throw new Error("Master sheet is empty");

    const headers = (masterRows[0] ?? []).map(x => String(x ?? ""));

    const hotelCol =
      cfg.masterHotelColIndex ??
      this.findColumnIndexByHeader(headers, ["enriched hotel name", "hotel", "hotel name"]) ??
      0;

    const questionCol =
      cfg.masterQuestionColIndex ??
      this.findColumnIndexByHeader(headers, ["question", "q"]) ??
      2;

    const answerCol =
      cfg.masterAnswerColIndex ??
      this.findColumnIndexByHeader(headers, ["answer", "a"]) ??
      null;

    const questionIdCol =
      cfg.masterQuestionIdColIndex ??
      this.findColumnIndexByHeader(headers, ["question id", "question_id", "qid", "id"]) ??
      null;

    const unmatchedTabName =
      (cfg.unmatchedTabName?.trim() || `Unmatched (${lang.toUpperCase()} Injection)`);

    const targetQCol =
      cfg.masterTargetQuestionColIndex ??
      this.findColumnIndexByHeader(headers, [
        `question ${lang}`,
        "question target",
        "question translated",
        "translated question",
      ]) ??
      4;

    const targetACol =
      cfg.masterTargetAnswerColIndex ??
      this.findColumnIndexByHeader(headers, [
        `answer ${lang}`,
        "answer target",
        "answer translated",
        "translated answer",
      ]) ??
      5;

    // Build index: hotelKey -> row indices in master
    const masterHotelIndex = new Map<string, number[]>();
    for (let r = 1; r < masterRows.length; r++) {
      const row = masterRows[r] ?? [];
      const hotelName = String(row[hotelCol] ?? "").trim();
      if (!hotelName) continue;
      const key = this.normalizeText(hotelName);
      const arr = masterHotelIndex.get(key) ?? [];
      arr.push(r);
      masterHotelIndex.set(key, arr);
    }

    let totalInjected = 0;
    let totalMissing = 0;
    let totalHotelsWithAnyMatch = 0;
    let totalFuzzyUsed = 0;

    type UnmatchedRow = {
      hotel: string;
      masterRowNumber: number; // 1-based in sheet
      questionId: string;
      questionEn: string;
      answerEn: string;
    };

    const unmatched: UnmatchedRow[] = [];

    for (const hotelSheetId of hotelSheetIds) {
      let hotelTitle = hotelSheetId;

      try {
        hotelTitle = await this.sheets.getSpreadsheetTitle(hotelSheetId);
      } catch {
        console.log(chalk.red(`❌ Failed to read spreadsheet title: ${hotelSheetId}`));
        continue;
      }

      const alias = cfg.hotelNameAliases?.[hotelSheetId] ?? cfg.hotelNameAliases?.[hotelTitle];
      const effectiveHotelName = (alias && alias.trim()) ? alias.trim() : hotelTitle;

      const hotelKey = this.normalizeText(effectiveHotelName);
      let masterRowIndices = masterHotelIndex.get(hotelKey) ?? [];

      if (masterRowIndices.length === 0) {
        const candidates: Array<{ key: string; rows: number[] }> = [];
        for (const [k, rows] of masterHotelIndex.entries()) {
          if (!k) continue;
          if (hotelKey.includes(k) || k.includes(hotelKey)) {
            candidates.push({ key: k, rows });
          }
        }
        if (candidates.length === 1) {
          masterRowIndices = candidates[0].rows;
          console.log(
            chalk.gray(
              `- Hotel title matched master by partial name: "${effectiveHotelName}" -> key: "${candidates[0].key}"`
            )
          );
        }
      }

      if (masterRowIndices.length === 0) {
        console.log(chalk.gray(`- Skipping hotel (not found in master): ${hotelTitle}`));
        continue;
      }

     const hotelEnTab = await this.resolveTabOrFirst(hotelSheetId, cfg.hotelEnglishTabName);

let hotelLangTab: string;
try {
  hotelLangTab = await this.detectLangTab(hotelSheetId, {
    targetLang: lang,
    hotelLangTabName: cfg.hotelLangTabName,
    hotelLangTabBaseName: cfg.hotelLangTabBaseName,
  });
} catch (e: any) {
  console.log(
    chalk.yellow(`⚠️ ${hotelTitle}: missing ${lang.toUpperCase()} tab. Skipping. (${e?.message || e})`)
  );
  continue;
}

const enRows = await this.sheets.readValues(hotelSheetId, `${hotelEnTab}!B:C`);
const targetRows = await this.sheets.readValues(hotelSheetId, `${hotelLangTab}!B:C`);

      const detectedEn = this.detectHotelColumnIndices(enRows, "en");
      const detectedT = this.detectHotelColumnIndices(targetRows, "target");

      const enQIdx = detectedEn.qIdx;
      const tQIdx = detectedT.qIdx;
      const tAIdx = detectedT.aIdx;

      const translations = this.buildTranslationsFromHotelTabs(enRows, targetRows, enQIdx, tQIdx, tAIdx);
      const translationKeys = Array.from(translations.keys());

      let injected = 0;
      let missing = 0;
      let fuzzyUsed = 0;

      for (const r of masterRowIndices) {
        const row = masterRows[r] ?? [];
        const enQ = String(row[questionCol] ?? "").trim();
        if (!enQ) continue;

        const key = this.normalizeText(enQ);
        let pair = translations.get(key);

        if (!pair && enableFuzzy) {
          const fuzzy = this.findFuzzyMatch(key, translationKeys, threshold);
          if (fuzzy) {
            pair = translations.get(fuzzy.bestKey);
            if (pair) fuzzyUsed++;
          }
        }

        if (!pair) {
          missing++;

          const row1Based = r + 1;
          const qid = questionIdCol != null ? String(row[questionIdCol] ?? "").trim() : "";
          const aEn = answerCol != null ? String(row[answerCol] ?? "").trim() : "";

          unmatched.push({
            hotel: effectiveHotelName,
            masterRowNumber: row1Based,
            questionId: qid,
            questionEn: enQ,
            answerEn: aEn,
          });

          continue;
        }

        const existingTQ = String(row[targetQCol] ?? "").trim();
        const existingTA = String(row[targetACol] ?? "").trim();

        if (!overwriteExisting && (existingTQ || existingTA)) {
          continue;
        }

        row[targetQCol] = pair.targetQuestion;
        row[targetACol] = pair.targetAnswer;
        masterRows[r] = row;
        injected++;
      }

      if (injected > 0) totalHotelsWithAnyMatch++;
      totalInjected += injected;
      totalMissing += missing;
      totalFuzzyUsed += fuzzyUsed;

      console.log(
        injected > 0
          ? chalk.green(`✅ ${hotelTitle}: injected ${injected}, missing ${missing}${enableFuzzy ? `, fuzzyUsed ${fuzzyUsed}` : ""}`)
          : chalk.yellow(`⚠️ ${hotelTitle}: injected 0, missing ${missing}${enableFuzzy ? `, fuzzyUsed ${fuzzyUsed}` : ""}`)
      );
    }

    if (dryRun) {
      console.log(chalk.magenta(`🧪 Dry run enabled. No writes were performed.`));
    } else {
      const qColLetter = this.indexToColumnLetter(targetQCol);
      const aColLetter = this.indexToColumnLetter(targetACol);

      const colQ: string[][] = masterRows.map((row, i) => {
        if (i === 0) return [headers[targetQCol] || `question ${lang}`];
        return [String((row ?? [])[targetQCol] ?? "")];
      });

      const colA: string[][] = masterRows.map((row, i) => {
        if (i === 0) return [headers[targetACol] || `answer ${lang}`];
        return [String((row ?? [])[targetACol] ?? "")];
      });

      console.log(chalk.magenta(`✍️ Writing back to master: ${masterTab}!${qColLetter} and ${masterTab}!${aColLetter}`));

      await this.sheets.writeValues(masterId, `${masterTab}!${qColLetter}1`, colQ);
      await this.sheets.writeValues(masterId, `${masterTab}!${aColLetter}1`, colA);
    }

    // Unmatched report
    if (!dryRun) {
      await this.sheets.ensureTab(masterId, unmatchedTabName);
      await this.sheets.clearTabValues(masterId, unmatchedTabName);

      const rows: string[][] = [
        ["hotel", "master_row", "question_id", "question_en", "answer_en", "target_lang"],
        ...unmatched.map(u => [
          u.hotel,
          String(u.masterRowNumber),
          u.questionId,
          u.questionEn,
          u.answerEn,
          lang,
        ]),
      ];

      await this.sheets.writeValues(masterId, `${unmatchedTabName}!A1`, rows);

      console.log(chalk.magenta(`🧾 Unmatched report written: ${unmatchedTabName} (${unmatched.length} rows)`));
    }

    console.log(chalk.green(`\n🎉 ${lang.toUpperCase()} injection completed.`));
    console.log(chalk.white(`- Hotels processed with matches: ${totalHotelsWithAnyMatch}`));
    console.log(chalk.white(`- Total injected: ${totalInjected}`));
    console.log(chalk.white(`- Total missing (questions not found in hotel map): ${totalMissing}`));
    console.log(chalk.white(`- Total fuzzy used: ${totalFuzzyUsed}`));
    console.log(chalk.gray(`- overwriteExisting: ${overwriteExisting} | dryRun: ${dryRun}`));
  }
}