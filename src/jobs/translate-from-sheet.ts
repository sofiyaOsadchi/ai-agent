// src/jobs/translate-from-sheet.ts
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

type TranslateSheetConfig = {
  spreadsheetId: string;
  sourceTab?: string;
  targetLangs: string[];
  translateHeader?: boolean; // ברירת מחדל: true (מתרגמים גם כותרת)
};

 // === Add near the top of the file (below langLabel) ===
const LANGUAGE_NOTES: Record<string, string> = {
  // ISO keys you use in LANGS (fallback to name keys if needed)
  de: [
    "Use formal, neutral German in third person; avoid slang.",
    "Prefer native question forms: “Gibt es …?” / “Verfügt das Hotel über …?”.",
    "Use standard hotel terms: kostenloses WLAN / Highspeed-WLAN; Rezeption rund um die Uhr; Zimmerreinigung; Late Check-out.",
    "Avoid English leftovers (e.g., 'Housekeeping' → Reinigungsteam / Housekeeping-Team if truly common).",
    "Keep numbers/time as in source; 'Uhr' for times when applicable.",
    "Branding consistency (e.g., “Clash Bar” exactly the same everywhere).",
    "Prefer natural verbs like “bietet”, “steht zur Verfügung”, “verfügt über”."
  ].join(" "),
  es: [
    "Neutral, polite Spanish (3rd person); no slang.",
    "Natural questions: “¿El hotel dispone de…?” / “¿Hay…?”.",
    "Consistent hotel terms: Wi-Fi gratis; recepción 24 horas; servicio de habitaciones; habitaciones comunicadas.",
    "Avoid Spanglish (translate housekeeping → servicio de limpieza).",
    "Place € after number if natural (15 €) unless source dictates otherwise.",
    "Keep brand names exactly; same capitalization for 'Clash Bar'."
  ].join(" "),
  nl: [
    "Polite, clear Dutch; keep sentences concise.",
    "Questions: “Beschikt het hotel over…?” / “Is er…?”.",
    "Use standard terms: gratis wifi; 24-uursreceptie; roomservice; verbonden kamers.",
    "Avoid English terms unless truly standard; keep tone down-to-earth.",
    "Be consistent with brand names (exact casing)."
  ].join(" "),
  it: [
    "Formale, cortese, scorrevole (3a persona).",
    "Domande naturali: “L’hotel dispone di…?” / “È disponibile…?”.",
    "Terminologia: Wi-Fi gratuito; reception aperta 24 ore su 24; servizio in camera; camere comunicanti.",
    "Evita anglicismi inutili (housekeeping → servizio pulizie).",
    "€ dopo il numero (24,00 €) se naturale; non riformattare dati del source.",
    "Coerenza su nomi/brand (es. “Clash Bar”)."
  ].join(" "),
  fr: [
    "Français formel, poli, fluide (3e personne).",
    "Questions naturelles: “Y a-t-il… ?” / “L’hôtel dispose-t-il de… ?”.",
    "Termes standard: Wi-Fi gratuit; réception ouverte 24h/24; service d’étage; chambres communicantes.",
    "Éviter les anglicismes; cohérence de la terminologie.",
    "Typo FR: espace avant ? : ; mais ne casse pas le formatage du source.",
    "Respect exact de la marque (ex. “Clash Bar”)."
  ].join(" "),
  pl: [
    "Polite, neutral Polish; clear syntax.",
    "Questions: “Czy hotel…?” / “Czy jest dostępne…?”.",
    "Terms: bezpłatne Wi-Fi; całodobowa recepcja; obsługa pokoju; pokoje połączone.",
    "Avoid English remnants; keep consistent terminology.",
    "Do not reformat numbers/currency unless clearly needed."
  ].join(" "),
  ru: [
    "Формальный, нейтральный стиль; 3-е лицо/безличные конструкции.",
    "Вопросы: “Предоставляется ли…?” / “Есть ли…?”.",
    "Термины: бесплатный Wi-Fi; круглосуточная стойка регистрации; обслуживание в номерах; смежные номера.",
    "Не оставлять англицизмы (housekeeping → уборка/персонал по уборке).",
    "Соблюдать единообразие брендов (например, “Clash Bar”)."
  ].join(" "),
  he: [
    "עברית רשמית, ברורה וזורמת; העדפת ניסוח ניטרלי מגדרית.",
    "שאלות טבעיות: “האם…?” / “האם יש… במלון?”.",
    "מונחים: אינטרנט/Wi-Fi חינם; קבלה 24/7; שירות חדרים; חדרים מחוברים.",
    "להימנע ממילים באנגלית כשיש חלופה טבעית; אפשר להשאיר Wi-Fi.",
    "לא לשנות פורמט של שעות/מחירים; לשמור אחידות מיתוג (Clash Bar)."
  ].join(" "),
  zh: [
    "简体中文，正式专业、自然流畅（第三人称）。",
    "常见问句：酒店是否提供…？/ 是否有…？",
    "用语：免费Wi-Fi；24小时前台；客房送餐服务；联通房。",
    "避免直译或中英混杂；用地道表达。",
    "品牌名与大小写保持一致（如“Clash Bar”）。"
  ].join(" "),
  ar: [
    "عربية فصحى حديثة، رسمية وواضحة (بأسلوب الغائب).",
    "صياغة أسئلة طبيعية: “هل يوفر الفندق…؟” / “هل يتوفر … في الفندق؟”.",
    "مصطلحات: واي فاي مجاني؛ مكتب استقبال يعمل على مدار 24 ساعة؛ خدمة الغرف؛ غرف متصلة.",
    "تجنّب الإنجليزية داخل الجمل؛ إن لزم فلتكن أسماء العلامات فقط.",
    "اتساق تام في أسماء العلامات (مثل “Clash Bar”)."
  ].join(" "),
};

// Optional: also support name keys if ever needed
LANGUAGE_NOTES["german"]  = LANGUAGE_NOTES.de;
LANGUAGE_NOTES["spanish"] = LANGUAGE_NOTES.es;
LANGUAGE_NOTES["dutch"]   = LANGUAGE_NOTES.nl;
LANGUAGE_NOTES["italian"] = LANGUAGE_NOTES.it;
LANGUAGE_NOTES["french"]  = LANGUAGE_NOTES.fr;
LANGUAGE_NOTES["polish"]  = LANGUAGE_NOTES.pl;
LANGUAGE_NOTES["russian"] = LANGUAGE_NOTES.ru;
LANGUAGE_NOTES["hebrew"]  = LANGUAGE_NOTES.he;
LANGUAGE_NOTES["chinese"] = LANGUAGE_NOTES.zh;
LANGUAGE_NOTES["arabic"]  = LANGUAGE_NOTES.ar;



export class TranslateFromSheetJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}
  
  // מיפוי קודי שפה לתווית ברורה כדי למנוע בלבול ("he" = Hebrew)
  private langLabel(lang: string): string {
    const m: Record<string, string> = {
      he: "Hebrew",
      fr: "French",
      de: "German",
      es: "Spanish",
      it: "Italian",
      ru: "Russian",
      en: "English",
      gr: "Greek",
      ar: "Arabic",  
      el: "Greek",
    nl: "Dutch",
    pl: "Polish",
    zh: "Chinese",    
    };
    return m[lang.toLowerCase()] ?? lang;
  }

  // פרסינג קשיח ל־JSON מהמודל – גוזר רק את התוכן שבין הסוגריים אם נוסף טקסט מסביב
private parseJsonMatrixOrThrow(text: string): string[][] {
  // לפעמים המודל מחזיר טקסט מסביב ל-JSON; חותכים רק את הבלוק בין הסוגריים המסולסלים
  const first = text.indexOf("{");
  const last  = text.lastIndexOf("}");
  const slice = (first >= 0 && last > first) ? text.slice(first, last + 1) : text;

  let obj: any;
  try {
    obj = JSON.parse(slice);
  } catch (e) {
    throw new Error("Model did not return valid JSON for translation output");
  }

  if (!obj || !Array.isArray(obj.rows)) {
    throw new Error("Translation JSON must contain a 'rows' array");
  }

  // מוודאים שמחזירים מטריצה של מחרוזות
  const rows: string[][] = obj.rows.map((row: any) =>
    Array.isArray(row) ? row.map((cell: any) => (cell == null ? "" : String(cell))) : []
  );

  return rows;
}

private systemInstructions(lang: string): string {
  const label = this.langLabel(lang);
  const note  = LANGUAGE_NOTES[lang.toLowerCase()] ?? "";

  return [
    `ROLE: Professional hotel-localization translator for ${label}.`,
    `TONE: Formal, courteous, neutral, natural; third-person; no slang; no hype.`,
    `BRANDING: Keep property/venue/brand names EXACTLY as in source (same casing). Do NOT translate brand names.`,
    `DO-NOT-TRANSLATE: URLs, email addresses, phone numbers, booking/room codes, currency symbols, units, placeholders/tokens (e.g., [VERIFY], {…}, {{…}}, %s, %1$s).`,
    `STRUCTURE: Preserve the exact matrix shape (rows × columns). Do not add/remove/merge/split cells. Keep empty cells empty.`,
    `LANGUAGE GUARANTEE: Output text fully in ${label}, except items listed under Do-Not-Translate.`,
    `TERMINOLOGY: Use consistent, standard hospitality terminology in ${label}.`,
    `QUALITY: Publication-ready copy for an official hotel website.`,
    `LANGUAGE-SPECIFIC NOTES: ${note}`,
  ].join("\n");
}

private userPromptForTranslation(lang: string, rows: string[][], translateHeader: boolean): string {
  return [
    `TASK: Translate EVERY non-empty cell to the target language.`,
    `Translate header row: ${translateHeader ? "YES" : "NO"}.`,
    `Do NOT add commentary.`,
    `OUTPUT (STRICT JSON):`,
    `{"rows":[["...","..."],["...","..."], ...]}`,
    ``,
    `INPUT:`,
    JSON.stringify({ rows })
  ].join("\n");
}

private wholeSheetPrompt(lang: string, rows: string[][], translateHeader: boolean) {
  const label = this.langLabel(lang);
  const note  = LANGUAGE_NOTES[lang.toLowerCase()] ?? "";

  return `You are a professional hotel-localization translator.

TARGET LANGUAGE: ${label} (${lang})

QUALITY BAR
- Target: publication-ready copy for an official hotel website.
- Tone: formal, courteous, neutral, and clear; third-person; no slang; no hype.
- Prefer natural target-language phrasing over literal renderings; rephrase for fluency where needed.
- Use consistent, standard hospitality terminology in the target language.

SEO & BRANDING (STRICT)
- Keep all hotel/property names, bar/venue names, and chain/brand names EXACTLY as in source (English). Do NOT translate or localize hotel names. Keep casing consistent (e.g., “Clash Bar” everywhere).
- Keep loyalty/program/product names as officially used; do not invent new forms.

DO-NOT-TRANSLATE (KEEP EXACT)
- URLs, email addresses, phone numbers, booking/confirmation codes, room-type codes (e.g., DLX).
- Currency symbols and measurement units as written (€, £, ₪, $, km, m²).
- Placeholders/tokens: [VERIFY], {…}, {{…}}, %s, %1$s (case-sensitive).
  *If a visible &nbsp; is not necessary, prefer a normal space — but do not break layout or remove required tags.*

STRUCTURE
- Translate EVERY non-empty cell in the 2D array "rows".
- Translate header row as well: ${translateHeader ? "YES" : "NO"}.
- Keep the exact matrix shape: same number of rows and columns.
- Do not add/remove/merge/split cells. Keep empty cells empty.
- No reordering, no extra comments, no notes.

LANGUAGE GUARANTEES
- All translatable content must be fully in ${label}, except for items listed under Do-Not-Translate.
- If the source mixes languages, translate only the translatable parts and preserve DNT items unchanged.
- Do NOT invent content; do NOT introduce new labels such as [VERIFY]; only preserve them if present.
- Maintain consistent terminology across all rows.

STYLE & FLUENCY
- Write as a native hospitality copywriter would for a hotel website in ${label}.
- Natural questions and answers: adjust word order and phrasing to what locals actually write/ask.
- Prefer short, clear sentences; accuracy + readability + local authenticity are the priorities.

LANGUAGE-SPECIFIC NOTES
${note}

OUTPUT FORMAT (STRICT)
Return ONLY valid JSON (no markdown), exactly:
{"rows":[["...","..."],["...","..."], ...]}

INPUT
${JSON.stringify({ rows })}`;
}

  async run(cfg: TranslateSheetConfig): Promise<void> {
    // בחירת טאב מקור: אם לא סופק, ניקח את הראשון
    let sourceTab = cfg.sourceTab && cfg.sourceTab.trim() ? cfg.sourceTab.trim() : undefined;
    if (!sourceTab) {
      sourceTab = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
      console.warn(`No sourceTab provided. Using first tab: "${sourceTab}"`);
    } else {
      // אימות שם טאב; אם לא קיים – ניפול לראשון (לא עוצרים את הריצה)
      try {
        await this.sheets.getSheetIdByTitle(cfg.spreadsheetId, sourceTab);
      } catch {
        const fallback = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
        console.warn(`Tab "${sourceTab}" not found. Using first tab: "${fallback}"`);
        sourceTab = fallback;
      }
    }

    // קריאת כל הטווח (A:Z – אפשר להרחיב אם יש יותר עמודות)
    const sourceId = await this.sheets.getSheetIdByTitle(cfg.spreadsheetId, sourceTab);
    const rows = await this.sheets.readValues(cfg.spreadsheetId, `${sourceTab}!A:Z`);
    if (rows.length === 0) throw new Error(`Source tab "${sourceTab}" is empty`);

    // כברירת מחדל – מתרגמים גם כותרת
    const translateHeader = cfg.translateHeader ?? true;

    for (const lang of cfg.targetLangs) {
      const newTitle = `${sourceTab} – ${lang.toUpperCase()}`;

      // שכפול הטאב לפני כתיבה – שומר עיצוב 1:1
      await this.sheets.duplicateSheet(cfg.spreadsheetId, sourceId, newTitle);

      // קריאה אחת למודל לכל שפה: כל הגיליון ב־JSON
      const system = this.systemInstructions(lang);
const user   = this.userPromptForTranslation(lang, rows, translateHeader);
const json   = await this.agent.runWithSystem(user, system, "o3");
      const translated = this.parseJsonMatrixOrThrow(json);


      // הבטחת אותו מבנה (מס׳ שורות/עמודות); אם חסר – נשלים מהמקור כדי לא לשבור את הטבלה
      const h = rows.length;
      const w = Math.max(...rows.map(r => r.length));
      for (let r = 0; r < h; r++) {
        translated[r] = translated[r] ?? [];
        for (let c = 0; c < w; c++) {
          if (translated[r][c] === undefined) {
            translated[r][c] = rows[r]?.[c] ?? "";
          }
        }
      }

      // כתיבה לטאב המשוכפל
      await this.sheets.writeValues(cfg.spreadsheetId, `${newTitle}!A1`, translated);
      console.log(`✅ Translated tab created: ${newTitle}`);
    }
  }
}