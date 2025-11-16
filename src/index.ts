import { config } from "dotenv";
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { AIAgent } from "./core/agent.js";
import { SafetyManager } from "./config/safety.js";

import { SheetsService } from "./services/sheets.js";
import { TranslateFromSheetJob } from "./jobs/translate-from-sheet.js";
import { RewriteFromSheetJob } from "./jobs/rewrite-from-sheet.js";
import { ValidateLiteJob } from "./jobs/validate-lite.js";
import { runAllHotelsResearch } from "./jobs/faq-from-scratch.js";
import { MetaSchemaFromSheetJob } from "./jobs/meta-schema-from-sheet.js";
import { FaqAuditFromWebJob } from "./jobs/faq-audit-from-web.js";



// טעינת משתני סביבה
console.log(chalk.blue("🤖 Starting Hotel Research Agent..."));
config();

// יצירת מופעי המערכת
const safetyManager = new SafetyManager('development');
const agent = new AIAgent(safetyManager);
const sheets = new SheetsService("info@carmelon.co.il");

/**
 * רשימת המלונות לעיבוד (נוודא שמות נכונים!)
 */
const HOTELS = [
  

  "Leonardo Boutique Hotel Linz City Center",

];



  // ← התרגום
const SHEETS: Array<{ spreadsheet: string; tab?: string }> = [

    { spreadsheet: "https://docs.google.com/spreadsheets/d/1u5LykkVY3k1LbSLQjqbRv7NV0F91K-FS_hSrwDwJBns/edit?usp=sharing" },


];

/** שפות יעד קבועות (טאב נפרד ייווצר לכל שפה) */
const LANGS = ["de", "es", "fr", "ru", "he", "ar"];




type RewriteSheetItem = {
  spreadsheet: string;
  tab?: string;       // אם לא מצוין, ניקח את הטאב הראשון
  commentCol?: string; // ברירת מחדל: "E" (הערות)
  answerCol?: string;  // ברירת מחדל: "C" (תשובה מקורית)
  targetCol?: string;  // ברירת מחדל: "F" (עמודה חדשה לפלט)
  header?: string;     // ברירת מחדל: "Agent Final Answer"
};

const REWRITE_SHEETS: RewriteSheetItem[] = [
  {
    spreadsheet: "https://docs.google.com/spreadsheets/d/1AXobJoAQMpwCVNF4j_yTaH-XvFYJz6vo2J-A25kAk3c/edit?usp=sharing",
    commentCol: "E",      // ההערות של המלון
    answerCol: "C",       // התשובה המקורית
    targetCol: "F",       // לעמודה החדשה
    header: "Agent Final Answer"
  },



];

const REWRITE_FOLDER: string = process.env.REWRITE_FOLDER_ID ?? ""; 


// ← מטא+סכימה (קבצים/טאבים/שורה לכתיבה)
const META_SCHEMA_SHEETS: Array<{
  spreadsheet: string;   // לינק מלא של Google Sheets או רק ID
  tab?: string;          // לא חובה (אם ריק – הטאב הראשון)
  metaRow?: number;      // ברירת מחדל 70
  schemaRow?: number;    // ברירת מחדל 70
  metaStartCol?: string; // ברירת מחדל "A" → A70:C70
  schemaCol?: string;    // ברירת מחדל "E"  → E70
}> = [
  {
    spreadsheet: "https://docs.google.com/spreadsheets/d/1AXobJoAQMpwCVNF4j_yTaH-XvFYJz6vo2J-A25kAk3c/edit?usp=sharing",
    tab: "FAQ",          // אופציונלי
    metaRow: 70,
    metaStartCol: "A",
    schemaCol: "E",
  },
  
];

// ← מטא+סכימה (תיקייה בגוגל דרייב – ירוץ על כל הגיליונות בתיקייה)
const META_SCHEMA_FOLDER: string =
  "";


// ← ולידציות

type ValidateSheetItem = {
  spreadsheet: string;        // URL או ID
  tabs?: "ALL" | string[];    // ברירת מחדל: "ALL"
  writeCol?: string;          // ברירת מחדל: "H"
  verifyCol?: string;         // ברירת מחדל: "I"
};

const VALIDATE_SHEETS: ValidateSheetItem[] = [
  { spreadsheet: "", tabs: "ALL" },
];

const VALIDATE_FOLDER: string = "https://drive.google.com/drive/folders/1sFU1sOqY0RIS1CmZMe6kjxlTzYpbywNL?usp=sharing"; 
const VALIDATE_DEFAULT_TABS: "ALL" | string[] = "ALL";
const VALIDATE_DEFAULT_WRITE_COL = "F";
const VALIDATE_DEFAULT_VERIFY_COL = "G";




// NEW – FAQ Audit config


const FAQ_AUDIT_COUNTRY_URL = "https://www.leonardo-hotels.com/united-kingdom";
const FAQ_AUDIT_SHEET_TITLE = "United Kingdom Hotels FAQ Audit";




// מצב הפעלה: faq (ברירת מחדל) או translate
const MODE = (process.env.MODE ?? "faq").toLowerCase();

async function main() {
  if (MODE === "translate") {
    const job = new TranslateFromSheetJob(agent, sheets);

    for (const item of SHEETS) {
      try {
        const spreadsheetId = sheets.parseSpreadsheetId(item.spreadsheet);
        await job.run({
          spreadsheetId,
          sourceTab: item.tab,
          targetLangs: LANGS,
          translateHeader: true, // מתרגם גם את שורת הכותרת
        });
    
        console.log(chalk.green(`✅ Translated: ${item.spreadsheet} / tab "${item.tab}"`));
      } catch (err) {
        console.error(chalk.red("⚠️ Skipping sheet due to error:"), item, err);
        continue;
      }
    }

    console.log(chalk.cyan("🎉 Translate run completed."));

} else if (MODE === "rewrite") {
  const job = new RewriteFromSheetJob(agent, sheets);

  // 1) מזהים קבצים מרשימת REWRITE_SHEETS
  const fromList = [];
  for (const item of REWRITE_SHEETS) {
    try {
      const spreadsheetId = sheets.parseSpreadsheetId(item.spreadsheet);
      fromList.push({ spreadsheetId, item });
    } catch (err) {
      console.error(chalk.red("⚠️ Bad sheet link in REWRITE_SHEETS:"), item, err);
    }
  }

  // 2) מזהים קבצים מתיקייה (אם סופקה)
  let fromFolder: Array<{ spreadsheetId: string }> = [];
  if (REWRITE_FOLDER.trim()) {
    const folderId =
      REWRITE_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ??
      REWRITE_FOLDER.trim();
    try {
      const ids = await sheets.listSpreadsheetIdsInFolder(folderId);
      fromFolder = ids.map((spreadsheetId) => ({ spreadsheetId }));
      console.log(chalk.cyan(`📂 Found ${ids.length} spreadsheets in folder`));
    } catch (err) {
      console.error(chalk.red("⚠️ Failed to list folder sheets:"), err);
    }
  }

  // 3) מאחדים – קבצים ייחודיים בלבד
  const seen = new Set<string>();
  const targets = [...fromList, ...fromFolder].filter(({ spreadsheetId }) => {
    if (seen.has(spreadsheetId)) return false;
    seen.add(spreadsheetId);
    return true;
  });

  // 4) ריצה
  for (const t of targets) {
    const conf = REWRITE_SHEETS.find(
      x =>
        t.spreadsheetId === ((): string => {
          try { return sheets.parseSpreadsheetId(x.spreadsheet); } catch { return ""; }
        })()
    );

    try {
      await job.run({
        spreadsheetId: t.spreadsheetId,
        sourceTab: conf?.tab,
        commentCol: conf?.commentCol ?? "E",
        answerCol:  conf?.answerCol  ?? "C",
        targetCol:  conf?.targetCol  ?? "F",
        header:     conf?.header     ?? "Agent Final Answer",

        // ✨ חדש: בדיקת דקדוק לתשובה המקורית
        checkOriginalGrammar: true,
        grammarFixCol: "G",
        grammarFixHeader: "Answer Grammar Fix",
      });

      const title = await sheets.getSpreadsheetTitle(t.spreadsheetId);
      console.log(chalk.green(`✅ Rewrote & grammar-checked: ${title}`));
    } catch (err) {
      console.error(chalk.red("⚠️ Skipping due to error:"), t, err);
      continue;
    }
  }

  console.log(chalk.cyan("🎉 Rewrite run completed."));

} else if (MODE === "validate-lite") {
  const job = new ValidateLiteJob(agent, sheets);

  // מזהה IDs מרשימת הקבצים בראש הקובץ
  const parsedIds = VALIDATE_SHEETS.map(item => {
    try { return sheets.parseSpreadsheetId(item.spreadsheet); }
    catch { return ""; }
  }).filter(Boolean);

  // מזהה ID לתיקייה (אם מולא לינק/ID ב-VALIDATE_FOLDER)
  const folderId = VALIDATE_FOLDER.trim()
    ? (VALIDATE_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? VALIDATE_FOLDER.trim())
    : undefined;

  // ריצה אחת שמכסה גם רשימת קבצים וגם תיקייה → דוח אחד מרכזי
  await job.run({
    spreadsheetIds: parsedIds.length ? parsedIds : undefined,
    driveFolderId: folderId,
    tabs: VALIDATE_DEFAULT_TABS,    // "ALL" או ["FAQ", ...]
    writeCol: "G",                  // עמודת Issue
    fixCol:   "H",                  // עמודת Fix (Suggested)
    writeBack: true
  });

  console.log(chalk.cyan("🎉 Lite validation completed."));


} else if (MODE === "meta-schema") {
  const job = new MetaSchemaFromSheetJob(agent, sheets);

  // 1) קבצים מהרשימה
  const fromList: Array<{
    spreadsheetId: string;
    item: (typeof META_SCHEMA_SHEETS)[number];
  }> = [];
  for (const item of META_SCHEMA_SHEETS) {
    if (!item.spreadsheet) continue;
    try {
      const spreadsheetId = sheets.parseSpreadsheetId(item.spreadsheet);
      fromList.push({ spreadsheetId, item });
    } catch (err) {
      console.error(chalk.red("⚠️ Bad sheet link in META_SCHEMA_SHEETS:"), item, err);
    }
  }

  // 2) גם מתיקייה (אם מולאה)
  let fromFolder: Array<{ spreadsheetId: string }> = [];
  if (META_SCHEMA_FOLDER.trim()) {
    const folderId =
      META_SCHEMA_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ??
      META_SCHEMA_FOLDER.trim();
    try {
      const ids = await sheets.listSpreadsheetIdsInFolder(folderId);
      fromFolder = ids.map((spreadsheetId) => ({ spreadsheetId }));
      console.log(chalk.cyan(`📂 Found ${ids.length} spreadsheets in folder for meta-schema`));
    } catch (err) {
      console.error(chalk.red("⚠️ Failed to list meta-schema folder sheets:"), err);
    }
  }

  // 3) ייחוד
  const seen = new Set<string>();
  const targets = [
    ...fromList.map(x => ({ spreadsheetId: x.spreadsheetId, item: x.item })),
    ...fromFolder.map(x => ({ spreadsheetId: x.spreadsheetId, item: {} as any })),
  ].filter(({ spreadsheetId }) => {
    if (seen.has(spreadsheetId)) return false;
    seen.add(spreadsheetId);
    return true;
  });

  // 4) ריצה
  for (const t of targets) {
    const cfgItem = (t as any).item ?? {};
    try {
      await job.run({
        spreadsheetId: t.spreadsheetId,
        sourceTab: cfgItem.tab,                // אם לא סופק – הטאב הראשון
        metaRow: cfgItem.metaRow ?? 70,
        metaStartCol: cfgItem.metaStartCol ?? "A",
        schemaCol: cfgItem.schemaCol ?? "E",
                          // קודם F (Agent Final Answer), אחרת C
      });
      const title = await sheets.getSpreadsheetTitle(t.spreadsheetId);
      console.log(chalk.green(`✅ Meta & Schema created for: ${title}`));
    } catch (err) {
      console.error(chalk.red("⚠️ Skipping due to error:"), t, err);
      continue;
    }
  }

  console.log(chalk.cyan("🎉 Meta & Schema run completed."));


    } else if (MODE === "faq-audit") {                 // NEW
  const job = new FaqAuditFromWebJob(agent, sheets);
  const result = await job.run({
    countryUrl: FAQ_AUDIT_COUNTRY_URL,
    sheetTitle: FAQ_AUDIT_SHEET_TITLE,
    shareResults: true,
  });

  // לינק ישיר לגיליון + סיכום
  console.log("📄 Google Sheet:", `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`);
  console.log(
    chalk.green(
      `🧾 Hotels scanned: ${result.hotelsProcessed} | With FAQ: ${result.hotelsWithFaq} | Hotels with issues: ${result.hotelsWithProblems}`
    )
  );


  } else {
    await runAllHotelsResearch(agent, sheets, HOTELS);
  }
}

main().catch(err => {
  console.error(chalk.red("❌ Run failed:"), err);
  process.exit(1);
});

 