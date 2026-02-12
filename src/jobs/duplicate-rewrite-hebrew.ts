// src/jobs/duplicate-rewrite-hebrew.ts
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

// 1) הוסף למעלה בקובץ (אחרי ה-importים), מפה EN -> HE
const HOTEL_NAME_MAP_EN_TO_HE: Record<string, string> = {
  "Leonardo Plaza Hotel Ashdod": "מלון לאונרדו פלאזה אשדוד",
  "Leonardo Hotel Negev": "מלון לאונרדו נגב באר שבע",
  "Leonardo Plaza Dead Sea": "מלון לאונרדו פלאזה ים המלח",
  "Herods Dead Sea Hotel": "מלון הרודס ים המלח",
  "Leonardo Club Dead Sea": "מלון לאונרדו קלאב ים המלח",
  "Leonardo Inn Dead Sea": "מלון לאונרדו אין ים המלח",
  "Herods Vitalis Eilat Hotel": "מלון הרודס ויטאליס אילת",
  "Herods Boutique Eilat Hotel": "מלון הרודס בוטיק אילת",
  "Herods Palace Eilat Hotel": "מלון הרודס פאלאס אילת",
  "Leonardo Royal Resort Eilat": "מלון לאונרדו רויאל ריזורט אילת",
  "Leonardo Plaza Hotel Eilat": "מלון לאונרדו פלאזה אילת",
  "Leonardo Club Hotel Eilat - All Inclusive": "מלון לאונרדו קלאב הכל כלול אילת",
  "Leonardo Privilege Hotel Eilat - All Inclusive": "מלון לאונרדו פריוילג' הכל כלול אילת",
  "U Coral Beach Club Eilat Ultra All Inclusive": "מלון יו קורל ביץ' קלאב אילת אולטרה הכל כלול",
  "U Magic Palace Eilat": "מלון יו מג'יק פאלאס אילת",
  "U Splash Resort": "מלון יו ספלאש ריזורט אילת",
  "Hotel Botanica Haifa": "מלון בוטניקה חיפה",
  "Leonardo Plaza Haifa": "מלון לאונרדו פלאזה חיפה",
  "Herods Herzliya": "הרודס הרצליה",
  // שינוי לפי הבקשה: NYX -> ניקס
  "NYX Hotel Herzliya": "מלון ניקס הרצליה",
  "Leonardo Boutique Jerusalem": "מלון לאונרדו בוטיק ירושלים",
  "Leonardo Hotel Jerusalem": "מלון לאונרדו ירושלים",
  "Leonardo Plaza Hotel Jerusalem": "מלון לאונרדו פלאזה ירושלים",
  "Nucha Hotel": "מלון נוצ'ה",
  "Leonardo Plaza Netanya": "מלון לאונרדו פלאזה נתניה",
  "Leonardo Plaza City Tower Hotel": "מלון לאונרדו פלאזה סיטי טאוור",
  "Leonardo Boutique Rehovot": "מלון לאונרדו בוטיק רחובות",
  "Canaan Hotel": "מלון כנען",
  "Herods Tel Aviv Hotel": "מלון הרודס תל אביב",
  // שינוי לפי הבקשה: NYX -> ניקס
  "NYX Hotel Tel Aviv": "מלון ניקס תל אביב",
  "Leonardo Boutique Hotel Tel Aviv": "מלון לאונרדו בוטיק תל אביב",
  "Hotel Rothschild 22 Tel Aviv": "מלון רוטשילד 22 תל אביב",
  "Leonardo Gordon Beach Tel Aviv": "מלון לאונרדו גורדון ביץ' תל אביב",
  "Bachar House": "מלון בכר האוס",
  "Nordoy Hotel": "נורדוי",
  "Sam & Blondi": "מלון סאם ובלונדי",
  "Bazaar Hotel": "מלון בזאר-Bazaar",
  "The Jaffa": "The Jaffa",
  "Hotel RECEPTION": "מלון ריספשן",
  "U Boutique Kinneret": "מלון יו בוטיק כנרת",
  "Leonardo Tiberias": "מלון לאונרדו טבריה",
  "Leonardo Plaza Tiberias": "מלון לאונרדו פלאזה טבריה",
  "Leonardo Club Tiberias": "מלון לאונרדו קלאב טבריה - הכל כלול",
};


type DuplicateRewriteHebrewConfig = {
  spreadsheetId: string;           // מקור
  outputFolderId?: string;         // לא חובה, אם לא נשלח - ישתמש בתיקיית המקור
  questionCol?: number;            // 0-based, ברירת מחדל: 1 (B)
  answerCol?: number;              // 0-based, ברירת מחדל: 2 (C)
  headerRow?: number;              // 1-based, ברירת מחדל: 1
  hebrewHotelNameExact?: string;   // אם רוצים לקבע ידנית (מומלץ כאופציה)
  rewriteStrength?: "medium" | "strong"; // ברירת מחדל: "strong"
};



type RowItem = { rowIndex1Based: number; q: string; a: string };



export class DuplicateRewriteHebrewJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  

  async run(cfg: DuplicateRewriteHebrewConfig): Promise<{ newSpreadsheetId: string }> {
    const questionCol = cfg.questionCol ?? 1;
    const answerCol = cfg.answerCol ?? 2;
    const headerRow = cfg.headerRow ?? 1;
    const strength = cfg.rewriteStrength ?? "strong";

    // 1) Where to place the copied sheet
    const outputFolderId = cfg.outputFolderId ?? (await this.sheets.getParentFolderId(cfg.spreadsheetId));

    // 2) Copy spreadsheet into target folder
    const originalTitle = await this.sheets.getSpreadsheetTitle(cfg.spreadsheetId);
    const newTitle = `${originalTitle} - HE rewritten`;
    const newSpreadsheetId = await this.sheets.copySpreadsheetToFolder(
      cfg.spreadsheetId,
      outputFolderId,
      newTitle
    );

    // 3) Single-tab only: always work with the first (and only) tab
    const keptHebrewTabTitle = await this.sheets.getFirstSheetTitle(newSpreadsheetId);

    // 4) Read all values from the single tab
    const values = await this.sheets.readValues(newSpreadsheetId, `${keptHebrewTabTitle}!A:Z`);
    if (!values || values.length <= headerRow) {
      return { newSpreadsheetId };
    }

    // 5) Detect exact Hebrew hotel name (or use provided override)
    // 3) ב-run(): החלף את סעיף 5 כך שנשמור גם שם "נוכחי בגיליון" וגם שם "נכון מהמפה"
const expectedHebrewHotelName = this.getExpectedHebrewHotelNameFromEnglishTitle(originalTitle);

const hebrewHotelNameExactInSheet = cfg.hebrewHotelNameExact
  ? cfg.hebrewHotelNameExact
  : await this.detectHebrewHotelNameExactFromSheet({
      spreadsheetId: newSpreadsheetId,
      tabTitle: keptHebrewTabTitle,
      values,
      questionCol,
      answerCol,
      headerRow,
      englishHotelNameFromTitle: originalTitle,
    });

// אם יש שם "נכון" מהמפה - נשתמש בו לשחזור. אם אין, נשאיר את מה שנמצא בגיליון.
const hebrewHotelNameToEnforce = expectedHebrewHotelName ?? hebrewHotelNameExactInSheet;

    // 6) Prepare rows for rewrite (question + answer)
    const items: RowItem[] = [];
    for (let r = headerRow + 1; r <= values.length; r++) {
      const row = values[r - 1] ?? [];
      const q = String(row[questionCol] ?? "").trim();
      const a = String(row[answerCol] ?? "").trim();
      if (!q && !a) continue;
      items.push({ rowIndex1Based: r, q, a });
    }

    // 7) Rewrite in batches
const rewrittenMap = await this.rewriteRowsInBatches(
  items,
  hebrewHotelNameExactInSheet,
  hebrewHotelNameToEnforce,
  strength
);
    // 8) Build output values aligned to sheet rows (data rows only)
    const outPairs: string[][] = [];
    for (let r = headerRow + 1; r <= values.length; r++) {
      const row = values[r - 1] ?? [];
      const qOrig = String(row[questionCol] ?? "");
      const aOrig = String(row[answerCol] ?? "");

      const rewritten = rewrittenMap.get(r);
      const qNew = rewritten?.q ?? qOrig;
      const aNew = rewritten?.a ?? aOrig;

      outPairs.push([qNew, aNew]);
    }

    const startRow = headerRow + 1;
    const qColLetter = this.indexToColumnLetter(questionCol);
    const aColLetter = this.indexToColumnLetter(answerCol);

    // Write back (assumes question/answer columns are adjacent, e.g. B:C)
    await this.sheets.writeValues(
      newSpreadsheetId,
      `${keptHebrewTabTitle}!${qColLetter}${startRow}:${aColLetter}`,
      outPairs
    );

    return { newSpreadsheetId };
  }

  private indexToColumnLetter(idx0: number): string {
    let n = idx0 + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  private getExpectedHebrewHotelNameFromEnglishTitle(englishTitleRaw: string): string | null {
  const englishTitle = String(englishTitleRaw ?? "").trim();
  return HOTEL_NAME_MAP_EN_TO_HE[englishTitle] ?? null;
}

  private async detectHebrewHotelNameExactFromSheet(args: {
    spreadsheetId: string;
    tabTitle: string;
    values: string[][];
    questionCol: number;
    answerCol: number;
    headerRow: number;
    englishHotelNameFromTitle: string;
  }): Promise<string> {
    // לוקחים דגימה מוגבלת כדי לא לשרוף טוקנים
    const sampleParts: string[] = [];
    let count = 0;
    for (let r = args.headerRow + 1; r <= args.values.length; r++) {
      const row = args.values[r - 1] ?? [];
      const q = String(row[args.questionCol] ?? "").trim();
      const a = String(row[args.answerCol] ?? "").trim();
      if (!q && !a) continue;
      sampleParts.push(`Q: ${q}\nA: ${a}`);
      count++;
      if (count >= 60) break;
    }
    const sampleText = sampleParts.join("\n\n");

    const system = [
      "You extract the exact Hebrew hotel name as it appears in the provided Hebrew FAQ text.",
      "Rules:",
      "- Return ONLY one string: the exact hotel name in Hebrew as it appears in the text.",
      "- It must be an exact substring found in the text (do not invent, do not translate freely).",
      "- If multiple candidates exist, choose the most official full name used consistently.",
      "- No explanations, no quotes, just the raw name.",
    ].join("\n");

    const user = [
      `English hotel name (from title): ${args.englishHotelNameFromTitle}`,
      "Hebrew FAQ sample:",
      sampleText,
    ].join("\n\n");

    const name = (await this.agent.runWithSystem(user, system, "o4-mini")).trim();

    // אימות קשיח: חייב להיות substring בדגימה
    if (!name || !sampleText.includes(name)) {
      throw new Error("Could not verify Hebrew hotel name as an exact match in the sheet sample. Provide hebrewHotelNameExact in config.");
    }

    return name;
  }

  private freezeTokens(
  input: string,
  hebrewHotelNameExactInSheet: string,
  hebrewHotelNameToEnforce: string,
  prefix: string
) {
  let text = input;
  const tokenMap = new Map<string, string>();
  let i = 0;

  const addToken = (valueToRestore: string) => {
    const token = `[[KEEP_${prefix}_${i++}]]`;
    tokenMap.set(token, valueToRestore);
    return token;
  };


  
  // Freeze: לפי מה שמופיע בגיליון בפועל
  // Unfreeze: תמיד לשם הנכון מהמפה
  if (hebrewHotelNameExactInSheet) {
    const re = new RegExp(this.escapeRegExp(hebrewHotelNameExactInSheet), "g");
    text = text.replace(re, () => addToken(hebrewHotelNameToEnforce));
  }

  // URLs
  text = text.replace(/https?:\/\/[^\s)]+/g, (m) => addToken(m));
  // Emails
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => addToken(m));
  // Times 14:30
  text = text.replace(/\b([01]?\d|2[0-3]):[0-5]\d\b/g, (m) => addToken(m));
  // Dates 20/01/2026 and 2026-01-20
  text = text.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, (m) => addToken(m));
  text = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (m) => addToken(m));
  // Currency
  text = text.replace(/₪\s?\d[\d,]*/g, (m) => addToken(m));
  // Numbers 2+ digits
  text = text.replace(/\b\d{2,}\b/g, (m) => addToken(m));

  return { frozenText: text, tokenMap };
}

private unfreezeTokens(text: string, tokenMap: Map<string, string>) {
  let out = text;
  for (const [token, value] of tokenMap.entries()) {
    out = out.split(token).join(value);
  }
  return out;
}

private escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

private async rewriteRowsInBatches(
  items: RowItem[],
  hebrewHotelNameExactInSheet: string,
  hebrewHotelNameToEnforce: string,
  strength: "medium" | "strong"
): Promise<Map<number, { q: string; a: string }>> {
  const result = new Map<number, { q: string; a: string }>();
  const batchSize = 18;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const frozenBatch = batch.map((it) => {
      const fq = this.freezeTokens(
        it.q,
        hebrewHotelNameExactInSheet,
        hebrewHotelNameToEnforce,
        `R${it.rowIndex1Based}_Q`
      );
      const fa = this.freezeTokens(
        it.a,
        hebrewHotelNameExactInSheet,
        hebrewHotelNameToEnforce,
        `R${it.rowIndex1Based}_A`
      );

      return {
        rowIndex1Based: it.rowIndex1Based,
        fq: fq.frozenText,
        fa: fa.frozenText,
        qMap: fq.tokenMap,
        aMap: fa.tokenMap,
      };
    });

    

    const input = frozenBatch.map((x) => ({
      rowIndex1Based: x.rowIndex1Based,
      question: x.fq,
      answer: x.fa,
    }));

    const system = [
      "You are a senior Hebrew hotel copywriter specializing in SEO-safe paraphrasing.",
      "Goal: rewrite Hebrew Q&A to reduce duplication risk between two hotel sites while keeping meaning and facts identical.",
      "Hard rules:",
      "- Keep all tokens like [[KEEP_...]] exactly as-is.",
      "- Do not change any facts, policies, numbers, names, times, dates, addresses, contacts, URLs.",
      "- Hebrew must be high-level, grammatically correct, and suitable for a hotel website.",
      "- Rewrite both question and answer.",
       "- If the ORIGINAL answer starts with 'כן' or 'לא' (optionally followed by ',' or '–'), the rewritten answer should start with the same word ('כן' stays 'כן', 'לא' stays 'לא'). unless it is not a yes/no question so just start with an informative sentence.",
  "- If the ORIGINAL answer does NOT start with 'כן' or 'לא', do NOT start the rewritten answer with 'כן', 'לא', or any equivalents (including 'בהחלט', 'כמובן', 'בוודאי'). Start directly with an informative sentence.",
  "- Avoid using the word 'בהחלט' as an opening. Prefer neutral, informative phrasing.",

      strength === "strong"
        ? "- Make the rewrite clearly distinct: change sentence structure, reorder clauses, use synonyms, vary connectors, avoid near-copy. Do not be too subtle."
        : "- Make a moderate rewrite: improve style and reduce duplication without being overly aggressive.",
      "Output format (STRICT JSON only):",
      '{ "items": [ { "rowIndex1Based": 2, "question": "...", "answer": "..." }, ... ] }',
    ].join("\n");

    const user = JSON.stringify({ items: input }, null, 2);

    const text = await this.agent.runWithSystem(user, system, "o4-mini");
    const parsed = this.parseJsonOrThrow(text);

    const outItems: any[] = Array.isArray(parsed.items) ? parsed.items : [];
    const outByRow = new Map<number, { question: string; answer: string }>();
    for (const x of outItems) {
      const r = Number(x.rowIndex1Based);
      if (!r) continue;
      outByRow.set(r, { question: String(x.question ?? ""), answer: String(x.answer ?? "") });
    }

 for (const x of frozenBatch) {
  const out = outByRow.get(x.rowIndex1Based);

  const mergedMap = new Map<string, string>([...x.qMap.entries(), ...x.aMap.entries()]);

  const cleanupHotelDup = (s: string) => {
    return String(s ?? "")
      // Fix "the hotel hotel"
      .replace(/\bהמלון\s+מלון\s+/g, "המלון ")
      // Fix other duplicated hotel patterns
      .replace(/\bבמלון\s+מלון\s+/g, "במלון ")
      .replace(/\bלמלון\s+מלון\s+/g, "למלון ")
      .replace(/\bמלון\s+מלון\s+/g, "מלון ")
      // Fix "ב179" -> "ב 179"
      .replace(/\bב(\d)/g, "ב $1");
  };

  const fallbackOriginal = () => {
    const qFallback = cleanupHotelDup(this.unfreezeTokens(x.fq, mergedMap));
    const aFallback = cleanupHotelDup(this.unfreezeTokens(x.fa, mergedMap));
    result.set(x.rowIndex1Based, { q: qFallback.trim(), a: aFallback.trim() });
  };

  if (!out) {
    fallbackOriginal();
    continue;
  }

 const mustContain = Array.from(mergedMap.keys());
  const joined = `${out.question}\n${out.answer}`;
  const missing = mustContain.filter((t) => !joined.includes(t));
  if (missing.length) {
    fallbackOriginal();
    continue;
  }

  const qRestored = cleanupHotelDup(this.unfreezeTokens(out.question, mergedMap));
  const aRestored = cleanupHotelDup(this.unfreezeTokens(out.answer, mergedMap));

  if (qRestored.includes("[[KEEP_") || aRestored.includes("[[KEEP_")) {
    fallbackOriginal();
    continue;
  }
  result.set(x.rowIndex1Based, { q: qRestored.trim(), a: aRestored.trim() });
}  }

  return result;
}

  private parseJsonOrThrow(text: string): any {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    const slice = first >= 0 && last > first ? text.slice(first, last + 1) : text;
    try {
      return JSON.parse(slice);
    } catch {
      throw new Error("Model did not return valid JSON");
    }
  }
}
