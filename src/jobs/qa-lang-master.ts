// src/jobs/qa-lang-master.ts
import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type QaLangMasterConfig = {
  spreadsheetId: string;
  tabName?: string;

  targetLang: string; // "de" | "fr" | ...

  outputTabName?: string; // default: `QA - ${targetLang.toUpperCase()} Master`
  templateTabName?: string; // default: "QA - TEMPLATE"

  // optional limits
  maxIssuesInReport?: number; // default: 1500

  // toggles
  checkMissingTarget?: boolean; // default: true
  checkLanguageHeuristic?: boolean; // default: true
  checkHotelNameInTarget?: boolean; // default: true
  checkNumbersPreserved?: boolean; // default: true
    // NEW toggles
  checkHotelNameInEnglish?: boolean; // default: true
  checkEnglishQuestionForm?: boolean; // default: true
  checkEnglishQAMatchHeuristic?: boolean; // default: true

  /**
   * If true: enforce hotel name in ALL target answers (project-wide requirement).
   * Recommended: keep false and do a deterministic post-process step instead.
   */
  requireHotelNameInAllAnswers?: boolean; // default: false
};

type IssueType =
  | "MISSING_TARGET_QUESTION"
  | "MISSING_TARGET_ANSWER"
  | "LANGUAGE_SUSPECT"
  | "HOTEL_NAME_MISSING_IN_TARGET_Q"
  | "HOTEL_NAME_MISSING_IN_TARGET_A"
  | "NUMBERS_MISMATCH"
   | "HOTEL_NAME_MISMATCH_EN_Q"
  | "HOTEL_NAME_MISMATCH_EN_A"
  | "EN_QUESTION_NOT_A_QUESTION"
  | "EN_QA_MISMATCH_SUSPECT";
 

type Issue = {
  severity: "ERROR" | "WARN" | "INFO";
  type: IssueType;
  rowNumber: number; // 1-based
  hotel: string;
  questionEn: string;
  answerEn: string;
  questionTarget: string;
  answerTarget: string;
  note?: string;
};

export class QaLangMasterJob {
  constructor(private sheets: SheetsService) {}

  private normHeader(s: string): string {
    return String(s ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private normCell(s: string): string {
    return String(s ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  private findCol(headers: string[], desired: string[]): number | null {
    const set = new Set(desired.map((d) => this.normHeader(d)));
    for (let i = 0; i < headers.length; i++) {
      if (set.has(this.normHeader(headers[i] ?? ""))) return i;
    }
    return null;
  }

  private getCell(row: string[], col: number | null): string {
    if (col == null) return "";
    return this.normCell(String(row[col] ?? ""));
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

  private stripHtmlTags(s: string): string {
    return String(s ?? "").replace(/<[^>]*>/g, " ");
  }

  /**
   * Remove HTML entities so they won't create fake numbers (e.g., &#39; -> "39").
   * We purposely remove them (not decode) because for numeric QA this is safer.
   */
  private stripHtmlEntities(s: string): string {
    const t = String(s ?? "");
    return t
      .replace(/&#\d+;/g, " ")
      .replace(/&#x[0-9a-f]+;/gi, " ")
      .replace(/&[a-z]+;/gi, " ");
  }

  private normalizeForCompare(s: string): string {
    return this.stripHtmlEntities(this.stripHtmlTags(String(s ?? "")))
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, "\"")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  // --- Numbers/time normalization (reduce false positives) ---

  private normalizeTextForNumbers(s: string): string {
    return this.stripHtmlEntities(this.stripHtmlTags(String(s ?? "")))
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, "\"")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private convert12hTo24h(text: string): string {
    // Examples:
    // "3:00 pm" -> "15:00"
    // "3 pm" -> "15:00"
    // "12:00 am" -> "00:00"
    const t = text.replace(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi, (_m, hStr, minStr, ap) => {
      let h = parseInt(String(hStr), 10);
      const m = minStr ? parseInt(String(minStr), 10) : 0;
      const isPm = String(ap).toLowerCase() === "pm";
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return `${hh}:${mm}`;
    });
    return t;
  }

  private normalizeDecimalToken(tok: string): string {
    if (!tok) return tok;
    // "1,2" == "1.2"
    const x = tok.replace(",", ".");
    return x;
  }

  private normalizePlainNumberToken(tok: string): string {
    if (!tok) return tok;
    const n = Number(this.normalizeDecimalToken(tok));
    if (!Number.isFinite(n)) return this.normalizeDecimalToken(tok);
    // Keep integers as "50", decimals without trailing zeros as "2.1"
    return Number.isInteger(n) ? String(n) : String(n);
  }

  private detect24hConcept(text: string, lang: string): boolean {
    const t = this.normalizeTextForNumbers(text);
    if (!t) return false;

    if (lang === "en") {
      if (/\b24\s*(?:hours?|hrs?)\b/.test(t)) return true;
      if (/\b24-?hour\b/.test(t)) return true;
      if (/\baround the clock\b/.test(t)) return true;
      if (/\bround-?the-?clock\b/.test(t)) return true;
      if (/\b24\/7\b/.test(t)) return true;
      return false;
    }

    if (lang === "de") {
      if (/\brund um die uhr\b/.test(t)) return true;
      if (/\bdurchgehend\b/.test(t)) return true;
      if (/\b24\s*stunden\b/.test(t)) return true;
      if (/\b24-?stunden\b/.test(t)) return true;
      if (/\b24\/7\b/.test(t)) return true;
      return false;
    }

    // other langs: only explicit 24 or 24/7
    if (/\b24\/7\b/.test(t)) return true;
    if (/\b24\b/.test(t) && /\b(hour|hours|stunden)\b/.test(t)) return true;
    return false;
  }

  /**
   * Extract numeric tokens with reduced noise:
   * - times are captured as HH:MM and removed before generic number scan (prevents 06 + 30 noise)
   * - 24h concept produces a semantic token "24h"
   * - if 24h concept exists, remove standalone "24" (and "7" for 24/7) to avoid EN=[24|24h] vs DE=[24h]
   */
  private extractNumberTokens(s: string, lang: string): string[] {
    let t = this.normalizeTextForNumbers(s);
    if (!t) return [];

    t = this.convert12hTo24h(t);

    const tokens: string[] = [];

    // Times like 15:00, 06:30
    const timeMatches = t.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
    for (const tm of timeMatches) {
      const [hhRaw, mm] = tm.split(":");
      const hh = String(parseInt(hhRaw, 10)).padStart(2, "0");
      tokens.push(`${hh}:${mm}`);
    }

    // Remove times before scanning generic numbers to avoid "06" and "30" duplicates
    const tNoTimes = t.replace(/\b\d{1,2}:\d{2}\b/g, " ");

    // General numbers/decimals
    const numMatches = tNoTimes.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [];
    for (const nm of numMatches) {
      const norm = this.normalizePlainNumberToken(nm);
      if (norm) tokens.push(norm);
    }

    // Semantic token for 24h concept
    const has24h = this.detect24hConcept(t, lang);
    if (has24h) tokens.push("24h");

    // If 24h concept exists, remove standalone "24" token (and "7" if 24/7 is explicitly present)
    const has24slash7 = /\b24\/7\b/.test(t);
    const filtered = tokens.filter((x) => {
      if (!x) return false;
      if (has24h && x === "24") return false;
      if (has24slash7 && has24h && x === "7") return false;
      return true;
    });

    // De-duplicate while keeping order
    const seen = new Set<string>();
    return filtered.filter((x) => {
      if (seen.has(x)) return false;
      seen.add(x);
      return true;
    });
  }

  private normalizeHotelForContains(hotel: string): string {
    const t = this.normalizeForCompare(hotel)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    return t;
  }

  private containsHotelName(targetText: string, hotelName: string): boolean {
    const h = this.normalizeHotelForContains(hotelName);
    const t = this.normalizeForCompare(targetText)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!h) return true;
    if (!t) return false;

    if (t.includes(h)) return true;

    const tokens = h.split(" ").filter(Boolean);
    const strongTokens = tokens.filter((x) => x.length >= 4);
    if (strongTokens.length === 0) return false;

    const hits = strongTokens.filter((x) => t.includes(x)).length;
    return hits / strongTokens.length >= 0.75;
  }

  /**
   * Hotel name required in target question only if EN question contains the hotel name.
   */
  private shouldRequireHotelNameInTargetQuestion(qEn: string, hotel: string): boolean {
    if (!hotel) return false;
    if (!qEn) return false;
    return this.containsHotelName(qEn, hotel);
  }

    private looksLikeEnglishQuestion(q: string): boolean {
    const t = this.normalizeForCompare(q);
    if (!t) return false;

    // Strong signal
    if (/[?]\s*$/.test(q.trim())) return true;

    // Conservative allowance for missing "?"
    const starters = [
      "what", "where", "when", "why", "how",
      "can", "could", "do", "does", "did",
      "is", "are", "was", "were",
      "will", "would", "should", "may", "might",
      "whats", "what's", "wheres", "where's", "hows", "how's",
    ];

    const first = t.split(" ")[0] ?? "";
    if (starters.includes(first)) return true;

    // Short "questiony" phrases
    if (t.startsWith("please") && t.includes("tell me")) return true;

    return false;
  }

    private extractHotelCandidatesEn(text: string): string[] {
    const raw = this.stripHtmlEntities(this.stripHtmlTags(String(text ?? "")));
    if (!raw.trim()) return [];

    const re =
      /\b(?:[A-Z][A-Za-z0-9&.'-]*\s+){1,10}(?:Hotel|Resort|Apartments|Suites|Inn|Hostel|Villa|Lodge|Palace)\b/g;

    const bannedFirst = new Set([
      "Do",
      "Does",
      "Did",
      "Is",
      "Are",
      "Was",
      "Were",
      "Can",
      "Could",
      "Will",
      "Would",
      "Should",
      "May",
      "Might",
      "What",
      "Which",
      "How",
      "When",
      "Where",
      "Why",
      "At",
      "In",
      "On",
      "From",
      "To",
      "For",
      "With",
      "Without",
    ]);

    const matches = raw.match(re) ?? [];

    const cleaned: string[] = [];
    for (const m of matches) {
      const words = this.normCell(m).split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;

      // Remove leading banned words like "Does", "Is", "At"
      while (words.length >= 2 && bannedFirst.has(words[0])) {
        words.shift();
      }

      if (words.length < 2) continue;

      // Must still end with a hotel-type word
      const last = words[words.length - 1];
      if (!/^(Hotel|Resort|Apartments|Suites|Inn|Hostel|Villa|Lodge|Palace)$/.test(last)) continue;

      const cand = words.join(" ");
      if (cand.length >= 6) cleaned.push(cand);
    }

    // De-dupe
    const seen = new Set<string>();
    return cleaned.filter((x) => {
      const k = x.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private tokenizeKeywordsEn(text: string): string[] {
    const t = this.normalizeForCompare(text);
    if (!t) return [];
    const stop = new Set([
      "the","a","an","and","or","but","if","then","than",
      "is","are","was","were","be","been","being",
      "do","does","did","can","could","will","would","should","may","might",
      "i","you","we","they","he","she","it","my","your","our","their",
      "what","where","when","why","how",
      "in","on","at","to","from","for","of","with","without","by","as",
      "this","that","these","those",
      "please",
    ]);

    return (t.match(/[a-z0-9]+/g) ?? [])
      .filter((w) => w.length >= 4)
      .filter((w) => !stop.has(w));
  }

   private englishQAMatchSuspect(qEn: string, aEn: string, hotel: string): boolean {
    const q = this.normalizeForCompare(qEn);
    const a = this.normalizeForCompare(aEn);
    if (!q || !a) return false;

    // If answer is very short or generic - do not flag
    if (this.isGenericTargetAnswer("en", aEn)) return false;

    // If question is about hours/times and answer contains time tokens - do not flag
    const qIsTime = /\b(hours?|times?|time)\b/.test(q);
    const aHasTime = /\b\d{1,2}:\d{2}\b/.test(this.normalizeTextForNumbers(aEn));
    if (qIsTime && aHasTime) return false;

    // Remove hotel tokens from question keywords (they destroy the overlap ratio)
    const hotelTokens = new Set(
      this.normalizeHotelForContains(hotel)
        .split(/\s+/)
        .filter((w) => w.length >= 4)
    );

    let qKeys = this.tokenizeKeywordsEn(qEn).filter((w) => !hotelTokens.has(w));
    if (qKeys.length < 4) return false;

    const aKeys = new Set(this.tokenizeKeywordsEn(aEn));
    if (aKeys.size === 0) return false;

    const overlap = qKeys.filter((w) => aKeys.has(w)).length;
    const ratio = overlap / qKeys.length;

    // Conservative threshold
    return ratio < 0.15;
  }

  /**
   * Hotel name required in target answer only if:
   * - EN answer contains the hotel name, OR
   * - project-wide requirement is enabled (cfg.requireHotelNameInAllAnswers)
   *
   * IMPORTANT: we do NOT require it just because the EN question has it (noise reduction).
   */
  private shouldRequireHotelNameInTargetAnswer(aEn: string, hotel: string, requireAllAnswers: boolean): boolean {
    if (!hotel) return false;
    if (requireAllAnswers) return true;
    if (aEn && this.containsHotelName(aEn, hotel)) return true;
    return false;
  }

  // Generic answers exception (noise reduction)
  private isGenericTargetAnswer(lang: string, answerTarget: string): boolean {
    const t = this.normalizeForCompare(answerTarget);
    if (!t) return false;

    if (lang === "de") {
      if (/^(ja|nein)\b/.test(t)) return true;
      if (/\b(im|im\s+gesamten)\s+hotel\b/.test(t)) return true;
      if (/\bdas\s+hotel\b/.test(t)) return true;
      if (/\bbei\s+uns\b/.test(t)) return true;
      if (/\bvor\s+ort\b/.test(t)) return true;
    }

    if (lang === "en") {
      if (/^(yes|no)\b/.test(t)) return true;
      if (/\bthe hotel\b/.test(t)) return true;
      if (/\bon site\b/.test(t)) return true;
    }

    // Keep the "short generic" rule
    if (t.length <= 40) return true;

    return false;
  }

  /**
   * Language heuristic should be conservative.
   * Keep as-is (DE only), but avoid triggering on very short strings.
   */
  private looksGerman(text: string): boolean {
    const t = this.normalizeForCompare(text);
    if (!t) return false;
    if (t.length < 12) return true;

    const hasUmlaut = /[äöüß]/i.test(t);

    // Allow common international terms - do not over-penalize.
    const germanHints = [
      "und",
      "oder",
      "für",
      "mit",
      "ohne",
      "bitte",
      "gäste",
      "zimmer",
      "rezeption",
      "frühstück",
      "parkplatz",
      "kostenfrei",
      "gebühr",
      "verfügbar",
      "uhr",
      "check-in",
      "check-out",
      "können",
      "bietet",
      "gibt es",
      "ist",
      "sind",
      "nicht",
      "ja",
      "nein",
      "werden",
      "wird",
      "im",
      "am",
      "an",
      "vom",
      "zur",
      "zum",
    ];
    const hintHits = germanHints.filter((w) => t.includes(w)).length;
    if (hasUmlaut) return true;
    if (hintHits >= 2) return true;

    // Strong English sentence pattern - only then suspect
    const englishHints = ["the", "and", "with", "available", "does", "can", "please", "is", "are"];
    const enHits = englishHints.filter((w) => t.includes(w)).length;

    // Conservative threshold: require many English function words and very low German hints
    if (enHits >= 6 && hintHits === 0 && !hasUmlaut) return false;

    return true;
  }

  private async prepareReportTab(spreadsheetId: string, tabName: string, templateTabName: string) {
    const anySheets = this.sheets as any;
    if (typeof anySheets.recreateTabFromTemplate === "function") {
      await anySheets.recreateTabFromTemplate(spreadsheetId, tabName, templateTabName);
    } else {
      await this.sheets.ensureTab(spreadsheetId, tabName);
    }
    await this.sheets.clearTabValues(spreadsheetId, tabName);
  }

  private diffTokens(en: string[], tgt: string[]): { missing: string[]; added: string[] } {
    const enSet = new Set(en);
    const tSet = new Set(tgt);
    const missing = en.filter((x) => !tSet.has(x));
    const added = tgt.filter((x) => !enSet.has(x));

    // Ignore cosmetic differences already normalized; if anything remains it's meaningful.
    return { missing, added };
  }

  async run(cfg: QaLangMasterConfig): Promise<void> {
    const lang = (cfg.targetLang || "").trim().toLowerCase();
    if (!lang) throw new Error("targetLang is required");

    const outputTab = cfg.outputTabName ?? `QA - ${lang.toUpperCase()} Master`;
    const templateTab = cfg.templateTabName ?? "QA - TEMPLATE";

    const checkMissingTarget = cfg.checkMissingTarget ?? true;
    const checkLanguageHeuristic = cfg.checkLanguageHeuristic ?? true;
    const checkHotelNameInTarget = cfg.checkHotelNameInTarget ?? true;
    const checkNumbersPreserved = cfg.checkNumbersPreserved ?? true;

    const requireHotelNameInAllAnswers = cfg.requireHotelNameInAllAnswers ?? false;

    const maxIssuesInReport = cfg.maxIssuesInReport ?? 1500;

    console.log(chalk.blue(`Starting QA for master translations (${lang.toUpperCase()})...`));

        const checkHotelNameInEnglish = cfg.checkHotelNameInEnglish ?? true;
    const checkEnglishQuestionForm = cfg.checkEnglishQuestionForm ?? true;
    const checkEnglishQAMatchHeuristic = cfg.checkEnglishQAMatchHeuristic ?? true;

    const tab = await this.resolveTabOrFirst(cfg.spreadsheetId, cfg.tabName);
    const rows = await this.sheets.readValues(cfg.spreadsheetId, `${tab}!A:AZ`);
    if (rows.length < 2) throw new Error("Sheet has no data rows.");

    const headers = (rows[0] ?? []).map((h) => String(h ?? ""));

    const hotelCol = this.findCol(headers, ["enriched hotel name", "hotel", "hotel name"]) ?? 0;
    const qEnCol = this.findCol(headers, ["question", "question en", "question_en"]) ?? 2;
    const aEnCol = this.findCol(headers, ["answer", "answer en", "answer_en"]) ?? 3;

    const qTCol =
      this.findCol(headers, [
        `question ${lang}`,
        `question_${lang}`,
        `question (${lang})`,
        `question ${lang.toUpperCase()}`,
      ]) ??
      this.findCol(headers, ["question de", "frage"]) ??
      4;

    const aTCol =
      this.findCol(headers, [`answer ${lang}`, `answer_${lang}`, `answer (${lang})`, `answer ${lang.toUpperCase()}`]) ??
      this.findCol(headers, ["answer de", "antwort"]) ??
      5;

    const issues: Issue[] = [];
    let okRows = 0;

    // strict cap
    let stop = false;
    const pushIssue = (issue: Issue): void => {
      if (issues.length >= maxIssuesInReport) {
        stop = true;
        return;
      }
      issues.push(issue);
      if (issues.length >= maxIssuesInReport) stop = true;
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const rowNumber = i + 1;

      const hotel = this.getCell(row, hotelCol);
      const qEn = this.getCell(row, qEnCol);
      const aEn = this.getCell(row, aEnCol);
      const qT = this.getCell(row, qTCol);
      const aT = this.getCell(row, aTCol);

      let rowHasIssue = false;

      if (checkMissingTarget) {
        if (!qT || !qT.trim()) {
          pushIssue({
            severity: "ERROR",
            type: "MISSING_TARGET_QUESTION",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
          });
          rowHasIssue = true;
        }
        if (!aT || !aT.trim()) {
          pushIssue({
            severity: "ERROR",
            type: "MISSING_TARGET_ANSWER",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
          });
          rowHasIssue = true;
        }
      }

      if (checkLanguageHeuristic && lang === "de") {
        if (qT && !this.looksGerman(qT)) {
          pushIssue({
            severity: "WARN",
            type: "LANGUAGE_SUSPECT",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
            note: "Target question looks non-German (conservative heuristic)",
          });
          rowHasIssue = true;
        }
        if (aT && !this.looksGerman(aT)) {
          pushIssue({
            severity: "WARN",
            type: "LANGUAGE_SUSPECT",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
            note: "Target answer looks non-German (conservative heuristic)",
          });
          rowHasIssue = true;
        }
      }

      if (checkNumbersPreserved) {
        // QUESTION numbers
        if (qEn && qT) {
          const enArr = this.extractNumberTokens(qEn, "en");
          const tArr = this.extractNumberTokens(qT, lang);
          const { missing, added } = this.diffTokens(enArr, tArr);

          // Rule: added numbers that do not exist in EN is the most critical signal (ERROR)
          // Missing/changing numbers is WARN.
          if (missing.length || added.length) {
            const severity: Issue["severity"] = added.length ? "ERROR" : "WARN";
            pushIssue({
              severity,
              type: "NUMBERS_MISMATCH",
              rowNumber,
              hotel,
              questionEn: qEn,
              answerEn: aEn,
              questionTarget: qT,
              answerTarget: aT,
              note: `Question numbers differ: missing=[${missing.join("|")}] added=[${added.join("|")}] EN=[${enArr.join(
                "|"
              )}] vs ${lang.toUpperCase()}=[${tArr.join("|")}]`,
            });
            rowHasIssue = true;
          }
        }

        // ANSWER numbers
        if (aEn && aT) {
          const enArr = this.extractNumberTokens(aEn, "en");
          const tArr = this.extractNumberTokens(aT, lang);
          const { missing, added } = this.diffTokens(enArr, tArr);

          if (missing.length || added.length) {
            const severity: Issue["severity"] = added.length ? "ERROR" : "WARN";
            pushIssue({
              severity,
              type: "NUMBERS_MISMATCH",
              rowNumber,
              hotel,
              questionEn: qEn,
              answerEn: aEn,
              questionTarget: qT,
              answerTarget: aT,
              note: `Answer numbers differ: missing=[${missing.join("|")}] added=[${added.join("|")}] EN=[${enArr.join(
                "|"
              )}] vs ${lang.toUpperCase()}=[${tArr.join("|")}]`,
            });
            rowHasIssue = true;
          }
        }
      }

      if (checkHotelNameInTarget && hotel) {
        const requireQ = this.shouldRequireHotelNameInTargetQuestion(qEn, hotel);
        const requireA = this.shouldRequireHotelNameInTargetAnswer(aEn, hotel, requireHotelNameInAllAnswers);

        if (requireQ && qT && !this.containsHotelName(qT, hotel)) {
          pushIssue({
            severity: "WARN",
            type: "HOTEL_NAME_MISSING_IN_TARGET_Q",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
            note: "Hotel name required because EN question contains it, but it was not found in target question",
          });
          rowHasIssue = true;
        }

        if (requireA && aT && !this.isGenericTargetAnswer(lang, aT) && !this.containsHotelName(aT, hotel)) {
          // If this is only due to global requirement, downgrade to INFO to reduce noise
          const sev: Issue["severity"] = requireHotelNameInAllAnswers ? "INFO" : "WARN";
          pushIssue({
            severity: sev,
            type: "HOTEL_NAME_MISSING_IN_TARGET_A",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
            note: requireHotelNameInAllAnswers
              ? "Hotel name missing in target answer (global requirement enabled). Consider deterministic post-process instead of QA issue."
              : "Hotel name required because EN answer contains it, but it was not found in target answer",
          });
          rowHasIssue = true;
        }
      }

            // --- NEW: English checks ---

      if (hotel && checkHotelNameInEnglish) {
        // If EN explicitly mentions a hotel candidate, it must match the hotel column
        const qCandidates = this.extractHotelCandidatesEn(qEn);
        for (const cand of qCandidates) {
         if (!this.containsHotelName(hotel, cand)) {
            pushIssue({
              severity: "WARN",
              type: "HOTEL_NAME_MISMATCH_EN_Q",
              rowNumber,
              hotel,
              questionEn: qEn,
              answerEn: aEn,
              questionTarget: qT,
              answerTarget: aT,
              note: `EN question mentions hotel candidate "${cand}" which does not match hotel column`,
            });
            rowHasIssue = true;
            break;
          }
        }

        const aCandidates = this.extractHotelCandidatesEn(aEn);
        for (const cand of aCandidates) {
          if (!this.containsHotelName(cand, hotel)) {
            pushIssue({
              severity: "WARN",
              type: "HOTEL_NAME_MISMATCH_EN_A",
              rowNumber,
              hotel,
              questionEn: qEn,
              answerEn: aEn,
              questionTarget: qT,
              answerTarget: aT,
              note: `EN answer mentions hotel candidate "${cand}" which does not match hotel column`,
            });
            rowHasIssue = true;
            break;
          }
        }
      }

      if (checkEnglishQuestionForm) {
        if (qEn && !this.looksLikeEnglishQuestion(qEn)) {
          pushIssue({
            severity: "WARN",
            type: "EN_QUESTION_NOT_A_QUESTION",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
            note: "English question does not look like a question (missing '?' or interrogative form)",
          });
          rowHasIssue = true;
        }
      }

      if (checkEnglishQAMatchHeuristic) {
       if (qEn && aEn && this.englishQAMatchSuspect(qEn, aEn, hotel)) {
          pushIssue({
            severity: "WARN",
            type: "EN_QA_MISMATCH_SUSPECT",
            rowNumber,
            hotel,
            questionEn: qEn,
            answerEn: aEn,
            questionTarget: qT,
            answerTarget: aT,
            note: "English Q/A seem weakly related (low keyword overlap). Check if answer matches the question topic.",
          });
          rowHasIssue = true;
        }
      }

      if (!rowHasIssue) okRows++;
      if (stop) break;
    }

    const now = new Date().toISOString();
    const totalRows = rows.length - 1;

    const summary: string[][] = [];
    summary.push([`QA - ${lang.toUpperCase()} Master (Deterministic)`]);
    summary.push(["Run at", now]);
    summary.push(["Tab", tab]);
    summary.push(["Total rows", String(totalRows)]);
    summary.push(["Rows with no issues", String(okRows)]);
    summary.push(["Issues captured (capped)", String(issues.length)]);
    summary.push([""]);

    summary.push(["issues"]);
    summary.push([
      "severity",
      "type",
      "row",
      "hotel",
      "question_en",
      "answer_en",
      `question_${lang}`,
      `answer_${lang}`,
      "note",
    ]);

    for (const it of issues) {
      summary.push([
        it.severity,
        it.type,
        String(it.rowNumber),
        it.hotel,
        it.questionEn,
        it.answerEn,
        it.questionTarget,
        it.answerTarget,
        it.note ?? "",
      ]);
    }

    await this.prepareReportTab(cfg.spreadsheetId, outputTab, templateTab);
    await this.sheets.writeValues(cfg.spreadsheetId, `${outputTab}!A1`, summary);

    console.log(chalk.green(`QA completed -> "${outputTab}".`));
    console.log(
      chalk.gray(`Total rows: ${totalRows} | OK: ${okRows} | Issues: ${issues.length} (cap ${maxIssuesInReport})`)
    );
  }
}