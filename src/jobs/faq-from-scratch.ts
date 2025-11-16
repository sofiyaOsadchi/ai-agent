// src/jobs/faq-from-scratch.ts
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

/**
 * שלב 1: הפרומפט ליצירת השאלות (ללא קיצורים!)
 */
export function createQuestionsPrompt(hotelName: string): string {
  return `SEO & GEO FAQ Research Prompt for Questions
Hotel Name: ${hotelName}

1 Goal  
Research and compile a list of real, high-frequency questions about **${hotelName}**. Each question must be suitable for the hotel's FAQ page; no answers are required.

2  Approved Data Sources (use these ONLY, in this order of authority)  
• Official Leonardo website – https://www.leonardo-hotels.com/  
• Google Hotels / Google Travel – property knowledge panel  
• Booking.com – official property profile only  
• Expedia – official property profile only (Facilities, Policies, Location, Amenities)   
• TripAdvisor – official property profile only (NO user reviews)  

Do **NOT** use any other websites, social media, forums, or user-generated content.  
If a detail is absent from the sources above, do not infer or invent it.

3 Required columns (in this exact order)  
Category | Question | Frequency Level  

4 Guidelines  
• Question – clear, complete, self-contained.  
• Include the full hotel name (“${hotelName}”) in 100% of questions unless it is an immediate follow-up.  
• Always use third person ("Does ${hotelName} …").  
• Group logically: broad question first, then its follow-ups.  
• **Frequency Level** – tag High / Medium / Low according to how often the question (or close variants) appears across the approved sources.  
• Language: English, refined luxury-hotel tone, suitable for an international audience.  
• Highlight features unique to this specific property (location, facilities, brand standards).
• IMPORTANT - Don't ask questions that asked for the same information that was given in a previous answer.
• Most IMPORTANT - write in English, refined luxury-hotel tone, suitable for an international audience.

5 Categories  
Provide **7–10 unique questions** per category, ordered from general to specific:  
General Information  
Accommodation & Room Services  
Food & Beverage  
Policies & Terms (pets, cancellation, check-in/out, etc.)  
Location & Transportation  
Activities & Entertainment 


6 Quality & Authenticity Rules  
• Only questions that genuinely appear in the **approved sources**; wording may be polished for clarity but must remain factual.  
• No duplicates or near-paraphrases.  
• Do not include details that are not explicitly stated in the approved sources.  
• Respect any limitations noted for each source (e.g., no user reviews).
• Very important - phrases the questions in a way that would be asked authentically by potential guests.


7 Delivery  
Return the FAQ as a **Markdown table** with the three columns above. Do **NOT** include hyperlinks, citations, or external files.

8 Scope  
Aim for approximately **50–60 total questions** across all categories.

Very important - do not use the same question (or very similar) twice, even if it is in a different category.

In addition,
I want to add a list of possible questions + their association with the correct category
It is important for me to note - not all questions must appear, but it is advisable to check if they are relevant to the hotel and its style - There may also be many more questions unique to the current hotel that are not on the list because each hotel has its own audience and its own unique characteristics - Therefore - first, characterize this hotel and what is special about it and add questions that you see can only be asked about this hotel.

 
General Information – free Wi-Fi, 24-hour front desk, check-in/check-out times, family-friendly, accessible facilities, multilingual staff, on-site parking, meeting & conference facilities  
Accommodation & Room Services – minibar / small fridge, tea & coffee facilities, iron & ironing board, hairdryer, air-conditioning & heating, USB charging sockets, complimentary toiletries, extra pillows / hypoallergenic bedding, 24-hour room service, laundry & dry-cleaning  
Food & Beverage – buffet breakfast, breakfast hours, vegetarian & vegan options, rooftop bar with city views, bar access for non-residents, gluten-free menu, children welcome at bar, lunch & dinner service, afternoon tea, children's menus  
Policies & Terms – express check-in/out, security deposit, baggage storage, minimum age, pets policy, free cancellation, early check-in / late check-out, group booking conditions  
Location & Transportation – proximity to landmarks, nearest transport stations, travel time to airports, airport shuttle, walking distance to attractions, taxi / car-hire services  
Activities & Entertainment – indoor pool, children access to pool, spa treatments, fitness classes, sauna / steam room, rooftop terrace, guided city tours, evening entertainment / live music


`;
}

/**
 * שלב 2: הפרומפט ליצירת התשובות
 */
export function createAnswersPrompt(hotelName: string, questions: string): string {
  return `SEO & GEO FAQ Research Prompt | Answers
Hotel: ${hotelName}

1 Goal  
Provide authoritative answers—based on the approved sources below—for each question in the list. Return the completed table with four columns:
Category | Question | Answer | Frequency Level

2  Approved Data Sources (use these ONLY, in this order of authority)  
• Official Leonardo website – https://www.leonardo-hotels.com/  
• Google Hotels / Google Travel – property knowledge panel  
• Booking.com – official property profile only  
• Expedia – official property profile only (Facilities, Policies, Location, Amenities)  
• TripAdvisor – official property profile only (NO user reviews)  


If a detail is absent from the sources above - please scan the approved sources again. If you still haven't found it, you can bring the answer from another source but mention which source and highlight the answer with [VERIFY].

3 Answer Guidelines  
• Begin each answer with "Yes, …", "No, …", "Currently, …", or a direct factual statement (for what/where/how questions).  
• Do **not** repeat the hotel name in the answer.  
• Always write in third person; tone: serious, welcoming, trustworthy.  
• Keep answers clear, factual, and web-ready; avoid marketing fluff.  
• If information is missing, and you couldn't find anywere online the answer (and you scanned the sources again!)- write exactly: "Information is currently not available. [VERIFY]".  
• Preserve the original order of questions and their categories.  
• Language: English, refined luxury-hotel tone, suitable for an international audience. 
 **IMPORTANT: Write complete, informative sentences as a caring and courteous hotel representative would - aim for at least 10-12 words per answer. Avoid one-word or overly brief responses.**
- **Provide clear and decisive answers. When uncertain information requires verification, add [VERIFY] but maintain confident, definitive phrasing.**
- **Don't use vague qualifiers like "generally", "usually", "typically", "normally", or "often" when it comes to facts. State facts directly and clearly.**
- **MOST IMPORTANT: scan all the sources again - specially the hotel website and booking.com - to find the answers to the questions.**

• Do not alter Category, Question, or Frequency Level values.

4 AI Workflow Tips  
• Search each **approved source** for the hotel name plus terms like "FAQ", "policies", "amenities", etc.  
• Convert any second-person phrasing found into third person. 
• If you find a duplicate question, add to the answer [duplicate].
• Mark unknown details with [VERIFY] so they can be confirmed with the hotel.  

5 Delivery  
Return **only** the table data in pure TSV format—tab-separated values with NO Markdown, NO backticks, NO extra text.  
Format: One header row, then data rows. Columns separated by actual tab characters.



Example (format only—replace with real answers):  
Category[TAB]Question[TAB]Answer[TAB]Frequency Level  
General Information[TAB]Does ${hotelName} offer free Wi-Fi?[TAB]Yes, complimentary Wi-Fi is available throughout the property.[TAB]High

Do not add any text before or after the table. Return only the raw TSV data that can be pasted into Google Sheets.
Dont add the links or sources, just the answers.

QUESTION LIST:
${questions}`;
}

// === EXTRA QA PROMPTS – run after TSV upload =========================
export function createDuplicateCheckPrompt(tsv: string): string {
  return `Check for duplicate questions that seek similar information.



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
Return one value per data row (skip header), in exact order.
If a row must be ignored (e.g. empty question/answer), write a single dash "-" so that the total number of output lines exactly equals the number of data rows.

Make sure to check all the questions and answers in the file (around 60 lines).
Return the results in the original language (English).

HEADER
Duplicate
DATA
${tsv}`;
}

export function createSourceVerifyPrompt(tsv: string): string {
  return `Cross-verify each Answer in the TSV with the approved hotel sources.

Pay special attention to:
- Answers marked with [VERIFY]
- Answers stating "Information is currently not available"

For each row write:

• \`Q[#] – OK\`  if answer is verified and correct
• \`Q[#] – NOT VERIFIED\`  if you cannot confirm the information
• \`Q[#] – WRONG: [correct info] - Source: [where found]" \`   if the answer is incorrect
• \`Q[#] – FOUND: [new answer] - Source: [where found]" \` if you find info for previously missing answers


[the correct info should be the full answer in English, not just a correction - should be clear, third-person sentence of at least 10–12 words that begins with “Yes,” “No,” or (for non-yes/no Q) a direct factual statement, and do NOT repeat the hotel name.]

If you cannot judge a row (e.g. it is blank), output a single dash "-". Produce exactly one line per data row (header excluded) to preserve row order.

Make sure to check all the questions and answers in the file (around 60 lines).
Return the results in the original language (English).

HEADER
Source OK
DATA
${tsv}`;
}

export function createGrammarCheckPrompt(tsv: string): string {
  return `Review each row for 5 critical aspects:


1. Question-Answer Match: Does the answer directly address what's asked?
   - Wrong: Q:"Pool hours?" A:"Yes, we have a pool" (doesn't answer WHEN)
   
2. Hotel Tone: Professional, welcoming, luxury hospitality language
   
3. Grammar/Spelling: Perfect English required

4. Clarity rule 
• For a Yes/No type question, begin the answer with **“Yes, …” or **“No, …”** or **“Currently, …” .  
• Otherwise, open with clear, factual information.

5. The question including the hotel name, but the answer DOES NOT repeat the hotel name.


For each row write:
- "-" if all perfect
- If ANY issue found, provide COMPLETE FIXED VERSION:
  • For wrong Q&A: write the full corrected answer
  • For poor tone: write the full rephrased answer
  • For grammar: write the full corrected text
  
Example fixes:
- "Yes, the pool is open daily from 6:00 AM to 10:00 PM"
- "Currently, pets are welcome with a €30 per night fee"

 IMPORTANT if ANY issue found - use one line for the correction answer / question you rewrote. Do NOT create extra lines;

 Another point you should know that when the answer was not found, it writes "Information is currently not available. [VERIFY]" and its ok. And when the source is not oficial, it writes "[VERIFY]" - and it's also ok.

Make sure to check all the questions and answers in the file (around 60 lines).

HEADER
Grammar Fix
DATA
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
      agent.addTask(questionsPrompt);
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
      agent.addTask(answersPrompt);
      await agent.executeChain();
      
      const answersResult = agent.getLastResult();
      if (!answersResult) {
        console.log(chalk.red(`❌ Failed to generate answers for ${hotelName}`));
        continue;
      }
      console.log(chalk.green(`✅ Complete FAQ generated for ${hotelName}`));

      // === QA STEPS ===
      const answerLines  = answersResult.trim().split("\n").filter(l => l.trim() !== "");
      const dataRowCount = answerLines.length - 1;

      const pad = (arr: string[]) => {
        while (arr.length < dataRowCount) arr.push("");
        return arr.slice(0, dataRowCount);
      };
      const parseQA = (text: string): string[] => {
        const raw = text.trim().split("\n").map(l => l.trim());
        if (raw.length === 0) return [];
        const dataIdx = raw.findIndex(l => l.toUpperCase() === "DATA");
        const start = dataIdx !== -1 ? dataIdx + 1 : 1;
        return raw.slice(start);
      };

      // Duplicate
      agent.clearTasks();
      agent.addTask(createDuplicateCheckPrompt(answersResult));
      await agent.executeChain();
      const dupCol     = pad(parseQA(agent.getLastResult() || ""));

      // Source verification
      agent.clearTasks();
      agent.addTask(createSourceVerifyPrompt(answersResult));
      await agent.executeChain();
      const verifyCol  = pad(parseQA(agent.getLastResult() || ""));

      // Grammar fix
      agent.clearTasks();
      agent.addTask(createGrammarCheckPrompt(answersResult));
      await agent.executeChain();
      const grammarCol = pad(parseQA(agent.getLastResult() || ""));

      const rows = answersResult.trim().split("\n").map(r => r.split("\t"));
      const headerRow = rows[0];
      const dataRows  = rows.slice(1);

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