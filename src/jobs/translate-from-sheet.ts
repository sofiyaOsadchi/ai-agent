import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";
import { TERMINOLOGY_MANAGEMENT, type LangKey, type TerminologyProfile } from "../jobs/subjobs/terminology-management.js";
import { selectTerminologyByDraftHits, formatStrictTerminologyFromSelection } from "../jobs/subjobs/utility-translate.js";
import chalk from "chalk";



type TranslateSheetConfig = {
  spreadsheetId: string;
  sourceTab?: string;
  targetLangs: string[];
  translateHeader?: boolean;
};


// === Language Notes Configuration ===
const LANGUAGE_NOTES: Record<string, string> = {
  en: [
    "Style: Professional International English (prefer US spelling 'color/center' unless British specified).",
    "Tone: Welcoming, warm, and helpful, but distinctively upscale.",
    "Vocabulary: Use hospitality standards (e.g., 'Complimentary' instead of 'Free', 'Front Desk' instead of 'Reception').",
    "Grammar: Use active voice. Avoid robotic 'Yes, there is...'. Instead use 'Yes, the hotel offers...'.",
    "Formatting: Use 24-hour clock (14:00).",
    "CRITICAL - HOTEL NAME:",
    "1. If the source text is Hebrew, YOU MUST translate the Hotel Name to its official English name provided in the context.",
    "2. NEVER remove the hotel name from the sentence if it appears in the source."
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
    "ROOM CATEGORY NAMES: Treat room categories and package names as official product names. Do NOT translate them literally. If a localized German name is known, use it; otherwise keep the original English name consistently (e.g., 'Standard Double', 'Executive Super-King'). Do not invent translations like 'Familienzimmer' unless it is the official on-site label.",
  "EN-SUITE: Do NOT translate 'en-suite' as 'eigenes Badezimmer'. Use 'en-suite Badezimmer' or 'Bad en suite' (keep 'en-suite' concept explicit).",
  "GUEST TERM: Never use 'Hausgäste'. Use 'Gäste' or 'Hotelgäste' consistently (prefer 'Hotelgäste' when answering).",
  "QUESTION STYLE: Avoid stiff templates like 'Wie lauten ...?'. Prefer natural forms: 'Wann ist ... verfügbar?', 'Welche ... gibt es ...?', 'Bis wann ...?', 'Gibt es ...?'.",
"HYPHENATION: Use correct German compounds: 'Executive-Zimmer' (not 'Executive Zimmer'), 'Super-King-DREAM-Bett', 'Tee-/Kaffee-Station' where appropriate.",
  "MEASUREMENTS: Use '55-Zoll-Fernseher' (not 55″-Fernseher). Use 'Zoll' spelling in questions and answers.",
  "Q-A CONSISTENCY: The German question MUST match the German answer semantically. If the source question mentions cooling/air-conditioning but the source answer only mentions heating/fans, adjust the German question to match the answer WITHOUT adding new facts.",




  ].join(" "),
  es: [
    "Neutral, polite Spanish (3rd person); no slang.",
    "Natural questions: “¿El hotel dispone de…?” / “¿Hay…?”.",
    "Consistent hotel terms: Wi-Fi gratis; recepción 24 horas; servicio de habitaciones.",
    "Avoid Spanglish; Place € after number (15 €).",
    "Keep brand names exactly."
  ].join(" "),
  nl: [
    "Polite, clear Dutch; keep sentences concise.",
    "Use standard terms: gratis wifi; 24-uursreceptie; roomservice.",
    "Avoid English terms unless truly standard.",
    "Be consistent with brand names."
  ].join(" "),
  it: [
    "Formale, cortese, scorrevole (3a persona).",
    "Domande naturali: “L’hotel dispone di…?”.",
    "Terminologia: Wi-Fi gratuito; reception aperta 24 ore su 24.",
    "Evita anglicismi inutili.",
    "€ dopo il numero (24,00 €)."
  ].join(" "),
  fr: [
    "Français formel, poli, fluide (3e personne).",
    "Questions naturelles: “L’hôtel dispose-t-il de… ?”.",
    "Termes standard: Wi-Fi gratuit; réception ouverte 24h/24.",
    "Typo FR: espace avant ? : ;.",
    "Respect exact de la marque."
  ].join(" "),
  pl: [
    "Polite, neutral Polish; clear syntax.",
    "Terms: bezpłatne Wi-Fi; całodobowa recepcja.",
    "Avoid English remnants; keep consistent terminology."
  ].join(" "),
  ru: [
    "Формальный, нейтральный стиль; 3-е лицо.",
    "Термины: бесплатный Wi-Fi; круглосуточная стойка регистрации.",
    "Не оставлять англицизмы.",
    "Соблюдать единообразие брендов."
  ].join(" "),
  he: [
    "עברית רשמית, ברורה וזורמת; ניסוח ניטרלי מגדרית.",
    "שאלות טבעיות: “האם…?” / “האם המלון מציע…?”.",
    "מונחים: אינטרנט אלחוטי חינם; קבלה 24/7; שירות חדרים.",
    "לא לשנות פורמט של שעות/מחירים; לשמור אחידות מיתוג (Clash Bar)."
  ].join(" "),
  zh: [
    "简体中文，正式专业、自然流畅（第三人称）。",
    "用语：免费Wi-Fi；24小时前台；客房送餐服务。",
    "避免直译；用地道表达。",
    "品牌名保持一致（如“Clash Bar”）。"
  ].join(" "),
  ar: [
    "عربية فصحى حديثة، رسمية وواضحة.",
    "مصطلحات: واي فاي مجاني؛ مكتب استقبال 24 ساعة.",
    "تجنّب الإنجليزية داخل الجمل.",
    "اتساق تام في أسماء العلامات."
  ].join(" "),
};

LANGUAGE_NOTES["english"] = LANGUAGE_NOTES["en"];
LANGUAGE_NOTES["german"]  = LANGUAGE_NOTES["de"];
LANGUAGE_NOTES["spanish"] = LANGUAGE_NOTES["es"];
LANGUAGE_NOTES["dutch"]   = LANGUAGE_NOTES["nl"];
LANGUAGE_NOTES["italian"] = LANGUAGE_NOTES["it"];
LANGUAGE_NOTES["french"]  = LANGUAGE_NOTES["fr"];
LANGUAGE_NOTES["polish"]  = LANGUAGE_NOTES["pl"];
LANGUAGE_NOTES["russian"] = LANGUAGE_NOTES["ru"];
LANGUAGE_NOTES["hebrew"]  = LANGUAGE_NOTES["he"];
LANGUAGE_NOTES["chinese"] = LANGUAGE_NOTES["zh"];
LANGUAGE_NOTES["arabic"]  = LANGUAGE_NOTES["ar"];

export class TranslateFromSheetJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  private langLabel(lang: string): string {
    const m: Record<string, string> = {
      he: "Hebrew", fr: "French", de: "German", es: "Spanish", it: "Italian",
      ru: "Russian", en: "English", gr: "Greek", ar: "Arabic", el: "Greek",
      nl: "Dutch", pl: "Polish", zh: "Chinese"
    };
    return m[lang.toLowerCase()] ?? lang;
  }

  private normalizeLang(lang: string): LangKey {
  const key = (lang || "").toLowerCase().trim();

  const aliases: Record<string, LangKey> = {
    en: "en", english: "en",
    de: "de", german: "de",
    es: "es", spanish: "es",
    nl: "nl", dutch: "nl",
    it: "it", italian: "it",
    fr: "fr", french: "fr",
    pl: "pl", polish: "pl",
    ru: "ru", russian: "ru",
    he: "he", hebrew: "he",
    zh: "zh", chinese: "zh",
    ar: "ar", arabic: "ar",
  };

  return aliases[key] ?? (key as LangKey);
}

private getTerminologyProfile(lang: string): TerminologyProfile {
  const k = this.normalizeLang(lang);
  return TERMINOLOGY_MANAGEMENT[k] ?? {};
}

  // === JSON Parsing Helper ===
  // === JSON Parsing Helper (robust) ===
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

/**
 * Extracts the first JSON object from a text response.
 * Handles code fences and extra text before/after.
 * Balances braces while ignoring braces inside strings.
 */
private extractFirstJsonObject(text: string): string {
  // Remove common code fences to reduce noise
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  // Prefer JSON that includes "rows"
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


  // === System Instructions (Persona) ===
  private systemInstructions(lang: string, hotelName: string): string {
    const label = this.langLabel(lang);
    return [
      `ROLE: You are an expert Hospitality Copywriter & Localization Specialist translating to ${label}.`,
      `GOAL: Create natural, flowing content that sounds like it was originally written in ${label}, NOT translated.`,
      `TONE: Warm, professional, helpful, and upscale (3rd person).`,
      ``,
      `=== CRITICAL RULES (ZERO TOLERANCE) ===`,
      `1. HOTEL NAME INTEGRITY: You must NEVER remove the hotel name from a question or answer if it appears in the source. If the source says "Does [Hotel] have a pool?", the target MUST say "Does [Hotel] have a pool?".`,
      `2. OFFICIAL NAME: The official English name of the hotel is: "${hotelName}".`,
      `3. HEBREW to ENGLISH: If the source is Hebrew and you see the hotel name (e.g., 'המלון', 'לאונרדו', etc.), you MUST replace it with "${hotelName}" in English.`,
      `4. TECH SAFETY: Do NOT translate URLs, emails, codes, or tokens (e.g., %s, {name}).`,
      `5. STRUCTURE: Preserve the exact JSON matrix shape.`,
      `6. ACCURACY: Keep prices, times, and facts exactly as they are.`,
    ].join("\n");
  }

  // === Step 1: Draft Prompt (Focus on Context & Accuracy) ===
  private draftPrompt(lang: string, rows: string[][], translateHeader: boolean, hotelName: string): string {
    return [
      `TASK: Translate EVERY cell in the provided matrix to ${this.langLabel(lang)}.`,
      `CONTEXT:`,
      ` - Domain: Hotel FAQ.`,
      ` - Official Hotel Name: "${hotelName}".`,
      ``,
      `INSTRUCTIONS:`,
      `- Translate ALL text content in the rows.`,
      `- Look at each row as a connected context unit (Category + Question + Answer).`,
`- If the source is brief (e.g., "Yes"/"No"), you may expand it slightly ONLY by restating the proposition of the question. Use third person (e.g., "Yes, the hotel offers ..."). Do NOT add qualifiers or new facts.`,
      `- Translate header row: ${translateHeader ? "YES" : "NO"}.`,
      `- PRESERVE the exact 2D matrix structure (same number of rows and columns).`,
      `- **IMPORTANT:** If the source text mentions the hotel name, ensure the translated text also includes "${hotelName}". Do not shorten it to "the hotel".`,
      ``,
      `INPUT DATA (JSON):`,
      JSON.stringify({ rows })
    ].join("\n");
  }

  // === Step 2: Polish Prompt (Focus on Human Touch) ===
 private polishPrompt(
  lang: string,
  sourceRows: string[][],
  draftJson: string,
  hotelName: string,
  translateHeader: boolean,
  strictTerminology: string
): string {
  const label = this.langLabel(lang);

  const note = LANGUAGE_NOTES[this.normalizeLang(lang)] ?? "";




  return [
    `ROLE: Senior Editor for a Luxury Hotel Brand (${label}).`,
    `TASK: Polish the DRAFT translation to sound fully native and premium, with MINIMAL edits, WITHOUT changing meaning.`,
    `WEB: Do NOT use web search. Do NOT cite sources. Output JSON only.`,
    ``,

     strictTerminology,
    `HARD CONSTRAINTS (ZERO TOLERANCE):`,
    `1) CELL-BY-CELL MAPPING: For every cell at position (row r, col c), output EXACTLY one polished cell at the same position (r,c).`,
    `2) DIMENSIONS: Output must have EXACTLY the same number of rows and columns as SOURCE.`,
    `3) EMPTY CELLS: If a SOURCE cell is empty/blank, the output cell MUST be empty.`,
    `4) NO NEW FACTS: Do not add any facts, services, conditions, qualifiers, or availability notes not present in SOURCE.`,
    `5) PRESERVE DATA: Keep numbers, times, prices, addresses, distances exactly as in SOURCE.`,
    `6) PRESERVE TOKENS: Keep placeholders/tokens unchanged: %s, {name}, {{x}}, URLs, emails, codes.`,
    `7) HOTEL NAME RULE: If the SOURCE cell contains the official hotel name OR a hotel reference (including Hebrew like "המלון" / "לאונרדו"), the output cell MUST include exactly "${hotelName}" (do not replace with "the hotel").`,
    `8) QUESTION INTEGRITY: If SOURCE cell is a question, keep it as a natural question in ${label}. Do not turn questions into statements.`,
    `9) MINIMAL EDITS: Only fix unnatural phrasing, literal translation artifacts, grammar, and hospitality vocabulary. Do not rewrite aggressively.`,
    `10) JSON ONLY: Return ONLY valid JSON in the schema: {"rows":[...]} and nothing else.`,
    ``,
    `LANGUAGE NOTES FOR ${label.toUpperCase()}:`,
    note,
    ``,
   `INPUT (JSON):`,
    JSON.stringify({
      meta: {
        language: label,
        officialHotelName: hotelName,
        translateHeader
      },
      source: { rows: sourceRows },
      draft: { json: draftJson }
    }),
    ``,
    `OUTPUT: Return ONLY {"rows":[...]}`
  ].filter(Boolean).join("\n");
}

  // === Main Execution Function ===
  async run(cfg: TranslateSheetConfig): Promise<void> {
    // 1. Resolve Source Tab
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

    // 2. Read Source Data & Metadata
    const sourceId = await this.sheets.getSheetIdByTitle(cfg.spreadsheetId, sourceTab);
    const rows = await this.sheets.readValues(cfg.spreadsheetId, `${sourceTab}!A:Z`);
    if (rows.length === 0) throw new Error(`Source tab "${sourceTab}" is empty`);
    
    // שליפת שם הקובץ כדי להשתמש בו כשם המלון הרשמי
    const docTitle = await this.sheets.getSpreadsheetTitle(cfg.spreadsheetId);
    console.log(chalk.cyan(`🏨 Official Hotel Name detected from file: "${docTitle}"`));

    const translateHeader = cfg.translateHeader ?? true;

    // --- LOGIC: SPLIT ROWS INTO 2 PARTS ---
    // Extract header (always the first row)
    const headerRow = rows[0]; 
    const contentRows = rows.slice(1); 

    // Calculate split index (round up to give the first half the extra row if odd)
    const splitIndex = Math.ceil(contentRows.length / 2);

    // Create chunks. Both chunks get the header row for context.
    const part1Input = [headerRow, ...contentRows.slice(0, splitIndex)];
    const part2Input = [headerRow, ...contentRows.slice(splitIndex)];

    console.log(chalk.gray(`ℹ️ Split info: Total items: ${contentRows.length}. Part 1: ${part1Input.length - 1}, Part 2: ${part2Input.length - 1}.`));

    // Helper function to process a single chunk (Draft -> Polish)
    const processChunk = async (chunkRows: string[][], lang: string, partNum: number) => {
      console.log(chalk.yellow(`   ⏳ Processing Part ${partNum}/2 (${chunkRows.length} rows)...`));
      
      // Step A: Draft
      // We pass 'docTitle' as the hotelName to ensure consistency
      const systemInstr = this.systemInstructions(lang, docTitle);
      const draftPromptStr = this.draftPrompt(lang, chunkRows, translateHeader, docTitle);
const draftResult = await this.agent.runWithSystem(draftPromptStr, systemInstr, "o3");

      // Step B: Polish
      console.log(chalk.magenta(`      ✨ Polishing Part ${partNum}...`));
const draftRows = this.parseJsonMatrixOrThrow(draftResult);
const draftJsonClean = JSON.stringify({ rows: draftRows });

const profile = this.getTerminologyProfile(lang);

console.log(chalk.gray(`[TERMS] lang=${lang} mappings=${profile.mappings?.length ?? 0} examples=${profile.examples?.length ?? 0}`));

// דגימה קצרה מהדראפט כדי לראות מה באמת יצא
const draftSample = draftRows
  .slice(0, 6)
  .map((r, i) => `${i}: ${(r ?? []).join(" | ")}`)
  .join("\n");

console.log(chalk.gray(`[TERMS] draft sample (first rows):\n${draftSample}`));

const selected = selectTerminologyByDraftHits(profile, draftRows, {
  maxForbiddenHits: 30,
  maxMappings: 30,
  maxExamples: 20,
    debug: true,

});

console.log(chalk.yellow(`[TERMS] matchedForbidden=${selected.matchedForbidden.length}`));
if (selected.matchedForbidden.length > 0) {
  console.log(chalk.yellow(`[TERMS] matchedForbidden list: ${selected.matchedForbidden.join(", ")}`));
}
console.log(chalk.yellow(`[TERMS] selected mappings=${selected.mappings.length}, selected examples=${selected.examples.length}`));

const strictTerminology = formatStrictTerminologyFromSelection(selected);
console.log(chalk.yellow(`[TERMS] matchedForbidden=${selected.matchedForbidden.length} mappings=${selected.mappings.length} examples=${selected.examples.length}`));
console.log(chalk.magenta(`[TERMS] strictTerminologyLen=${strictTerminology.length}`));

console.log(chalk.magenta(`[TERMS] strictTerminology chars=${strictTerminology.length}`));
if (!strictTerminology) {
  console.log(chalk.magenta(`[TERMS] strictTerminology is EMPTY - polish will run without filtered rules.`));
}

const polishPromptStr = this.polishPrompt(
  lang,
  chunkRows,
  draftJsonClean,
  docTitle,
  translateHeader,
  strictTerminology
);const germanPolishRules =
  lang.toLowerCase() === "de"
    ? [
        "",
        "GERMAN STRICT QA (apply before output):",
        "- Avoid 'Wie lautet/Wie lauten ...?'. Prefer 'Wann...?', 'Welche...?', 'Bis wann...?', 'Gibt es...?', 'Verfügt ... über...?'",
        "- Never use 'Hausgäste' or 'Haus' for hotel wording. Use 'Gäste/Hotelgäste' and 'Hotel'.",
        "- Use correct compounds/units: 'Executive-Zimmer' (hyphen), '55-Zoll-Fernseher' (not 55″).",
        "- en-suite: never 'eigenes Badezimmer'. Use 'en-suite Badezimmer' / 'Bad en suite'.",
        "- Avoid 'Services' in German. Prefer 'Leistungen' / 'steht zur Verfügung'.",
        "- Ensure Q and A match semantically; if mismatch exists, adjust ONLY the question wording to match the answer (no new facts).",
        "- Preserve HTML tags and entities exactly as given (<p>, &amp; etc.). Do not introduce new escaping.",
                "- Avoid unnatural nouns like 'Zubereiter' in room amenities. Prefer 'Zubereitungsmöglichkeiten' or 'Möglichkeiten zur ...zubereitung'.",
        "- Do not add marketing adjectives not present in SOURCE (e.g., avoid 'reichhaltig', 'luxuriös', 'hochwertig').",
        "- Avoid 'arrangiert' in German answers. Prefer 'bereitgestellt', 'angeboten', 'nach vorheriger Absprache'.",
        "- Prefer 'Mittag- und Abendessen' / 'Mittag- und Abendessen werden serviert' over 'Mittags-/Abendservice'.",
        "- Avoid 'im am ...' constructions. If you see it, rewrite to a simpler correct structure (e.g., 'im Bezirk ..., direkt am Flussufer').",
        "- Avoid 'Late-Night' (English) in German. Prefer 'späte Snacks' / 'Snack-Angebote am späten Abend'."
      ].join("\n")
    : "";

const systemInstrPolish = [systemInstr, germanPolishRules].join("\n");

const finalJson = await this.agent.runWithSystem(polishPromptStr, systemInstrPolish, "o3");      
      return this.parseJsonMatrixOrThrow(finalJson);
    };

    // 3. Process Each Target Language
    for (const lang of cfg.targetLangs) {
      const newTitle = `${sourceTab} – ${lang.toUpperCase()}`;
      
      console.log(chalk.blue(`🚀 Starting translation chain for ${lang} (${newTitle})...`));

      try {
        // --- Process Part 1 ---
        const part1Result = await processChunk(part1Input, lang, 1);

        // --- Process Part 2 (only if it has content beyond the header) ---
        let part2Result: string[][] = [];
        if (part2Input.length > 1) {
            part2Result = await processChunk(part2Input, lang, 2);
        }

        // --- Merge Results ---
        // Part 1 is taken as is.
        // Part 2 is taken starting from index 1 (skipping its header).
        const finalTranslatedMatrix = [
            ...part1Result,
            ...part2Result.slice(1)
        ];

        // --- Validate & Normalize Matrix Shape ---
        const h = finalTranslatedMatrix.length;
        const w = Math.max(...finalTranslatedMatrix.map(r => r.length));
        
        for (let r = 0; r < h; r++) {
          finalTranslatedMatrix[r] = finalTranslatedMatrix[r] ?? [];
          for (let c = 0; c < w; c++) {
            // Fill undefined/missing cells with empty string
            if (finalTranslatedMatrix[r][c] === undefined) {
              finalTranslatedMatrix[r][c] = ""; 
            }
          }
        }

        // 4. Write to New Tab
        // Duplicate the original sheet to preserve formatting/colors
        await this.sheets.duplicateSheet(cfg.spreadsheetId, sourceId, newTitle);
        // Overwrite with translated data
        await this.sheets.writeValues(cfg.spreadsheetId, `${newTitle}!A1`, finalTranslatedMatrix);
        
        console.log(chalk.green(`✅ Success: ${newTitle} created with ${finalTranslatedMatrix.length - 1} items!`));

      } catch (err) {
        console.error(chalk.red(`❌ Failed to process language ${lang}:`), err);
        // Continue to next language, do not crash the whole job
        continue;
      }
    }
  }
}
