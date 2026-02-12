import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";
import chalk from "chalk";

export type TranslateMasterConfig = {
  spreadsheetId: string;
  tabName: string;
  targetLang: string; 
  
  colHotelName: number; // אינדקס עמודת שם המלון
  colQuestion: number;  // אינדקס עמודת השאלה
  colAnswer: number;    // אינדקס עמודת התשובה (המקורית)
  
  colTargetQ: string;   // אות העמודה לכתיבה (למשל E)
  colTargetA: string;   // אות העמודה לכתיבה (למשל F)
};
// === Language Notes Configuration ===
const LANGUAGE_NOTES: Record<string, string> = {
  en: [
    "Style: Professional International English (prefer US spelling 'color/center' unless British specified).",
    "Tone: Welcoming, warm, and helpful, but distinctively upscale.",
    "Vocabulary: Use hospitality standards (e.g., 'Complimentary' instead of 'Free', 'Front Desk' instead of 'Reception').",
    "Grammar: Use active voice. Avoid robotic 'Yes, there is...'. Instead use 'Yes, the hotel offers...'.",
    "Formatting: Use 24-hour clock (14:00).",
    // 👇 התיקון לשם המלון מעברית לאנגלית 👇
    "BRAND NAMES SPECIAL RULE: If the source text is in a non-Latin script (like Hebrew), TRANSLATE the Hotel Name to its official English name (e.g., 'לאונרדו פלאזה' -> 'Leonardo Plaza'). Do NOT leave Hebrew characters. If source is already Latin, keep exact."
  ].join(" "),
  de: [
    "Use formal, neutral German in third person; avoid slang.",
    "Prefer native question forms: “Gibt es …?” / “Verfügt das Hotel über …?”.",
    "Use standard hotel terms: kostenloses WLAN; Rezeption rund um die Uhr; Zimmerreinigung.",
    "Avoid English leftovers; Keep brand names exactly (unless source is non-Latin, then transliterate).",
    "Prefer natural verbs like “bietet”, “steht zur Verfügung”.",
    "HOTEL WORDING: Do NOT use “Haus” to refer to the hotel/property. Always use “Hotel”.",
  "RECEPTION TONE: Avoid “engagiert(e)” for the reception team. Prefer: “das Rezeptionsteam steht Gästen rund um die Uhr für alle Anliegen zur Verfügung”.",
  "STYLE: Avoid “in ca.”, use “in etwa”.",
  "WORD CHOICE: Prefer “Anfrage” over “Wunsch” (e.g., “auf Anfrage”).",
  "WORD CHOICE: Prefer “Ernährungsbedürfnisse” over “Ernährungswünsche”.",
  "WORD CHOICE: Avoid “arrangiert” when referring to reserved areas; prefer “eingerichtet” or “reserviert” depending on context.",
  "WALKABILITY: Prefer “lässt sich ... zu Fuß zurücklegen” over “kann ... zu Fuß zurückgelegt werden”."

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

// Helpers
const getLangNote = (lang: string) => LANGUAGE_NOTES[lang.toLowerCase()] || "";
const getLangLabel = (lang: string) => {
    const m: Record<string, string> = { he: "Hebrew", de: "German", fr: "French", es: "Spanish", it: "Italian", ru: "Russian", en: "English", nl: "Dutch", pl: "Polish", zh: "Chinese", ar: "Arabic" };
    return m[lang.toLowerCase()] ?? lang;
};


const GERMAN_QA_RULES = [
  "German QA Rules (must comply):",
  "- Never use “Haus” to refer to the hotel/property. Replace with “Hotel”.",
  "- Avoid “engagiert(e)” describing the reception team. Prefer “Rezeptionsteam ... zur Verfügung”.",
  "- Replace “in ca.” with “in etwa”.",
  "- Prefer “auf Anfrage” over “auf Wunsch”.",
  "- Prefer “Ernährungsbedürfnisse” over “Ernährungswünsche”.",
  "- Avoid “arrangiert” for reserved areas; prefer “eingerichtet” or “reserviert”.",
  "- Prefer “lässt sich ... zu Fuß zurücklegen” for walkability questions."
].join("\n");


// מבנה נתונים לשורה לעיבוד
type RowItem = {
  index: number; // מספר השורה באקסל (0-based מהקריאה, נוסיף 1 לכתיבה)
  hotel: string;
  q: string;
  a: string;
};

export class TranslateMasterJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  // === System Instructions ===
  private systemInstructions(lang: string): string {
    const label = getLangLabel(lang);
    return [
      `ROLE: You are an expert Hospitality Copywriter & Localization Specialist translating to ${label}.`,
      `GOAL: Create natural content that sounds original, NOT translated.`,
      `CRITICAL HTML RULE: You will receive text containing HTML tags (like <p>, <strong>, <br>).`,
      `   👉 YOU MUST PRESERVE THESE TAGS EXACTLY IN THE TRANSLATION.`,
      `   👉 Do NOT translate the tag names (e.g. keep <p>, do not write <absatz>).`,
      `   👉 Place the tags logically in the translated sentence.`,
      `BRANDING: Keep property names EXACTLY as source.`,
      `TONE: Warm, professional, upscale.`,
    ].join("\n");
  }

  // === Step 1: Draft Prompt ===
  private draftPrompt(lang: string, batch: any[]): string {
    return [
      `TASK: Translate the following list of Question/Answer pairs to ${getLangLabel(lang)}.`,
      `CONTEXT: Hotel FAQ.`,
      `INSTRUCTIONS:`,
      `1. Translate the 'question' and 'answer' fields.`,
      `2. KEEP HTML TAGS (<p>, etc) exactly as they are.`,
      `3. Use the 'hotel' field for context but do not translate the hotel name itself.`,
      `4. Output strictly valid JSON.`,
      ``,
      `INPUT BATCH:`,
      JSON.stringify(batch, null, 2)
    ].join("\n");
  }

  // === Step 2: Polish Prompt ===
  private polishPrompt(lang: string, draftJson: string): string {
    const label = getLangLabel(lang);
    const note = getLangNote(lang);

     const extraRules =
    lang.toLowerCase() === "de"
      ? `\n\n${GERMAN_QA_RULES}\n`
      : "";

    return [
    `ROLE: Senior Editor (${label}).`,
    `TASK: Polish this JSON translation.`,
    `RULES:`,
    `- Ensure native flow and upscale hospitality tone.`,
    `- CHECK HTML TAGS: Make sure <p> and other tags are preserved and placed correctly.`,
    `- LANGUAGE NOTES: ${note}`,
    extraRules,
    ``,
      `INPUT DRAFT:`,
      draftJson,
      ``,
      `OUTPUT: Return ONLY valid JSON with the structure: { "rows": [ { "q": "...", "a": "..." }, ... ] }`
    ].join("\n");
  }

  // === Main Execution ===
  async run(cfg: TranslateMasterConfig): Promise<void> {
    console.log(chalk.blue(`🚀 Starting Smart Split Translation Job (2 Batches Per Hotel)...`));
    console.log(chalk.yellow(`📥 Reading Master File...`));
    
    const allRows = await this.sheets.readValues(cfg.spreadsheetId, `${cfg.tabName}!A:Z`);
    
    // 1. קיבוץ לפי מלונות (Grouping)
    const hotelGroups = new Map<string, RowItem[]>();

    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      const hotel = String(row[cfg.colHotelName] || "").trim();
      const q = String(row[cfg.colQuestion] || "");
      const a = String(row[cfg.colAnswer] || "");
      
      // מדלגים על שורות ללא מלון או שאלה
      if (!hotel || !q) continue;

      if (!hotelGroups.has(hotel)) {
        hotelGroups.set(hotel, []);
      }
      hotelGroups.get(hotel)?.push({ index: i, hotel, q, a });
    }

    console.log(chalk.green(`📋 Found ${hotelGroups.size} hotels to process.`));

    // 2. עיבוד כל מלון בנפרד
    for (const [hotelName, items] of hotelGroups.entries()) {
      console.log(chalk.cyan(`\n🏨 Processing Hotel: "${hotelName}" (${items.length} items)`));
      
      // חישוב החלוקה ל-2
      // אם יש 45 שאלות: midpoint = 23. חלק ראשון: 23, חלק שני: 22.
      const midpoint = Math.ceil(items.length / 2);
      
      const part1 = items.slice(0, midpoint);
      const part2 = items.slice(midpoint);
      
      // עיבוד חלק 1
      if (part1.length > 0) {
        console.log(chalk.yellow(`   👉 Batch 1/2 (${part1.length} Qs)...`));
        await this.processBatch(part1, cfg);
      }

      // עיבוד חלק 2
      if (part2.length > 0) {
        console.log(chalk.yellow(`   👉 Batch 2/2 (${part2.length} Qs)...`));
        await this.processBatch(part2, cfg);
      }
    }
    
    console.log(chalk.blue(`\n🎉 All hotels processed successfully.`));
  }

  // פונקציה לעיבוד באץ' בודד (Draft -> Polish -> Write)
  private async processBatch(batch: RowItem[], cfg: TranslateMasterConfig): Promise<void> {
    try {
        const lang = cfg.targetLang;
        const sys = this.systemInstructions(lang);

        // הכנת הפיילוד ל-AI
        const payload = batch.map(item => ({
            id: item.index,
            hotel: item.hotel,
            question: item.q,
            answer: item.a
        }));
        
        // 1. Draft
        process.stdout.write(chalk.gray("      Drafting... "));
        const draftRes = await this.agent.runWithSystem(this.draftPrompt(lang, payload), sys, "o3");
        
        // 2. Polish
        process.stdout.write(chalk.gray("Polishing... "));
        const finalRes = await this.agent.runWithSystem(this.polishPrompt(lang, draftRes), sys, "o3");
        console.log(chalk.green("Done."));

        // 3. Parse
        const parsed = this.parseJson(finalRes);

        // 4. Write Back
        // אנחנו כותבים את הבלוק הזה חזרה.
        // הנחה: השורות בקובץ המקורי הן רציפות עבור המלון הזה (כי הקובץ ממוין).
        // אם הן רציפות, אפשר לכתוב בבת אחת.
        
        const startRow = batch[0].index + 1; // המרה מ-0-based ל-1-based
        const valuesToWrite = parsed.rows.map((r: any) => [r.q, r.a]);

        // טווח הכתיבה: נגיד E15
        const range = `${cfg.tabName}!${cfg.colTargetQ}${startRow}`;
        
        await this.sheets.writeValues(cfg.spreadsheetId, range, valuesToWrite);
        // console.log(chalk.gray(`      ✅ Saved to row ${startRow}`));

    } catch (err) {
        console.error(chalk.red(`      ❌ Batch failed:`), err);
    }
  }

  private parseJson(text: string): any {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    const slice = (first >= 0 && last > first) ? text.slice(first, last + 1) : text;
    try {
        return JSON.parse(slice);
    } catch {
        throw new Error("Invalid JSON from AI");
    }
  }
}