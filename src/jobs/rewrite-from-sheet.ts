// src/jobs/rewrite-from-sheet.ts
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

type RewriteFromSheetConfig = {
  spreadsheetId: string;
  sourceTab?: string;
  commentCol?: string;  // default "E"
  answerCol?: string;   // default "C" (This is where we will inject the name now!)
  targetCol?: string;   // default "F" (Final Answer)
  header?: string;      // default "Agent Final Answer"

  checkOriginalGrammar?: boolean;      // default: false
  grammarFixCol?: string;              // default: "G"
  grammarFixHeader?: string;           // default: "Answer Grammar Fix"
  
  questionGrammarFixCol?: string;      // default: "H"
  questionGrammarFixHeader?: string;   // default: "Question Grammar Fix"
  
  hotelNameCol?: string;               // default: "I"
  hotelNameHeader?: string;            // default: "Hotel Name Status"
  hotelName?: string;                  // Optional
};

export class RewriteFromSheetJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  private letterToIndex(letter: string): number {
    const s = (letter ?? "").toUpperCase().trim();
    if (!/^[A-Z]+$/.test(s)) throw new Error(`Bad column letter: "${letter}"`);
    let idx = 0;
    for (let i = 0; i < s.length; i++) {
      idx = idx * 26 + (s.charCodeAt(i) - 64);
    }
    return idx - 1; // 0-based
  }

  private buildPromptCombined(
    itemsForRewrite: Array<{ rowIndex1Based: number; question: string; originalAnswer: string; clientComment: string }>,
    itemsForGrammar: Array<{ rowIndex1Based: number; question: string; originalAnswer: string }>,
    allRowsForNameInjection: Array<{ rowIndex1Based: number; question: string; currentAnswer: string }>,
    enableGrammar: boolean,
    hotelName: string
  ) {
    return `Hotel FAQ Combined – Rewrite (Comments) + QA + Hotel Name Injection

ROLE
You are a senior hospitality copywriter.
Target Hotel Name: "${hotelName}"

INPUT DATA
1. "rewrite": Rows with client comments (Needs full rewrite).
2. "grammar": Rows without comments (Needs light QA).
3. "name_candidates": ALL rows (Candidates for inserting the hotel name).

========================
SECTION A — REWRITE (APPLY COMMENTS)
========================
For "rewrite" items:
- Use Client Comment as priority.
- Output: Polished final answer.

========================
SECTION B — GRAMMAR (LIGHT TOUCH)
========================
For "grammar" items:
- Fix only factual/severe errors. Return "" if fine.

========================
SECTION C — HOTEL NAME INJECTION (UPDATE ORIGINAL)
========================
**Goal:** The client requires the hotel name "${hotelName}" to appear in 7-10 answers.
**Instructions:**
1. Pick exactly 7 to 10 rows from "name_candidates" where inserting the name fits naturally.
2. Create the **Final Version** of that sentence including the hotel name.
   - If the row was rewritten in Section A, use that version + Name.
   - Otherwise use the original/grammar-fixed version + Name.
3. Language: Must match the row's language.

========================
OUTPUT JSON
========================
{
  "rewrite": [ {"rowIndex1Based": number, "final_answer": string}, ... ],
  "grammar": [ {"rowIndex1Based": number, "fixed": string}, ... ],
  "hotel_name_inject": [ {"rowIndex1Based": number, "answer_with_name": string}, ... ]
}

INPUT
${JSON.stringify({
  rewrite: itemsForRewrite,
  grammar: enableGrammar ? itemsForGrammar : [],
  name_candidates: allRowsForNameInjection
}, null, 2)}`;
  }

  private parseCombinedOutputOrThrow(text: string): {
    rewrite: Array<{ rowIndex1Based: number; final_answer: string }>;
    grammar: Array<{ rowIndex1Based: number; fixed: string }>;
    hotel_name_inject: Array<{ rowIndex1Based: number; answer_with_name: string }>;
  } {
    const first = text.indexOf("{");
    const last  = text.lastIndexOf("}");
    const slice = (first >= 0 && last > first) ? text.slice(first, last + 1) : text;
    let obj: any;
    try { obj = JSON.parse(slice); } catch {
      throw new Error("Model did not return valid JSON");
    }
    obj.rewrite = Array.isArray(obj.rewrite) ? obj.rewrite : [];
    obj.grammar = Array.isArray(obj.grammar) ? obj.grammar : [];
    obj.hotel_name_inject = Array.isArray(obj.hotel_name_inject) ? obj.hotel_name_inject : [];
    return obj;
  }

  async run(cfg: RewriteFromSheetConfig): Promise<void> {
    const commentCol = cfg.commentCol ?? "E";
    const answerCol  = cfg.answerCol  ?? "C"; // Target for Name Injection updates!
    const targetCol  = cfg.targetCol  ?? "F";
    const header     = cfg.header     ?? "Agent Final Answer";

    const enableGrammar     = cfg.checkOriginalGrammar ?? false;
    const grammarFixCol     = cfg.grammarFixCol ?? "G";
    const grammarFixHeader  = cfg.grammarFixHeader ?? "Answer Grammar Fix";

    const hotelNameCol    = cfg.hotelNameCol ?? "I";
    const hotelNameHeader = cfg.hotelNameHeader ?? "Hotel Name Status";

    // 1. זיהוי שם המלון
    let targetHotelName = cfg.hotelName;
    if (!targetHotelName || targetHotelName.toLowerCase() === "hotel name") {
        try {
            targetHotelName = await this.sheets.getSpreadsheetTitle(cfg.spreadsheetId);
            targetHotelName = targetHotelName.replace(/FAQ/i, "").replace(/Audit/i, "").trim();
            console.log(`🏨 Detected Hotel Name: "${targetHotelName}"`);
        } catch {
            targetHotelName = "The Hotel";
        }
    }

    let sourceTab = cfg.sourceTab && cfg.sourceTab.trim() ? cfg.sourceTab.trim() : undefined;
    if (!sourceTab) sourceTab = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
    
    // קריאת הנתונים (כולל כותרות בשורה 1)
    const rows = await this.sheets.readValues(cfg.spreadsheetId, `${sourceTab}!A:Z`);
    const h = rows.length;
    const dataRowCount = Math.max(0, h - 1);
    
    const qColIdx = 1; 
    const ansIdx  = this.letterToIndex(answerCol);
    const cmtIdx  = this.letterToIndex(commentCol);

    const itemsForRewrite: any[] = [];
    const itemsForGrammar: any[] = [];
    const allRowsForNameInjection: any[] = [];

    for (let r = 2; r <= h; r++) {
      const row = rows[r - 1] ?? [];
      const question       = (row[qColIdx] ?? "").toString().trim();
      const originalAnswer = (row[ansIdx]  ?? "").toString().trim();
      const clientComment  = (row[cmtIdx]  ?? "").toString().trim();

      if (clientComment) {
        itemsForRewrite.push({ rowIndex1Based: r, question, originalAnswer, clientComment });
      }
      
      // ✅ בדיקת דקדוק נשמרת כמו שהייתה
      if (enableGrammar && originalAnswer && !clientComment) {
        itemsForGrammar.push({ rowIndex1Based: r, question, originalAnswer });
      }
      
      if (originalAnswer || clientComment) {
          allRowsForNameInjection.push({ 
              rowIndex1Based: r, 
              question, 
              currentAnswer: clientComment ? `(Pending Rewrite: ${clientComment})` : originalAnswer 
          });
      }
    }

    // AI
    const prompt = this.buildPromptCombined(itemsForRewrite, itemsForGrammar, allRowsForNameInjection, enableGrammar, targetHotelName);
    const json   = await this.agent.run(prompt);
    const out    = this.parseCombinedOutputOrThrow(json);

    // === מיפוי התוצאות ===
    
    // 1. הכנת הנתונים לכתיבה רגילה (F + G)
    const rewriteMap = new Map<number, string>();
    for (const r of out.rewrite) rewriteMap.set(r.rowIndex1Based, r.final_answer);

    const grammarMap = new Map<number, string>();
    if (enableGrammar) {
        for (const g of out.grammar) grammarMap.set(g.rowIndex1Based, g.fixed);
    }

    // 2. הכנת הנתונים לעדכון עמודה C (שם המלון)
    const nameInjectionMap = new Map<number, string>();
    for (const item of out.hotel_name_inject) {
        nameInjectionMap.set(item.rowIndex1Based, item.answer_with_name);
    }

    // === בניית העמודות לכתיבה ===

    const rewriteValues: string[] = [];      // F
    const grammarValues: string[] = [];      // G
    const nameStatusValues: string[] = [];   // I (Status)
    const newOriginalAnswers: string[] = []; // C (Updated Original)

    for (let i = 0; i < dataRowCount; i++) {
      const sheetRow = i + 2;
      
      // --- טיפול בעמודה C (המקורית) ---
      // אנו לוקחים את הערך הקיים, אלא אם ה-AI החליט להזריק שם
      const existingAnswer = (rows[sheetRow - 1] && rows[sheetRow - 1][ansIdx]) 
                             ? rows[sheetRow - 1][ansIdx].toString() 
                             : "";
      
      if (nameInjectionMap.has(sheetRow)) {
          // דריסה! ה-AI הוסיף שם, נעדכן את עמודה C
          newOriginalAnswers.push(nameInjectionMap.get(sheetRow)!);
          nameStatusValues.push("✅ Name Added to Original"); // סימון בעמודה I
      } else {
          // שמירה על הקיים
          newOriginalAnswers.push(existingAnswer);
          nameStatusValues.push(""); // אין סימון
      }

      // --- טיפול בשאר העמודות (רגיל) ---
      rewriteValues.push(rewriteMap.get(sheetRow) ?? "");
      grammarValues.push(grammarMap.get(sheetRow) ?? "");
    }

    // ביצוע הכתיבה
    
    // 1. עדכון עמודה C (התשובה המקורית)
    // הערה: כדי לא לדרוס את הכותרת של C, אנו לוקחים אותה מהקובץ הקיים
    const originalHeader = (rows[0] && rows[0][ansIdx]) ? rows[0][ansIdx].toString() : "Answer";
    await this.sheets.writeColumn(cfg.spreadsheetId, answerCol, originalHeader, newOriginalAnswers);

    // 2. כתיבת עמודת הסטטוס (I)
    await this.sheets.writeColumn(cfg.spreadsheetId, hotelNameCol, hotelNameHeader, nameStatusValues);

    // 3. כתיבת עמודת השכתוב (F)
    await this.sheets.writeColumn(cfg.spreadsheetId, targetCol, header, rewriteValues);

    // 4. כתיבת עמודת דקדוק (G)
    if (enableGrammar) {
        await this.sheets.writeColumn(cfg.spreadsheetId, grammarFixCol, grammarFixHeader, grammarValues);
    }

    // עיצוב
    await this.sheets.formatSheetLikeFAQ(cfg.spreadsheetId, sourceTab!);

    console.log(`✅ Completed for "${targetHotelName}":
    - Updated Original Answers (Col ${answerCol}) with ${out.hotel_name_inject.length} name injections.
    - Marked Status in Col ${hotelNameCol}.
    - Standard Rewrite (Col ${targetCol}) & Grammar (Col ${grammarFixCol}) preserved.`);
  }
}