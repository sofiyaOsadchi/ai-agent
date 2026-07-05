// src/jobs/faq-from-scratch.ts
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

const FAQ_QUESTIONS_MODEL = process.env.FAQ_QUESTIONS_MODEL || "o3";
const FAQ_ANSWERS_MODEL = process.env.FAQ_ANSWERS_MODEL || "o3";
const FAQ_QA_MODEL = process.env.FAQ_QA_MODEL || "o3";
const FAQ_FINAL_POLISH_MODEL = process.env.FAQ_FINAL_POLISH_MODEL || "gpt-5.5";
const FAQ_HEADER = ["Category", "Question", "Answer", "Frequency Level"];

function parseTsvRows(tsv: string): string[][] {
  return String(tsv || "")
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split("\t"));
}

function isNonEmptyRow(row: string[]): boolean {
  return row.some((cell) => String(cell || "").trim() !== "");
}

function isFaqHeaderRow(row: string[]): boolean {
  const normalized = row.map((cell) => String(cell || "").trim().toLowerCase());
  return (
    normalized[0] === "category" &&
    normalized[1] === "question" &&
    normalized[2] === "answer"
  );
}

function normalizeFaqRows(tsv: string): { headerRow: string[]; dataRows: string[][] } {
  const rows = parseTsvRows(stripOptionalCodeFence(tsv)).filter(isNonEmptyRow);
  if (rows.length === 0) {
    return { headerRow: FAQ_HEADER, dataRows: [] };
  }

  if (isFaqHeaderRow(rows[0])) {
    return { headerRow: FAQ_HEADER, dataRows: rows.slice(1) };
  }

  return { headerRow: FAQ_HEADER, dataRows: rows };
}

function serializeTsvRows(headerRow: string[], dataRows: string[][]): string {
  return [headerRow, ...dataRows].map((row) => row.join("\t")).join("\n");
}

function normalizeForIncludes(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function questionHasHotelName(question: string, hotelName: string): boolean {
  return normalizeForIncludes(question).includes(normalizeForIncludes(hotelName));
}

function ensureQuestionHasHotelName(question: string, hotelName: string): string {
  const trimmed = String(question || "").trim();
  const hotel = hotelName.trim();
  if (!trimmed || !hotel || questionHasHotelName(trimmed, hotel)) return trimmed;

  let next = trimmed
    .replace(/\bthe hotel\b/gi, hotel)
    .replace(/\bthis hotel\b/gi, hotel)
    .replace(/\bthe property\b/gi, hotel);

  if (questionHasHotelName(next, hotel)) return next;

  const withoutQuestionMark = next.replace(/\?+$/, "").trim();

  const doesEveryRoomMatch = withoutQuestionMark.match(/^does\s+((?:every|each|all)\s+(?:guest\s+)?rooms?)\s+(.+)$/i);
  if (doesEveryRoomMatch) {
    return `Does ${doesEveryRoomMatch[1]} at ${hotel} ${doesEveryRoomMatch[2]}?`;
  }

  const doRoomsMatch = withoutQuestionMark.match(/^do\s+((?:all|any|some)\s+(?:guest\s+)?rooms?)\s+(.+)$/i);
  if (doRoomsMatch) {
    return `Do ${doRoomsMatch[1]} at ${hotel} ${doRoomsMatch[2]}?`;
  }

  if (/^does\s+/i.test(withoutQuestionMark)) {
    return `${withoutQuestionMark} at ${hotel}?`;
  }

  if (/^is\s+there\s+/i.test(withoutQuestionMark)) {
    return `${withoutQuestionMark} at ${hotel}?`;
  }

  if (/^are\s+there\s+/i.test(withoutQuestionMark)) {
    return `${withoutQuestionMark} at ${hotel}?`;
  }

  if (/^can\s+guests\s+/i.test(withoutQuestionMark)) {
    return withoutQuestionMark.replace(/^can\s+guests\s+/i, `Can guests at ${hotel} `) + "?";
  }

  if (/^what\s+(?:are|is)\s+/i.test(withoutQuestionMark)) {
    return `${withoutQuestionMark} at ${hotel}?`;
  }

  if (/^how\s+(?:far|long|close|much)\s+/i.test(withoutQuestionMark)) {
    return `${withoutQuestionMark} from ${hotel}?`;
  }

  return `${withoutQuestionMark} at ${hotel}?`;
}

function ensureQuestionsHaveHotelName(dataRows: string[][], hotelName: string): { rows: string[][]; changed: number } {
  let changed = 0;
  const rows = dataRows.map((row) => {
    const currentQuestion = row[1] ?? "";
    const fixedQuestion = ensureQuestionHasHotelName(currentQuestion, hotelName);
    if (fixedQuestion !== currentQuestion) {
      changed++;
      const nextRow = [...row];
      nextRow[1] = fixedQuestion;
      return nextRow;
    }
    return row;
  });
  return { rows, changed };
}

function dataRowCountFromTsv(tsv: string): number {
  return normalizeFaqRows(tsv).dataRows.length;
}

function buildNumberedQaInput(tsv: string): string {
  const { dataRows } = normalizeFaqRows(tsv);
  if (dataRows.length === 0) return "Row\tCategory\tQuestion\tAnswer\tFrequency Level";

  return [
    "Row\tCategory\tQuestion\tAnswer\tFrequency Level",
    ...dataRows.map((row, idx) => {
      const category = row[0] ?? "";
      const question = row[1] ?? "";
      const answer = row[2] ?? "";
      const frequency = row[3] ?? "";
      return [String(idx + 1), category, question, answer, frequency].join("\t");
    }),
  ].join("\n");
}

function stripOptionalCodeFence(text: string): string {
  return String(text || "")
    .trim()
    .replace(/^```(?:tsv|csv|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function looksLikeFaqTsv(tsv: string): boolean {
  const rows = parseTsvRows(stripOptionalCodeFence(tsv)).filter(isNonEmptyRow);
  if (rows.length === 0) return false;
  if (isFaqHeaderRow(rows[0])) return rows.length >= 2;
  return rows[0].length >= 4 && rows[0].some((cell) => String(cell || "").trim().includes("?"));
}

function parseNumberedQaColumn(text: string, expectedRows: number): string[] {
  const normalized = stripOptionalCodeFence(text);
  const raw = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (raw.length === 0) return [];

  const dataIdx = raw.findIndex((line) => line.toUpperCase() === "DATA");
  let body = dataIdx !== -1 ? raw.slice(dataIdx + 1) : raw;

  body = body.filter((line) => {
    const upper = line.toUpperCase();
    return upper !== "HEADER" && !/^ROW\s*(\t|\||,|$)/i.test(line);
  });

  const mapped = Array.from({ length: expectedRows }, () => "");
  const sequential: string[] = [];
  let sawNumbered = false;

  for (const line of body) {
    const tabParts = line.split("\t");
    if (tabParts.length >= 2 && /^(?:Q)?\d+$/i.test(tabParts[0].trim())) {
      const idx = Number(tabParts[0].trim().replace(/^Q/i, "")) - 1;
      if (idx >= 0 && idx < expectedRows) {
        mapped[idx] = tabParts.slice(1).join(" ").trim();
        sawNumbered = true;
        continue;
      }
    }

    const match = line.match(/^(?:Q)?(\d+)\s*(?:\||[.:)\]-]|–|—)\s*(.+)$/i);
    if (match) {
      const idx = Number(match[1]) - 1;
      if (idx >= 0 && idx < expectedRows) {
        mapped[idx] = match[2].trim();
        sawNumbered = true;
        continue;
      }
    }

    sequential.push(line);
  }

  if (sawNumbered) return mapped;

  while (sequential.length < expectedRows) sequential.push("");
  return sequential.slice(0, expectedRows);
}

function normalizeQaCells(cells: string[], columnCount: number): string[] {
  const cleaned = cells.map((cell) => String(cell || "").replace(/\t/g, " ").trim());
  const result = Array.from({ length: columnCount }, () => "");
  for (let i = 0; i < columnCount; i++) {
    result[i] = cleaned[i] ?? "";
  }
  if (cleaned.length > columnCount) {
    result[columnCount - 1] = cleaned.slice(columnCount - 1).join(" ").trim();
  }
  return result;
}

function parseNumberedQaColumns(text: string, expectedRows: number, columnCount: number): string[][] {
  const normalized = stripOptionalCodeFence(text);
  const raw = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const emptyRow = () => Array.from({ length: columnCount }, () => "");
  if (raw.length === 0) return Array.from({ length: expectedRows }, emptyRow);

  const dataIdx = raw.findIndex((line) => line.toUpperCase() === "DATA");
  let body = dataIdx !== -1 ? raw.slice(dataIdx + 1) : raw;

  body = body.filter((line) => {
    const upper = line.toUpperCase();
    return upper !== "HEADER" && !/^ROW\s*(\t|\||,|$)/i.test(line);
  });

  const mapped = Array.from({ length: expectedRows }, emptyRow);
  const sequential: string[][] = [];
  let sawNumbered = false;

  for (const line of body) {
    const tabParts = line.split("\t");
    if (tabParts.length >= 2 && /^(?:Q)?\d+$/i.test(tabParts[0].trim())) {
      const idx = Number(tabParts[0].trim().replace(/^Q/i, "")) - 1;
      if (idx >= 0 && idx < expectedRows) {
        mapped[idx] = normalizeQaCells(tabParts.slice(1), columnCount);
        sawNumbered = true;
        continue;
      }
    }

    const match = line.match(/^(?:Q)?(\d+)\s*(?:\||[.:)\]-]|–|—)\s*(.+)$/i);
    if (match) {
      const idx = Number(match[1]) - 1;
      if (idx >= 0 && idx < expectedRows) {
        mapped[idx] = normalizeQaCells([match[2]], columnCount);
        sawNumbered = true;
        continue;
      }
    }

    sequential.push(normalizeQaCells([line], columnCount));
  }

  if (sawNumbered) return mapped;

  while (sequential.length < expectedRows) sequential.push(emptyRow());
  return sequential.slice(0, expectedRows);
}

/**
 * שלב 1: הפרומפט ליצירת השאלות (ללא קיצורים!)
 */
export function createQuestionsPrompt(hotelName: string): string {
return `SEO & GEO FAQ Research Prompt for Leonardo Hotels | Questions
Hotel Name: ${hotelName}

1 Goal
Research and compile a strong hotel-verification FAQ question set for ${hotelName}.
The output is NOT final published copy. It will be sent to the hotel team for factual verification, completion, and refinement before publication.

The question set must help the hotel confirm the information guests actually need before booking or arrival.
It should combine:
• source-confirmed questions based on real property facts,
• strongly relevant guest-intent questions suggested by this hotel's location, facilities, and guest profile,
• a small number of high-value hotel-verification questions where a reasonable guest would expect an answer but the approved sources do not clearly answer it.

Do not overburden the hotel with too many missing-info questions. As a guideline, at least 80-85% of the questions should be source-confirmed or strongly source-indicated, and no more than 15-20% should be hotel-verification gap questions.

2 Approved data sources, in this order of authority
Use these only:
• Official Leonardo Hotels website – https://www.leonardo-hotels.com/
• Google Hotels / Google Travel – property knowledge panel
• Booking.com – official property profile only
• Expedia – official property profile only
• TripAdvisor – official property profile only, with NO user reviews

Do not use forums, blogs, social media, unverified travel guides, or guest reviews.
If a detail is absent from approved sources, include it only if it is a high-intent, hotel-specific verification question that the hotel should reasonably answer.
Do not include speculative questions that are generic, low-value, or likely irrelevant to this specific property.

3 Required columns, exact order
Category | Question | Frequency Level

4 Question rules
• Write in English, clear, natural guest-facing FAQ language.
• Prefer how real guests search and ask: "Is there parking...", "How close is...", "Are there sea-view rooms...", "Does ... have...".
• Avoid overly formal SEO-only wording when a simpler guest question sounds more natural.
• Questions must sound like real guest questions, not marketing copy. Do not add benefit or lifestyle phrases such as "for guests seeking...", "where guests can enjoy...", "for a relaxing stay", "for extra comfort", "for riverside strolls", "for a historic visit", "signature", "curated", "elegant", "plush", or "premium" inside the question.
• Ask the fact directly: write "Does ${hotelName} offer suites?" not "Does ${hotelName} offer suites for guests seeking extra space and comfort?"
• Marketing adjectives may appear in answers only when source-supported, but not in questions.
• Every question must be self-contained and understandable outside the table.
• Include the exact full hotel name "${hotelName}" in every question. There are no exceptions.
• Do not write generic replacements such as "the hotel" or "this property" in questions; use "${hotelName}".
• Use third person phrasing: "Does ${hotelName} offer...", "What time does ${hotelName}...", "How far is ${hotelName}..."
• Prioritize questions guests actually ask before booking or before arrival.
• Do not ask duplicate, near-duplicate, or answer-overlapping questions.
• Do not ask questions that can only be answered by guesswork unless they are high-value hotel-verification questions for the hotel team.
• Do not include a question just because it appears in the topic list below; include it only if relevant to this specific hotel.
• Characterize this hotel first internally: city, neighborhood, brand style, property type, key facilities, guest profile, transport context, and unusual amenities. Use that characterization to create property-specific questions.
• Expand from real facilities: if the hotel has pools, beach proximity, family rooms, restaurants, bars, parking, meeting rooms, spa/wellness, or airport/train access, ask the natural follow-up questions guests would ask about those features.
• Keep the final set useful and concise. A question should earn its place because it helps a guest decide, plan, or avoid confusion.

5 Brand-risk and usefulness filter
Some questions are legitimate even when the answer is "No" (for example pets, parking, pool, shuttle, accessibility, cribs), because guests truly need to know.
However, avoid questions that unnecessarily make the hotel look weak, highlight a negative edge case, or invite an unflattering answer when the topic is not a common guest need.

Before returning the table, silently review every question:
• Keep neutral high-intent policy questions even if the answer may be "No".
• Remove or replace questions that are too negative, too niche, too operational, or "set up" the hotel to look bad.
• Prefer neutral phrasing: "Are pets allowed..." rather than "Why does the hotel not allow pets...".
• Strip marketing intent phrases from questions. Prefer "Does the hotel have a bar?" over "Does the hotel have a bar where guests can enjoy signature cocktails?"
• Prefer guest-useful gaps over obscure gaps. A missing answer about pool towels may be useful; an exact motorway exit is usually too niche unless the official hotel directions emphasize it.

6 Categories
Use these categories only. Aim for 45-55 total questions, with 6-10 useful questions per category:
General Information
Accommodation & Room Services
Food & Beverage
Policies & Terms
Location & Transportation
Activities & Entertainment

7 Topic checklist by category
Use this as a relevance checklist, not as a mandatory list:
General Information – Wi-Fi, 24-hour front desk, check-in/check-out times, accessibility, multilingual staff, parking, family suitability, guest profile, conference facilities, brand/collection, sustainability certifications.
Accommodation & Room Services – room categories, sea-view or city-view rooms where relevant, air-conditioning/heating, minibar or refrigerator, tea/coffee facilities, safe, toiletries, hairdryer, hypoallergenic bedding, baby cots, connecting rooms, family rooms, housekeeping, laundry, terrace/balcony, work desk.
Food & Beverage – buffet breakfast, breakfast hours, breakfast price, whether breakfast is included or rate-dependent, vegan/vegetarian/gluten-free options, restaurant, bar, room service, vending machines, coffee/tea, children at dining venues.
Policies & Terms – minimum age, pets, cancellation, early check-in, late check-out, luggage storage, group bookings, smoking policy, payment/deposit.
Location & Transportation – airports, train stations, metro/tram/bus stops, parking, shuttle/taxi help, walking distance and walking difficulty to beaches/landmarks where relevant, promenade/beach access, city center/old town/business district.
Activities & Entertainment – gym, spa, pool, pool season/hours, children's pool, sun loungers, pool/beach towels if relevant, sauna, tours, ticket help, bike storage/rental, games room, live music, local art, terrace, nearby cultural attractions.

8 Frequency level
Use High for core booking/arrival questions that most guests care about.
Use Medium for useful hotel-specific amenities or policies.
Use Low only for niche but source-confirmed features or a very limited number of useful hotel-verification gaps.

9 Delivery
Return only a Markdown table with exactly these columns:
Category | Question | Frequency Level

No links, citations, bullets, notes, or text before/after the table.`;
}

/**
 * שלב 2: הפרומפט ליצירת התשובות
 */
export function createAnswersPrompt(hotelName: string, questions: string): string {
return `SEO & GEO FAQ Research Prompt for Leonardo Hotels | Answers
Hotel: ${hotelName}

1 Goal
Answer every question from the provided list with authoritative, source-grounded FAQ copy.
Return a completed table with exactly four columns:
Category | Question | Answer | Frequency Level

2 Approved data sources, in this order of authority
Use these first:
• Official Leonardo Hotels website – https://www.leonardo-hotels.com/
• Google Hotels / Google Travel – property knowledge panel
• Booking.com – official property profile only
• Expedia – official property profile only
• TripAdvisor – official property profile only, with NO user reviews

If a detail is absent from all approved sources, scan the approved sources again before deciding it is missing.
If a useful answer is found only in another reliable source, answer it and add [VERIFY].
If no reliable answer can be found, write exactly:
Information is currently not available. [VERIFY]

3 Answer rules
• Preserve Category, Question, and Frequency Level exactly as provided.
• Write in English, third person, refined but not promotional hotel FAQ tone.
• Use complete, informative answers of at least 10-12 words when information is available.
• For yes/no questions, begin with "Yes," or "No," only when the answer is truly yes or truly no.
• Do not start with "Yes," for what/where/when/how/how far/how much questions; begin with the factual answer directly.
• Do not force a positive "Yes" when the hotel does not offer the service or when the answer is conditional.
• Across the full table, include the exact hotel name "${hotelName}" in roughly 6-8 answer cells. Prioritize identity, full address, location, airport/transport, parking, signature facilities, brand/collection, and policy answers.
• Do not repeat the hotel name mechanically in every answer; about 7 answers in the whole sheet is the target.
• Avoid vague qualifiers such as generally, usually, typically, normally, often, may, or might for confirmed facts.
• Keep [VERIFY] only when a fact needs confirmation or comes from a non-approved source.
• Do not add links or citations in the TSV.

4 Delivery
Return only raw TSV, no Markdown and no extra text.
Use actual tab characters between columns.
The first row must be the header exactly as shown below. Do not omit it.

Category[TAB]Question[TAB]Answer[TAB]Frequency Level

QUESTION LIST:
${questions}`;
}

// === EXTRA QA PROMPTS – run after TSV upload =========================
export function createDuplicateCheckPrompt(tsv: string): string {
  const numberedData = buildNumberedQaInput(tsv);
  const rowCount = dataRowCountFromTsv(tsv);
  return `Check for duplicate FAQ questions that seek similar information.



A question is duplicate if:
- It asks for information already covered by another question
- Examples:
  • "Late-night snacks?" duplicates "24-hour room service?" (room service includes snacks)
  • "Can concierge book tours?" duplicates "Does hotel arrange tours?" (same service)
  • "Is there a gym?" duplicates "What fitness facilities?" (specific within general)
  • "Breakfast included?" duplicates "What does the rate include?" (if breakfast mentioned)

For each row:
- Write "NO" if unique question
- Write "YES - Q[#] [question] and Q[#] [question]" if duplicate.

  Example: "YES - Q7 Does the hotel offer room service? and Q12 Is it possible to get food delivered to the room?"
  Example: "YES - Q22 Is parking available at the hotel? and Q35 Does the hotel offer paid parking options?"

Consider the broader question as primary, specific as duplicate.
Use the Row number from the input. This is mandatory so the result cannot shift rows.
Return exactly ${rowCount} DATA rows.
If a row must be ignored (e.g. empty question/answer), write "-" for that Row.

Make sure to check every row in the input.
Return the results in the original language (English).

INPUT TSV TO CHECK
${numberedData}

OUTPUT FORMAT
HEADER
Row[TAB]Duplicate
DATA`;
}

export function createDuplicateRecommendationPrompt(tsv: string): string {
  const numberedData = buildNumberedQaInput(tsv);
  const rowCount = dataRowCountFromTsv(tsv);
  return `Check for duplicate FAQ questions and recommend which row to delete.

The questionnaire will be reviewed quickly before sending to the hotel, so keep this practical and low-noise.

A question is duplicate only if it asks for information already covered by another question and keeping both would waste the hotel team's time.

Do NOT mark useful follow-up questions as duplicates merely because they relate to the same topic.
Examples that are NOT duplicates:
• "How many swimming pools does the hotel have?" and "Does the hotel have a rooftop pool?"
• "How many swimming pools does the hotel have?" and "Is there a children's pool?"
• "What room types are offered?" and "Are connecting rooms available?"
• "Does the hotel have parking?" and "Does the parking include EV charging?"

Examples that ARE duplicates:
• "Is the hotel a non-smoking property?" and "Does the hotel allow smoking indoors?"
• "Does the hotel offer room service?" and "Can guests order food to the room?"
• "Is parking available?" and "Does the hotel offer on-site parking?"

For each row return two columns:
1. Duplicate
2. Duplicate Delete

Duplicate column:
• Write "NO" if this row is unique or is a useful follow-up question.
• Write "YES - Q[#] [question] and Q[#] [question]" if this row is part of a true duplicate pair.

Duplicate Delete column:
• Put the delete recommendation ONLY on the row that should actually be deleted.
• On the row to delete, write "DELETE THIS ROW - keep Q[#] [short reason]".
• On the row to keep, write "-".
• If both rows are equally good, recommend deleting the narrower, weaker, less guest-useful, less hotel-specific, or lower-frequency row.
• Prefer keeping the clearer question with the fuller answer.

Use the Row number from the input. This is mandatory so the result cannot shift rows.
Return exactly ${rowCount} DATA rows.
If a row must be ignored (e.g. empty question/answer), write "-" in both columns.

Make sure to check every row in the input.
Return the results in the original language (English).

INPUT TSV TO CHECK
${numberedData}

OUTPUT FORMAT
HEADER
Row[TAB]Duplicate[TAB]Duplicate Delete
DATA`;
}

export function createQuestionQualityPrompt(hotelName: string, tsv: string): string {
  const numberedData = buildNumberedQaInput(tsv);
  const rowCount = dataRowCountFromTsv(tsv);
  return `Review each FAQ question as a hotel-verification questionnaire item for Leonardo Hotels.
Hotel: ${hotelName}

The questionnaire will be sent to the hotel team for verification before publication.
Do NOT judge whether the answer is publication-ready. Judge whether the QUESTION is useful, guest-realistic, and safe to send to the hotel.

For each row, write one of:
• OK
• REVIEW - MARKETING WORDING: [short reason]
• REVIEW - TOO NICHE: [short reason]
• REVIEW - LOW GUEST INTENT: [short reason]
• REVIEW - BRAND RISK: [short reason]
• REVIEW - NOT HOTEL-SPECIFIC: [short reason]
• REVIEW - TOO MANY UNKNOWN DETAILS: [short reason]
• QUESTION: [better replacement question]

Guidelines:
1. Keep common guest-need questions even if the answer may be "No" (pets, pool, parking, accessibility, cribs, shuttle, connecting rooms, breakfast inclusion).
2. Flag questions that unnecessarily make the hotel look bad, invite a negative answer without strong guest value, or sound like a complaint.
3. Flag obscure operational questions unless they are clearly useful for arrival planning.
4. Flag generic questions that could apply to any hotel and do not reflect this property's location, amenities, or guest profile.
5. Flag marketing-style question wording. Questions should ask the fact directly, not sell the experience.
6. If a useful question contains a promotional tail, provide a plain replacement starting with "QUESTION:".
7. Do not over-flag. The goal is a strong questionnaire, not a perfect published FAQ.
8. Every question must include the exact full hotel name "${hotelName}".
9. If your output is anything other than "OK" or "-", include "${hotelName}" in the review note or in the replacement question.
10. Any replacement after "QUESTION:" must include "${hotelName}" and must not use generic wording like "the hotel" or "this property".

Marketing wording examples to rewrite:
• "Does the hotel offer suites for guests seeking extra space and comfort?" → "Does ${hotelName} offer suites?"
• "Is there a bar where guests can enjoy signature cocktails?" → "Does ${hotelName} have a bar?"
• "How far is the landmark for riverside strolls?" → "How far is the landmark from ${hotelName}?"

Use the Row number from the input. This is mandatory so the result cannot shift rows.
Return exactly ${rowCount} DATA rows.
If a row must be ignored (e.g. empty question/answer), write "-".

INPUT TSV TO CHECK
${numberedData}

OUTPUT FORMAT
HEADER
Row[TAB]Question Review
DATA`;
}

export function createSourceVerifyPrompt(tsv: string): string {
  const numberedData = buildNumberedQaInput(tsv);
  const rowCount = dataRowCountFromTsv(tsv);
  return `Cross-verify each Answer in the TSV with the approved Leonardo hotel sources.

Approved source hierarchy:
1. Official Leonardo Hotels website
2. Google Hotels / Google Travel property knowledge panel
3. Booking.com official property profile
4. Expedia official property profile
5. TripAdvisor official property profile only, no user reviews

Pay special attention to:
- Answers marked with [VERIFY]
- Answers stating "Information is currently not available"
- Answers that start with "Yes," when the question is not a yes/no question
- Answers that say "Yes," even though the service is unavailable or only conditional

For each row write:

• \`OK\` if the answer is verified and correct
• \`OK\` if the answer transparently says "Information is currently not available. [VERIFY]" for a useful hotel-verification question
• \`NOT VERIFIED\` only if the answer states a concrete factual claim that cannot be confirmed and is not already marked [VERIFY]
• \`WRONG: [full corrected answer] - Source: [where found]\` if the answer is incorrect
• \`FOUND: [full new answer] - Source: [where found]\` if you find info for a previously missing answer


[the correct info should be the full answer in English, not just a correction. It should be clear, third-person, at least 10-12 words when possible, and should begin with "Yes,"/"No," only for real yes/no questions.]
[VERIFY] is acceptable for useful hotel-verification questions. Do not output extra notes just because the hotel needs to complete missing information.
Keep this column low-noise: only flag rows that need the user's attention before sending the questionnaire to the hotel.

Use the Row number from the input. This is mandatory so the result cannot shift rows.
If you cannot judge a row (e.g. it is blank), output "-".
Return exactly ${rowCount} DATA rows.

Make sure to check every row in the input.
Return the results in the original language (English).

INPUT TSV TO CHECK
${numberedData}

OUTPUT FORMAT
HEADER
Row[TAB]Source OK
DATA`;
}

export function createGrammarCheckPrompt(tsv: string): string {
  const numberedData = buildNumberedQaInput(tsv);
  const rowCount = dataRowCountFromTsv(tsv);
  return `Review each FAQ row for 6 critical aspects:


1. Question-Answer Match: Does the answer directly address what's asked?
   - Wrong: Q:"Pool hours?" A:"Yes, we have a pool" (doesn't answer WHEN)
   
2. Hotel Tone: Professional, welcoming, luxury hospitality language
   
3. Grammar/Spelling: Perfect English required

4. Clarity rule 
• For a true yes/no question, begin the answer with "Yes," or "No," only when the answer is genuinely yes or no.
• If the hotel does not offer a service, do not write a positive "Yes,". Write "No," and the correct limitation.
• For what/where/when/how/how far/how much questions, do not begin with "Yes,". Open with the factual answer directly.

5. Hotel-name use
• Every question must include the exact full hotel name from that row. This is mandatory.
• If a question says "the hotel" or "this property" instead of the exact hotel name, return "QUESTION: [fixed question]".
• The answer may include the hotel name when it improves clarity: location, address, brand, signature facilities, parking, airport/transport, or policies.
• Across the full sheet, roughly 6-8 answers should include the exact hotel name. Do not repeat it mechanically in every answer.

6. Plain guest question wording
• Questions must sound like real guests asking for information, not hotel marketing copy.
• Remove benefit/lifestyle tails such as "for guests seeking extra space and comfort", "where guests can enjoy signature cocktails", "for riverside strolls", "for a historic hilltop visit", "for a relaxing stay", or similar wording.
• Remove promotional adjectives from questions, including "elegant", "signature", "curated", "plush", "premium", "exclusive", and "memorable", unless the word is part of an official proper name.
• Keep the factual intent and rewrite the question directly.


For each row write:
- "-" if all perfect
- If ANY issue found, provide COMPLETE FIXED VERSION:
  • For wrong Q&A: write the full corrected answer, or write "QUESTION: [fixed question]" if the question is what needs fixing
  • For poor tone: write the full rephrased answer
  • For grammar: write the full corrected text
  
Example fixes:
- "Yes, the pool is open daily from 6:00 AM to 10:00 PM"
- "Currently, pets are welcome with a €30 per night fee"
- "No, the hotel does not offer on-site parking, but nearby public parking is available."
- "QUESTION: How far is the hotel from the nearest metro station?"
- "QUESTION: Does Hotel Corpus Christi Lisboa – Leonardo Limited Edition offer suites?"
- "QUESTION: Does Hotel Corpus Christi Lisboa – Leonardo Limited Edition have a bar?"

IMPORTANT if ANY issue is found: use one line for the correction. Do not create extra lines.
The returned fix will be applied automatically to the generated TSV. Only provide a fix when it is safe, complete, and clearly improves the row. Do not suggest optional style changes.

When the answer was not found, "Information is currently not available. [VERIFY]" is acceptable.
When a non-approved source was used, keeping "[VERIFY]" is acceptable.

Use the Row number from the input. This is mandatory so the result cannot shift rows.
Return exactly ${rowCount} DATA rows.
Make sure to check every row in the input.

INPUT TSV TO CHECK
${numberedData}

OUTPUT FORMAT
HEADER
Row[TAB]Grammar Fix
DATA`;
}

export function createFinalPolishPrompt(hotelName: string, tsv: string): string {
  return `Final FAQ TSV polish for Leonardo Hotels
Hotel: ${hotelName}

You will receive a TSV with columns:
Category | Question | Answer | Frequency Level

Goal:
Return the full corrected TSV with the same header, same number of data rows, and same row order.

Edit directly inside the Question and Answer cells when needed.

Critical checks:
1. Every answer must directly answer the exact question.
2. Grammar, punctuation, and spelling must be clean professional English.
3. For yes/no questions, answers must begin with "Yes," or "No," only when that is logically correct.
4. For what/where/when/how/how far/how much questions, answers must not start with "Yes,".
5. Do not write "Yes," when the hotel does not provide a service or when the answer is conditional.
6. Every question must include the exact full hotel name "${hotelName}". There are no exceptions.
7. Across the full TSV, include the exact hotel name "${hotelName}" in roughly 6-8 answer cells. Prioritize identity, address, location, airport/transport, parking, signature facilities, brand/collection, and policy answers.
8. Do not repeat the hotel name mechanically in every answer; about 7 answer mentions in the whole sheet is the target.
9. Keep [VERIFY] if the fact needs confirmation. Do not invent missing facts.
10. Keep Category and Frequency Level unchanged unless there is a clear typo.
11. Preserve useful hotel-verification questions. Do not remove a good guest-intent question just because the answer needs hotel input.
12. Keep question wording neutral and guest-useful. Avoid phrasing that makes the hotel look bad unless it is a common guest need such as pets, parking, pool, shuttle, accessibility, or cribs.
13. Keep questions plain and factual. Remove marketing/lifestyle wording such as "for guests seeking...", "where guests can enjoy...", "for riverside strolls", "for a historic visit", "signature cocktails", "plush bedding", or "premium amenities" from questions.
14. Ask the direct guest question with the hotel name: "Does ${hotelName} offer suites?", "Does ${hotelName} have a bar?", "How far is Praça do Comércio from ${hotelName}?"
15. Do not add sources, links, commentary, Markdown, code fences, or extra columns.

Return only raw TSV.

DATA:
${tsv}`;
}

/**
 * פונקציה ראשית - מחקר מלא לכל המלונות
 * (מועתק מ־index כפי שהוא; עטפתי ב־export + פרמטרים)
 */
export async function runAllHotelsResearch(
  agent: AIAgent,
  sheets: SheetsService,
  HOTELS: string[]
) {
  try {
    console.log(chalk.green(`🏨 Starting COMPLETE FAQ research for ${HOTELS.length} hotels...`));
    console.log(chalk.yellow("📋 For each hotel: Step 1 (Questions) → Step 2 (Answers in TSV)"));
    console.log(chalk.yellow("⏱️ This will take several minutes..."));
    
    const allResults: Array<{hotel: string, questions: string, answers: string}> = [];
    
    for (let i = 0; i < HOTELS.length; i++) {
      const hotelName = HOTELS[i];
      console.log(chalk.blue(`\n🏨 [${i+1}/${HOTELS.length}] Processing: ${hotelName}`));
      
      agent.clearTasks();
      
      console.log(chalk.yellow(`🔍 Step 1: Generating questions for ${hotelName}...`));
      const questionsPrompt = createQuestionsPrompt(hotelName);
      agent.addTask(questionsPrompt, FAQ_QUESTIONS_MODEL);
      await agent.executeChain();
      
      const questionsResult = agent.getLastResult();
      if (!questionsResult) {
        console.log(chalk.red(`❌ Failed to generate questions for ${hotelName}`));
        continue;
      }
      console.log(chalk.green(`✅ Questions generated for ${hotelName}`));
      
      agent.clearTasks();
      
      console.log(chalk.yellow(`💬 Step 2: Generating answers for ${hotelName}...`));
      const answersPrompt = createAnswersPrompt(hotelName, questionsResult);
      agent.addTask(answersPrompt, FAQ_ANSWERS_MODEL);
      await agent.executeChain();
      
      let answersResult = agent.getLastResult();
      if (!answersResult) {
        console.log(chalk.red(`❌ Failed to generate answers for ${hotelName}`));
        continue;
      }
      console.log(chalk.green(`✅ Complete FAQ generated for ${hotelName}`));

      console.log(chalk.yellow(`✨ Step 2.5: Final answer-fit and grammar polish for ${hotelName}...`));
      agent.clearTasks();
      agent.addTask(createFinalPolishPrompt(hotelName, answersResult), FAQ_FINAL_POLISH_MODEL);
      await agent.executeChain();
      const polishedResult = stripOptionalCodeFence(agent.getLastResult() || "");
      if (
        looksLikeFaqTsv(polishedResult)
        && dataRowCountFromTsv(polishedResult) === dataRowCountFromTsv(answersResult)
      ) {
        answersResult = polishedResult;
        console.log(chalk.green(`✅ Final polish applied with ${FAQ_FINAL_POLISH_MODEL}`));
      } else {
        console.log(
          chalk.yellow(
            `⚠️ Final polish did not return a matching TSV. Keeping original answers for ${hotelName}.`
          )
        );
      }

      // === QA STEPS ===
      const normalizedRows = normalizeFaqRows(answersResult);
      const headerRow = normalizedRows.headerRow;
      let dataRows = normalizedRows.dataRows;
      const dataRowCount = dataRows.length;
      const initialQuestionNameFix = ensureQuestionsHaveHotelName(dataRows, hotelName);
      dataRows = initialQuestionNameFix.rows;
      if (initialQuestionNameFix.changed > 0) {
        console.log(
          chalk.green(`✅ Added hotel name to ${initialQuestionNameFix.changed} question(s) before QA`)
        );
      }
      answersResult = serializeTsvRows(headerRow, dataRows);

      // Grammar fix is applied directly so the sheet is ready to send without a manual fix column.
      agent.clearTasks();
      agent.addTask(createGrammarCheckPrompt(answersResult), FAQ_FINAL_POLISH_MODEL);
      await agent.executeChain();
      const grammarCol = parseNumberedQaColumn(agent.getLastResult() || "", dataRowCount);

      let appliedGrammarFixes = 0;
      dataRows = dataRows.map((row, idx) => {
        const rawFix = String(grammarCol[idx] ?? "").trim();
        if (!rawFix || rawFix === "-") return row;

        const fix = rawFix.replace(/\t/g, " ");
        const nextRow = [...row];
        if (/^QUESTION\s*:/i.test(fix)) {
          nextRow[1] = fix.replace(/^QUESTION\s*:/i, "").trim();
        } else if (/^ANSWER\s*:/i.test(fix)) {
          nextRow[2] = fix.replace(/^ANSWER\s*:/i, "").trim();
        } else {
          nextRow[2] = fix;
        }

        appliedGrammarFixes++;
        return nextRow;
      });

      if (appliedGrammarFixes > 0) {
        console.log(chalk.green(`✅ Applied ${appliedGrammarFixes} grammar/wording fixes directly`));
      }

      const finalQuestionNameFix = ensureQuestionsHaveHotelName(dataRows, hotelName);
      dataRows = finalQuestionNameFix.rows;
      if (finalQuestionNameFix.changed > 0) {
        console.log(
          chalk.green(`✅ Re-applied hotel name to ${finalQuestionNameFix.changed} question(s) after grammar fixes`)
        );
      }

      answersResult = serializeTsvRows(headerRow, dataRows);

      // Question quality / brand-risk review
      agent.clearTasks();
      agent.addTask(createQuestionQualityPrompt(hotelName, answersResult), FAQ_QA_MODEL);
      await agent.executeChain();
      const questionReviewCol = parseNumberedQaColumn(agent.getLastResult() || "", dataRowCount);

      // Duplicate
      agent.clearTasks();
      agent.addTask(createDuplicateRecommendationPrompt(answersResult), FAQ_QA_MODEL);
      await agent.executeChain();
      const duplicateQa = parseNumberedQaColumns(agent.getLastResult() || "", dataRowCount, 2);
      const dupCol = duplicateQa.map((row) => row[0] ?? "");
      const dupDeleteCol = duplicateQa.map((row) => row[1] ?? "");

      // Source verification
      agent.clearTasks();
      agent.addTask(createSourceVerifyPrompt(answersResult), FAQ_QA_MODEL);
      await agent.executeChain();
      const verifyCol = parseNumberedQaColumn(agent.getLastResult() || "", dataRowCount);

      const combinedRows = [
        [...headerRow, "Question Review", "Duplicate", "Duplicate Delete", "Source OK"],
        ...dataRows.map((r, idx) => [
          ...r,
          questionReviewCol[idx] ?? "",
          dupCol[idx] ?? "",
          dupDeleteCol[idx] ?? "",
          verifyCol[idx] ?? "",
        ]),
      ];

      const combinedTsv = combinedRows.map(r => r.join("\t")).join("\n");

      // Google Sheet + עיצוב
      const sheetId = await sheets.createSpreadsheet(hotelName);
      await sheets.uploadTsv(sheetId, combinedTsv);
      console.log(chalk.green(`📊 Google Sheet created: https://docs.google.com/spreadsheets/d/${sheetId}`));
      await sheets.formatSheet(sheetId);
      console.log(chalk.cyan(`🎨 Sheet formatted`));

      allResults.push({ hotel: hotelName, questions: questionsResult, answers: answersResult });

      // שמירה לקובץ מקומי
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hotelFilename = hotelName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${hotelFilename}_faq_tsv_${timestamp}.tsv`;
      try {
        writeFileSync(filename, answersResult, 'utf8');
        console.log(chalk.blue(`📄 ${hotelName} TSV saved to: ${filename}`));
        if (existsSync(filename)) {
          console.log(chalk.green(`✅ File confirmed: ${filename}`));
        } else {
          console.log(chalk.red(`❌ File NOT created: ${filename}`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to save file for ${hotelName}:`, error));
      }
      
      if (i < HOTELS.length - 1) {
        console.log(chalk.gray(`⏳ Brief pause before next hotel...`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // קובץ סיכום
    const summaryTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryFilename = `all_hotels_summary_${summaryTimestamp}.txt`;
    const summaryContent = `Hotel FAQ Research Summary
Generated: ${new Date().toLocaleString()}
Total Hotels Processed: ${allResults.length}
========================================================

${allResults.map((result, index) => 
  `${index + 1}. ${result.hotel}
   - Questions: Generated ✅
   - Answers: Generated ✅
   - TSV File: ${result.hotel.toLowerCase().replace(/[^a-z0-9]/g, '_')}_faq_tsv_*.tsv
`).join('\n')}

========================================================
Generated by AI Agent - Hotel Research System`;
    writeFileSync(summaryFilename, summaryContent, 'utf8');

    console.log(chalk.green(`\n🎉 ALL HOTELS RESEARCH COMPLETED!`));
    console.log(chalk.blue(`📄 Summary saved to: ${summaryFilename}`));
    console.log(chalk.yellow(`📊 Total hotels processed: ${allResults.length}`));
    console.log(chalk.cyan(`💾 Each hotel has its own TSV file ready for Google Sheets!`));
  } catch (error) {
    console.error(chalk.red("❌ Research failed:"), error);
  }
}
