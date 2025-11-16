// src/jobs/rewrite-from-sheet.ts
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

type RewriteFromSheetConfig = {
  spreadsheetId: string;
  sourceTab?: string;
  commentCol?: string;  // default "E"  (hotel comments)
  answerCol?: string;   // default "C"  (original answer)
  targetCol?: string;   // default "F"  (final answer column)
  header?: string;      // default "Agent Final Answer"

  checkOriginalGrammar?: boolean;      // default: false
  grammarFixCol?: string;              // default: "G"
  grammarFixHeader?: string;           // default: "Answer Grammar Fix"
};

type RowItem = {
  rowIndex1Based: number;    // מספר שורה בגיליון (1-based)
  question: string;          // B
  originalAnswer: string;    // C (default)
  clientComment: string;     // E (default)
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
  enableGrammar: boolean
) {
  return `Hotel FAQ Combined – Rewrite (Client Comments) + Answer QA (Light-Touch) | Single Call

ROLE
You are a senior hospitality copywriter and precise proofreader. Your task has two parts:
A) Produce final, publication-ready answers for FAQ rows that include client comments (unchanged behavior).
B) For rows that have an original answer, perform a minimal QA check and correct only if truly needed.

========================
SECTION A — REWRITE (UNCHANGED – ORIGINAL SPEC)
========================
Hotel FAQ Rewrite Prompt | Apply Client Comments

ROLE
You are a senior hospitality copywriter. Your task: produce final, publication-ready answers for FAQ rows that include client comments.

INPUT FORMAT
You will receive a JSON with an array of items. Each item contains:
- rowIndex1Based: Google Sheets row number (1-based)
- question: the FAQ question (string)
- originalAnswer: the current answer from column C (string)
- clientComment: the hotel's comment/instruction from column E (string)

STYLE & RULES (STRICT)
- Language: write in the SAME language as "originalAnswer" (usually English). <<< CHANGED
  • If the originalAnswer is in Hebrew, write in Hebrew (RTL), formal third-person hotel tone, without transliteration or niqqud, and keep numbers/symbols as in the source. <<< ADDED
- Hotel Tone: Professional, welcoming, luxury hospitality language.
- Grammar/Spelling: Perfect English required. <<< CHANGED
  • If Hebrew: use correct Hebrew grammar, punctuation and formal style suitable for publication. <<< ADDED
- Clarity:
  • For Yes/No questions, begin with "Yes, …", "No, …", or "Currently, …". <<< (unchanged for English)
  • If Hebrew Yes/No: begin with "כן, …", "לא, …", או "נכון לעכשיו, …". <<< ADDED
  • Otherwise, open with a clear factual statement.
- Do NOT repeat the hotel name. Do NOT repeat the question.
- 10–12+ (max 16 unless the original answer or the comment are longer) words per answer; fully informative; no marketing fluff; third-person.
- Remove redundancy, fix grammar, ensure clarity and completeness.
- Never include links, sources, or markdown.
- VERY IMPORTANT - stick to the facts; do NOT invent details or amenities not mentioned in the original answer or comment.
- If the comment contradicts the original answer, prioritize the comment.
- If the comment is unclear or unimplementable, improve the original answer as best as possible considering the comment meaning.
- pay attention to the comments - if it refers to parcially to the original answer, try to read between the lines and understand what the client wants to change.
- pay attention to the question - make sure the final answer answers the question fully and correctly.
- dont overcomplicate - keep the answers simple and to the point. dont add unnecessary details or information. if the comment is written according to the rules - keep it as is.
- If the comment is not clear, or it sents to the wwbsite - try to search it on the official website of the hotel and find the answer there + note it was from the web
- If the comment is exactly the same as the original answer - dont add anything new - keep the cell empty.
- If the note says ״correct״ or ״yes״  - keep the original answer as is - dont add an answer.

OUTPUT FORMAT (STRICT)
Return ONLY valid JSON (no markdown):
{"rows":[{"rowIndex1Based": <number>, "final_answer": "<string>"}, ...]}

REQUIREMENTS
- Output one object per input item (same order).    
- Do NOT include rows without comments (they are not part of the input).
- "final_answer" must be a single string per row.

========================
SECTION B — ANSWER QA (LIGHT-TOUCH ON COLUMN C)
========================
BASIC QA CHECK (apply only when truly needed for original answers):
• Return "" (empty string) for "fixed" unless there is a clear and significant issue in the original answer.
• Apply a correction only if one or more of the following problems exist:
  1) The answer does not actually address the question (content-wise).
  2) The English contains grammatical or spelling errors — not stylistic preferences. 
  3) The tone or form are incorrect (not third-person, not hotel-professional, or includes the hotel name).
  4) The sentence is unclear or incomplete — fragmented, too short, or missing key meaning (generally 6–24 words).
  6) If the answer sounds like an internal note by hotel staff and is not appropriate for public website publishing.
  7) If there is already a client comment in column E and a final rewrite was added, do not add anything to grammar fix unless the new final answer itself needs a true correction.
  8) If the original answer includes a tag like [VERIFY] — just flag it with [VERIFY] in the "fixed" field.
  9) If the original answer states - currently the information is not available - flag it with [INFO NEEDED] in the "fixed" field.
  10) If anything sounds really strange and you believe need to be flagged - you can flag it with the reason and offer correction.
  11) if the question contains grammatical errors or spelling mistakes - you can fix them in the nect cell with the corrected question.

• If none of the above apply, return "" (leave unchanged).
• If any of the above apply, return ONE corrected, publication-ready sentence that fixes only the true error(s).
  • If English source → corrected English. If Hebrew source → corrected Hebrew (RTL, formal). <<< ADDED
• Do not rewrite or rephrase text that is already correct.
• Do not add new information. If information is missing or unclear, return "" (do not attempt to invent or guess).

========================
GLOBAL OUTPUT (STRICT – SINGLE JSON OBJECT)
========================
Return ONLY valid JSON (no markdown) with two arrays:
{
  "rewrite":[{"rowIndex1Based": <number>, "final_answer":"<string>"}...],
  "grammar":[{"rowIndex1Based": <number>, "fixed":"<string>"}...]
}

INPUT
${JSON.stringify({
  rewrite: itemsForRewrite,
  grammar: enableGrammar ? itemsForGrammar : []
}, null, 2)}`;
}

private parseCombinedOutputOrThrow(text: string): {
  rewrite: Array<{ rowIndex1Based: number; final_answer: string }>;
  grammar: Array<{ rowIndex1Based: number; fixed: string }>;
} {
  const first = text.indexOf("{");
  const last  = text.lastIndexOf("}");
  const slice = (first >= 0 && last > first) ? text.slice(first, last + 1) : text;
  let obj: any;
  try { obj = JSON.parse(slice); } catch {
    throw new Error("Model did not return valid JSON for combined rewrite+grammar output");
  }
  if (!obj || !Array.isArray(obj.rewrite) || !Array.isArray(obj.grammar)) {
    throw new Error("Combined JSON must contain 'rewrite' and 'grammar' arrays");
  }
  return obj;
}


// src/jobs/rewrite-from-sheet.ts
async run(cfg: RewriteFromSheetConfig): Promise<void> {
  const commentCol = cfg.commentCol ?? "E";
  const answerCol  = cfg.answerCol  ?? "C";
  const targetCol  = cfg.targetCol  ?? "F";
  const header     = cfg.header     ?? "Agent Final Answer";

  const enableGrammar     = cfg.checkOriginalGrammar ?? false;
  const grammarFixCol     = cfg.grammarFixCol ?? "G";
  const grammarFixHeader  = cfg.grammarFixHeader ?? "Answer Grammar Fix";

  // === קביעת טאב מקור – כרגיל (הקוד שלך ללא שינוי) ===
  let sourceTab = cfg.sourceTab && cfg.sourceTab.trim() ? cfg.sourceTab.trim() : undefined;
  if (!sourceTab) {
    sourceTab = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
  } else {
    try { await this.sheets.getSheetIdByTitle(cfg.spreadsheetId, sourceTab); }
    catch {
      sourceTab = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
    }
  }

  // === קריאה לכל הדאטה A:Z – כרגיל ===
  const rows = await this.sheets.readValues(cfg.spreadsheetId, `${sourceTab}!A:Z`);
  if (rows.length === 0) throw new Error(`Source tab "${sourceTab}" is empty`);

  const h = rows.length;
  const dataRowCount = Math.max(0, h - 1);
  const qColIdx = 1; // B
  const ansIdx  = this.letterToIndex(answerCol);
  const cmtIdx  = this.letterToIndex(commentCol);

  // 1) איסוף לשכתוב (יש הערת לקוח)
  const itemsForRewrite: Array<{ rowIndex1Based: number; question: string; originalAnswer: string; clientComment: string }> = [];
  // 2) איסוף לגרמר (כל שורה עם תשובה מקורית)
  const itemsForGrammar: Array<{ rowIndex1Based: number; question: string; originalAnswer: string }> = [];

  for (let r = 2; r <= h; r++) {
    const row = rows[r - 1] ?? [];
    const question       = (row[qColIdx] ?? "").toString().trim();
    const originalAnswer = (row[ansIdx]  ?? "").toString().trim();
    const clientComment  = (row[cmtIdx]  ?? "").toString().trim();

    if (clientComment) {
      itemsForRewrite.push({ rowIndex1Based: r, question, originalAnswer, clientComment });
    }
    if (enableGrammar && originalAnswer) {
      itemsForGrammar.push({ rowIndex1Based: r, question, originalAnswer });
    }
  }

  // ❗ קריאה אחת ל-GPT – פרומפט משולב
  const prompt = this.buildPromptCombined(itemsForRewrite, itemsForGrammar, enableGrammar);
  const json   = await this.agent.run(prompt);   // "o3" ברירת מחדל אצלך
  const out    = this.parseCombinedOutputOrThrow(json);

  // כתיבה לעמודת היעד (שכתוב) – רק לשורות שהיו בהן הערות
  const rewriteMap = new Map<number, string>();
  for (const r of out.rewrite) rewriteMap.set(r.rowIndex1Based, r.final_answer);
  const rewriteValues: string[] = [];
  for (let i = 0; i < dataRowCount; i++) {
    const sheetRow = i + 2;
    rewriteValues.push(rewriteMap.get(sheetRow) ?? "");
  }
  await this.sheets.writeColumn(cfg.spreadsheetId, targetCol, header, rewriteValues);

  // כתיבה לעמודת תיקון דקדוק (אם מופעל)
  if (enableGrammar) {
    const grammarMap = new Map<number, string>();
    for (const g of out.grammar) grammarMap.set(g.rowIndex1Based, g.fixed);

    const grammarValues: string[] = [];
    for (let i = 0; i < dataRowCount; i++) {
      const sheetRow = i + 2;
      // אם "fixed" ריק → נשאיר תא ריק (משמע תשובה מקורית מושלמת)
      grammarValues.push((grammarMap.get(sheetRow) ?? "").trim());
    }
    await this.sheets.writeColumn(cfg.spreadsheetId, grammarFixCol, grammarFixHeader, grammarValues);
  }

  // עיצוב (הפונקציה שלך)
  await this.sheets.formatSheetLikeFAQ(cfg.spreadsheetId, sourceTab!);

  console.log(`✅ Rewrite → ${targetCol} | Grammar(${enableGrammar ? "on" : "off"}) → ${grammarFixCol}`);
}
}