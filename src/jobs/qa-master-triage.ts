import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

export type QaMasterTriageConfig = {
  spreadsheetId: string;

  // Tab that contains the deterministic QA output (the "noisy" issues list)
  sourceQaTabName: string;

  // Target language (e.g., "de")
  targetLang: string;

  // Output tab name (default: `QA - ${LANG} True Issues`)
  outputTabName?: string;

  // Template tab name (optional)
  templateTabName?: string;

  // AI model
  model?: string; // default: "o3"

  // Limits
  maxItemsToProcess?: number; // default: 500
  aiBatchSize?: number; // default: 10

  /**
   * If true: writes ONLY "true issues" after deterministic noise filtering,
   * without asking AI for fixes.
   */
  deterministicOnly?: boolean;

  /**
   * Placeholder for empty cells (so you can copy/paste to Google Sheets easily)
   * Default: "∅"
   */
  emptyCellMarker?: string;
};

type QaIssueRow = {
  severity: string;
  type: string;
  row: string; // original sheet row number (string in report)
  hotel: string;
  questionEn: string;
  answerEn: string;
  questionTarget: string;
  answerTarget: string;
  note: string;
};

type TriageResultRow = {
  hotel: string;
  questionEn: string;
  answerEn: string;
  questionTarget: string;
  answerTarget: string;
  whyIssue: string;
  fixQuestionTarget: string;
  fixAnswerTarget: string;

  // helpful metadata
  sourceSeverity: string;
  sourceType: string;
  sourceRow: string;
};

export class QaMasterTriageJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  // ---------------------------
  // Tab helpers
  // ---------------------------

  private coerceSpreadsheetId(input: string): string {
    const s = String(input ?? "").trim();
    if (!s) return s;

    // If it's already an ID (no slashes), return as-is
    if (!s.includes("/")) return s;

    // Try extracting from common Google Sheets URL:
    // https://docs.google.com/spreadsheets/d/<ID>/edit...
    const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m?.[1]) return m[1];

    // Fallback: return as-is (will fail loudly)
    return s;
  }

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

  private stripHtmlTags(s: string): string {
    return String(s ?? "").replace(/<[^>]*>/g, " ");
  }

  private stripHtmlEntities(s: string): string {
    const t = String(s ?? "");
    return t
      .replace(/&#\d+;/g, " ")
      .replace(/&#x[0-9a-f]+;/gi, " ")
      .replace(/&[a-z]+;/gi, " ");
  }

  private normalizeBase(s: string): string {
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

  // ---------------------------
  // Deterministic noise filter
  // ---------------------------

  /**
   * Step-2 filter: drop NUMBERS_MISMATCH rows that are not real issues.
   * We re-normalize EN/DE (Rule Set A-D), extract number/time tokens from normalized text,
   * and if they match - it's noise -> drop.
   */
  private isNumbersMismatchNoise(issue: QaIssueRow, lang: string): boolean {
    if (issue.type !== "NUMBERS_MISMATCH") return false;

    // Decide whether mismatch was in question or answer based on note string
    const note = this.normalizeBase(issue.note);
    const inQuestion = note.includes("question numbers differ");
    const inAnswer = note.includes("answer numbers differ");

    const enText = inQuestion ? issue.questionEn : issue.answerEn;
    const tgtText = inQuestion ? issue.questionTarget : issue.answerTarget;

    if (!enText || !tgtText) return false;

    const enTokens = this.extractNumberTokensNormalized(enText, "en");
    const tgtTokens = this.extractNumberTokensNormalized(tgtText, lang);

    // If identical -> noise (examples: zehn vs 10, four vs 4, noon vs 12:00, rund um die Uhr vs 24-hour)
    if (this.tokensEqual(enTokens, tgtTokens)) return true;

    // Additional noise pattern: EN contains both "24h" and "7" because of "7 days a week",
    // DE says "sieben Tage die Woche" (words). If after normalization DE still lacks 7 token,
    // it is also noise (we do not want to flag 7-days-a-week if written in words).
    // Our words-to-number tries to catch "sieben", but keep a final safe check:
    if (inAnswer || inQuestion) {
      const enHas24h = enTokens.includes("24h");
      const enHas7 = enTokens.includes("7");
      const deHas24h = tgtTokens.includes("24h");
      const deHas7 = tgtTokens.includes("7");
      if (enHas24h && deHas24h && enHas7 && !deHas7) {
        // likely "seven days a week" in words -> noise
        return true;
      }
    }

    return false;
  }

  private tokensEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // ---------------------------
  // Rule Set A-D normalization
  // ---------------------------

  private normalizeTextForNumberCompare(text: string, lang: string): string {
    let t = this.normalizeBase(text);
    if (!t) return "";

    // Rule Set A: Noon/Midnight
    t = t
      .replace(/\bnoon\b/g, "12:00")
      .replace(/\bmidnight\b/g, "00:00");

    if (lang === "de") {
      t = t
        .replace(/\bmittag\b/g, "12:00")
        .replace(/\bmitternacht\b/g, "00:00");
    }

    // Rule Set A: AM/PM -> 24h (supports "a.m." "p.m." and spacing)
    t = this.convert12hTo24h(t);

    // Rule Set C: normalize 24h concept into a unified token "24h"
    t = this.inject24hToken(t, lang);

    // Rule Set D: thousands separators removal (1,000 / 1.000 / 1 000 -> 1000)
    // Avoid touching times (already handled as HH:MM).
    t = t.replace(/\b(\d{1,3})(?:[.\s,]\d{3})+(?!\d)\b/g, (m) => m.replace(/[.\s,]/g, ""));

    // Rule Set D: decimal comma -> dot (mostly DE)
    t = t.replace(/\b(\d+),(\d+)\b/g, "$1.$2");

    // Rule Set B: numbers in words -> digits BEFORE extraction
    t = this.wordsToNumbers(t, lang);

    // Keep "about/circa" etc - do nothing (they should not break extraction)
    return t;
  }

  private convert12hTo24h(text: string): string {
    // "4 pm" / "4 p.m." / "4:00 PM" / "12:00 a.m."
    return text.replace(
      /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/gi,
      (_m, hStr, minStr, apRaw) => {
        let h = parseInt(String(hStr), 10);
        const m = minStr ? parseInt(String(minStr), 10) : 0;
        const ap = String(apRaw).toLowerCase().replace(/\./g, "");
        const isPm = ap === "pm";
        if (isPm && h < 12) h += 12;
        if (!isPm && h === 12) h = 0;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    );
  }

  private inject24hToken(text: string, lang: string): string {
    let t = text;

    const patternsEn = [
      /\b24\s*(?:hours?|hrs?)\b/g,
      /\b24-?hour\b/g,
      /\baround the clock\b/g,
      /\bround-?the-?clock\b/g,
      /\ball day and night\b/g,
      /\b24\/7\b/g,
      /\btwenty-?four\s*(?:hours?|hrs?)\b/g,
    ];

    const patternsDe = [
      /\brund um die uhr\b/g,
      /\bdurchgehend\b/g,
      /\btag und nacht\b/g,
      /\b24\s*stunden\b/g,
      /\b24-?stunden\b/g,
      /\b24\/7\b/g,
    ];

    const patterns = lang === "de" ? patternsDe : patternsEn;

    let has = false;
    for (const p of patterns) {
      if (p.test(t)) {
        has = true;
        t = t.replace(p, " 24h ");
      }
    }

    // Also if the text already contains explicit "24-hour"/"24 Stunden" etc but in a different lang,
    // normalize it anyway:
    if (!has) {
      if (/\b24\s*(?:hours?|hrs?|stunden)\b/.test(t) || /\b24\/7\b/.test(t)) {
        t = t.replace(/\b24\s*(?:hours?|hrs?|stunden)\b/g, " 24h ");
        t = t.replace(/\b24\/7\b/g, " 24h ");
      }
    }

    return t.replace(/\s+/g, " ").trim();
  }

  private wordsToNumbers(text: string, lang: string): string {
    let t = text;

    // EN basic & tens
    const enBase: Record<string, number> = {
      zero: 0,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      sixteen: 16,
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
    };

    const enTens: Record<string, number> = {
      twenty: 20,
      thirty: 30,
      forty: 40,
      fifty: 50,
      sixty: 60,
      seventy: 70,
      eighty: 80,
      ninety: 90,
    };

    // DE basic & tens (covers common cases like "zehn", "vier", "sieben")
    // Note: this is intentionally conservative - we want to kill noise, not over-parse German compounds.
    const deBase: Record<string, number> = {
      null: 0,
      eins: 1,
      eine: 1,
      ein: 1,
      zwei: 2,
      drei: 3,
      vier: 4,
      fünf: 5,
      sechs: 6,
      sieben: 7,
      acht: 8,
      neun: 9,
      zehn: 10,
      elf: 11,
      zwölf: 12,
      dreizehn: 13,
      vierzehn: 14,
      fünfzehn: 15,
      sechzehn: 16,
      siebzehn: 17,
      achtzehn: 18,
      neunzehn: 19,
    };

    const deTens: Record<string, number> = {
      zwanzig: 20,
      dreißig: 30,
      dreissig: 30,
      vierzig: 40,
      fünfzig: 50,
      sechzig: 60,
      siebzig: 70,
      achtzig: 80,
      neunzig: 90,
    };

    // Replace hyphenated or spaced EN compound tens: "twenty-five" / "twenty five"
    if (lang === "en") {
      t = t.replace(
        new RegExp(`\\b(${Object.keys(enTens).join("|")})[-\\s]+(${Object.keys(enBase).join("|")})\\b`, "g"),
        (_m, tensW, baseW) => String(enTens[tensW] + enBase[baseW])
      );

      // Replace standalone EN base words
      t = t.replace(new RegExp(`\\b(${Object.keys(enBase).join("|")})\\b`, "g"), (m) => String(enBase[m]));

      // Replace standalone EN tens words
      t = t.replace(new RegExp(`\\b(${Object.keys(enTens).join("|")})\\b`, "g"), (m) => String(enTens[m]));
    }

    if (lang === "de") {
      // Standalone German number words
      t = t.replace(new RegExp(`\\b(${Object.keys(deBase).join("|")})\\b`, "g"), (m) => String(deBase[m]));
      t = t.replace(new RegExp(`\\b(${Object.keys(deTens).join("|")})\\b`, "g"), (m) => String(deTens[m]));

      // Handle simple "x bis y" where x/y are now digits (already replaced above)
      // Nothing else required here.
    }

    return t;
  }

  // ---------------------------
  // Extraction on normalized text
  // ---------------------------

  private extractNumberTokensNormalized(text: string, lang: string): string[] {
    let t = this.normalizeTextForNumberCompare(text, lang);
    if (!t) return [];

    const tokens: string[] = [];

    // Times HH:MM
    const timeMatches = t.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
    for (const tm of timeMatches) {
      const [hhRaw, mm] = tm.split(":");
      const hh = String(parseInt(hhRaw, 10)).padStart(2, "0");
      tokens.push(`${hh}:${mm}`);
    }

    // Remove times before scanning generic numbers (prevents 06 + 30 noise)
    const tNoTimes = t.replace(/\b\d{1,2}:\d{2}\b/g, " ");

    // Semantic 24h token
    const has24h = /\b24h\b/.test(t);
    if (has24h) tokens.push("24h");

    // General numbers/decimals
    const numMatches = tNoTimes.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
    for (const nm of numMatches) tokens.push(nm);

    // If 24h exists, remove standalone "24" (and "7" if original included 24/7-like)
    const has24slash7 = /\b24\/7\b/.test(this.normalizeBase(text)) || /\b24\s*h\b/.test(t);
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

  // ---------------------------
  // Read issues list from QA tab
  // ---------------------------

  private findIssuesHeaderRow(rows: string[][]): { headerRowIndex: number; colIndex: Record<string, number> } | null {
    // We scan for a row that contains the expected headers
    // severity | type | row | hotel | question_en | answer_en | question_xx | answer_xx | note
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const n = row.map((c) => this.normHeader(c));
      const severityIdx = n.indexOf("severity");
      const typeIdx = n.indexOf("type");
      const rowIdx = n.indexOf("row");
      const hotelIdx = n.indexOf("hotel");
      const qEnIdx = n.indexOf("question_en");
      const aEnIdx = n.indexOf("answer_en");
      const noteIdx = n.indexOf("note");

      if (severityIdx >= 0 && typeIdx >= 0 && rowIdx >= 0 && hotelIdx >= 0 && qEnIdx >= 0 && aEnIdx >= 0 && noteIdx >= 0) {
        // Find target columns by prefix
        let qTIdx = -1;
        let aTIdx = -1;
        for (let i = 0; i < n.length; i++) {
          if (n[i].startsWith("question_") && n[i] !== "question_en") qTIdx = i;
          if (n[i].startsWith("answer_") && n[i] !== "answer_en") aTIdx = i;
        }

        // fallback: allow "frage"/"antwort"
        if (qTIdx < 0) qTIdx = n.indexOf("frage");
        if (aTIdx < 0) aTIdx = n.indexOf("antwort");

        if (qTIdx >= 0 && aTIdx >= 0) {
          return {
            headerRowIndex: r,
            colIndex: {
              severity: severityIdx,
              type: typeIdx,
              row: rowIdx,
              hotel: hotelIdx,
              questionEn: qEnIdx,
              answerEn: aEnIdx,
              questionTarget: qTIdx,
              answerTarget: aTIdx,
              note: noteIdx,
            },
          };
        }
      }
    }
    return null;
  }

  private parseIssues(rows: string[][]): QaIssueRow[] {
    const found = this.findIssuesHeaderRow(rows);
    if (!found) return [];

    const { headerRowIndex, colIndex } = found;
    const out: QaIssueRow[] = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const sev = this.normCell(row[colIndex.severity] ?? "");
      const type = this.normCell(row[colIndex.type] ?? "");

      // stop at empty lines
      if (!sev && !type) break;

      out.push({
        severity: this.normCell(row[colIndex.severity] ?? ""),
        type: this.normCell(row[colIndex.type] ?? ""),
        row: this.normCell(row[colIndex.row] ?? ""),
        hotel: this.normCell(row[colIndex.hotel] ?? ""),
        questionEn: this.normCell(row[colIndex.questionEn] ?? ""),
        answerEn: this.normCell(row[colIndex.answerEn] ?? ""),
        questionTarget: this.normCell(row[colIndex.questionTarget] ?? ""),
        answerTarget: this.normCell(row[colIndex.answerTarget] ?? ""),
        note: this.normCell(row[colIndex.note] ?? ""),
      });
    }

    return out;
  }

  // ---------------------------
  // AI triage + fix suggestions
  // ---------------------------

  private systemForLang(lang: string): string {
    if (lang === "de") {
      return [
        "ROLE: You are a strict Hotel FAQ QA & German localization editor.",
        "GOAL: Identify only REAL issues and propose minimal fixes.",
        "",
        "CRITICAL RULES:",
        "1) Do NOT invent facts. If the English source lacks a detail, the German must not add it.",
        "2) Preserve all numbers, times, distances and constraints exactly as in English unless clearly a formatting conversion (e.g., 4 p.m. -> 16:00).",
        "3) Keep the hotel name exactly as in the German question if it exists (do not remove it).",
        "4) If the issue is only wording style, mark it as NOT a real issue.",
        "4.1 if the name of the hotel is mising in the German answer but is present in the German question, it is NOT a real issue (",
        "5) If German is missing entirely, propose full German question/answer translations.",
        "",
        "OUTPUT FORMAT:",
        "Return VALID JSON only: {\"items\":[ ... ]}",
        "Each item must include:",
        "- key (string) - pass through as provided",
        "- isRealIssue (boolean)",
        "- why (Hebrew string, short, practical)",
        "- fixQuestion (German string or empty)",
        "- fixAnswer (German string or empty)",
      ].join("\n");
    }

    // default generic
    return [
      "ROLE: You are a strict Hotel FAQ QA editor.",
      "Return VALID JSON only: {\"items\":[...]} with key,isRealIssue,why,fixQuestion,fixAnswer.",
      "Do NOT invent facts. Preserve numbers and times. If it's stylistic only, isRealIssue=false.",
    ].join("\n");
  }

  private buildAiPrompt(batch: Array<{ key: string; issue: QaIssueRow }>, lang: string): string {
    const items = batch.map(({ key, issue }) => ({
      key,
      type: issue.type,
      severity: issue.severity,
      hotel: issue.hotel,
      question_en: issue.questionEn,
      answer_en: issue.answerEn,
      question_target: issue.questionTarget,
      answer_target: issue.answerTarget,
      note: issue.note,
    }));

    return [
      "TASK: Triage each issue. Mark only REAL issues and propose minimal fixes in target language.",
      "IMPORTANT: If a time conversion is purely formatting (e.g., 4 p.m. => 16:00), it is NOT a real issue.",
      "Return JSON only.",
      JSON.stringify({ items }, null, 0),
    ].join("\n");
  }

  private parseAiJson(text: string): any {
    const raw = String(text ?? "");
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    const slice = first >= 0 && last > first ? raw.slice(first, last + 1) : raw;

    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }

  // ---------------------------
  // Writing report
  // ---------------------------

  private async prepareReportTab(spreadsheetId: string, tabName: string, templateTabName?: string) {
    const anySheets = this.sheets as any;
    if (templateTabName && typeof anySheets.recreateTabFromTemplate === "function") {
      await anySheets.recreateTabFromTemplate(spreadsheetId, tabName, templateTabName);
    } else {
      await this.sheets.ensureTab(spreadsheetId, tabName);
    }
    await this.sheets.clearTabValues(spreadsheetId, tabName);
  }

  private cellOrMarker(v: string, marker: string): string {
    const x = this.normCell(v);
    return x ? x : marker;
  }

  // ---------------------------
  // Main
  // ---------------------------

  async run(cfg: QaMasterTriageConfig): Promise<void> {
    const lang = (cfg.targetLang || "").trim().toLowerCase();
    if (!lang) throw new Error("targetLang is required");

    const sourceTab = cfg.sourceQaTabName?.trim();
    if (!sourceTab) throw new Error("sourceQaTabName is required");

    const outTab = cfg.outputTabName ?? `QA - ${lang.toUpperCase()} True Issues`;
    const templateTab = cfg.templateTabName;
    const model = cfg.model ?? "o3";

    const maxItems = cfg.maxItemsToProcess ?? 500;
    const batchSize = cfg.aiBatchSize ?? 10;
    const deterministicOnly = cfg.deterministicOnly ?? false;

    const marker = cfg.emptyCellMarker ?? "∅";

    console.log(chalk.blue(`Starting QA triage (${lang.toUpperCase()})...`));
    console.log(chalk.gray(`Source tab: "${sourceTab}" -> Output tab: "${outTab}"`));

    const rows = await this.sheets.readValues(cfg.spreadsheetId, `${sourceTab}!A:AZ`);
    if (rows.length < 2) throw new Error("Source QA tab has no data.");


    const issues = this.parseIssues(rows);
    if (issues.length === 0) throw new Error("Could not find issues header row in source QA tab.");

    // 1) Deterministic noise filtering
    const candidates: QaIssueRow[] = [];
    for (const it of issues) {
      if (candidates.length >= maxItems) break;

      if (it.type === "NUMBERS_MISMATCH") {
        const isNoise = this.isNumbersMismatchNoise(it, lang);
        if (isNoise) continue;
        candidates.push(it);
        continue;
      }

      // Always keep missing translations - those are real
      if (it.type === "MISSING_TARGET_QUESTION" || it.type === "MISSING_TARGET_ANSWER") {
        candidates.push(it);
        continue;
      }

      // Keep others (hotel name missing, language suspect, etc.) for AI triage
      candidates.push(it);
    }

    console.log(chalk.cyan(`Parsed issues: ${issues.length} | After deterministic noise filter: ${candidates.length}`));

    // If deterministicOnly: just write the remaining candidates without AI fixes
    const triagedRows: TriageResultRow[] = [];

    if (deterministicOnly) {
      for (const it of candidates) {
        triagedRows.push({
          hotel: it.hotel,
          questionEn: it.questionEn,
          answerEn: it.answerEn,
          questionTarget: it.questionTarget,
          answerTarget: it.answerTarget,
          whyIssue: it.note || it.type,
          fixQuestionTarget: "",
          fixAnswerTarget: "",
          sourceSeverity: it.severity,
          sourceType: it.type,
          sourceRow: it.row,
        });
      }
    } else {
      // 2) AI triage on remaining candidates + suggested fixes
      const system = this.systemForLang(lang);

      let idx = 0;
      while (idx < candidates.length) {
        const slice = candidates.slice(idx, idx + batchSize);

        const batch = slice.map((issue, i) => ({
          key: `item_${idx + i + 1}`,
          issue,
        }));

        const prompt = this.buildAiPrompt(batch, lang);
        const resp = await this.agent.runWithSystem(prompt, system, model);

        const obj = this.parseAiJson(resp);
        const items = obj?.items;
        if (!Array.isArray(items)) {
          // if model failed JSON, fallback: keep them as "needs manual review"
          for (const { issue } of batch) {
            triagedRows.push({
              hotel: issue.hotel,
              questionEn: issue.questionEn,
              answerEn: issue.answerEn,
              questionTarget: issue.questionTarget,
              answerTarget: issue.answerTarget,
              whyIssue: issue.note || "Needs manual review (AI JSON failed)",
              fixQuestionTarget: "",
              fixAnswerTarget: "",
              sourceSeverity: issue.severity,
              sourceType: issue.type,
              sourceRow: issue.row,
            });
          }
          idx += batchSize;
          continue;
        }

        // Map AI outputs by key
        const map = new Map<string, any>();
        for (const it of items) {
          if (it && typeof it.key === "string") map.set(it.key, it);
        }

        for (const { key, issue } of batch) {
          const ai = map.get(key);

          // If AI doesn't return it - keep as manual review
          if (!ai) {
            triagedRows.push({
              hotel: issue.hotel,
              questionEn: issue.questionEn,
              answerEn: issue.answerEn,
              questionTarget: issue.questionTarget,
              answerTarget: issue.answerTarget,
              whyIssue: issue.note || "Needs manual review (missing AI item)",
              fixQuestionTarget: "",
              fixAnswerTarget: "",
              sourceSeverity: issue.severity,
              sourceType: issue.type,
              sourceRow: issue.row,
            });
            continue;
          }

          // Only keep REAL issues
          if (ai.isRealIssue !== true) continue;

          triagedRows.push({
            hotel: issue.hotel,
            questionEn: issue.questionEn,
            answerEn: issue.answerEn,
            questionTarget: issue.questionTarget,
            answerTarget: issue.answerTarget,
            whyIssue: String(ai.why ?? issue.note ?? issue.type),
            fixQuestionTarget: String(ai.fixQuestion ?? ""),
            fixAnswerTarget: String(ai.fixAnswer ?? ""),
            sourceSeverity: issue.severity,
            sourceType: issue.type,
            sourceRow: issue.row,
          });
        }

        idx += batchSize;
      }
    }

    // 3) Write output tab
    const now = new Date().toISOString();

    const out: string[][] = [];
    out.push([`QA - ${lang.toUpperCase()} True Issues (Triage)`]);
    out.push(["Run at", now]);
    out.push(["Source tab", sourceTab]);
    out.push(["Total source issues", String(issues.length)]);
    out.push(["After deterministic filter", String(candidates.length)]);
    out.push(["True issues (final)", String(triagedRows.length)]);
    out.push([""]);

    out.push([
      "hotel",
      "question_en_full",
      "answer_en_full",
      `question_${lang}_full`,
      `answer_${lang}_full`,
      "why_issue",
      `fix_question_${lang}`,
      `fix_answer_${lang}`,
      "source_severity",
      "source_type",
      "source_row",
    ]);

    for (const r of triagedRows) {
      out.push([
        this.cellOrMarker(r.hotel, marker),
        this.cellOrMarker(r.questionEn, marker),
        this.cellOrMarker(r.answerEn, marker),
        this.cellOrMarker(r.questionTarget, marker),
        this.cellOrMarker(r.answerTarget, marker),
        this.cellOrMarker(r.whyIssue, marker),
        this.cellOrMarker(r.fixQuestionTarget, marker),
        this.cellOrMarker(r.fixAnswerTarget, marker),
        this.cellOrMarker(r.sourceSeverity, marker),
        this.cellOrMarker(r.sourceType, marker),
        this.cellOrMarker(r.sourceRow, marker),
      ]);
    }

    await this.prepareReportTab(cfg.spreadsheetId, outTab, templateTab);
    await this.sheets.writeValues(cfg.spreadsheetId, `${outTab}!A1`, out);

    console.log(chalk.green(`QA triage completed -> "${outTab}".`));
    console.log(chalk.gray(`Final true issues: ${triagedRows.length}`));
  }
}