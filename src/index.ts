// src/index.ts - סוכן אוטומטי למלונות - 10 מלונות
// ==============================================
// תפקיד: רץ לכל מלון ברשימה ויוצר FAQ מלא
// שלב 1: שאלות למלון
// שלב 2: תשובות למלון (TSV)
// ==============================================

import { config } from "dotenv";
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { AIAgent } from "./core/agent.js";
import { SafetyManager } from "./config/safety.js";
import { SheetsService } from "./services/sheets.js";
import { promptManager } from "./prompts/promptManager.js";
import { DocsService }   from "./services/docs.js";



// טעינת משתני סביבה
console.log(chalk.blue("🤖 Starting Hotel Research Agent..."));
config();

// יצירת מופעי המערכת
const safetyManager = new SafetyManager('development');
const agent = new AIAgent(safetyManager);
const sheets = new SheetsService("asosadchi@gmail.com");
const docs   = new DocsService("asosadchi@gmail.com");

/**
 * רשימת המלונות לעיבוד (נוודא שמות נכונים!)
 */
const HOTELS = [
  
  
    
    "Leonardo Royal Hotel Baden-Baden", 
    "Hotel Berlin Potsdamer Platz by Leonardo Hotels",

];

/**
 * שלב 1: הפרומפט ליצירת השאלות (ללא קיצורים!)
 */
function createQuestionsPrompt(hotelName: string): string {
  return `SEO & GEO FAQ Research Prompt for Questions
Hotel Name: ${hotelName}

1 Goal  
Research and compile a list of real, high-frequency questions about **${hotelName}**. Each question must be suitable for the hotel's FAQ page; no answers are required.

2 Approved Data Sources (use these ONLY, in this order of authority)  
• Official Leonardo Hotels website – https://www.leonardo-hotels.com  
• Booking.com – official hotel profile only  
• Expedia – official hotel profile only (Facilities, Policies, Location, Amenities)  
• Google Hotels / Google Travel – hotel knowledge panel  
• TripAdvisor – official hotel profile only (NO user reviews)  
• HolidayCheck.de – official hotel profile only (NO user reviews)  

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

5 Categories  
Provide **7–10 unique questions** per category, ordered from general to specific:  
General Information  
Accommodation & Room Services  
Food & Beverage  
Policies & Terms (pets, smoking, cancellation, check-in/out, etc.)  
Location & Transportation  
Activities & Entertainment  
[Add an extra category only if truly necessary]

6 Quality & Authenticity Rules  
• Only questions that genuinely appear in the **approved sources**; wording may be polished for clarity but must remain factual.  
• No duplicates or near-paraphrases.  
• Do not include details that are not explicitly stated in the approved sources.  
• Respect any limitations noted for each source (e.g., no user reviews).

7 Delivery  
Return the FAQ as a **Markdown table** with the three columns above. Do **NOT** include hyperlinks, citations, or external files.

8 Scope  
Aim for approximately **50–60 total questions** across all categories.



In addition,
I want to add a list of possible questions + their association with the correct category
It is important for me to note - not all questions must appear, but it is advisable to check if they are relevant to the hotel and its style - There may also be many more questions unique to the current hotel that are not on the list because each hotel has its own audience and its own unique characteristics - Therefore - first, characterize this hotel and what is special about it and add questions that you see can only be asked about this hotel.

 
General Information – free Wi-Fi, 24-hour front desk, check-in/check-out times, family-friendly, accessible facilities, multilingual staff, on-site parking, meeting & conference facilities  
Accommodation & Room Services – minibar / small fridge, tea & coffee facilities, iron & ironing board, hairdryer, air-conditioning & heating, USB charging sockets, complimentary toiletries, extra pillows / hypoallergenic bedding, 24-hour room service, laundry & dry-cleaning  
Food & Beverage – buffet breakfast, breakfast hours, vegetarian & vegan options, rooftop bar with city views, bar access for non-residents, gluten-free menu, late-night snacks, children welcome at bar, lunch & dinner service, afternoon tea, children's menus  
Policies & Terms – express check-in/out, security deposit, baggage storage, minimum age, pets policy, smoking policy, free cancellation, early check-in / late check-out, group booking conditions  
Location & Transportation – proximity to landmarks, nearest transport stations, travel time to airports, airport shuttle, walking distance to attractions, taxi / car-hire services  
Activities & Entertainment – indoor pool, children access to pool, spa treatments, fitness classes, sauna / steam room, rooftop terrace, guided city tours, evening entertainment / live music`;
}


/**
 * שלב 2: הפרומפט ליצירת התשובות
 */
function createAnswersPrompt(hotelName: string, questions: string): string {
  return `SEO & GEO FAQ Research Prompt | Answers
Hotel: ${hotelName}

1 Goal  
Provide authoritative answers—based on the approved sources below—for each question in the list. Return the completed table with four columns:
Category | Question | Answer | Frequency Level

2 Approved Data Sources (use these ONLY, in this order of authority)  
• Official Leonardo Hotels website – https://www.leonardo-hotels.com  
• Booking.com – official hotel profile only  
• Expedia – official hotel profile only (Facilities, Policies, Location, Amenities)  
• Google Hotels / Google Travel – hotel knowledge panel  
• TripAdvisor – official hotel profile only (NO user reviews)  
• HolidayCheck.de – official hotel profile only (NO user reviews)  

If a detail is absent from the sources above - please scan the approved sources again. If you still haven't found it, you can bring the answer from another source but mention which source and highlight the answer with [VERIFY].

3 Answer Guidelines  
• Begin each answer with "Yes, …", "No, …", "Currently, …", or a direct factual statement (for what/where/how questions).  
• Do **not** repeat the hotel name in the answer.  
• Always write in third person; tone: serious, welcoming, trustworthy.  
• Keep answers clear, factual, and web-ready; avoid marketing fluff.  
• If information is missing, and you couldn't find anywere online the answer (and you scanned the sources again!)- write exactly: "Information is currently not available. [VERIFY]".  
• Preserve the original order of questions and their categories.  
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

QUESTION LIST:
${questions}`;
}




/** שלב 3: פרומפט לבדיקת השאלון */
function createAuditPrompt(hotelName: string, faqTable: string): string {
  return `היי, צריכה שתעבור על שאלון שיצרתי
מטרת השאלון לאסוף שאלות אמיתיות ונפוצות מאוד מרחבי האינטרנט על ${hotelName} ולספק תשובות מוסמכות ומוכנות לפרסום בעמוד FAQ של המלון.
תעבור בדקדוק על כל השאלון והשאלות שלי כאן ותענה ביסודיות:

 -  חלק ראשון והחשוב ביותר - אם אתה מוצא בעיות תצרף בסוף הבדיקה של חלק זה במרוכז - את השאלה / התשובה הבעייתית ומתחת תציע פתרון חליפי מלא באנגלית:
שים לב להתייחס לכל השאלות /תשבות שמצאת בהם טעות 

האם כל השאלות מותאמות לתשובות?
האם יש בעיות של תחביר או של שגיאת כתיב?
על כל השאלות והתשובות להיכתב בגוף שלישי - האם חלק מהשאלות או חלק מהתשובות כתובות בגוף שני או ראשון?
על התשובות להתחיל בכן או לא 
)("Yes, …", "No, …", "Currently, …", )
(בהנחה שזה הגיוני, אם אלה לא שאלות של כן או לא אז - בכל מקרה על התשובה להיות מובנת וברורה בתחילתה כדי שהקורא יבין מיד מה התשובה למה שחיפש.
בהנחיה המקורית ביקשתי שהשם של המלון יופיע ב90-100 אחוז מהשאלות ולא יופיע כלל בתשובות - האם ההנחיה בוצעה?
האם יש שאלות מיותרות או לא קשורות? נגיד שאלת פולואפ שלא מותאמת לתשובה (כגון - האם יש בריכה התשובה - לא ואז שאלה האם ילדים יכולים להיכנס לבריכה
)
מאוד חשוב - האם יש שאלות שחוזרות על עצמן או דומות אחת לשניה? 


חלק שני, בדיקות נוספות:
האם יש שאלה שמנוסחת לא ברוח של בית מלון? אם כן איזו?
תשובה שהיא לא וודאית מסומנת עם הסימון [verify]
אם אין תשובה (כתוב שאין תשובה כרגע) - תחפש במקורות רשמיים של המלון האם כן ניתן למצוא תשובה ותכתוב מה מצאת באנגלית.
• חשוב שתיתן רק הערות אמיתיות וכנות, ומה שמצאת כטעות – נא לספק פתרון מלא.

==== FAQ TABLE (TSV) ====
${faqTable}`;
}
/**
 * פונקציה ראשית - מבצעת מחקר מלא לכל המלונות
 */
async function runAllHotelsResearch() {
  try {
    console.log(chalk.green(`🏨 Starting COMPLETE FAQ research for ${HOTELS.length} hotels...`));
    console.log(chalk.yellow("📋 For each hotel: Step 1 (Questions) → Step 2 (Answers in TSV)"));
    console.log(chalk.yellow("⏱️ This will take several minutes..."));
    
    const allResults: Array<{hotel: string, questions: string, answers: string}> = [];
    
    // עיבוד כל מלון
    for (let i = 0; i < HOTELS.length; i++) {
      const hotelName = HOTELS[i];
      console.log(chalk.blue(`\n🏨 [${i+1}/${HOTELS.length}] Processing: ${hotelName}`));
      
      // 🔧 ניקוי משימות לפני מלון חדש
      agent.clearTasks();
      
      // שלב 1: יצירת השאלות
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
      
      // 🔧 ניקוי משימות לפני שלב 2
      agent.clearTasks();
      
      // שלב 2: יצירת התשובות בפורמט TSV
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
      
// 🔧 יצירת גיליון Google Sheets והעלאת הנתונים
const sheetId = await sheets.createSpreadsheet(hotelName);
await sheets.uploadTsv(sheetId, answersResult);
console.log(chalk.green(`📊 Google Sheet created: https://docs.google.com/spreadsheets/d/${sheetId}`));
await sheets.formatSheet(sheetId);
console.log(chalk.cyan(`🎨 Sheet formatted`));



const auditPrompt = createAuditPrompt(hotelName, answersResult);

agent.clearTasks();
agent.addTask(auditPrompt);
await agent.executeChain();

const auditResult = agent.getLastResult() || "לא התקבלה תוצאה";

const docUrl = await docs.createDoc(`${hotelName} – FAQ Audit`, auditResult);
console.log(chalk.magenta(`📑 Audit Doc: ${docUrl}`));

      // שמירת התוצאות
      allResults.push({
        hotel: hotelName,
        questions: questionsResult,
        answers: answersResult
      });
      
      // 🔧 שמירה לקובץ נפרד לכל מלון עם וידוא
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hotelFilename = hotelName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${hotelFilename}_faq_tsv_${timestamp}.tsv`;
      
      try {
        writeFileSync(filename, answersResult, 'utf8');
        console.log(chalk.blue(`📄 ${hotelName} TSV saved to: ${filename}`));
        
        // 🔧 וידוא שהקובץ נוצר
       if (existsSync(filename)) {
  console.log(chalk.green(`✅ File confirmed: ${filename}`));
} else {
  console.log(chalk.red(`❌ File NOT created: ${filename}`));
}
        
      } catch (error) {
        console.log(chalk.red(`❌ Failed to save file for ${hotelName}:`, error));
      }
      
      // השהיה בין מלונות
      if (i < HOTELS.length - 1) {
        console.log(chalk.gray(`⏳ Brief pause before next hotel...`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // יצירת קובץ סיכום
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
    
    // הצגת סטטוס סופי
    safetyManager.showStatus();
    
  } catch (error) {
    console.error(chalk.red("❌ Research failed:"), error);
  }
}

// הפעלת המחקר לכל המלונות
runAllHotelsResearch();