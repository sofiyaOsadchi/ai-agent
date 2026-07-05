// src/jobs/translate-from-sheet-demo.ts
// Demo-only job. Keeps the production job untouched.
// Code in English. Comments can be Hebrew if needed.

import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

import {
  TERMINOLOGY_MANAGEMENT,
  type LangKey,
  type TerminologyProfile,
} from "./subjobs/terminology-management.js";

import {
  selectTerminologyByDraftHits,
  formatStrictTerminologyFromSelection,
} from "./subjobs/utility-translate.js";

import { getGlossaryPrompt } from "./subjobs/translation-glossary.js";

type UiGlossaryByLang = Partial<Record<LangKey, Record<string, string>>>;

export type DemoPromptOverrides = {
  draftSystem?: string; // system prompt for draft step
  draftUser?: string; // user prompt for draft step
  polishSystem?: string; // system prompt for polish step
  polishUser?: string; // user prompt for polish step
  finalPolishSystem?: string; // system prompt for optional clean final polish step
  finalPolishUser?: string; // user prompt for optional clean final polish step
};

type TranslateDemoOverrides = {
  splitIntoTwo?: boolean;
  finalPolishEnabled?: boolean;
  targetTabExistsMode?: "skip" | "numbered";

  // prompts editable from UI
  prompts?: DemoPromptOverrides;

  // notes per language (override)
  languageNotes?: Partial<Record<LangKey, string>>;

  // glossary per language from UI (simple source -> required translation map)
  glossaryByLang?: UiGlossaryByLang;
  glossaryEnabledByLang?: Partial<Record<LangKey, boolean>>;

  // terminology profile per language (override)
  terminologyByLang?: Partial<Record<LangKey, TerminologyProfile>>;
  terminologyEnabledByLang?: Partial<Record<LangKey, boolean>>;

  // model selected from UI
  model?: string;
  finalPolishModel?: string;

  // optional extra rules per language (mostly for DE polish)
  polishRulesByLang?: Partial<Record<LangKey, string>>;
};

type TranslateSheetDemoConfig = {
  spreadsheetId: string;
  sourceTab?: string;
  sourceRange?: string;
  targetLangs: string[];
  translateHeader?: boolean;
  demoOverrides?: TranslateDemoOverrides;
};

type DemoModelSelection = {
  provider: "openai" | "anthropic";
  model: string;
  label: string;
};

// === Default Language Notes (fallback if UI doesn't override) ===
const DEFAULT_LANGUAGE_NOTES: Record<LangKey, string> = {
  en: [
    "Style: Professional International English (prefer US spelling 'color/center' unless British specified).",
    "Tone: Welcoming, warm, and helpful, but distinctively upscale.",
    "Vocabulary: Use hospitality standards (e.g., 'Complimentary' instead of 'Free', 'Front Desk' instead of 'Reception').",
    "Grammar: Use active voice. Avoid robotic 'Yes, there is...'. Instead use 'Yes, the hotel offers...'.",
    "Formatting: Use 24-hour clock (14:00).",
    "CRITICAL - HOTEL NAME:",
    "1. If the source text is Hebrew, YOU MUST translate the Hotel Name to its official English name provided in the context.",
    "2. NEVER remove the hotel name from the sentence if it appears in the source.",
  ].join(" "),
  de: [
    "Use formal, neutral German in third person; avoid slang.",
    "Prefer native question forms: “Gibt es …?” / “Verfügt das Hotel über …?”.",
    "Use standard hotel terms: kostenloses WLAN; Rezeption rund um die Uhr; Zimmerreinigung.",
    "Avoid English leftovers; Keep brand names exactly (unless source is non-Latin, then transliterate).",
    "HOTEL WORDING: Do NOT use “Haus” to refer to the hotel/property. Always use “Hotel”.",
    "RECEPTION TONE: Avoid “engagiert(e)” for the reception team. Prefer: “das Rezeptionsteam steht Gästen rund um die Uhr für alle Anliegen zur Verfügung”.",
    "STYLE: Avoid “in ca.”, use “in etwa”.",
    "WORD CHOICE: Prefer “Anfrage” over “Wunsch” (e.g., “auf Anfrage”).",
    "WORD CHOICE: Prefer “Ernährungsbedürfnisse” over “Ernährungswünsche”.",
    "WORD CHOICE: Avoid “arrangiert” when referring to reserved areas; prefer “eingerichtet” or “reserviert” depending on context.",
    "WALKABILITY: Prefer “lässt sich ... zu Fuß zurücklegen” over “kann ... zu Fuß zurückgelegt werden”.",
    "Prefer natural verbs like “bietet”, “steht zur Verfügung”.",
    "ROOM CATEGORY NAMES: Treat room categories and package names as official product names. Do NOT translate them literally.",
    "EN-SUITE: Do NOT translate 'en-suite' as 'eigenes Badezimmer'. Use 'en-suite Badezimmer' or 'Bad en suite'.",
    "GUEST TERM: Never use 'Hausgäste'. Use 'Gäste' or 'Hotelgäste' consistently (prefer 'Hotelgäste' when answering).",
    "QUESTION STYLE: Avoid stiff templates like 'Wie lauten ...?'. Prefer natural forms: 'Wann ist ... verfügbar?', 'Welche ... gibt es ...?', 'Bis wann ...?', 'Gibt es ...?'.",
    "HYPHENATION: Use correct German compounds: 'Executive-Zimmer' (not 'Executive Zimmer'), 'Tee-/Kaffee-Station' where appropriate.",
    "MEASUREMENTS: Use '55-Zoll-Fernseher' (not 55″-Fernseher). Use 'Zoll' spelling.",
    "Q-A CONSISTENCY: The German question MUST match the German answer semantically. Adjust the question to match the answer WITHOUT adding new facts.",
  ].join(" "),
  es: [
    "Neutral, polite Spanish (3rd person); no slang.",
    "Natural questions: “¿El hotel dispone de…?” / “¿Hay…?”.",
    "Consistent hotel terms: Wi-Fi gratis; recepción 24 horas; servicio de habitaciones.",
    "Avoid Spanglish; Place € after number (15 €).",
    "Keep brand names exactly.",
  ].join(" "),
  nl: [
    "Polite, clear Dutch; keep sentences concise.",
    "Use standard terms: gratis wifi; 24-uursreceptie; roomservice.",
    "Avoid English terms unless truly standard.",
    "Be consistent with brand names.",
  ].join(" "),
  it: [
    "Formale, cortese, scorrevole (3a persona).",
    "Domande naturali: “L’hotel dispone di…?”.",
    "Terminologia: Wi-Fi gratuito; reception aperta 24 ore su 24.",
    "Evita anglicismi inutili.",
    "€ dopo il numero (24,00 €).",
  ].join(" "),
  fr: [
    "Français formel, poli, fluide (3e personne).",
    "Questions naturelles: “L’hôtel dispose-t-il de… ?”.",
    "Termes standard: Wi-Fi gratuit; réception ouverte 24h/24.",
    "Typo FR: espace avant ? : ;.",
    "Respect exact de la marque.",
  ].join(" "),
  pl: [
    "Polite, neutral Polish; clear syntax.",
    "Terms: bezpłatne Wi-Fi; całodobowa recepcja.",
    "Avoid English remnants; keep consistent terminology.",
  ].join(" "),
  ru: [
    "Формальный, нейтральный стиль; 3-е лицо.",
    "Термины: бесплатный Wi-Fi; круглосуточная стойка регистрации.",
    "Не оставлять англицизмы.",
    "Соблюдать единообразие брендов.",
  ].join(" "),
  he: [
    "עברית רשמית, ברורה וזורמת; ניסוח ניטרלי מגדרית.",
    "שאלות טבעיות: “האם…?” / “האם המלון מציע…?”.",
    "מונחים: אינטרנט אלחוטי חינם; קבלה 24/7; שירות חדרים.",
    "לא לשנות פורמט של שעות/מחירים; לשמור אחידות מיתוג.",
  ].join(" "),
  zh: [
    "简体中文，正式专业、自然流畅（第三人称）。",
    "用语：免费Wi-Fi；24小时前台；客房送餐服务。",
    "避免直译；用地道表达。",
    "品牌名保持一致。",
  ].join(" "),
  ar: [
    "عربية فصحى حديثة، رسمية وواضحة.",
    "مصطلحات: واي فاي مجاني؛ مكتب استقبال 24 ساعة.",
    "تجنّب الإنجليزية داخل الجمل.",
    "اتساق تام في أسماء العلامات.",
  ].join(" "),
  el: [
    "Natural, fluent Modern Greek for hotel FAQ content.",
    "Keep official hotel names and brand names exactly in Latin script; do not transliterate or decline them.",
    "Use natural Greek FAQ questions such as “Προσφέρει το [Hotel] ...;”, “Υπάρχει ... στο [Hotel];”, “Πόσο απέχει το [Hotel] από ...;”.",
    "Use the Greek question mark (;).",
    "Prefer standard hotel terms: δωρεάν Wi-Fi, ρεσεψιόν, check-in, check-out, φύλαξη αποσκευών, υπηρεσία δωματίου, χώρος στάθμευσης, πρωινό σε μπουφέ.",
    "Avoid literal English word order, stiff corporate phrasing, and marketing filler.",
    "Use natural Greek category labels with και instead of English ampersands when possible.",
    "For pet policies, avoid literal trained-dog wording unless formal training is genuinely meant.",
    "Check gender, number and case agreement carefully.",
    "Use natural 24-hour Greek hotel time when converting AM/PM values, and format distances naturally in Greek (0.7 km -> 0,7 χλμ.).",
  ].join(" "),
};

// === Optional default polish rules (especially useful for DE) ===
const DEFAULT_POLISH_RULES: Partial<Record<LangKey, string>> = {
  de: [
    "GERMAN STRICT QA (apply before output):",
    "- Avoid 'Wie lautet/Wie lauten ...?'. Prefer 'Wann...?', 'Welche...?', 'Bis wann...?', 'Gibt es...?', 'Verfügt ... über...?'",
    "- Never use 'Hausgäste' or 'Haus'. Use 'Hotelgäste' and 'Hotel'.",
    "- Use correct compounds/units: 'Executive-Zimmer' (hyphen), '55-Zoll-Fernseher' (not 55″).",
    "- en-suite: never 'eigenes Badezimmer'. Use 'en-suite Badezimmer' / 'Bad en suite'.",
    "- Avoid English 'Services' in German. Prefer 'Leistungen' / 'steht zur Verfügung'.",
    "- Ensure Q and A match semantically; if mismatch exists, adjust ONLY the question wording to match the answer (no new facts).",
    "- Preserve HTML tags and entities exactly as given (<p>, &amp; etc.). Do not introduce new escaping.",
    "- Avoid adding marketing adjectives not present in SOURCE.",
  ].join("\n"),
};

export const TRANSLATE_DEMO_DEFAULT_PROMPTS: Required<DemoPromptOverrides> = {
  draftSystem: `ROLE: You are an expert Hospitality Copywriter & Localization Specialist translating to {{lang}}.
GOAL: Create natural, flowing content that sounds like it was originally written in {{lang}}, NOT translated.
TONE: Warm, professional, helpful, and upscale (3rd person).

=== CRITICAL RULES (ZERO TOLERANCE) ===
1. HOTEL NAME INTEGRITY: You must NEVER remove the hotel name from a question or answer if it appears in the source.
2. OFFICIAL NAME: The official English name of the hotel is: "{{hotelName}}".
3. TECH SAFETY: Do NOT translate URLs, emails, codes, or tokens (e.g., %s, {name}).
4. STRUCTURE: Preserve the exact JSON matrix shape.
5. ACCURACY: Keep prices, times, and facts exactly as they are.`,

  draftUser: `TASK: Translate EVERY cell in the provided matrix to {{lang}}.
CONTEXT:
 - Domain: Hotel FAQ.
 - Official Hotel Name: "{{hotelName}}".

MANDATORY GLOSSARY RULES:
{{glossaryRules}}

INSTRUCTIONS:
- Translate ALL text content in the rows.
- Look at each row as a connected context unit (Category + Question + Answer).
- If the source is brief (e.g., "Yes"/"No"), you may expand it slightly ONLY by restating the proposition of the question.
- Translate header row: {{translateHeader}}.
- PRESERVE the exact 2D matrix structure (same number of rows and columns).
- If the source mentions the hotel name, ensure the translated text also includes "{{hotelName}}". Do not shorten it to "the hotel".
- Apply the mandatory glossary rules exactly when relevant.

INPUT DATA (JSON):
{{rows}}`,

  polishSystem: `ROLE: Senior Editor for a Luxury Hotel Brand ({{lang}}).
GOAL: Polish the translation to sound fully native and premium, with MINIMAL edits, WITHOUT changing meaning.
OUTPUT: JSON only.
OFFICIAL HOTEL NAME: "{{hotelName}}".`,

  polishUser: `TASK: Polish the DRAFT translation to sound fully native and premium, with MINIMAL edits, WITHOUT changing meaning.
WEB: Do NOT use web search. Do NOT cite sources. Output JSON only.

{{strictTerminology}}

HARD CONSTRAINTS (ZERO TOLERANCE):
1) CELL-BY-CELL MAPPING: For every cell at position (row r, col c), output EXACTLY one polished cell at the same position (r,c).
2) DIMENSIONS: Output must have EXACTLY the same number of rows and columns as SOURCE.
3) EMPTY CELLS: If a SOURCE cell is empty/blank, the output cell MUST be empty.
4) NO NEW FACTS: Do not add any facts, services, conditions, qualifiers, or availability notes not present in SOURCE.
5) PRESERVE DATA: Keep numbers, times, prices, addresses, distances exactly as in SOURCE.
6) PRESERVE TOKENS: Keep placeholders/tokens unchanged: %s, {name}, {{x}}, URLs, emails, codes.
7) HOTEL NAME RULE: If the SOURCE cell contains the official hotel name OR a hotel reference, the output cell MUST include exactly "{{hotelName}}" (do not replace with "the hotel").
8) QUESTION INTEGRITY: If SOURCE cell is a question, keep it as a natural question in {{lang}}. Do not turn questions into statements.
9) MINIMAL EDITS: Only fix unnatural phrasing, literal translation artifacts, grammar, and hospitality vocabulary. Do not rewrite aggressively.
10) JSON ONLY: Return ONLY valid JSON in the schema: {"rows":[...]} and nothing else.

LANGUAGE NOTES FOR {{lang}}:
{{languageNotes}}

INPUT (JSON):
{
  "meta": {
    "language": "{{lang}}",
    "officialHotelName": "{{hotelName}}",
    "translateHeader": "{{translateHeader}}"
  },
  "source": {{sourceRows}},
  "draft": { "json": {{draftJson}} }
}

OUTPUT: Return ONLY {"rows":[...]}`,

  finalPolishSystem: `ROLE: Native hospitality editor for {{lang}}.
GOAL: Make an already-correct translation sound natural, warm, friendly, and human.
NO RULE PACKS: Do not apply glossary, terminology, or language-note rules in this pass.
SAFETY: Preserve facts, numbers, prices, times, URLs, hotel names, placeholders, HTML, row count, and column count.
OFFICIAL HOTEL NAME: "{{hotelName}}".
OUTPUT: JSON only.`,

  finalPolishUser: `TASK: Final naturalness pass on the already polished translation.

The translation has already passed glossary and terminology checks. Do NOT add new rules and do NOT force terminology replacements here.
Only smooth wording that still sounds translated, stiff, blunt, or robotic.
Make it feel native, pleasant, clear, and guest-friendly in {{lang}}.

Guardrails:
- Keep the same meaning and facts.
- Keep every row and column in the same position.
- Preserve empty cells as empty.
- Preserve numbers, prices, times, URLs, emails, codes, placeholders, HTML tags and entities.
- Keep official hotel names unchanged, especially "{{hotelName}}".
- Translate header row: {{translateHeader}}.

SOURCE ROWS, for meaning check only:
{{sourceRows}}

POLISHED JSON TO SMOOTH:
{{polishedJson}}

OUTPUT: return ONLY {"rows":[...]}`
};

export function getTranslateDemoDefaultPrompts(): Required<DemoPromptOverrides> {
  return { ...TRANSLATE_DEMO_DEFAULT_PROMPTS };
}

export function getTranslateDemoDefaultLanguageNotes(): Record<LangKey, string> {
  return { ...DEFAULT_LANGUAGE_NOTES };
}

export class TranslateFromSheetDemoJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}


    // === Matrix Shape Helpers (critical for keeping blank rows aligned) ===

  private toRectMatrix(rows: string[][], width: number): string[][] {
    const w = Math.max(1, width);
    return (rows ?? []).map((r) => {
      const row = Array.isArray(r) ? r.map((x) => (x == null ? "" : String(x))) : [];
      if (row.length === w) return row;
      if (row.length > w) return row.slice(0, w);
      return [...row, ...Array(w - row.length).fill("")];
    });
  }

  private enforceSameShape(source: string[][], out: string[][]): string[][] {
    const src = source ?? [];
    const outRows = out ?? [];

    const height = src.length;
    const width = src.reduce((m, r) => Math.max(m, (r ?? []).length), 0) || 1;

    const fixed: string[][] = [];

    for (let i = 0; i < height; i++) {
      const srcRow = src[i] ?? [];
      const outRow = outRows[i] ?? [];

      // If SOURCE row is fully empty, keep it fully empty in output
      const srcAllEmpty = srcRow.every((c) => String(c ?? "").trim() === "");
      if (srcAllEmpty) {
        fixed.push(Array(width).fill(""));
        continue;
      }

      const normalizedOut = Array.isArray(outRow)
        ? outRow.map((c) => (c == null ? "" : String(c)))
        : [];

      if (normalizedOut.length > width) fixed.push(normalizedOut.slice(0, width));
      else if (normalizedOut.length < width)
        fixed.push([...normalizedOut, ...Array(width - normalizedOut.length).fill("")]);
      else fixed.push(normalizedOut);
    }

    return fixed;
  }

  private assertSameShapeOrThrow(source: string[][], out: string[][], ctx: string) {
    const srcH = source.length;
    const outH = out.length;
    const srcW = source.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
    const outW = out.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);

    if (srcH !== outH || srcW !== outW) {
      throw new Error(`[${ctx}] Shape mismatch. source=${srcH}x${srcW} out=${outH}x${outW}`);
    }
  }

  // ---- Public entry for server-demo env wiring ----
  async runFromEnv(): Promise<void> {
    const rawPayload = process.env.DYNAMIC_PAYLOAD || "{}";
    let payload: any = {};
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = {};
    }

    const sourceType =
      payload.sourceType === "folder" || process.env.DYNAMIC_INPUT_TYPE === "folder"
        ? "folder"
        : "sheet";
    const spreadsheetId = String(
      payload.spreadsheetId || (sourceType === "sheet" ? process.env.DYNAMIC_TARGET_ID : "") || ""
    ).trim();
    const sourceFolderId = String(
      payload.sourceFolderId || (sourceType === "folder" ? process.env.DYNAMIC_TARGET_ID : "") || ""
    ).trim();
    const sourceId = sourceType === "folder" ? sourceFolderId : spreadsheetId;
    if (!sourceId) {
      throw new Error(
        sourceType === "folder"
          ? "translate-demo: Missing sourceFolderId (provide in DYNAMIC_PAYLOAD.sourceFolderId or DYNAMIC_TARGET_ID)"
          : "translate-demo: Missing spreadsheetId (provide in DYNAMIC_PAYLOAD.spreadsheetId or DYNAMIC_TARGET_ID)"
      );
    }

    const targetLangsRaw =
      payload.targetLangs ??
      payload.langs ??
      (process.env.DYNAMIC_LANGS ? String(process.env.DYNAMIC_LANGS).split(",") : []);
    const targetLangs = (Array.isArray(targetLangsRaw) ? targetLangsRaw : [])
      .map((x: any) => String(x).trim())
      .filter(Boolean);

    const buildConfig = (targetSpreadsheetId: string): TranslateSheetDemoConfig => ({
      spreadsheetId: targetSpreadsheetId,
      sourceTab: payload.sourceTab ? String(payload.sourceTab) : undefined,
      sourceRange: payload.sourceRange ? String(payload.sourceRange) : undefined,
      targetLangs,
      translateHeader:
        typeof payload.translateHeader === "boolean" ? payload.translateHeader : true,
      demoOverrides: {
        splitIntoTwo:
          typeof payload.splitIntoTwo === "boolean" ? payload.splitIntoTwo : true,
        prompts: payload.prompts ?? undefined,
        languageNotes: payload.languageNotes ?? undefined,
        glossaryByLang: payload.glossaryByLang ?? undefined,
        glossaryEnabledByLang: payload.glossaryEnabledByLang ?? undefined,
        terminologyByLang: payload.terminologyByLang ?? undefined,
        terminologyEnabledByLang: payload.terminologyEnabledByLang ?? undefined,
        polishRulesByLang: payload.polishRulesByLang ?? undefined,
        finalPolishEnabled:
          typeof payload.finalPolishEnabled === "boolean" ? payload.finalPolishEnabled : false,
        targetTabExistsMode:
          payload.targetTabExistsMode === "numbered" ? "numbered" : "skip",
        model: payload.model ? String(payload.model) : undefined,
        finalPolishModel: payload.finalPolishModel
          ? String(payload.finalPolishModel)
          : payload.polishModel
            ? String(payload.polishModel)
            : undefined,
      },
    });

    if (sourceType === "folder") {
      const folderId = this.extractFolderId(sourceFolderId);
      console.log(chalk.cyan(`📂 Loading spreadsheets from folder: ${folderId}`));
      const spreadsheetIds = await this.sheets.listSpreadsheetIdsInFolderRecursive(folderId);
      if (spreadsheetIds.length === 0) {
        throw new Error(`translate-demo: No Google Sheets files found in folder ${folderId}`);
      }
      console.log(chalk.cyan(`📂 Found ${spreadsheetIds.length} spreadsheet(s) in folder.`));

      const failedSheets: string[] = [];
      for (let index = 0; index < spreadsheetIds.length; index++) {
        const targetSpreadsheetId = spreadsheetIds[index];
        const title = await this.sheets
          .getSpreadsheetTitle(targetSpreadsheetId)
          .catch(() => targetSpreadsheetId);
        console.log(
          chalk.cyan(
            `📄 Folder item ${index + 1}/${spreadsheetIds.length}: ${title} (${targetSpreadsheetId})`
          )
        );

        try {
          await this.run(buildConfig(targetSpreadsheetId));
        } catch (error) {
          console.error(
            chalk.red(`⚠️ Failed folder item ${index + 1}/${spreadsheetIds.length}: ${title}`),
            error
          );
          failedSheets.push(title);
        }
      }

      if (failedSheets.length) {
        throw new Error(
          `translate-demo folder run failed for ${failedSheets.length}/${spreadsheetIds.length} spreadsheet(s): ${failedSheets.join(", ")}`
        );
      }
      return;
    }

    await this.run(buildConfig(spreadsheetId));
  }

  // ---- Helpers ----
  private langLabel(lang: string): string {
    const m: Record<string, string> = {
      he: "Hebrew",
      fr: "French",
      de: "German",
      es: "Spanish",
      it: "Italian",
      ru: "Russian",
      en: "English",
      ar: "Arabic",
      el: "Greek",
      gr: "Greek",
      nl: "Dutch",
      pl: "Polish",
      zh: "Chinese",
    };
    return m[lang.toLowerCase()] ?? lang;
  }

  private normalizeLang(lang: string): LangKey {
    const key = (lang || "").toLowerCase().trim();
    const aliases: Record<string, LangKey> = {
      en: "en",
      english: "en",
      de: "de",
      german: "de",
      es: "es",
      spanish: "es",
      nl: "nl",
      dutch: "nl",
      it: "it",
      italian: "it",
      fr: "fr",
      french: "fr",
      pl: "pl",
      polish: "pl",
      ru: "ru",
      russian: "ru",
      he: "he",
      hebrew: "he",
      zh: "zh",
      chinese: "zh",
      ar: "ar",
      arabic: "ar",
      el: "el",
      greek: "el",
      gr: "el",
    };
    return aliases[key] ?? (key as LangKey);
  }

  private normalizeSourceRange(input?: string): string {
    const defaultRange = "A1:Z68";
    const raw = String(input || "").trim();
    if (!raw) return defaultRange;

    const rangeOnly = raw.includes("!") ? raw.split("!").pop() || "" : raw;
    const normalized = rangeOnly.replace(/\$/g, "").replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{1,3}[1-9]\d*(?::[A-Z]{1,3}[1-9]\d*)?$/.test(normalized)) {
      throw new Error(
        `translate-demo: Invalid sourceRange "${input}". Use A1 notation such as A1:Z68.`
      );
    }

    return normalized;
  }

  private getRangeStartCell(range: string): string {
    return range.split(":")[0] || "A1";
  }

  private extractFolderId(input: string): string {
    const raw = String(input || "").trim();
    const match = raw.match(/\/folders\/([A-Za-z0-9_-]+)/) || raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
    return match?.[1] ?? raw;
  }

  private normalizeTabTitle(title: string): string {
    return String(title ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private trimSheetTitle(title: string): string {
    return String(title || "Translation").trim().slice(0, 96).trim() || "Translation";
  }

  private resolveTargetTabTitle(
    existingTitles: string[],
    baseTitle: string,
    mode: "skip" | "numbered"
  ): string | null {
    const normalizedExisting = new Set(existingTitles.map((title) => this.normalizeTabTitle(title)));
    const safeBaseTitle = this.trimSheetTitle(baseTitle);

    if (!normalizedExisting.has(this.normalizeTabTitle(safeBaseTitle))) {
      return safeBaseTitle;
    }

    if (mode === "skip") {
      return null;
    }

    for (let index = 2; index <= 99; index++) {
      const suffix = ` ${index}`;
      const candidate = `${this.trimSheetTitle(safeBaseTitle).slice(0, 100 - suffix.length)}${suffix}`;
      if (!normalizedExisting.has(this.normalizeTabTitle(candidate))) {
        return candidate;
      }
    }

    throw new Error(`Could not find an available numbered tab name for "${baseTitle}".`);
  }

  private buildPrompt(template: string, vars: Record<string, string>): string {
    let out = template || "";
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{{${k}}}`).join(v);
    }
    return out;
  }

  private getLanguageNotes(lang: string, overrides?: Partial<Record<LangKey, string>>): string {
    const k = this.normalizeLang(lang);
    return overrides?.[k] ?? DEFAULT_LANGUAGE_NOTES[k] ?? "";
  }

  private getPolishRules(lang: string, overrides?: Partial<Record<LangKey, string>>): string {
    const k = this.normalizeLang(lang);
    return overrides?.[k] ?? DEFAULT_POLISH_RULES[k] ?? "";
  }

  private isResourceEnabled(
    lang: string,
    overrides?: Partial<Record<LangKey, boolean>>
  ): boolean {
    const k = this.normalizeLang(lang);
    return overrides?.[k] !== false;
  }

  private getTerminologyProfileWithOverride(
    lang: string,
    overrides?: Partial<Record<LangKey, TerminologyProfile>>
  ): TerminologyProfile {
    const k = this.normalizeLang(lang);
    return overrides?.[k] ?? TERMINOLOGY_MANAGEMENT[k] ?? {};
  }

  private resolveModel(model?: string): DemoModelSelection {
    const allowed = new Set([
      "o3",
      "o4-mini",
      "gpt-5.5",
      "gpt-5.2",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4o",
      "gpt-4o-mini",
    ]);

    const value = String(model || "").trim();
    const providerModel = value.match(/^(openai|anthropic):(.+)$/i);
    if (providerModel) {
      const provider = providerModel[1].toLowerCase() as "openai" | "anthropic";
      const providerSpecificModel = providerModel[2].trim();
      if (provider === "anthropic" && providerSpecificModel === "claude-sonnet-4-6") {
        return {
          provider,
          model: providerSpecificModel,
          label: `anthropic:${providerSpecificModel}`,
        };
      }
      if (provider === "openai" && allowed.has(providerSpecificModel)) {
        return {
          provider,
          model: providerSpecificModel,
          label: providerSpecificModel,
        };
      }
    }

    if (/^claude/i.test(value)) {
      const claudeModel = value === "claude" ? "claude-sonnet-4-6" : value;
      if (claudeModel === "claude-sonnet-4-6") {
        return {
          provider: "anthropic",
          model: claudeModel,
          label: `anthropic:${claudeModel}`,
        };
      }
    }

    return {
      provider: "openai",
      model: allowed.has(value) ? value : "o3",
      label: allowed.has(value) ? value : "o3",
    };
  }

  private normalizeGlossaryText(text: string): string {
    return String(text || "")
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[–—-]/g, " ")
      .replace(/[^\p{L}\p{N}\s']/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private formatUiGlossaryPrompt(
    lang: string,
    sourceRows: string[][],
    glossaryByLang?: UiGlossaryByLang
  ): string {
    const langKey = this.normalizeLang(lang);
    const glossary = glossaryByLang?.[langKey] ?? {};

    if (!glossary || Object.keys(glossary).length === 0) {
      return "";
    }

    const sourceText = this.normalizeGlossaryText(sourceRows.flat().join(" "));
    const matched = Object.entries(glossary).filter(([source, target]) => {
      const normalizedSource = this.normalizeGlossaryText(source);
      return Boolean(normalizedSource && String(target || "").trim() && sourceText.includes(normalizedSource));
    });

    if (!matched.length) {
      return "";
    }

    return [
      "=== UI TRANSLATION GLOSSARY ===",
      "These rules were entered in the demo UI. When you see these source terms, translate them exactly as shown:",
      ...matched.map(([source, target]) => `- "${source}" -> "${target}"`),
    ].join("\n");
  }

  // ---- JSON parsing helpers (robust) ----
  private parseJsonMatrixOrThrow(text: string): string[][] {
    const jsonStr = this.extractFirstJsonObject(text);

    let obj: any;
    try {
      obj = JSON.parse(jsonStr);
    } catch {
      throw new Error("Model did not return valid JSON for translation output");
    }

    if (!obj || !Array.isArray(obj.rows)) {
      throw new Error("Translation JSON must contain a 'rows' array");
    }

    return obj.rows.map((row: any) =>
      Array.isArray(row) ? row.map((cell: any) => (cell == null ? "" : String(cell))) : []
    );
  }

  private extractFirstJsonObject(text: string): string {
    const cleaned = text
      .replace(/```json/gi, "```")
      .replace(/```/g, "")
      .trim();

    const start = cleaned.indexOf('{"rows"');
    const startFallback = cleaned.indexOf("{");
    const i0 = start >= 0 ? start : startFallback;

    if (i0 < 0) {
      throw new Error("Model did not return valid JSON for translation output");
    }

    let inString = false;
    let escaped = false;
    let depth = 0;

    for (let i = i0; i < cleaned.length; i++) {
      const ch = cleaned[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      } else {
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === "{") depth++;
        if (ch === "}") depth--;

        if (depth === 0) {
          return cleaned.slice(i0, i + 1);
        }
      }
    }

    throw new Error("Model did not return a complete JSON object");
  }

  // ---- Default prompt templates (used if UI does not override) ----
  private defaultDraftSystem(lang: string, hotelName: string): string {
    return this.buildPrompt(TRANSLATE_DEMO_DEFAULT_PROMPTS.draftSystem, {
      lang: this.langLabel(lang),
      hotelName,
    });
  }

  private defaultDraftUser(
    lang: string,
    rows: string[][],
    translateHeader: boolean,
    hotelName: string,
    glossaryRules: string
  ): string {
    return this.buildPrompt(TRANSLATE_DEMO_DEFAULT_PROMPTS.draftUser, {
      lang: this.langLabel(lang),
      hotelName,
      glossaryRules: glossaryRules || "",
      rows: JSON.stringify({ rows }),
      translateHeader: translateHeader ? "YES" : "NO",
    });
  }

  private defaultPolishSystem(lang: string, hotelName: string): string {
    return this.buildPrompt(TRANSLATE_DEMO_DEFAULT_PROMPTS.polishSystem, {
      lang: this.langLabel(lang),
      hotelName,
    });
  }

  private defaultPolishUser(params: {
    lang: string;
    sourceRows: string[][];
    draftJson: string;
    hotelName: string;
    translateHeader: boolean;
    strictTerminology: string;
    languageNotes: string;
  }): string {
    return this.buildPrompt(TRANSLATE_DEMO_DEFAULT_PROMPTS.polishUser, {
      lang: this.langLabel(params.lang),
      hotelName: params.hotelName,
      translateHeader: params.translateHeader ? "YES" : "NO",
      strictTerminology: params.strictTerminology || "",
      languageNotes: params.languageNotes || "",
      sourceRows: JSON.stringify({ rows: params.sourceRows }),
      draftJson: params.draftJson,
    });
  }

  private defaultFinalPolishSystem(lang: string, hotelName: string): string {
    return this.buildPrompt(TRANSLATE_DEMO_DEFAULT_PROMPTS.finalPolishSystem, {
      lang: this.langLabel(lang),
      hotelName,
    });
  }

  private defaultFinalPolishUser(params: {
    lang: string;
    sourceRows: string[][];
    polishedJson: string;
    hotelName: string;
    translateHeader: boolean;
  }): string {
    return this.buildPrompt(TRANSLATE_DEMO_DEFAULT_PROMPTS.finalPolishUser, {
      lang: this.langLabel(params.lang),
      hotelName: params.hotelName,
      translateHeader: params.translateHeader ? "YES" : "NO",
      sourceRows: JSON.stringify({ rows: params.sourceRows }),
      polishedJson: params.polishedJson,
    });
  }

  // ---- Main execution ----
  async run(cfg: TranslateSheetDemoConfig): Promise<void> {
    // 1) Resolve Source Tab
    let sourceTab = cfg.sourceTab && cfg.sourceTab.trim() ? cfg.sourceTab.trim() : undefined;
    if (!sourceTab) {
      sourceTab = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
      console.warn(`No sourceTab provided. Using first tab: "${sourceTab}"`);
    } else {
      try {
        await this.sheets.getSheetIdByTitle(cfg.spreadsheetId, sourceTab);
      } catch {
        const fallback = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
        console.warn(`Tab "${sourceTab}" not found. Using first tab: "${fallback}"`);
        sourceTab = fallback;
      }
    }

    // 2) Read Source Data & Metadata
    const sourceId = await this.sheets.getSheetIdByTitle(cfg.spreadsheetId, sourceTab);
    const sourceRange = this.normalizeSourceRange(cfg.sourceRange);
    const writeStartCell = this.getRangeStartCell(sourceRange);

    console.log(chalk.gray(`ℹ️ Translation range: ${sourceTab}!${sourceRange}`));
    const rawRows = await this.sheets.readValues(cfg.spreadsheetId, `${sourceTab}!${sourceRange}`);

    if (rawRows.length === 0) throw new Error(`Source tab "${sourceTab}" is empty`);

    // Determine a stable width and make the matrix rectangular.
    // This is critical so blank rows are not represented as [] and get dropped by the model.
    const headerRowRaw = rawRows[0] ?? [];
    const width = Math.max(1, headerRowRaw.length, ...rawRows.map((r) => (r ?? []).length));
    const rows = this.toRectMatrix(rawRows, width);

    const docTitle = await this.sheets.getSpreadsheetTitle(cfg.spreadsheetId);
    console.log(chalk.cyan(`🏨 Official Hotel Name detected from file: "${docTitle}"`));

    const translateHeader = cfg.translateHeader ?? true;
    const splitIntoTwo = cfg.demoOverrides?.splitIntoTwo ?? true;

    // 3) Split handling
    let part1Input: string[][];
    let part2Input: string[][];

    if (splitIntoTwo) {
      const headerRow = rows[0];
      const contentRows = rows.slice(1);
      const splitIndex = Math.ceil(contentRows.length / 2);

      part1Input = [headerRow, ...contentRows.slice(0, splitIndex)];
      part2Input = [headerRow, ...contentRows.slice(splitIndex)];

      console.log(
        chalk.gray(
          `ℹ️ Split info: Total items: ${contentRows.length}. Part 1: ${
            part1Input.length - 1
          }, Part 2: ${part2Input.length - 1}.`
        )
      );
    } else {
      part1Input = rows;
      part2Input = [rows[0]]; // "empty" part2
      console.log(chalk.gray(`ℹ️ Split disabled: processing all rows as a single chunk.`));
    }

    const prompts = cfg.demoOverrides?.prompts;
    const selectedModel = this.resolveModel(cfg.demoOverrides?.model);
    const selectedFinalPolishModel = this.resolveModel(
      cfg.demoOverrides?.finalPolishModel || cfg.demoOverrides?.model
    );
    console.log(chalk.gray(`🤖 translate-demo model: ${selectedModel.label}`));
    if (cfg.demoOverrides?.finalPolishEnabled) {
      console.log(
        chalk.gray(`🤖 translate-demo final polish model: ${selectedFinalPolishModel.label}`)
      );
    }

    const processChunk = async (chunkRows: string[][], lang: string, partNum: number) => {
      console.log(
        chalk.yellow(`   ⏳ Processing Part ${partNum}/2 (${chunkRows.length} rows)...`)
      );

      const normalizedLang = this.normalizeLang(lang);
      const glossaryEnabled = this.isResourceEnabled(
        normalizedLang,
        cfg.demoOverrides?.glossaryEnabledByLang
      );
      const terminologyEnabled = this.isResourceEnabled(
        normalizedLang,
        cfg.demoOverrides?.terminologyEnabledByLang
      );
      const staticGlossaryRules = glossaryEnabled
        ? getGlossaryPrompt(normalizedLang, chunkRows)
        : "";
      const uiGlossaryRules = glossaryEnabled
        ? this.formatUiGlossaryPrompt(
            normalizedLang,
            chunkRows,
            cfg.demoOverrides?.glossaryByLang
          )
        : "";
      const glossaryRules = [staticGlossaryRules, uiGlossaryRules].filter(Boolean).join("\n\n");

      console.log(
        chalk.gray(
          `[GLOSSARY] lang=${normalizedLang} enabled=${glossaryEnabled ? "yes" : "no"} static=${staticGlossaryRules ? "yes" : "no"} ui=${uiGlossaryRules ? "yes" : "no"}`
        )
      );

      // Step A: Draft
      const draftSystem = prompts?.draftSystem?.trim()
        ? this.buildPrompt(prompts.draftSystem, {
            lang: this.langLabel(lang),
            hotelName: docTitle,
          })
        : this.defaultDraftSystem(lang, docTitle);

      const draftUser = prompts?.draftUser?.trim()
        ? this.buildPrompt(prompts.draftUser, {
            lang: this.langLabel(lang),
            hotelName: docTitle,
            glossaryRules: glossaryRules || "",
            rows: JSON.stringify({ rows: chunkRows }),
            translateHeader: translateHeader ? "YES" : "NO",
          })
        : this.defaultDraftUser(lang, chunkRows, translateHeader, docTitle, glossaryRules);

      const draftResult = await this.agent.runWithSystem(
        draftUser,
        draftSystem,
        selectedModel.model,
        selectedModel.provider,
        { useWebSearch: false }
      );

      let draftRows = this.parseJsonMatrixOrThrow(draftResult);
      draftRows = this.enforceSameShape(chunkRows, draftRows);
      const draftJsonClean = JSON.stringify({ rows: draftRows });

      // Step B: Terminology selection (filtered)
      const profile = terminologyEnabled
        ? this.getTerminologyProfileWithOverride(
            lang,
            cfg.demoOverrides?.terminologyByLang
          )
        : {};

      console.log(
        chalk.gray(
          `[TERMS] lang=${lang} enabled=${terminologyEnabled ? "yes" : "no"} mappings=${profile.mappings?.length ?? 0} examples=${
            profile.examples?.length ?? 0
          }`
        )
      );

      const selected = selectTerminologyByDraftHits(profile, draftRows, {
        maxForbiddenHits: 30,
        maxMappings: 30,
        maxExamples: 20,
        debug: true,
      });

      const strictTerminology = formatStrictTerminologyFromSelection(selected);
      console.log(
        chalk.yellow(
          `[TERMS] matchedForbidden=${selected.matchedForbidden.length} mappings=${selected.mappings.length} examples=${selected.examples.length}`
        )
      );

      // Step C: Polish
      console.log(chalk.magenta(`      ✨ Polishing Part ${partNum}...`));

      const languageNotes = this.getLanguageNotes(lang, cfg.demoOverrides?.languageNotes);
      const polishRules = this.getPolishRules(lang, cfg.demoOverrides?.polishRulesByLang);

      const polishSystemBase = prompts?.polishSystem?.trim()
        ? this.buildPrompt(prompts.polishSystem, {
            lang: this.langLabel(lang),
            hotelName: docTitle,
          })
        : this.defaultPolishSystem(lang, docTitle);

      // If we have language polish rules, append to system (keeps user prompt clean)
      const polishSystem = polishRules
        ? [polishSystemBase, "", polishRules].join("\n")
        : polishSystemBase;

      const polishUser = prompts?.polishUser?.trim()
        ? this.buildPrompt(prompts.polishUser, {
            lang: this.langLabel(lang),
            hotelName: docTitle,
            translateHeader: translateHeader ? "YES" : "NO",
            strictTerminology: strictTerminology || "",
            languageNotes: languageNotes || "",
            sourceRows: JSON.stringify({ rows: chunkRows }),
            draftJson: draftJsonClean,
          })
        : this.defaultPolishUser({
            lang,
            sourceRows: chunkRows,
            draftJson: draftJsonClean,
            hotelName: docTitle,
            translateHeader,
            strictTerminology,
            languageNotes,
          });

      const finalJson = await this.agent.runWithSystem(
        polishUser,
        polishSystem,
        selectedModel.model,
        selectedModel.provider,
        { useWebSearch: false }
      );

      let finalRows = this.parseJsonMatrixOrThrow(finalJson);
      finalRows = this.enforceSameShape(chunkRows, finalRows);

      return finalRows;
    };

    const normalizeOutputMatrix = (matrix: string[][]): string[][] => {
      if (matrix.length === 0) return matrix;
      const h = matrix.length;
      const w = Math.max(...matrix.map((r) => r.length));

      for (let r = 0; r < h; r++) {
        matrix[r] = matrix[r] ?? [];
        for (let c = 0; c < w; c++) {
          if (matrix[r][c] === undefined) {
            matrix[r][c] = "";
          }
        }
      }

      return matrix;
    };

    const runFinalPolish = async (polishedRows: string[][], lang: string) => {
      console.log(
        chalk.green(`      [FINAL POLISH] Running clean natural polish on the full sheet...`)
      );

      const polishedJsonClean = JSON.stringify({ rows: polishedRows });
      const finalPolishSystem = prompts?.finalPolishSystem?.trim()
        ? this.buildPrompt(prompts.finalPolishSystem, {
            lang: this.langLabel(lang),
            hotelName: docTitle,
          })
        : this.defaultFinalPolishSystem(lang, docTitle);

      const finalPolishUser = prompts?.finalPolishUser?.trim()
        ? this.buildPrompt(prompts.finalPolishUser, {
            lang: this.langLabel(lang),
            hotelName: docTitle,
            translateHeader: translateHeader ? "YES" : "NO",
            sourceRows: JSON.stringify({ rows }),
            polishedJson: polishedJsonClean,
          })
        : this.defaultFinalPolishUser({
            lang,
            sourceRows: rows,
            polishedJson: polishedJsonClean,
            hotelName: docTitle,
            translateHeader,
          });

      const finalPolishJson = await this.agent.runWithSystem(
        finalPolishUser,
        finalPolishSystem,
        selectedFinalPolishModel.model,
        selectedFinalPolishModel.provider,
        { useWebSearch: false }
      );

      let finalRows = this.parseJsonMatrixOrThrow(finalPolishJson);
      finalRows = this.enforceSameShape(rows, finalRows);
      return finalRows;
    };

    // 4) Process languages
    const failedLanguages: string[] = [];
    const targetTabExistsMode = cfg.demoOverrides?.targetTabExistsMode ?? "skip";
    const existingTabTitles = await this.sheets.getSheetTitles(cfg.spreadsheetId);
    console.log(
      chalk.gray(
        `ℹ️ Existing translation tab behavior: ${
          targetTabExistsMode === "numbered"
            ? "create a numbered copy when target tab exists"
            : "skip language when target tab exists"
        }`
      )
    );

    for (const lang of cfg.targetLangs) {
      const baseTitle = `${sourceTab} – ${lang.toUpperCase()}`;
      const newTitle = this.resolveTargetTabTitle(existingTabTitles, baseTitle, targetTabExistsMode);
      if (!newTitle) {
        console.log(chalk.yellow(`⏭️ Skipping ${lang}: target tab already exists: "${baseTitle}"`));
        continue;
      }
      console.log(chalk.blue(`🚀 Starting translation chain for ${lang} (${newTitle})...`));

      try {
        const part1Result = await processChunk(part1Input, lang, 1);

        let part2Result: string[][] = [];
        if (part2Input.length > 1) {
          part2Result = await processChunk(part2Input, lang, 2);
        }

        let finalTranslatedMatrix = normalizeOutputMatrix([
          ...part1Result,
          ...part2Result.slice(1),
        ]);

        if (cfg.demoOverrides?.finalPolishEnabled) {
          finalTranslatedMatrix = normalizeOutputMatrix(
            await runFinalPolish(finalTranslatedMatrix, lang)
          );
        }

        // Duplicate sheet and write results
        await this.sheets.duplicateSheet(cfg.spreadsheetId, sourceId, newTitle);
        await this.sheets.writeValues(
          cfg.spreadsheetId,
          `${newTitle}!${writeStartCell}`,
          finalTranslatedMatrix
        );
        existingTabTitles.push(newTitle);

        console.log(
          chalk.green(
            `✅ Success: ${newTitle} created with ${finalTranslatedMatrix.length - 1} items!`
          )
        );
      } catch (err) {
        console.error(chalk.red(`❌ Failed to process language ${lang}:`), err);
        failedLanguages.push(lang);
      }
    }

    if (failedLanguages.length) {
      throw new Error(`Translation failed for: ${failedLanguages.join(", ")}`);
    }
  }
}
