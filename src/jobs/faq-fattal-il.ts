// src/jobs/faq-fattal-il.ts
import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

export interface FattalFaqConfig {
  hotels: string[];
}

/**
 * שלב 1: יצירת שאלות (עברית, מותאם לקהל ישראלי)
 */
function createQuestionsPrompt(hotelName: string): string {
  return `
אתה מומחה תוכן תיירותי עבור רשת פתאל, המתמחה בקהל הישראלי.
המטרה: לייצר רשימת שאלות ותשובות (FAQ) עבור המלון: **${hotelName}**.

הנחיות לשלב א' - יצירת השאלות:
1. צור רשימה של עד 25 שאלות נפוצות וחשובות ביותר למטייל הישראלי.
2. **חובה:** כל שאלה חייבת להכיל את שם המלון המלא ("${hotelName}").
3. סגנון: ישיר שירותי ומזמין.
4. השתמש ב5 קטגוריות הבאות -  מידע כללי | שירותי אירוח וחדרים (כולל שאלות של משפחה, ילדים, נגישות וצרכים מיוחדים) | אוכל וכשרות |   חניה ותחבורה | אזור מקומי ואטרקציות - פעילויות ערב


5. פלט נדרש: טבלה פשוטה עם עמודה אחת בלבד: "השאלה".
   אל תענה על השאלות בשלב זה.
`;
}

/**
 * שלב 2: יצירת תשובות (עברית, אימות נתונים)
 */
function createAnswersPrompt(hotelName: string, questionsList: string): string {
  return `
כעת, כתוב את התשובות עבור השאלות שיצרת למלון **${hotelName}**.

מקורות מידע מאושרים בלבד:
1. אתר פתאל רשמי (Fattal).
2. אתר לאונרדו רשמי (Leonardo Hotels).
3. בוקינג (Booking.com) - עמוד הנכס הרשמי.
4. גוגל טראוול (Google Travel).

הנחיות לכתיבת התשובות:
1. **שילוב שם המלון:** שלב את שם המלון ("${hotelName}") בערך ב-25% מהתשובות (כלומר, באחת מכל 4 תשובות בממוצע). בשאר התשובות ענה ישירות.
2. **שאלות כן/לא:** התחל ב"כן" או "לא" רק אם זה מרגיש טבעי ולא מאולץ.
3. **סגנון:** עברית תקנית אך קלילה, מתאימה לישראלים בחופשה.
4. **אמינות:** חפש את המידע במקורות. אם המידע לא מופיע במפורש, הסק מסקנה הגיונית על סמך אופי המלון או מיקומו, אך אל תכתוב "לא מצאתי מידע" ואל תכתוב [VERIFY]. תן את התשובה הטובה ביותר האפשרית.

פורמט פלט (TSV - Tab Separated Values):
החזר את התשובה בפורמט טבלאי נקי (TSV) המיועד להעתקה לאקסל.
מבנה העמודות:
קטגוריה | שאלה | תשובה

שים לב:
- הקפד על הפרדה בטאבים (Tabs).
- אל תוסיף מרכאות מיותרות.
אל תוסיף לינקים ומקורות - התשובות צריכות להיות מוכנות להזנה באתר

רשימת השאלות לעבודה:
${questionsList}
`;
}

/**
 * שלב 3: QA ובדיקת איות והתאמה (שלב מאוחד)
 */
function createQAPrompt(tsvContent: string): string {
  return `
אתה עורך לשוני ובודק איכות קפדני בעברית.
משימתך: לעבור על טבלת ה-FAQ המצורפת ולבצע תיקונים סופיים.

מה לבדוק ולתקן:
1. **התאמה:** האם התשובה עונה בדיוק על השאלה שנשאלה?
2. **שגיאות כתיב ודקדוק:** תקן כל שגיאת איות או ניסוח מסורבל בעברית.
3. **שם המלון בשאלות:** וודא ששם המלון מופיע **בכל** השאלות. אם חסר - הוסף אותו.
4. **שם המלון בתשובות:** וודא ששם המלון מופיע בחלק מהתשובות (אך לא בכולן, כדי לא להעמיס).
5. **עיצוב:** וודא שאין רווחים מיותרים.

החזר את הטבלה המתוקנת המלאה (אותו פורמט TSV בדיוק: קטגוריה | שאלה | תשובה).
אל תחזיר הערות, רק את התוכן המתוקן.

התוכן לבדיקה:
${tsvContent}
`;
}

/**
 * הפונקציה הראשית להרצת הג'וב
 */
export async function runFattalFaqResearch(
  agent: AIAgent,
  sheets: SheetsService,
  config: FattalFaqConfig
) {
  const { hotels } = config;

  console.log(chalk.green(`🇮🇱 Starting Fattal Israel FAQ Research for ${hotels.length} hotels...`));

  for (let i = 0; i < hotels.length; i++) {
    const hotelName = hotels[i];
    console.log(chalk.blue(`\n🏨 [${i + 1}/${hotels.length}] Processing: ${hotelName}`));

    // --- שלב 1: שאלות ---
    agent.clearTasks();
    console.log(chalk.yellow(`➡️ Step 1: Generating Questions...`));
    agent.addTask(createQuestionsPrompt(hotelName));
    await agent.executeChain();
    const questionsResult = agent.getLastResult();

    if (!questionsResult) {
      console.log(chalk.red(`❌ Failed to generate questions for ${hotelName}`));
      continue;
    }

    // --- שלב 2: תשובות ---
    agent.clearTasks();
    console.log(chalk.yellow(`➡️ Step 2: Generating Answers...`));
    agent.addTask(createAnswersPrompt(hotelName, questionsResult));
    await agent.executeChain();
    const answersResult = agent.getLastResult();

    if (!answersResult) {
      console.log(chalk.red(`❌ Failed to generate answers for ${hotelName}`));
      continue;
    }

    // --- שלב 3: QA ועריכה סופית ---
    agent.clearTasks();
    console.log(chalk.yellow(`➡️ Step 3: QA & Grammar Check...`));
    agent.addTask(createQAPrompt(answersResult));
    await agent.executeChain();
    
    // ניקוי קוד בלוקים אם המודל החזיר אותם בטעות (למשל ```tsv)
    let finalTsv = agent.getLastResult() || "";
    finalTsv = finalTsv.replace(/```tsv/g, '').replace(/```/g, '').trim();

    // --- יצירת גיליון גוגל ---
    try {
      console.log(chalk.yellow(`📊 Creating Google Sheet...`));
      const sheetId = await sheets.createSpreadsheet(`FAQ - ${hotelName}`);
      
      // הוספת כותרות אם חסרות (לרוב המודל יחזיר, אבל ליתר ביטחון נשלח את מה שקיבלנו)
      await sheets.uploadTsv(sheetId, finalTsv);
      
      // עיצוב בסיסי
      await sheets.formatSheet(sheetId);
      
      console.log(chalk.green(`✅ DONE! Link: https://docs.google.com/spreadsheets/d/${sheetId}`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create/update sheet for ${hotelName}:`), error);
    }
    
    // השהיה קצרה בין מלונות כדי לא להעמיס
    if (i < hotels.length - 1) {
       await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(chalk.green(`\n🎉 All Fattal hotels processed successfully.`));
}