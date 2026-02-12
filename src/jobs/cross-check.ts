import { SheetsService } from "../services/sheets.js";
import chalk from "chalk";

export type CrossCheckConfig = {
  masterSpreadsheetId: string;
  masterTabName: string;
  masterHotelCol: number;       
  masterQuestionCol: number;    
  masterAnswerCol: number; // 👈 חדש: איפה התשובה במאסטר (כדי לבדוק אם היא ריקה ולמלא)

  targetFolderId: string;
  individualTabName: string;    
  individualQuestionCol: number; 
  individualAnswerCol: number; // 👈 חדש: מאיפה להעתיק את התשובה אם חסרה
};

export class CrossCheckJob {
  constructor(private sheets: SheetsService) {}

  private normalize(str: string): string {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private IGNORE_LIST = [
    "meta description",
    "find answers to frequently asked questions",
    "faq schema",
    "json-ld",
    "category", 
    "question"  
  ];

  private shouldIgnore(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return this.IGNORE_LIST.some(phrase => lower.includes(phrase));
  }

  async run(cfg: CrossCheckConfig): Promise<void> {
    console.log(chalk.blue(`🕵️‍♀️ Starting QA & REPAIR Job...`));

    // --- 1. טעינת המאסטר ---
    console.log(chalk.yellow(`📥 Loading Master File Data...`));
    // קריאת כל הנתונים (אנחנו נעדכן את המערך הזה בזיכרון ואז נכתוב אותו חזרה)
    const masterRows = await this.sheets.readValues(cfg.masterSpreadsheetId, `${cfg.masterTabName}!A:Z`);
    
    // מיפוי: שם מלון -> (שאלה מנורמלת -> אינדקס השורה במאסטר)
    // Map<HotelName, Map<NormalizedQ, RowIndex>>
    const masterMap = new Map<string, Map<string, number>>();
    const readableQuestions = new Map<string, string>(); 

    for (let i = 1; i < masterRows.length; i++) {
      const row = masterRows[i];
      const hotel = String(row[cfg.masterHotelCol] || "").trim();
      const question = String(row[cfg.masterQuestionCol] || "");
      
      if (!hotel || !question || this.shouldIgnore(question)) continue;

      if (!masterMap.has(hotel)) {
        masterMap.set(hotel, new Map());
      }
      
      const normQ = this.normalize(question);
      // שומרים את האינדקס (i) כדי שנוכל לחזור ולתקן את השורה הזאת
      masterMap.get(hotel)?.set(normQ, i);
      readableQuestions.set(normQ, question); 
    }

    console.log(chalk.green(`✅ Master loaded: ${masterMap.size} hotels mapped.`));

    // --- 2. סריקת התיקייה ---
    console.log(chalk.yellow(`📂 Scanning Drive Folder...`));
    const folderFiles = await this.sheets.listSpreadsheetIdsInFolder(cfg.targetFolderId);
    console.log(chalk.cyan(`Found ${folderFiles.length} files. Comparing & Fixing...\n`));

    let totalErrors = 0;
    let totalFixedAnswers = 0; // מונה תיקונים

    for (const fileId of folderFiles) {
      let fileName = "";
      try { fileName = await this.sheets.getSpreadsheetTitle(fileId); } catch (e) { continue; }

      // זיהוי המלון
      let matchedHotelName = "";
      const masterHotels = Array.from(masterMap.keys()).sort((a, b) => b.length - a.length);
      for (const h of masterHotels) {
        if (this.normalize(fileName).includes(this.normalize(h))) {
          matchedHotelName = h;
          break;
        }
      }

      if (!matchedHotelName) {
        console.log(chalk.gray(`⚪ File: "${fileName}" -> Skipped (No match)`));
        continue;
      }

      // קריאת הקובץ המקורי
      const masterQuestionsMap = masterMap.get(matchedHotelName)!;
      let originalRows: string[][] = [];
      try {
        originalRows = await this.sheets.readValues(fileId, `${cfg.individualTabName}!A:Z`);
      } catch (e) {
        console.log(chalk.red(`❌ File: "${fileName}" -> Read Error`));
        continue;
      }

      const originalQuestionsSet = new Set<string>();
      const originalReadable = new Map<string, string>();

      // משתנה למעקב אחר תיקונים במלון הספציפי הזה
      let fixedInThisFile = 0;

      for (let r = 1; r < originalRows.length; r++) { 
        const q = String(originalRows[r][cfg.individualQuestionCol] || "");
        const a = String(originalRows[r][cfg.individualAnswerCol] || ""); // התשובה המקורית

        if (q && !this.shouldIgnore(q)) {
          const normQ = this.normalize(q);
          originalQuestionsSet.add(normQ);
          originalReadable.set(normQ, q);

          // 🔥 בדיקת התיקון (Repair Check) 🔥
          if (masterQuestionsMap.has(normQ)) {
            const masterRowIndex = masterQuestionsMap.get(normQ)!;
            const currentMasterAnswer = String(masterRows[masterRowIndex][cfg.masterAnswerCol] || "").trim();

            // אם התשובה במאסטר ריקה, ויש לנו תשובה בקובץ המקורי - נתקן!
            if (currentMasterAnswer === "" && a.trim() !== "") {
              // מעדכנים את המערך בזיכרון
              masterRows[masterRowIndex][cfg.masterAnswerCol] = a;
              fixedInThisFile++;
              totalFixedAnswers++;
            }
          }
        }
      }

      // --- דוח ---
      const missingInMaster: string[] = [];
      for (const origQ of originalQuestionsSet) {
        if (!masterQuestionsMap.has(origQ)) missingInMaster.push(originalReadable.get(origQ) || "Unknown");
      }

      const extraInMaster: string[] = [];
      for (const mastQ of masterQuestionsMap.keys()) {
        if (!originalQuestionsSet.has(mastQ)) extraInMaster.push(readableQuestions.get(mastQ) || "Unknown");
      }

      const hasIssues = missingInMaster.length > 0 || extraInMaster.length > 0;

      // הדפסה
      if (!hasIssues && fixedInThisFile === 0) {
        console.log(chalk.green(`✅ "${matchedHotelName}" -> PERFECT`));
      } else {
        let msg = `"${matchedHotelName}" -> `;
        if (hasIssues) {
            msg += chalk.red(`ISSUES FOUND `);
            totalErrors++;
        }
        if (fixedInThisFile > 0) {
            msg += chalk.blue(`🛠️  REPAIRED ${fixedInThisFile} MISSING ANSWERS`);
        }
        console.log(msg);

        // פירוט שגיאות (אם יש)
        if (missingInMaster.length > 0) {
            console.log(chalk.yellow(`   ⚠️  Missing Qs in Master:`));
            missingInMaster.forEach(q => console.log(chalk.gray(`      - ${q}`)));
        }
        if (extraInMaster.length > 0) {
            console.log(chalk.magenta(`   ⚠️  Extra Qs in Master:`));
            extraInMaster.forEach(q => console.log(chalk.gray(`      - ${q}`)));
        }
      }
    }

    // --- 3. שמירת התיקונים ---
    if (totalFixedAnswers > 0) {
        console.log(chalk.yellow(`\n💾 Saving ${totalFixedAnswers} repaired answers back to Master File...`));
        
        // כדי לא לכתוב את כל הקובץ (מה שעלול להיות כבד), נחלץ רק את עמודת התשובות
        // אבל הכי פשוט ובטוח זה לכתוב את כל הטווח מחדש, או לפחות את עמודת התשובות.
        // נכתוב את עמודת התשובות בלבד.
        
        const answerColumnData = masterRows.map(row => [row[cfg.masterAnswerCol] || ""]);
        
        // המרת אינדקס נומרי לאות (למשל 3 -> D)
        const colLetter = this.columnIndexToLetter(cfg.masterAnswerCol);
        
        await this.sheets.writeValues(
            cfg.masterSpreadsheetId, 
            `${cfg.masterTabName}!${colLetter}1`, 
            answerColumnData
        );
        console.log(chalk.green(`🎉 Successfully updated Master file!`));
    } else {
        console.log(chalk.gray(`\nNo missing answers found to repair.`));
    }

    console.log(chalk.gray("---------------------------------------------------"));
    if (totalErrors === 0) console.log(chalk.green.bold(`🏁 Scan Complete. Structure is clean.`));
    else console.log(chalk.red.bold(`🏁 Scan Complete. ${totalErrors} hotels have structure mismatches.`));
  }

  // עזר להמרת מספר לאות (0->A, 1->B...)
  private columnIndexToLetter(index: number): string {
    let temp, letter = '';
    while (index >= 0) {
        temp = (index) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        index = Math.floor((index) / 26) - 1;
    }
    return letter;
  }
}