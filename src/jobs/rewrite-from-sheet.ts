// src/jobs/rewrite-from-sheet.ts
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

type RewriteFromSheetConfig = {
  spreadsheetId: string;
  sourceTab?: string;

  // Master columns
  categoryCol?: string;   // default "A"
  questionCol?: string;   // default "B"
  answerCol?: string;     // default "C"
  commentCol?: string;    // default "D" (Corrected Answer)

  targetCol?: string;     // default "F" (Final Answer)
  header?: string;        // default "Agent Final Answer"

  // NEW: question suitability + mismatch note
  questionFixCol?: string;       // default "G"
  questionFixHeader?: string;    // default "Question Correction"
  qaNoteCol?: string;            // default "H"
  qaNoteHeader?: string;         // default "QA Note"

  checkOriginalGrammar?: boolean; // default: false (נשאר)
  
  hotelNameCol?: string;          // default: "I"
  hotelNameHeader?: string;       // default: "Hotel Name Status"
  hotelName?: string;
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
  itemsForRewrite: Array<{ rowIndex1Based: number; category: string; question: string; originalAnswer: string; clientComment: string }>,
  itemsForQA: Array<{ rowIndex1Based: number; category: string; question: string; originalAnswer: string }>,
  allRowsForNameInjection: Array<{ rowIndex1Based: number; question: string; currentAnswer: string }>,
  enableGrammar: boolean,
  hotelName: string
) {
  return `Hotel FAQ Combined - Rewrite + QA + Question Check + Hotel Name Injection

ROLE
You are a senior hospitality copywriter and a precise QA editor.
Target Hotel Name: "${hotelName}"

INPUT DATA
JSON items include: rowIndex1Based, category, question, originalAnswer, clientComment.

YOUR TASK HAS 5 PARTS:
A) REWRITE: For rows with a meaningful clientComment, produce final, publication-ready answers.
B) QA (LIGHT-TOUCH): For rows without a meaningful clientComment, fix answers only if needed.
C) NAME INJECTION: Ensure the hotel name ("${hotelName}") appears in 7-10 answers total.
D) QUESTION FIX: If the question is not suitable, propose a corrected question (write it to column G).
E) QA NOTE: If the question and answer are mismatched, write a short note (write it to column H).

========================
SECTION A - REWRITE (APPLY CLIENT COMMENT AS PREFERRED)
========================
Rules:
- Language: same as originalAnswer (English or Hebrew).
Prioritize clientComment over originalAnswer if they conflict.
If the clientComment is already suitable for publication, keep it unchanged.
- If clientComment is effectively "correct", "ok", "yes", "no change", "looks good" or empty -> do NOT rewrite; handle in QA instead.
- Stick to facts. Do not invent amenities.
- Length: Prefer 10-16 words, BUT clientComment requirements override length.
  If needed to include all comment details, you may exceed 16 words.
- Tone: professional, welcoming, luxury hospitality.
- If the answer is Yes/No:
  English: start with "Yes, ...", "No, ...", or "Currently, ...".
  Hebrew: start with "כן, ...", "לא, ...", or "נכון לעכשיו, ...".

  Client Comment Preservation Rule:
If the clientComment already:
- correctly answers the question
- follows the FAQ tone
- has proper grammar
- complies with the length and style rules

Then DO NOT rewrite it.
Return the clientComment exactly as written.

Only rewrite when:
- the comment contains grammar issues
- the comment is unclear
- the comment does not fully answer the question
- the comment violates the FAQ style rules.

Client Comment is the Source of Truth (Strict):
- Treat clientComment as a REQUIREMENTS LIST.
- Every concrete instruction in clientComment must be reflected in the final answer.
- Do not drop small details (numbers, times, conditions, exceptions, wording like "only", "except", "must", "not available", etc.).
- If clientComment contradicts originalAnswer, ALWAYS follow clientComment.
- If you cannot comply with a detail because it is unclear, keep the detail and add "[INFO NEEDED]" at the end.

========================
SECTION B - QA (LIGHT-TOUCH)
========================
Goal: only fix when truly needed.
Return "" (empty string) if no fix is needed.

Fix ONLY if:
1) The answer does not address the question.
2) Grammar/spelling errors exist (not stylistic).
3) Tone is internal/staff-only.
4) Incomplete/fragmented sentence.
5) Contains tags like [VERIFY] -> keep but add [INFO NEEDED].
6) Says "info not available" -> use [INFO NEEDED].
7) Logic: remove wrong "Yes/No" openings if they contradict the details.
8) The answer starts with Yes/No but the question is not a Yes/No question - remove the Yes/No opening.
9( dont use — em dash; 

========================
SECTION D - QUESTION FIX (COLUMN G)
========================
Goal: fix the question ONLY if it is not suitable for a hotel FAQ.
Examples of "not suitable":
- Not a real question / unclear wording
- Not about the hotel guest experience (internal ops)
- Duplicated/misalabeled category context (question clearly about different topic)
- Includes wrong hotel name / wrong property
Return "" if the question is acceptable.
If you propose a fix:
- Keep language consistent with the question.
- Keep it short and clear, as a real FAQ question.

========================
SECTION E - QA NOTE (COLUMN H)
========================
Write a short note ONLY if there is a mismatch between question and answer.
Examples:
- Answer discusses different topic than the question
- Answer partially answers but misses key requirement
- Answer contradicts the question framing (Yes/No inconsistency)
Return "" if no mismatch.
Keep note concise (max ~12 words).

========================
SECTION C - HOTEL NAME INJECTION (CRITICAL)
========================
Goal: name "${hotelName}" must appear in exactly 7-10 answers across the entire dataset.
Select rows where it fits naturally.
Output those rows in "hotel_name_inject".

========================
OUTPUT FORMAT (STRICT JSON)
========================
Return ONLY valid JSON:
{
  "rewrite": [
    {"rowIndex1Based": <number>, "final_answer": "<string>"}
  ],
  "qa": [
    {"rowIndex1Based": <number>, "fixed": "<string or empty>"}
  ],
  "question_fix": [
    {"rowIndex1Based": <number>, "fixed_question": "<string or empty>"}
  ],
  "qa_note": [
    {"rowIndex1Based": <number>, "note": "<string or empty>"}
  ],
  "hotel_name_inject": [
    {"rowIndex1Based": <number>, "answer_with_name": "<string>"}
  ]
}

INPUT
${JSON.stringify(
  {
    rewrite: itemsForRewrite,
    qa: enableGrammar ? itemsForQA : [],
    name_candidates: allRowsForNameInjection
  },
  null,
  2
)}`;
  }

 private parseCombinedOutputOrThrow(text: string): {
  rewrite: Array<{ rowIndex1Based: number; final_answer: string }>;
  qa: Array<{ rowIndex1Based: number; fixed: string }>;
  question_fix: Array<{ rowIndex1Based: number; fixed_question: string }>;
  qa_note: Array<{ rowIndex1Based: number; note: string }>;
  hotel_name_inject: Array<{ rowIndex1Based: number; answer_with_name: string }>;
} {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  const slice = first >= 0 && last > first ? text.slice(first, last + 1) : text;

  let obj: any;
  try {
    obj = JSON.parse(slice);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  obj.rewrite = Array.isArray(obj.rewrite) ? obj.rewrite : [];
  obj.qa = Array.isArray(obj.qa) ? obj.qa : [];
  obj.question_fix = Array.isArray(obj.question_fix) ? obj.question_fix : [];
  obj.qa_note = Array.isArray(obj.qa_note) ? obj.qa_note : [];
  obj.hotel_name_inject = Array.isArray(obj.hotel_name_inject) ? obj.hotel_name_inject : [];

  return obj;
}

 async run(cfg: RewriteFromSheetConfig): Promise<void> {
  const categoryCol = cfg.categoryCol ?? "A";
  const questionCol = cfg.questionCol ?? "B";
  const answerCol = cfg.answerCol ?? "C";
  const commentCol = cfg.commentCol ?? "D";

  const targetCol = cfg.targetCol ?? "F";
  const header = cfg.header ?? "Agent Final Answer";

  const questionFixCol = cfg.questionFixCol ?? "G";
  const questionFixHeader = cfg.questionFixHeader ?? "Question Correction";

  const qaNoteCol = cfg.qaNoteCol ?? "H";
  const qaNoteHeader = cfg.qaNoteHeader ?? "QA Note";

  const enableGrammar = cfg.checkOriginalGrammar ?? false;

  const hotelNameCol = cfg.hotelNameCol ?? "I";
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

  const catIdx = this.letterToIndex(categoryCol);
  const qIdx = this.letterToIndex(questionCol);
  const ansIdx = this.letterToIndex(answerCol);
  const cmtIdx = this.letterToIndex(commentCol);

    const itemsForRewrite: Array<{ rowIndex1Based: number; category: string; question: string; originalAnswer: string; clientComment: string }> = [];
const itemsForQA: Array<{ rowIndex1Based: number; category: string; question: string; originalAnswer: string }> = [];
const allRowsForNameInjection: Array<{ rowIndex1Based: number; question: string; currentAnswer: string }> = [];

for (let r = 2; r <= h; r++) {
  const row = rows[r - 1] ?? [];

  const category = (row[catIdx] ?? "").toString().trim();
  const question = (row[qIdx] ?? "").toString().trim();
  const originalAnswer = (row[ansIdx] ?? "").toString().trim();
  const clientComment = (row[cmtIdx] ?? "").toString().trim(); // Corrected Answer

  if (clientComment) {
    itemsForRewrite.push({ rowIndex1Based: r, category, question, originalAnswer, clientComment });
  }

  // QA only if enabled and no client comment
  if (enableGrammar && originalAnswer && !clientComment) {
    itemsForQA.push({ rowIndex1Based: r, category, question, originalAnswer });
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
  const prompt = this.buildPromptCombined(
  itemsForRewrite,
  itemsForQA,
  allRowsForNameInjection,
  enableGrammar,
  targetHotelName
);

const json = await this.agent.run(prompt);
const out = this.parseCombinedOutputOrThrow(json);

const rewriteMap = new Map<number, string>();
for (const r of out.rewrite) rewriteMap.set(r.rowIndex1Based, r.final_answer);

const qaMap = new Map<number, string>();
for (const q of out.qa) qaMap.set(q.rowIndex1Based, q.fixed);

const questionFixMap = new Map<number, string>();
for (const q of out.question_fix) questionFixMap.set(q.rowIndex1Based, q.fixed_question);

const qaNoteMap = new Map<number, string>();
for (const n of out.qa_note) qaNoteMap.set(n.rowIndex1Based, n.note);

const nameInjectionMap = new Map<number, string>();
for (const item of out.hotel_name_inject) {
  nameInjectionMap.set(item.rowIndex1Based, item.answer_with_name);
}

    // === בניית העמודות לכתיבה ===

  const finalAnswerValues: string[] = [];   // F
const questionFixValues: string[] = [];   // G
const qaNoteValues: string[] = [];        // H

const nameStatusValues: string[] = [];    // I
const newOriginalAnswers: string[] = [];  // C

for (let i = 0; i < dataRowCount; i++) {
  const sheetRow = i + 2;

  // Column C - keep existing unless name injected
  const existingAnswer =
    rows[sheetRow - 1] && rows[sheetRow - 1][ansIdx]
      ? rows[sheetRow - 1][ansIdx].toString()
      : "";

  if (nameInjectionMap.has(sheetRow)) {
    newOriginalAnswers.push(nameInjectionMap.get(sheetRow)!);
    nameStatusValues.push("✅ Name Added to Original");
  } else {
    newOriginalAnswers.push(existingAnswer);
    nameStatusValues.push("");
  }

  // Column F - Final Answer: rewrite has priority, then QA fix, else empty
  const rewritten = rewriteMap.get(sheetRow) ?? "";
  const qaFixed = qaMap.get(sheetRow) ?? "";
  finalAnswerValues.push(rewritten || qaFixed || "");

  // Column G - Question correction
  questionFixValues.push(questionFixMap.get(sheetRow) ?? "");

  // Column H - QA mismatch note
  qaNoteValues.push(qaNoteMap.get(sheetRow) ?? "");
}

    // ביצוע הכתיבה
    
    // 1. עדכון עמודה C (התשובה המקורית)
    // הערה: כדי לא לדרוס את הכותרת של C, אנו לוקחים אותה מהקובץ הקיים
   const originalHeader =
  rows[0] && rows[0][ansIdx] ? rows[0][ansIdx].toString() : "Answer";

// 1) Update column C (original answer) only for name injection rows
await this.sheets.writeColumn(cfg.spreadsheetId, answerCol, originalHeader, newOriginalAnswers);

// 2) Status in column I
await this.sheets.writeColumn(cfg.spreadsheetId, hotelNameCol, hotelNameHeader, nameStatusValues);

// 3) Final Answer in column F
await this.sheets.writeColumn(cfg.spreadsheetId, targetCol, header, finalAnswerValues);

// 4) Question Fix in column G
await this.sheets.writeColumn(cfg.spreadsheetId, questionFixCol, questionFixHeader, questionFixValues);

// 5) QA Note in column H
await this.sheets.writeColumn(cfg.spreadsheetId, qaNoteCol, qaNoteHeader, qaNoteValues);

// format
await this.sheets.formatSheetLikeFAQ(cfg.spreadsheetId, sourceTab!);

console.log(`✅ Completed for "${targetHotelName}":
- Updated Original Answers (Col ${answerCol}) with ${out.hotel_name_inject.length} name injections.
- Marked Status in Col ${hotelNameCol}.
- Final Answer written to Col ${targetCol}.
- Question correction written to Col ${questionFixCol}.
- QA note written to Col ${qaNoteCol}.`);

  }
}