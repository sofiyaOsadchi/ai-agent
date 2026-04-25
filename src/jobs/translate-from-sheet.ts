import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";
import { TERMINOLOGY_MANAGEMENT, type LangKey, type TerminologyProfile } from "../jobs/subjobs/terminology-management.js";
import { selectTerminologyByDraftHits, formatStrictTerminologyFromSelection } from "../jobs/subjobs/utility-translate.js";
import { HOTEL_NAME_HE_MAP } from "../jobs/subjobs/hotel-name-hebrew-map.js";
import { getGlossaryPrompt } from "../jobs/subjobs/translation-glossary.js";
import chalk from "chalk";



type TranslateSheetConfig = {
  spreadsheetId: string;
  sourceTab?: string;
  targetLangs: string[];
  translateHeader?: boolean;
};

type ReviewRow = {
  questionFix: string;
  answerFix: string;
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
  
  "Use natural European Spanish for hotel FAQ content.",
  "Translate meaning, not English structure.",
  "Prefer factual, guest-facing wording over promotional language.",
  "Remove non-essential marketing fluff if it adds no factual value.",
  "Prefer factual, guest-facing wording over promotional language.",
  "Avoid literal calques that sound correct but non-native.",
  "Prefer concise, standard hotel phrasing over technical or bureaucratic wording.",
  "Avoid unnecessary English borrowings unless they are part of an official name.",
  "Use European Spanish terminology consistently.",
  "ARTICLE RULE: When the official hotel name appears explicitly as a full noun phrase, always use the definite article before it.",
  "QUESTION RULE: Questions must sound like native Spanish FAQ questions and must not be broader or narrower than the answer.",
  "ROOM NAME RULE: Keep official room categories, package names, restaurant names, and branded venue names unchanged unless an official Spanish form is known.",
  "ACCESSIBILITY RULE: Use natural person-first wording for accessibility. Avoid mechanical phrasing.",
  "SERVICE RULE: Prefer standard hospitality phrasing such as 'previa solicitud', 'sujeto a disponibilidad', 'por un suplemento', 'gratuito/a', 'de cortesía'.",
  "AMENITY RULE: Use natural wording for room amenities. Avoid stiff or overlong formulations.",
  "LOCATION RULE: Use simple, natural phrasing for distances and walking times.",
  "TAX RULE: When referring to a hotel city tax, use standard tourist-tax wording.",
  "Do not turn simple factual answers into descriptive copy.",
  "If a sentence is grammatically correct but still sounds translated, rewrite it into simpler native Spanish without changing facts."

  ].join(" "),
  nl: [
    "Polite, clear Dutch; keep sentences concise.",
    "Use standard terms: gratis wifi; 24-uursreceptie; roomservice.",
    "Avoid English terms unless truly standard.",
    "Be consistent with brand names."
  ].join(" "),
  it: [
   "Usa un italiano naturale, scorrevole e professionale, tipico delle FAQ di hotel.",
  "Non tradurre in modo letterale dall’inglese se la struttura suona innaturale in italiano.",
  "Preferisci formulazioni semplici, dirette e orientate all’ospite.",
  "Usa terminologia alberghiera standard in italiano, come si trova sui siti ufficiali degli hotel.",
  "Evita anglicismi inutili e costruzioni che suonano importate dall’inglese.",
  "Evita aggettivi e avverbi promozionali non essenziali, come formulazioni troppo decorative o marketing.",
  "Se una frase è grammaticalmente corretta ma suona tradotta, riscrivila in italiano più naturale senza cambiare i fatti.",
  "Preferisci 'hotel' a 'struttura' nei testi rivolti agli ospiti, salvo casi eccezionali.",
  "Preferisci risposte concise in stile FAQ. Se lo stesso significato può essere espresso in modo più semplice, scegli la versione più naturale e breve.",
  "Controlla che articoli, preposizioni e collocazioni suonino native in italiano alberghiero, non solo grammaticalmente corrette.",
  "Domande naturali: “L’hotel dispone di...?”, “È disponibile...?”, “Quali sono...?”, “È possibile...?”.",
  "Terminologia: Wi-Fi gratuito; reception aperta 24 ore su 24; servizio concierge; set di cortesia; cassaforte in camera; camere comunicanti.",
  "Formato prezzi: € dopo il numero (24,00 €)."
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
    "SIMPLICITY & HOSPITALITY TONE: Hebrew hospitality language is direct, warm, and natural. Filter out exaggerated English marketing fluff and superlatives that add no factual value (e.g., avoid literal translations like 'לבוקר רגוע ונינוח', 'הבטחת שנת לילה', or 'באותנטיות'). Drop redundant filler words (e.g., 'לטובת האורחים', 'כסטנדרט'). Never use stiff, industrial verbs for room amenities (avoid 'מצוידים', 'מעמיד', 'עומדים לרשותכם'); use simple terms instead ('יש', 'כוללים', 'בחדר תמצאו').",
    "STYLE & TONE: Professional, welcoming, upscale Israeli hospitality. Prioritize a natural, inviting flow over literal word-for-word translation.",
    "GENDER AGREEMENT (CRITICAL): Before outputting, perform an internal grammatical audit. Identify the main subject noun. Pay strict attention to genders and numbers. For example: 'Room' (חדר) is masculine (e.g., חדרים מרווחים). 'Terrace' (טרסה) is feminine. 'Journey/Drive' (נסיעה) is feminine. Check specifically for construct states (סמיכות) where the adjective modifies the first noun, not the second (e.g., 'משך הנסיעה המשוער', not 'המשוערת').",
    "PUNCTUATION & SYNTAX: Do NOT blindly copy English punctuation. Avoid long em-dashes (—); use short dashes (-) or commas. Avoid excessive semicolons (;); split long sentences into two separate sentences instead.",
    "DISTANCES & BRACKETS: Do not leave distances in brackets if it disrupts the Hebrew sentence flow (e.g., 'KAF Theatre (50m)'). Instead, integrate them naturally into the sentence structure: 'תיאטרון KAF במרחק 50 מטרים'.",
    "AMENITIES (INANIMATE OBJECTS): Avoid robotic or stiff verbs for objects in the room. Instead of literal translations like 'equipped with' or 'stands at your disposal', use natural phrasing like 'בחדר תמצאו', 'החדרים כוללים', or 'יש בחדר'.",
    "TIME FORMATTING: Use the 24-hour clock (e.g., 14:00). Do NOT append time-of-day words like 'אחר הצהריים' or 'בבוקר' if the 24h format makes it obvious."
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

private normalizeHotelKey(name: string): string {
  return (name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-");
}

private getOfficialHotelNameForTargetLang(docTitle: string, lang: string): string {
  const normalizedLang = this.normalizeLang(lang);
  const normalizedDocTitle = this.normalizeHotelKey(docTitle);

  if (normalizedLang !== "he") {
    return docTitle;
  }

  for (const [englishName, hebrewName] of Object.entries(HOTEL_NAME_HE_MAP)) {
    if (this.normalizeHotelKey(englishName) === normalizedDocTitle) {
      return hebrewName;
    }
  }

  console.warn(
    chalk.yellow(`[HOTEL_NAME_HE_MAP] Missing Hebrew mapping for hotel: "${docTitle}"`)
  );

  return docTitle;
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

private parseReviewRowsOrThrow(text: string): ReviewRow[] {
  const jsonStr = this.extractFirstJsonObject(text);

  let obj: any;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    throw new Error("Model did not return valid JSON for review output");
  }

  if (!obj || !Array.isArray(obj.rows)) {
    throw new Error("Review JSON must contain a 'rows' array");
  }

  return obj.rows.map((row: any) => ({
    questionFix: row?.questionFix == null ? "" : String(row.questionFix),
    answerFix: row?.answerFix == null ? "" : String(row.answerFix),
  }));
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

private static readonly EMPTY_ROW_MARKER = "__EMPTY_CATEGORY_SEPARATOR_ROW__";

private isVisualEmptyRow(row: string[]): boolean {
  return (row ?? []).every(cell => String(cell ?? "").trim() === "");
}

private encodeStructuralRows(rows: string[][]): string[][] {
  return rows.map((row) => {
    const normalized = row.map(cell => String(cell ?? ""));

    if (this.isVisualEmptyRow(normalized)) {
      return normalized.map(() => TranslateFromSheetJob.EMPTY_ROW_MARKER);
    }

    return normalized;
  });
}

private decodeStructuralRows(rows: string[][], expectedWidth: number): string[][] {
  return rows.map((row) => {
    const normalized = row.map(cell => String(cell ?? ""));

    const isMarkerRow =
      normalized.length > 0 &&
      normalized.every(cell => cell.trim() === TranslateFromSheetJob.EMPTY_ROW_MARKER);

    if (isMarkerRow) {
      return Array.from({ length: expectedWidth }, () => "");
    }

    while (normalized.length < expectedWidth) normalized.push("");
    return normalized.slice(0, expectedWidth);
  });
}

private normalizeSourceRows(rows: string[][]): string[][] {
  return rows.map((row) => {
    const normalized = (row ?? []).map((cell) => String(cell ?? ""));

    while (normalized.length < 3) {
      normalized.push("");
    }

    return normalized.slice(0, 3);
  });
}

private assertSameShape(sourceRows: string[][], resultRows: string[][], label: string): void {
  if (sourceRows.length !== resultRows.length) {
    throw new Error(
      `${label}: row count mismatch. source=${sourceRows.length}, result=${resultRows.length}`
    );
  }

  for (let r = 0; r < sourceRows.length; r++) {
    const sourceWidth = sourceRows[r]?.length ?? 0;
    const resultWidth = resultRows[r]?.length ?? 0;

    if (sourceWidth !== resultWidth) {
      throw new Error(
        `${label}: col count mismatch at row ${r + 1}. source=${sourceWidth}, result=${resultWidth}`
      );
    }
    const sourceIsEmpty = this.isVisualEmptyRow(sourceRows[r] ?? []);
    const resultIsEmpty = this.isVisualEmptyRow(resultRows[r] ?? []);

    if (sourceIsEmpty !== resultIsEmpty) {
      throw new Error(
        `${label}: empty-row mismatch at row ${r + 1}. sourceEmpty=${sourceIsEmpty}, resultEmpty=${resultIsEmpty}`
      );
    }
  }
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
`2. OFFICIAL NAME: The official hotel name in the TARGET language is: "${hotelName}".`,
`3. HOTEL NAME LOCALIZATION: If the source contains a hotel reference such as a hotel name, "the hotel", "the property", "המלון", or brand-only mention, you MUST use exactly "${hotelName}" when the output should explicitly mention the hotel name.`,      `4. TECH SAFETY: Do NOT translate URLs, emails, codes, or tokens (e.g., %s, {name}).`,
      `4. STRUCTURE: Preserve the exact JSON matrix shape.`,
      `5. ACCURACY: Keep prices, times, and facts exactly as they are.`,
      `6. CONTEXT: Maintain the context of each question and answer, including any relevant details about the hotel or location.`,
        `7. - SIMPLICITY & TONE: Keep the translation direct and natural. Filter out exaggerated English marketing fluff, flowery adjectives, and superlatives that add no factual value.`,
        `7.2 - If a literal translation sounds unnatural in the target language, rewrite it into simpler native wording without changing facts.`,
        `7.3 - Prefer factual, guest-facing wording over promotional language.`,
        `7.4 - If a sentence structure sounds like a calque from English, rewrite it freely into native target-language syntax while preserving the exact meaning.`,
        `8. - GRAMMAR & GENDER AGREEMENT: Pay strict attention to the target language's grammar rules regarding masculine/feminine nouns and number agreement. Ensure verbs, adjectives, and articles match the subject perfectly..`,
    ].join("\n");
  }

 // === Step 1: Draft Prompt (Focus on Context & Accuracy) ===
  private draftPrompt(lang: string, rows: string[][], translateHeader: boolean, hotelName: string): string {
    // Fetch the glossary rules dynamically based on the actual content of the rows
    const glossaryRules = getGlossaryPrompt(this.normalizeLang(lang), rows);

    return [
      `TASK: Translate EVERY cell in the provided matrix to ${this.langLabel(lang)}.`,
      `CONTEXT:`,
      ` - Domain: Hotel FAQ.`,
      ` - Official Hotel Name: "${hotelName}".`,
      ``,
      glossaryRules, // Inject the dynamic glossary rules here
      ``,
      `INSTRUCTIONS:`,
      `- Translate ALL text content in the rows.`,
      `- Look at each row as a connected context unit (Category + Question + Answer).`,
      `- If the source is brief (e.g., "Yes"/"No"), you may expand it slightly ONLY by restating the proposition of the question. Use third person (e.g., "Yes, the hotel offers ..."). Do NOT add qualifiers or new facts.`,
      `- Translate header row: ${translateHeader ? "YES" : "NO"}.`,
      `- PRESERVE the exact 2D matrix structure (same number of rows and columns).`,
      `- **IMPORTANT:** If the source text mentions the hotel name or clearly refers to the hotel as a named entity, ensure the translated text also includes exactly "${hotelName}". Do not shorten it to "the hotel" / "המלון" when the source explicitly names the hotel.`,
      ``,
      `INPUT DATA (JSON):`,
      JSON.stringify({ rows })
    ].filter(Boolean).join("\n"); 
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
`7) HOTEL NAME RULE: If the SOURCE cell contains the official hotel name, an English hotel name, or a hotel reference (including "the hotel", "the property", Hebrew like "המלון" / "לאונרדו", or brand-only mention), the output cell MUST use exactly "${hotelName}" whenever the hotel is explicitly named. Do not replace it with a generic term.`,   
 `8) QUESTION INTEGRITY: If SOURCE cell is a question, keep it as a natural question in ${label}. Do not turn questions into statements.`,
    `9) MINIMAL EDITS: Only fix unnatural phrasing, literal translation artifacts, grammar, and hospitality vocabulary. Do not rewrite aggressively.`,
    `10) JSON ONLY: Return ONLY valid JSON in the schema: {"rows":[...]} and nothing else.`,
`11) CONDITIONAL FLUFF OMISSION: You may delete marketing adjectives (e.g., luxurious, exquisite) ONLY IF they lack a natural Hebrew equivalent AND provide no factual value. Do not delete words that convey actual amenities, quality levels, or specific services. Deleting pure, non-informative fluff is not a violation of the "NO NEW FACTS" rule.`,
`12) STRUCTURAL MARKER: If an entire row contains only "${TranslateFromSheetJob.EMPTY_ROW_MARKER}" values, preserve that whole row exactly as-is. Do not translate, remove, rewrite, merge, split, or move it.`,    ``,
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
private reviewPrompt(
    lang: string,
    transRows: string[][],
    hotelName: string
  ): string {
    const label = this.langLabel(lang);
    const isHebrew = lang.toLowerCase() === "he";

    // Add Hebrew-specific grammar rules only when translating to Hebrew
    const hebrewSpecificRules = isHebrew ? [
      ` - GENDER & NUMBER (CRITICAL): Ensure nouns match their adjectives and verbs perfectly. 'חדר' is masculine, 'טרסה' is feminine, 'נסיעה' is feminine, 'שפות' is feminine, 'הליכה' is feminine.`,
      ` - PUNCTUATION: Ensure NO long em-dashes (-) are used. Replace with short dashes (-) or commas.`,
      ` - NATURAL HEBREW: Flag and fix literal translations that sound like 'English in Hebrew words'.`
    ].join("\n") : "";

    return [
      `ROLE: You are a strict Native Proofreader and QA Editor for high-end hospitality content in ${label}.`,
      `TASK: Perform a monolingual Linguistic Quality Audit (LQA) on the provided text. You are evaluating the text purely on how natural, grammatical, and professional it sounds in ${label}.`,
      ``,
      `CRITICAL AUDIT POINTS:`,
      `1. GRAMMAR & FLUENCY: The text must flow perfectly. Fix awkward phrasing, robotic verbs, and clunky syntax.`,
      `2. AGREEMENT: Check gender, number, and case agreement rigorously.`,
      `3. HOTEL NAME: Ensure "${hotelName}" is spelled and capitalized correctly if present.`,
      hebrewSpecificRules,
      ``,
      `INSTRUCTIONS:`,
      `- Evaluate each row independently without seeing the source.`,
      `- ONLY provide a fix if there is a clear grammatical error (like a gender mismatch) or highly unnatural phrasing.`,
      `- DO NOT provide stylistic alternatives if the current text is perfectly valid and natural.`,
      `- If the row is flawless, leave "questionFix" and "answerFix" as empty strings ("").`,
      `- Keep the exact same number of rows as the input.`,
      `- For the header row (index 0), always return empty strings.`,
      ``,
      `OUTPUT FORMAT (STRICT JSON):`,
      `{"rows":[{"questionFix":"","answerFix":""}]}`,
      ``,
      `INPUT DATA:`,
      JSON.stringify({ 
        meta: { officialHotelName: hotelName },
        targetMatrix: transRows 
      })
    ].filter(Boolean).join("\n");
  }

  private async runFinalReviewPass(
    lang: string,
    transRows: string[][],
    hotelName: string
  ): Promise<ReviewRow[]> {
    const prompt = this.reviewPrompt(lang, transRows, hotelName);

    const system = [
      `You are a strict monolingual proofreader for ${this.langLabel(lang)}.`,
      `Evaluate the text purely on target-language grammar, gender agreement, and natural flow.`,
      `Do not rewrite if the text is already correct and natural.`,
      `Output JSON only.`
    ].join("\n");

    const result = await this.agent.runWithSystem(prompt, system, "o3");
    return this.parseReviewRowsOrThrow(result);
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
const MAX_TRANSLATE_ROW = 68; // כולל כותרת
const rawRows = await this.sheets.readValues(
  cfg.spreadsheetId,
  `${sourceTab}!A1:Z${MAX_TRANSLATE_ROW}`
);

if (rawRows.length === 0) throw new Error(`Source tab "${sourceTab}" is empty`);

const rows = this.normalizeSourceRows(rawRows);    
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
const processChunk = async (
  chunkRows: string[][],
  lang: string,
  partNum: number,
  officialHotelName: string
) => {
  console.log(chalk.yellow(`   ⏳ Processing Part ${partNum}/2 (${chunkRows.length} rows)...`));

  const expectedWidth = Math.max(...chunkRows.map(r => r.length));
  const encodedChunkRows = this.encodeStructuralRows(chunkRows);

  // Step A: Draft
  const systemInstr = this.systemInstructions(lang, officialHotelName);
  const draftPromptStr = this.draftPrompt(lang, encodedChunkRows, translateHeader, officialHotelName);
  const draftResult = await this.agent.runWithSystem(draftPromptStr, systemInstr, "o3");

  const draftRowsRaw = this.parseJsonMatrixOrThrow(draftResult);
  const draftRows = this.decodeStructuralRows(draftRowsRaw, expectedWidth);
  this.assertSameShape(chunkRows, draftRows, `Draft part ${partNum}`);

  console.log(chalk.magenta(`      ✨ Polishing Part ${partNum}...`));

  const draftJsonClean = JSON.stringify({ rows: this.encodeStructuralRows(draftRows) });

  const profile = this.getTerminologyProfile(lang);

  console.log(chalk.gray(`[TERMS] lang=${lang} mappings=${profile.mappings?.length ?? 0} examples=${profile.examples?.length ?? 0}`));

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
    this.encodeStructuralRows(chunkRows),
    draftJsonClean,
    officialHotelName,
    translateHeader,
    strictTerminology
  );

const germanPolishRules =
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
  const finalRowsRaw = this.parseJsonMatrixOrThrow(finalJson);
  const finalRows = this.decodeStructuralRows(finalRowsRaw, expectedWidth);
  this.assertSameShape(chunkRows, finalRows, `Polish part ${partNum}`);
return finalRows;
};


    // 3. Process Each Target Language
    for (const lang of cfg.targetLangs) {
  const newTitle = `${sourceTab} – ${lang.toUpperCase()}`;
        const officialHotelName = this.getOfficialHotelNameForTargetLang(docTitle, lang);

      
      console.log(chalk.blue(`🚀 Starting translation chain for ${lang} (${newTitle})...`));
        console.log(chalk.cyan(`🏨 Official hotel name for ${lang}: "${officialHotelName}"`));


      try {
        // --- Process Part 1 ---
const part1Result = await processChunk(part1Input, lang, 1, officialHotelName);

        // --- Process Part 2 (only if it has content beyond the header) ---
        let part2Result: string[][] = [];
        if (part2Input.length > 1) {
part2Result = await processChunk(part2Input, lang, 2, officialHotelName);        }

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

       if (false) {
  console.log(chalk.yellow(`🧪 Running final monolingual review pass for ${lang}...`));
  const reviewRows = await this.runFinalReviewPass(
    lang,
    finalTranslatedMatrix,
    officialHotelName
  );

  // Add review columns headers
  if (finalTranslatedMatrix.length > 0) {
    finalTranslatedMatrix[0][3] = "Question Review";
    finalTranslatedMatrix[0][4] = "Answer Review";
  }

  // Populate the review columns
  for (let r = 1; r < finalTranslatedMatrix.length; r++) {
    const review = reviewRows[r] ?? { questionFix: "", answerFix: "" };

    finalTranslatedMatrix[r][3] = review.questionFix || "";
    finalTranslatedMatrix[r][4] = review.answerFix || "";
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
