import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type InjectHebrewToMasterConfig = {
  masterSpreadsheetId: string;
  masterTabName?: string;

  masterHotelColIndex?: number;
  masterQuestionColIndex?: number;
  masterHebQuestionColIndex?: number;
  masterHebAnswerColIndex?: number;

  hotelsFolderId: string;

  hotelNameAliases?: Record<string, string>;

  hotelEnglishTabName?: string;
  hotelHebrewTabName?: string;

  hotelQuestionColIndex?: number;
  hotelAnswerColIndex?: number;

  overwriteExisting?: boolean;
  dryRun?: boolean;

  // New: allow fuzzy matching on questions when exact normalized key not found
  enableFuzzyQuestionMatch?: boolean; // default: true
  fuzzyQuestionMatchThreshold?: number; // default: 0.93 (93%)

  // Master columns
masterAnswerColIndex?: number;       // optional ("answer")
masterQuestionIdColIndex?: number;   // optional ("question_id" / "qid" / "id")

// Unmatched report
unmatchedTabName?: string;           // default: "Unmatched (Hebrew Injection)"
};

type TranslationPair = {
  hebQuestion: string;
  hebAnswer: string;
};

export class InjectHebrewToMasterJob {
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

  private async detectHebrewTab(spreadsheetId: string, preferred?: string): Promise<string> {
    if (preferred && preferred.trim()) {
      return await this.resolveTabOrFirst(spreadsheetId, preferred);
    }

    const titles = await this.sheets.listSheetTitles(spreadsheetId);
    const norm = (t: string) => (t ?? "").toLowerCase().replace(/\u00A0/g, " ").trim();

    const candidates = titles.filter(t => {
      const n = norm(t);
      return n.includes(" he") || n.includes("- he") || n.includes("– he") || n.includes("hebrew") || n.includes("עבר");
    });

    if (candidates.length > 0) return candidates[0];

    // More forgiving fallback:
    if (titles.length >= 2) return titles[1];
    if (titles.length === 1) return titles[0]; // important: do not throw, allows "Sheet1" only cases

    throw new Error(`Cannot auto-detect Hebrew tab in spreadsheet ${spreadsheetId}. Tabs: ${titles.join(", ")}`);
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

  private detectHotelColumnIndices(rows: string[][], kind: "en" | "he"): { qIdx: number; aIdx: number } {
    const headers = (rows[0] ?? []).map(x => String(x ?? ""));

    const qDesired = kind === "en"
      ? ["question", "q", "question text"]
      : ["שאלה", "שאלה בעברית", "question", "question hebrew"];

    const aDesired = kind === "en"
      ? ["answer", "a", "answer text"]
      : ["תשובה", "תשובה בעברית", "answer", "answer hebrew"];

    const qIdx = this.findColumnIndexByHeader(headers, qDesired) ?? 0;
    const aIdx = this.findColumnIndexByHeader(headers, aDesired) ?? 1;

    return { qIdx, aIdx };
  }

  private buildTranslationsFromHotelTabs(
    enRows: string[][],
    heRows: string[][],
    enQuestionIdx: number,
    heQuestionIdx: number,
    heAnswerIdx: number
  ): Map<string, TranslationPair> {
    const map = new Map<string, TranslationPair>();
    const max = Math.max(enRows.length, heRows.length);

    for (let r = 1; r < max; r++) {
      const enRow = enRows[r] ?? [];
      const heRow = heRows[r] ?? [];

      const enQ = String(enRow[enQuestionIdx] ?? "").trim();
      const heQ = String(heRow[heQuestionIdx] ?? "").trim();
      const heA = String(heRow[heAnswerIdx] ?? "").trim();

      if (!enQ) continue;

      const key = this.normalizeText(enQ);
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, { hebQuestion: heQ, hebAnswer: heA });
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
        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prev + cost
        );
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

    // cheap prefilter: require at least one shared token (reduces false positives)
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

  async run(cfg: InjectHebrewToMasterConfig): Promise<void> {
    console.log(chalk.blue("🚀 Starting Hebrew injection into master FAQ..."));

    const overwriteExisting = cfg.overwriteExisting ?? false;
    const dryRun = cfg.dryRun ?? false;

    const enableFuzzy = cfg.enableFuzzyQuestionMatch ?? true;
    const threshold = cfg.fuzzyQuestionMatchThreshold ?? 0.93;

    const masterId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);
    const masterTab = await this.resolveTabOrFirst(masterId, cfg.masterTabName);

    const folderId = this.extractIdFromFolderUrl(cfg.hotelsFolderId);
    const hotelSheetIds = await this.sheets.listSpreadsheetIdsInFolder(folderId);

    console.log(chalk.cyan(`📂 Found ${hotelSheetIds.length} hotel spreadsheets in folder`));

    const masterRows = await this.sheets.readValues(masterId, `${masterTab}!A:Z`);
    if (masterRows.length === 0) throw new Error("Master sheet is empty");

    const headers = (masterRows[0] ?? []).map(x => String(x ?? ""));

    const hotelCol = cfg.masterHotelColIndex ??
      this.findColumnIndexByHeader(headers, ["enriched hotel name", "hotel", "hotel name"]) ?? 0;

    const questionCol = cfg.masterQuestionColIndex ??
      this.findColumnIndexByHeader(headers, ["question", "q"]) ?? 2;

      const answerCol = cfg.masterAnswerColIndex ??
  this.findColumnIndexByHeader(headers, ["answer", "a"]) ?? null;

const questionIdCol = cfg.masterQuestionIdColIndex ??
  this.findColumnIndexByHeader(headers, ["question id", "question_id", "qid", "id"]) ?? null;

const unmatchedTabName = (cfg.unmatchedTabName?.trim() || "Unmatched (Hebrew Injection)");

    const hebQCol = cfg.masterHebQuestionColIndex ??
      this.findColumnIndexByHeader(headers, ["question hebrew", "hebrew question", "שאלה בעברית"]) ?? 4;

    const hebACol = cfg.masterHebAnswerColIndex ??
      this.findColumnIndexByHeader(headers, ["answer hebrew", "hebrew answer", "תשובה בעברית"]) ?? 5;

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
} catch (e: any) {
  console.log(chalk.red(`❌ Failed to read spreadsheet title: ${hotelSheetId}`));
  continue; // important: skip this file entirely
}

      const alias = cfg.hotelNameAliases?.[hotelSheetId] ?? cfg.hotelNameAliases?.[hotelTitle];
      const effectiveHotelName = (alias && alias.trim()) ? alias.trim() : hotelTitle;

      // Optional debug - enable if needed
      // this.debugName("hotelTitle", hotelTitle);
      // this.debugName("effectiveHotelName", effectiveHotelName);

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
          console.log(chalk.gray(`- Hotel title matched master by partial name: "${effectiveHotelName}" -> key: "${candidates[0].key}"`));
        }
      }

      if (masterRowIndices.length === 0) {
        console.log(chalk.gray(`- Skipping hotel (not found in master): ${hotelTitle}`));
        continue;
      }

      const hotelEnTab = await this.resolveTabOrFirst(hotelSheetId, cfg.hotelEnglishTabName);
      const hotelHeTab = await this.detectHebrewTab(hotelSheetId, cfg.hotelHebrewTabName);

      // Keep your narrow ranges, but make indices flexible
      const enRows = await this.sheets.readValues(hotelSheetId, `${hotelEnTab}!B:C`);
      const heRows = await this.sheets.readValues(hotelSheetId, `${hotelHeTab}!B:C`);

      if (enRows.length <= 1 || heRows.length <= 1) {
        console.log(chalk.yellow(`⚠️ Hotel sheet has insufficient rows: ${hotelTitle}`));
        continue;
      }

      

      const detectedEn = this.detectHotelColumnIndices(enRows, "en");
      const detectedHe = this.detectHotelColumnIndices(heRows, "he");

      // Important fix: do not hardcode indices
      const enQIdx = detectedEn.qIdx;
      const heQIdx = detectedHe.qIdx;
      const heAIdx = detectedHe.aIdx;

      const translations = this.buildTranslationsFromHotelTabs(
        enRows,
        heRows,
        enQIdx,
        heQIdx,
        heAIdx
      );

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

  const row1Based = r + 1; // masterRows is 0-based array, sheet is 1-based
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

        const existingHebQ = String(row[hebQCol] ?? "").trim();
        const existingHebA = String(row[hebACol] ?? "").trim();

        if (!overwriteExisting && (existingHebQ || existingHebA)) {
          continue;
        }

        row[hebQCol] = pair.hebQuestion;
        row[hebACol] = pair.hebAnswer;
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
      const hebQColLetter = this.indexToColumnLetter(hebQCol);
      const hebAColLetter = this.indexToColumnLetter(hebACol);

      const colHebQ: string[][] = masterRows.map((row, i) => {
        if (i === 0) return [headers[hebQCol] || "question hebrew"];
        return [String((row ?? [])[hebQCol] ?? "")];
      });

      const colHebA: string[][] = masterRows.map((row, i) => {
        if (i === 0) return [headers[hebACol] || "answer hebrew"];
        return [String((row ?? [])[hebACol] ?? "")];
      });

      console.log(chalk.magenta(`✍️ Writing back to master: ${masterTab}!${hebQColLetter} and ${hebAColLetter}`));

      await this.sheets.writeValues(masterId, `${masterTab}!${hebQColLetter}1`, colHebQ);
      await this.sheets.writeValues(masterId, `${masterTab}!${hebAColLetter}1`, colHebA);
    }

// Write unmatched report to a dedicated tab in the master
if (!dryRun) {
  await this.sheets.ensureTab(masterId, unmatchedTabName);
  await this.sheets.clearTabValues(masterId, unmatchedTabName);

  const rows: string[][] = [
    ["hotel", "master_row", "question_id", "question_en", "answer_en"],
    ...unmatched.map(u => [
      u.hotel,
      String(u.masterRowNumber),
      u.questionId,
      u.questionEn,
      u.answerEn,
    ]),
  ];

  await this.sheets.writeValues(masterId, `${unmatchedTabName}!A1`, rows);

  console.log(chalk.magenta(`🧾 Unmatched report written: ${unmatchedTabName} (${unmatched.length} rows)`));
}

    console.log(chalk.green("\n🎉 Hebrew injection completed."));
    console.log(chalk.white(`- Hotels processed with matches: ${totalHotelsWithAnyMatch}`));
    console.log(chalk.white(`- Total injected: ${totalInjected}`));
    console.log(chalk.white(`- Total missing (questions not found in hotel map): ${totalMissing}`));
    console.log(chalk.white(`- Total fuzzy used: ${totalFuzzyUsed}`));
    console.log(chalk.gray(`- overwriteExisting: ${overwriteExisting} | dryRun: ${dryRun}`));
  }
}