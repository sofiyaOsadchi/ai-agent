// src/jobs/faq-from-scratch.ts
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

const FAQ_QUESTIONS_MODEL = process.env.FAQ_QUESTIONS_MODEL || "o3";
const FAQ_ANSWERS_MODEL = process.env.FAQ_ANSWERS_MODEL || "o3";
const FAQ_QA_MODEL = process.env.FAQ_QA_MODEL || "o3";
const FAQ_FINAL_POLISH_MODEL = process.env.FAQ_FINAL_POLISH_MODEL || "gpt-5.5";

function parseTsvRows(tsv: string): string[][] {
  return String(tsv || "")
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split("\t"));
}

function dataRowCountFromTsv(tsv: string): number {
  const rows = parseTsvRows(tsv);
  return Math.max(0, rows.length - 1);
}

function buildNumberedQaInput(tsv: string): string {
  const rows = parseTsvRows(tsv);
  if (rows.length <= 1) return "Row\tCategory\tQuestion\tAnswer\tFrequency Level";

  const dataRows = rows.slice(1);
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
  const rows = parseTsvRows(stripOptionalCodeFence(tsv));
  if (rows.length < 2) return false;
  const header = rows[0].map((cell) => String(cell || "").trim().toLowerCase());
  return header.includes("category") && header.includes("question") && header.includes("answer");
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

/**
 * שלב 1: הפרומפט ליצירת השאלות (ללא קיצורים!)
 */
export function createQuestionsPrompt(hotelName: string): string {
return `SEO & GEO FAQ Research Prompt for Leonardo Hotels | Questions
Hotel Name: ${hotelName}

1 Goal
Research and compile a strong FAQ question set for ${hotelName}.
The output must be suitable for a Leonardo Hotels FAQ page and should reflect real guest search intent, real property features, and source-confirmed hotel facts.

2 Approved data sources, in this order of authority
Use these only:
• Official Leonardo Hotels website – https://www.leonardo-hotels.com/
• Google Hotels / Google Travel – property knowledge panel
• Booking.com – official property profile only
• Expedia – official property profile only
• TripAdvisor – official property profile only, with NO user reviews

Do not use forums, blogs, social media, unverified travel guides, or guest reviews.
If a detail is absent from the approved sources, do not turn it into a question.

3 Required columns, exact order
Category | Question | Frequency Level

4 Question rules
• Write in English, refined hotel FAQ tone, clear and natural.
• Every question must be self-contained and understandable outside the table.
• Include the exact full hotel name "${hotelName}" in every question unless the row is an immediate sub-question that would sound unnatural with repetition.
• Use third person phrasing: "Does ${hotelName} offer...", "What time does ${hotelName}...", "How far is ${hotelName}..."
• Prioritize questions guests actually ask before booking or before arrival.
• Do not ask duplicate, near-duplicate, or answer-overlapping questions.
• Do not ask questions that can only be answered by guesswork.
• Do not include a question just because it appears in the topic list below; include it only if relevant to this specific hotel.
• Characterize this hotel first internally: city, neighborhood, brand style, property type, key facilities, guest profile, transport context, and unusual amenities. Use that characterization to create property-specific questions.

5 Categories
Use these categories only. Aim for 45-55 total questions, with 6-10 useful questions per category:
General Information
Accommodation & Room Services
Food & Beverage
Policies & Terms
Location & Transportation
Activities & Entertainment

6 Topic checklist by category
Use this as a relevance checklist, not as a mandatory list:
General Information – Wi-Fi, 24-hour front desk, check-in/check-out times, accessibility, multilingual staff, parking, conference facilities, brand/collection, sustainability certifications.
Accommodation & Room Services – room categories, air-conditioning/heating, minibar or refrigerator, tea/coffee facilities, safe, toiletries, hairdryer, hypoallergenic bedding, baby cots, housekeeping, laundry, terrace/balcony, work desk.
Food & Beverage – buffet breakfast, breakfast hours, breakfast price, vegan/vegetarian/gluten-free options, restaurant, bar, room service, vending machines, coffee/tea, children at dining venues.
Policies & Terms – minimum age, pets, cancellation, early check-in, late check-out, luggage storage, group bookings, smoking policy, payment/deposit.
Location & Transportation – airports, train stations, metro/tram/bus stops, parking, shuttle/taxi, walking distance to landmarks, city center/old town/business district.
Activities & Entertainment – gym, spa, pool, sauna, tours, ticket help, bike storage/rental, live music, local art, terrace, nearby cultural attractions.

7 Frequency level
Use High for core booking/arrival questions that most guests care about.
Use Medium for useful hotel-specific amenities or policies.
Use Low only for niche but source-confirmed features.

8 Delivery
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
• Include the exact hotel name "${hotelName}" in some answers where it improves clarity: identity, location, address, brand, signature facilities, parking, airport/transport, or policies that would otherwise sound vague.
• Do not repeat the hotel name mechanically in every answer.
• Avoid vague qualifiers such as generally, usually, typically, normally, often, may, or might for confirmed facts.
• Keep [VERIFY] only when a fact needs confirmation or comes from a non-approved source.
• Do not add links or citations in the TSV.

4 Delivery
Return only raw TSV, no Markdown and no extra text.
Use actual tab characters between columns.

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

• \`OK\` if answer is verified and correct
• \`NOT VERIFIED\` if you cannot confirm the information
• \`WRONG: [full corrected answer] - Source: [where found]\` if the answer is incorrect
• \`FOUND: [full new answer] - Source: [where found]\` if you find info for a previously missing answer


[the correct info should be the full answer in English, not just a correction. It should be clear, third-person, at least 10-12 words when possible, and should begin with "Yes,"/"No," only for real yes/no questions.]

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
  return `Review each FAQ row for 5 critical aspects:


1. Question-Answer Match: Does the answer directly address what's asked?
   - Wrong: Q:"Pool hours?" A:"Yes, we have a pool" (doesn't answer WHEN)
   
2. Hotel Tone: Professional, welcoming, luxury hospitality language
   
3. Grammar/Spelling: Perfect English required

4. Clarity rule 
• For a true yes/no question, begin the answer with "Yes," or "No," only when the answer is genuinely yes or no.
• If the hotel does not offer a service, do not write a positive "Yes,". Write "No," and the correct limitation.
• For what/where/when/how/how far/how much questions, do not begin with "Yes,". Open with the factual answer directly.

5. Hotel-name use
• The question should normally include the exact hotel name.
• The answer may include the hotel name when it improves clarity: location, address, brand, signature facilities, parking, airport/transport, or policies.
• The answer should not repeat the hotel name mechanically in every row.


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

IMPORTANT if ANY issue is found: use one line for the correction. Do not create extra lines.

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
6. Include the exact hotel name "${hotelName}" in answers where it improves clarity: location, address, brand, signature facilities, parking, airport/transport, or policies.
7. Do not repeat the hotel name mechanically in every answer.
8. Keep [VERIFY] if the fact needs confirmation. Do not invent missing facts.
9. Keep Category and Frequency Level unchanged unless there is a clear typo.
10. Do not add sources, links, commentary, Markdown, code fences, or extra columns.

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
      const rows = parseTsvRows(answersResult);
      const headerRow = rows[0];
      const dataRows  = rows.slice(1);
      const dataRowCount = dataRows.length;

      // Duplicate
      agent.clearTasks();
      agent.addTask(createDuplicateCheckPrompt(answersResult), FAQ_QA_MODEL);
      await agent.executeChain();
      const dupCol = parseNumberedQaColumn(agent.getLastResult() || "", dataRowCount);

      // Source verification
      agent.clearTasks();
      agent.addTask(createSourceVerifyPrompt(answersResult), FAQ_QA_MODEL);
      await agent.executeChain();
      const verifyCol = parseNumberedQaColumn(agent.getLastResult() || "", dataRowCount);

      // Grammar fix
      agent.clearTasks();
      agent.addTask(createGrammarCheckPrompt(answersResult), FAQ_FINAL_POLISH_MODEL);
      await agent.executeChain();
      const grammarCol = parseNumberedQaColumn(agent.getLastResult() || "", dataRowCount);

      const combinedRows = [
        [...headerRow, "Duplicate", "Source OK", "Grammar Fix"],
        ...dataRows.map((r, idx) => [...r, dupCol[idx] ?? "", verifyCol[idx] ?? "", grammarCol[idx] ?? ""]),
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
