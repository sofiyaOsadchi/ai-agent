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
You are a senior hospitality copywriter and precise proofreader.
Target Hotel Name: "${hotelName}"

INPUT DATA
The input is a JSON with items containing: rowIndex1Based, question, originalAnswer, clientComment.

YOUR TASK HAS 3 PARTS:
A) REWRITE: For rows with client comments, produce final, publication-ready answers.
B) GRAMMAR QA: For rows without comments, perform a minimal QA check (fix only if needed).
C) NAME INJECTION: Ensure the hotel name ("${hotelName}") appears in 7-10 answers total.

========================
SECTION A — REWRITE (APPLY COMMENTS)
========================
**Goal:** Rewrite answers based on "clientComment".

STYLE & RULES (STRICT):
- Language: Write in the SAME language as "originalAnswer" (English or Hebrew).
  • If Hebrew: Write in Hebrew (RTL), formal third-person hotel tone, no transliteration/niqqud.
- Grammar/Spelling: Perfect grammar required.
- Clarity:
  • English Yes/No: Begin with "Yes, …", "No, …", or "Currently, …".
  • Hebrew Yes/No: Begin with "כן, …", "לא, …", or "נכון לעכשיו, …".
  • Otherwise, open with a clear factual statement.
- Length: 10–16 words per answer (fully informative, no fluff).
- Content:
  • Prioritize the client comment. If it contradicts the original, follow the comment.
  • If the comment says "correct" or "yes" or is empty -> Do not rewrite (treat as QA).
  • Stick to facts. Do not invent amenities.
  • If the comment sents to the website -> Try to find the answer or note it matches the web.
- Tone: Professional, welcoming, luxury hospitality.
- **Hotel Name Policy:** generally use "the hotel" or "we", UNLESS the row is selected for Name Injection (see Section C).

========================
SECTION B — BASIC QA CHECK (LIGHT-TOUCH)
========================
**Goal:** Check rows that do NOT have comments.

RULES (Apply only when truly needed):
- Return "" (empty string) if the original answer is acceptable.
- Apply a correction ONLY if:
  1. The answer does not address the question.
  2. There are grammatical/spelling errors (not stylistic).
  3. The tone is internal/staff-only (not suitable for public).
  4. The sentence is incomplete or fragmented.
  5. The original answer includes tags like [VERIFY] -> Flag it.
  6. The original says "info not available" -> Flag as [INFO NEEDED].
  7. Logic/Consistency: Remove "Yes" or "No" openings if they contradict the specific details or only partially answer the question.
  (Example: Q: "Is X in all rooms?", A: "Yes, in suites only" -> FIX: Remove "Yes", start directly with "Suites feature...").

========================
SECTION C — HOTEL NAME INJECTION (CRITICAL)
========================
**Goal:** The client MANDATES that the hotel name "${hotelName}" must appear in 7-10 answers across the entire dataset.

INSTRUCTIONS:
1. Review ALL output candidates (from Section A rewrites AND Section B original/fixed answers).
2. Select exactly 7 to 10 rows where inserting the name "${hotelName}" fits **naturally** and maintains the flow.
   - You can choose rows that were rewritten OR rows that were just QA'd.
3. Create the **Final Version** of that sentence including the hotel name.
   - Example: Instead of "The hotel offers...", write "The ${hotelName} offers...".
   - The name must match the language of the row (English/Hebrew).
4. Output these specific rows in the "hotel_name_inject" array.

========================
OUTPUT FORMAT (STRICT JSON)
========================
Return ONLY valid JSON (no markdown):
{
  "rewrite": [ 
    {"rowIndex1Based": <number>, "final_answer": "<string>"}, ... 
  ],
  "grammar": [ 
    {"rowIndex1Based": <number>, "fixed": "<string or empty>"}, ... 
  ],
  "hotel_name_inject": [ 
    {"rowIndex1Based": <number>, "answer_with_name": "<string>"}, ... 
  ]
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