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
import { EnrichHotelDataJob, EnrichConfig } from "./jobs/enrich-hotel-data.js";
import { FilterByCountryJob } from "./jobs/filter-by-country.js"; 
import { CrossCheckJob, CrossCheckConfig } from "./jobs/cross-check.js";
import { TranslateMasterJob, TranslateMasterConfig } from "./jobs/translate-master.js";
import { runFaqPlayground } from "./jobs/faq-playground.js";
import { InjectHebrewToMasterJob, InjectHebrewToMasterConfig } from "./jobs/inject-hebrew-to-master.js";
import { DuplicateRewriteHebrewJob } from "./jobs/duplicate-rewrite-hebrew.js";
import { HotelsCatalogFromWebJob } from "./jobs/hotels-catalog-from-web.js";
import { SemanticMatchUnmatchedJob, SemanticMatchUnmatchedConfig } from "./jobs/semanticMatchUnmatched.js";
import { InjectHebrewFromUnmatchedJob, InjectHebrewFromUnmatchedConfig } from "./jobs/inject-hebrew-from-unmatched.js";
import { VlookupHebrewFromUnmatchedJob, VlookupHebrewFromUnmatchedConfig } from "./jobs/vlookup-hebrew-from-unmatched.js";
import { HebrewInjectionQaJob, HebrewInjectionQaConfig } from "./jobs/qa-hebrew-injection.js";
import { ImportHebrewMetaTagsJob } from "./jobs/import-hebrew-meta-from-folder.js";
import type { ImportHebrewMetaTagsConfig } from "./jobs/import-hebrew-meta-from-folder.js";
import { runFattalFaqResearch, FattalFaqConfig } from "./jobs/faq-fattal-il.js";
import { runAllPetalIsraelFaq } from "./jobs/faq-petal-israel.js";
import { TranslateFromSheetDemoJob } from "./jobs/translate-from-sheet-demo.js";




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
 "NYX Hotel Amsterdam Rembrandt Square",

];



  // ← התרגום
const SHEETS: Array<{ spreadsheet: string; tab?: string }> = [

    { spreadsheet: "https://docs.google.com/spreadsheets/d/1iMClaoGZ310UYkfHlY36Jvw6VHJzjHWN4jRyXBhoYUs/edit?usp=sharing" },


];

const TRANSLATE_FOLDER: string = "";

const LANGS = ["de"];




type RewriteSheetItem = {
  spreadsheet: string;
  tab?: string;       // אם לא מצוין, ניקח את הטאב הראשון
  commentCol?: string; // ברירת מחדל: "E" (הערות)
  answerCol?: string;  // ברירת מחדל: "C" (תשובה מקורית)
  targetCol?: string;  // ברירת מחדל: "F" (עמודה חדשה לפלט)
  header?: string;     // ברירת מחדל: "Agent Final Answer"
   hotelName?: string;
};

const REWRITE_SHEETS: RewriteSheetItem[] = [
  {
    spreadsheet: "https://docs.google.com/spreadsheets/d/1zzjKcfvj5YCRbKDOShLVUU_agH3zAdvNPIzJM-DLY3U/edit?usp=sharing",
    commentCol: "E",      // ההערות של המלון
    answerCol: "C",       // התשובה המקורית
    targetCol: "F",       // לעמודה החדשה
    header: "Agent Final Answer",
    hotelName: "hotel name"
  },



];

const REWRITE_FOLDER: string = process.env.REWRITE_FOLDER_ID ?? ""; 




// ← מטא+סכימה (קבצים/טאבים/שורה לכתיבה)
const META_SCHEMA_SHEETS: Array<{
  spreadsheet: string; // URL or ID
  tab?: string;
  metaRow?: number;
  schemaRow?: number;
  metaStartCol?: string;
  schemaCol?: string;

  lang?: string; // "he" / "en" ...
  hotelNameMap?: {
    spreadsheet: string; // URL or ID
    tabName?: string;
    rangeA1?: string;
    englishColIndex?: number;
    localizedColIndex?: number;
    headerRows?: number;
  };
}> = [
  {
    spreadsheet: "",
    tab: "Sheet1",
    metaRow: 70,
    metaStartCol: "A",
    schemaCol: "E",

    // NEW
    lang: "he",
    hotelNameMap: {
      spreadsheet: process.env.HOTEL_NAME_MAP_SHEET ?? "https://docs.google.com/spreadsheets/d/1ngNtQSIiLFWk_SjKZeX7-M_oT7A_idoqaPXX8BN0E9U/edit?usp=sharing", // לשים כאן את הלינק/ID של המיפוי
      // tabName: "Sheet1", // אם צריך
      // rangeA1: "A:B",
      // englishColIndex: 0,
      // localizedColIndex: 1,
      // headerRows: 1,
    },
  },
];

// ← מטא+סכימה (תיקייה בגוגל דרייב – ירוץ על כל הגיליונות בתיקייה)
const META_SCHEMA_FOLDER: string =
  "https://drive.google.com/drive/folders/1tgO5nKYwzy1O3QNlQe5NJAJ_XuRMTkz1?usp=sharing";

const META_SCHEMA_FOLDER_DEFAULTS: Partial<(typeof META_SCHEMA_SHEETS)[number]> = {
  tab: "Sheet1",
  metaRow: 70,
  metaStartCol: "A",
  schemaCol: "E",
  lang: "he",
  hotelNameMap: {
    spreadsheet:
      process.env.HOTEL_NAME_MAP_SHEET ??
      "https://docs.google.com/spreadsheets/d/1ngNtQSIiLFWk_SjKZeX7-M_oT7A_idoqaPXX8BN0E9U/edit?usp=sharing",
  },
};

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


const FAQ_AUDIT_COUNTRY_URL = "https://www.leonardo-hotels.co.il/israel";
const FAQ_AUDIT_SHEET_TITLE = "Israel4 Hotels FAQ Audit";



// Config for the matching job
const ENRICH_CONFIG: EnrichConfig = {
  faqSpreadsheetId: "https://docs.google.com/spreadsheets/d/17EyPMlXyaMf8qXvEHPfNTNooUDQgznM6PznPQEBy-Gw/edit?usp=sharing",  // תכניסי את ה-ID מקובץ 1
  faqTabName: "faq",                       // שם הטאב בקובץ השאלות
  
  hotelsSpreadsheetId: "https://docs.google.com/spreadsheets/d/1RHjrYtzsnFaHAO8kNvmAfeZCzr68KcjHH4l-ZkIM3dE/edit?usp=sharing", // תכניסי את ה-ID מקובץ 2
  hotelsTabName: "Hotels",                   // לפי מה שראיתי בקובץ
  
  questionColIndex: 2, // עמודה C = אינדקס 2
  targetHotelCol: "A", 
  targetCountryCol: "B"
};


const FILTER_CONFIG = {
  // המדינה שאת רוצה לייצר לה קובץ כרגע
  targetCountry: "Israel", 
  
  // הלינק לקובץ הראשי המלא (FAQ)
  spreadsheetId: "https://docs.google.com/spreadsheets/d/17EyPMlXyaMf8qXvEHPfNTNooUDQgznM6PznPQEBy-Gw/edit?usp=sharing", 
  
  sourceTabName: "faq", // או Sheet1, מה שזה לא יהיה
  
  // איזה עמודה מכילה את המדינה (אחרי ה-Enrichment)?
  // אם שמרנו את המדינה בעמודה B, האינדקס הוא 1.
  countryColIndex: 1,
  hotelColIndex: 0
};


// 👇 הגדרות למשימת הבדיקה (QA)
const CROSS_CHECK_CONFIG: CrossCheckConfig = {
  // הקובץ המרוכז שיצרנו (FAQ Export - Republic of Ireland)
  masterSpreadsheetId: "https://docs.google.com/spreadsheets/d/1k6o6d-EmL8a2oN-VP5bnZXGHfv7tzV1sG3fsi9XIRL8/edit?usp=sharing", 
  masterTabName: "Sheet1", 
  
  masterHotelCol: 0,    // עמודה A - שם המלון במאסטר
  masterQuestionCol: 2, // עמודה C - השאלה במאסטר (לפי הקובץ ששלחת)
  masterAnswerCol: 3,

  // התיקייה עם 7 המלונות של אירלנד
  targetFolderId: "https://drive.google.com/drive/folders/1_zPQ1g2PJsplxAMQxtFNzTTYC35trNxT?usp=sharing", 
  
  // איך נקרא הטאב בקבצים המקוריים? (בדרך כלל Questions או Sheet1)
  individualTabName: "Sheet1", 
  
  // איפה השאלה בקובץ המקורי? (בדרך כלל עמודה B)
  individualQuestionCol: 1, // עמודה B
  individualAnswerCol: 2 // עמודה C
};


const MASTER_TRANSLATE_CONFIG: TranslateMasterConfig = {
  spreadsheetId: "https://docs.google.com/spreadsheets/d/1691LFhQ-CFRJBjHnckVegfmc9yuY0JHaygylhgwcLII/edit?gid=0#gid=0", // ה-FAQ Export
  tabName: "Sheet1",
  
  targetLang: "de", // גרמנית
  
  colHotelName: 0, // A
  colQuestion: 2,  // C
  colAnswer: 3,    // D (התשובה המקורית עם ה-HTML)

  colTargetQ: "E", 
  colTargetA: "F"
};



const INJECT_HEBREW_CONFIG: InjectHebrewToMasterConfig = {
  masterSpreadsheetId: "https://docs.google.com/spreadsheets/d/1K0H1gy3M70xkWwGZDkExs1NGKEFX4tLSChECiJD7NfI/edit?usp=sharing",
  masterTabName: "Sheet1",
  hotelsFolderId: "https://drive.google.com/drive/folders/1A_lHBYgS5Y0PMH7Fbx6oyLQW7CuP9mue?usp=sharing",
  overwriteExisting: false,
  dryRun: false
};



const DUPLICATE_REWRITE_FOLDER: string =
  process.env.DUPLICATE_REWRITE_FOLDER_ID ??
  "https://drive.google.com/drive/folders/1UgsRtC5Mno2D3e_FjqhaOI1etGAHP5Ch?usp=sharing";

const DUPLICATE_REWRITE_SHEETS: Array<{ spreadsheet: string; hebrewHotelNameExact?: string }> = [
  { spreadsheet: "" },
];

// אופציונלי: תיקיית יעד לפלט (אם לא - נשמור ליד המקור)
const DUPLICATE_REWRITE_OUTPUT_FOLDER: string =
  process.env.DUPLICATE_REWRITE_OUTPUT_FOLDER_ID ?? "";



  

// Hotels Catalog config
const HOTELS_CATALOG_SHEET_TITLE = "Leonardo - Countries Cities Hotels Catalog";
const HOTELS_CATALOG_DESTINATIONS_URL = "https://www.leonardo-hotels.com/destinations";

// מה יהיה הבסיס (country/city/hotel הראשיים)
const HOTELS_CATALOG_BASE_LANG = "en";

// איזה שפות להוציא בעמודות
const HOTELS_CATALOG_LANGS = ["en", "he"];

// כמה בקשות במקביל להבאת שמות מלון בשפות נוספות
const HOTELS_CATALOG_I18N_CONCURRENCY = 6;

// דומיינים לפי שפה (ככה זה גמיש, ואת שולטת בזה כאן)
const HOTELS_CATALOG_LANG_ORIGINS: Record<string, string> = {
  en: "https://www.leonardo-hotels.com",
  he: "https://www.leonardo-hotels.co.il",
};


const SEMANTIC_MATCH_UNMATCHED_CONFIG: SemanticMatchUnmatchedConfig = {
  masterSpreadsheetId: "https://docs.google.com/spreadsheets/d/15v1wcpldYxNLVKcEXzr5KkImthqknXrTRouh6oKAn2I/edit?usp=sharing",
  hotelsFolderId: "https://drive.google.com/drive/folders/1A_lHBYgS5Y0PMH7Fbx6oyLQW7CuP9mue?usp=sharing",

  unmatchedTabName: "Unmatched (Hebrew Injection)",

  // בדיפולט זה מחפש בטאב הראשון במלון, בטווח B:C (שאלה, תשובה)
  // אם אצלך זה שונה, כאן משנים:
  // hotelEnglishTabName: "Sheet1",
  // hotelEnglishRangeA1: "B:C",

  strictHotelNameMatch: true,
  includeAnswerInQuery: true,

  // סף לקבלת התאמה "טובה"
  minScoreToWrite: 0.80,

  // מודל embedding
  model: "text-embedding-3-small",

  // כתיבה החל מעמודה F בטאב ה-Unmatched
  outputStartColLetter: "F",
};


const INJECT_HEBREW_FROM_UNMATCHED_CONFIG: InjectHebrewFromUnmatchedConfig = {
  masterSpreadsheetId: "https://docs.google.com/spreadsheets/d/1K0H1gy3M70xkWwGZDkExs1NGKEFX4tLSChECiJD7NfI/edit?usp=sharing",
  masterTabName: "Sheet1",
  hotelsFolderId: "https://drive.google.com/drive/folders/1A_lHBYgS5Y0PMH7Fbx6oyLQW7CuP9mue?usp=sharing",

  unmatchedTabName: "Unmatched (Hebrew Injection)",

  strictHotelNameMatch: true,
  minScoreToInject: 0.0,

  hotelEnglishTabName: "Sheet1",
  // hotelHebrewTabName: "Sheet1", // אם אין לך טאב עברי נפרד - תשימי אותו כאן, אחרת ינסה לזהות

  hotelRangeA1: "B:C",

  writeBackStatus: true,
  statusColLetter: "K",
};

const VLOOKUP_HEBREW_CONFIG: VlookupHebrewFromUnmatchedConfig = {
  masterSpreadsheetId: "https://docs.google.com/spreadsheets/d/15v1wcpldYxNLVKcEXzr5KkImthqknXrTRouh6oKAn2I/edit?usp=sharing",
  masterTabName: "Sheet1",
  unmatchedTabName: "Unmatched (Hebrew Injection)",

  // התנהגות
  overwriteExisting: false,
  copyQuestionHebrew: true, // לשנות ל-true אם רוצים גם עמודה E
  writeBackStatus: true,
  statusColLetter: "M",
};


const HEBREW_INJECTION_QA_CONFIG: HebrewInjectionQaConfig = {
  processedSpreadsheetId: "https://docs.google.com/spreadsheets/d/15v1wcpldYxNLVKcEXzr5KkImthqknXrTRouh6oKAn2I/edit?usp=sharing",
  processedTabName: "Sheet1",

  originalSpreadsheetId: "https://docs.google.com/spreadsheets/d/17EyPMlXyaMf8qXvEHPfNTNooUDQgznM6PznPQEBy-Gw/edit?usp=sharing",
  originalTabName: "faq",

  outputTabName: "QA - Hebrew Injection",
  unmatchedTabName: "Unmatched (Hebrew Injection)",

  compareEnglishText: true,
  checkMissingHebrew: true,
};


const HEBREW_META_MASTER_SHEET =
  "https://docs.google.com/spreadsheets/d/125x1kAt8HhqnVkmP2zrDJZ95c5cfUoeZZRm7Or3BHfw/edit?usp=sharing";

const HEBREW_HOTEL_NAME_MAP_SHEET =
  "https://docs.google.com/spreadsheets/d/1ngNtQSIiLFWk_SjKZeX7-M_oT7A_idoqaPXX8BN0E9U/edit?usp=sharing";

const HEBREW_QUESTIONNAIRES_FOLDER =
  "https://drive.google.com/drive/folders/1A_lHBYgS5Y0PMH7Fbx6oyLQW7CuP9mue?usp=sharing";
const IMPORT_HEBREW_META_TAGS_CONFIG: ImportHebrewMetaTagsConfig = {

  
  // dest (master)
  masterSpreadsheetId: HEBREW_META_MASTER_SHEET,
  masterTabName: "Sheet1",
  masterHotelColIndex: 0, // A - אם אצלך שם המלון בעמודה אחרת, תשני את האינדקס

  // source folder (all questionnaires)
  questionnairesFolderId: HEBREW_QUESTIONNAIRES_FOLDER,

  // mapping (he <-> en)
  hotelNameMap: {
    spreadsheetId: HEBREW_HOTEL_NAME_MAP_SHEET,
    tabName: "Hotels Catalog",
    rangeA1: "A:B",
    englishColIndex: 0,
    localizedColIndex: 1,
    headerRows: 1,
  },

  // source pull points (second tab + cells)
  sourceTabIndex0: 1, // הטאב השני
  pull: {
    metaTitleA1: "A71",
    metaDescriptionA1: "B71",
    h1A1: "C71",
    schemaA1: "E74",
  },

  // write-back columns in master
  writeBack: {
    schemaCol: "I",       // seo_head_after2
    titleCol: "M",        // seo_title he
    descriptionCol: "O",  // seo_description he
    h1Col: "W",           // title he (H1)
  },

  dryRun: false,
};

const FATTAL_CONFIG: FattalFaqConfig = {
  hotels: [
    "מלון לאונרדו פלאזה אשדוד",
  ]
};








// מצב הפעלה: faq (ברירת מחדל) או translate
const MODE = (process.env.MODE ?? "faq").toLowerCase();

async function main() {if (MODE === "translate") {
    const job = new TranslateFromSheetJob(agent, sheets);

    // --- לוגיקה חדשה: תמיכה בממשק הוובי ---
    let targets: Array<{ spreadsheetId: string; tab?: string }> = [];
    let targetLangs = LANGS; // ברירת מחדל מהקוד

    // 1. אם הגיעו שפות מהאתר - נשתמש בהן
    if (process.env.DYNAMIC_LANGS) {
      targetLangs = process.env.DYNAMIC_LANGS.split(',').map(s => s.trim()).filter(Boolean);
      console.log(chalk.magenta(`🌐 Using dynamic languages: ${targetLangs.join(', ')}`));
    }

    // 2. אם הגיע ID מהאתר
    if (process.env.DYNAMIC_TARGET_ID) {
        const inputId = process.env.DYNAMIC_TARGET_ID;
        const inputType = process.env.DYNAMIC_INPUT_TYPE || 'sheet';

        console.log(chalk.magenta(`🎯 Dynamic Input: ${inputType} -> ${inputId}`));

        if (inputType === 'folder') {
            // אם זו תיקייה - מביאים את כל הקבצים ממנה
            try {
                const folderId = inputId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? inputId;
                const ids = await sheets.listSpreadsheetIdsInFolder(folderId);
                targets = ids.map(id => ({ spreadsheetId: id }));
                console.log(chalk.cyan(`📂 Loaded ${ids.length} sheets from dynamic folder`));
            } catch (err) {
                console.error(chalk.red("❌ Failed to load folder:"), err);
            }
        } else {
            // אם זה קובץ בודד
            try {
                 const sheetId = sheets.parseSpreadsheetId(inputId);
                 targets = [{ spreadsheetId: sheetId }];
            } catch (err) {
                console.error(chalk.red("❌ Invalid Sheet ID provided"));
            }
        }
        
    } 

    
    else {
        // --- אם לא הגיע כלום מהאתר, עובדים כרגיל (כמו קודם) ---
        // 1) קבצים מרשימת SHEETS
        const fromList = SHEETS.map(item => {
            try { return { spreadsheetId: sheets.parseSpreadsheetId(item.spreadsheet), tab: item.tab }; }
            catch { return null; }
        }).filter(Boolean) as any[];

        // 2) קבצים מתיקייה קבועה
        let fromFolder: any[] = [];
        if (TRANSLATE_FOLDER.trim()) {
            const fId = TRANSLATE_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? TRANSLATE_FOLDER;
            const ids = await sheets.listSpreadsheetIdsInFolder(fId);
            fromFolder = ids.map(spreadsheetId => ({ spreadsheetId }));
        }

        // איחוד
        const seen = new Set<string>();
        targets = [...fromList, ...fromFolder].filter(t => {
            if (seen.has(t.spreadsheetId)) return false;
            seen.add(t.spreadsheetId);
            return true;
        });
    }

    // --- ביצוע הריצה ---
    if (targets.length === 0) {
        console.log(chalk.yellow("⚠️ No targets found to translate."));
    }

    for (const t of targets) {
      try {
        await job.run({
          spreadsheetId: t.spreadsheetId,
          sourceTab: t.tab,
          targetLangs: targetLangs, // שולחים את השפות (הדינמיות או הקבועות)
          translateHeader: true,
        });
        const title = await sheets.getSpreadsheetTitle(t.spreadsheetId);
        console.log(chalk.green(`✅ Translated: ${title}`));
      } catch (err) {
        console.error(chalk.red("⚠️ Skipping sheet due to error:"), t.spreadsheetId, err);
        continue;
      }
    }
    console.log(chalk.cyan("🎉 Translate run completed."));



} else if (MODE === "translate-demo") {
  const job = new TranslateFromSheetDemoJob(agent, sheets);

  try {
    await job.runFromEnv();
    console.log(chalk.green("✅ translate-demo completed"));
  } catch (e) {
    console.log(chalk.red("❌ translate-demo failed:"), e);
  }



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

        // NEW: question grammar
        questionGrammarFixCol: "H",
        questionGrammarFixHeader: "Question Grammar Fix",

        // NEW: hotel name notes
        hotelNameCol: "I",
        hotelNameHeader: "Hotel Name Notes",

        // NEW: hotel name for this sheet (if defined in REWRITE_SHEETS)
        hotelName: conf?.hotelName
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
  ...fromFolder.map(x => ({ spreadsheetId: x.spreadsheetId, item: META_SCHEMA_FOLDER_DEFAULTS as any })),
].filter(({ spreadsheetId }) => {
  if (seen.has(spreadsheetId)) return false;
  seen.add(spreadsheetId);
  return true;
});

  const mapSheetIdToSkip = (() => {
  const m = META_SCHEMA_FOLDER_DEFAULTS?.hotelNameMap?.spreadsheet;
  if (!m) return null;
  try { return sheets.parseSpreadsheetId(m); } catch { return null; }
})();

const finalTargets = targets.filter(t => t.spreadsheetId !== mapSheetIdToSkip);

for (const t of finalTargets) {
  const cfgItem = {
    ...META_SCHEMA_FOLDER_DEFAULTS,
    ...((t as any).item ?? {}),
    hotelNameMap: {
      ...(META_SCHEMA_FOLDER_DEFAULTS.hotelNameMap ?? {}),
      ...(((t as any).item ?? {}).hotelNameMap ?? {}),
    },
  };

  try {
    await job.run({
      spreadsheetId: t.spreadsheetId,
      sourceTab: cfgItem.tab ?? undefined,

      metaRow: cfgItem.metaRow ?? 70,
      schemaRow: cfgItem.schemaRow ?? undefined,
      metaStartCol: cfgItem.metaStartCol ?? "A",
      schemaCol: cfgItem.schemaCol ?? "E",

      lang: cfgItem.lang ?? "en",

      hotelNameMap: cfgItem.hotelNameMap?.spreadsheet
        ? {
            spreadsheetId: sheets.parseSpreadsheetId(cfgItem.hotelNameMap.spreadsheet),
            tabName: cfgItem.hotelNameMap.tabName ?? undefined,
            rangeA1: cfgItem.hotelNameMap.rangeA1 ?? undefined,
            englishColIndex: cfgItem.hotelNameMap.englishColIndex ?? undefined,
            localizedColIndex: cfgItem.hotelNameMap.localizedColIndex ?? undefined,
            headerRows: cfgItem.hotelNameMap.headerRows ?? undefined,
          }
        : undefined,
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
  type SiteLocale = "en" | "he" | "de";

const LOCALE: SiteLocale = "he";

const COUNTRY_URL_BY_LOCALE: Record<SiteLocale, string> = {
  en: "https://www.leonardo-hotels.com/israel",
  he: "https://www.leonardo-hotels.co.il/israel",
  de: "https://www.leonardo-hotels.de/israel",
};

const result = await job.run({
  countryUrl: COUNTRY_URL_BY_LOCALE[LOCALE],
  sheetTitle: FAQ_AUDIT_SHEET_TITLE,
  shareResults: true,
  locale: LOCALE
});

  // לינק ישיר לגיליון + סיכום
  console.log("📄 Google Sheet:", `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`);
  console.log(
    chalk.green(
      `🧾 Hotels scanned: ${result.hotelsProcessed} | With FAQ: ${result.hotelsWithFaq} | Hotels with issues: ${result.hotelsWithProblems}`
    )
  );

} else if (MODE === "match-hotels") {
  const job = new EnrichHotelDataJob(sheets);
  try {
    // במקרה הזה ה-IDs כבר בתוך הקונפיגורציה, אבל אם צריך פרסור:
    const faqId = sheets.parseSpreadsheetId(ENRICH_CONFIG.faqSpreadsheetId);
    const hotelsId = sheets.parseSpreadsheetId(ENRICH_CONFIG.hotelsSpreadsheetId);

    await job.run({
      ...ENRICH_CONFIG,
      faqSpreadsheetId: faqId,
      hotelsSpreadsheetId: hotelsId
    });

  } catch (err) {
    console.error(chalk.red("❌ Match hotels failed:"), err);
  }

} else if (MODE === "filter-country") {
  const job = new FilterByCountryJob(sheets);
  try {
    const sheetId = sheets.parseSpreadsheetId(FILTER_CONFIG.spreadsheetId);
    
    await job.run({
      sourceSpreadsheetId: sheetId,
      sourceTabName: FILTER_CONFIG.sourceTabName,
      targetCountry: FILTER_CONFIG.targetCountry,
      countryColIndex: FILTER_CONFIG.countryColIndex,
      hotelColIndex: FILTER_CONFIG.hotelColIndex // 👈 להעביר גם את זה
    });
  } catch (err) {
    console.error(chalk.red("❌ Filter job failed:"), err);
  }


} else if (MODE === "cross-check") {
  const job = new CrossCheckJob(sheets);
  try {
    // 👇 התיקון: חילוץ ה-ID מתוך הלינק המלא (גם לקובץ וגם לתיקייה)
    
    // 1. חילוץ ID לקובץ המאסטר
    const masterId = sheets.parseSpreadsheetId(CROSS_CHECK_CONFIG.masterSpreadsheetId);

    // 2. חילוץ ID לתיקייה
    const folderId = CROSS_CHECK_CONFIG.targetFolderId.includes("folders/") 
        ? CROSS_CHECK_CONFIG.targetFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? CROSS_CHECK_CONFIG.targetFolderId
        : CROSS_CHECK_CONFIG.targetFolderId;

    console.log(chalk.gray(`   Debug: Master ID extracted: ${masterId}`));
    console.log(chalk.gray(`   Debug: Folder ID extracted: ${folderId}`));

    await job.run({
      ...CROSS_CHECK_CONFIG,
      masterSpreadsheetId: masterId, // שולחים את ה-ID הנקי
      targetFolderId: folderId       // שולחים את ה-ID הנקי
    });

  } catch (err) {
    console.error(chalk.red("❌ Cross-check failed:"), err);
  }

} else if (MODE === "translate-master") {
  const job = new TranslateMasterJob(agent, sheets);
  try {
    const sheetId = sheets.parseSpreadsheetId(MASTER_TRANSLATE_CONFIG.spreadsheetId);
    await job.run({
      ...MASTER_TRANSLATE_CONFIG,
      spreadsheetId: sheetId
    });
  } catch (err) {
    console.error(chalk.red("❌ Master Translation failed:"), err);
  }

} else if (MODE === "faq-playground") {
  console.log(chalk.blue("🎡 Entering FAQ Playground..."));

  if (!process.env.DYNAMIC_PAYLOAD) {
    console.error(chalk.red("❌ Error: No payload received from Web Interface."));
  } else {
    try {
      const payload = JSON.parse(process.env.DYNAMIC_PAYLOAD);

      // NEW: UI mode (subjects + tasks)
      if (Array.isArray(payload?.tasks)) {
        const subjects: string[] = Array.isArray(payload?.subjects)
          ? payload.subjects.map((s: string) => String(s).trim()).filter(Boolean)
          : String(payload?.subjects || "")
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean);

        if (subjects.length === 0) {
          console.log(chalk.yellow("⚠️ No subjects provided."));
        } else {
          await runFaqPlayground(agent, sheets, {
            subjects,
            tasks: payload.tasks,
          });
        }
        return;
      }

      // Legacy playground mode (hotels + steps + prompts)
      const hotels: string[] = Array.isArray(payload?.hotels)
        ? payload.hotels.map((h: string) => String(h).trim()).filter(Boolean)
        : String(payload?.hotels || "")
            .split("\n")
            .map((h) => h.trim())
            .filter(Boolean);

      if (hotels.length === 0) {
        console.log(chalk.yellow("⚠️ No hotels provided."));
      } else {
        await runFaqPlayground(agent, sheets, {
          hotels,
          steps: payload.steps,
          prompts: payload.prompts,
        });
      }
    } catch (e) {
      console.error(chalk.red("❌ JSON Parse Error:"), e);
    }
  }


  } else if (MODE === "inject-hebrew") {
  const job = new InjectHebrewToMasterJob(sheets);

  try {
    // 1) Master sheet ID (clean)
    const masterId = sheets.parseSpreadsheetId(INJECT_HEBREW_CONFIG.masterSpreadsheetId);

    // 2) Folder ID (clean)
    const folderId = INJECT_HEBREW_CONFIG.hotelsFolderId.includes("folders/")
      ? (INJECT_HEBREW_CONFIG.hotelsFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? INJECT_HEBREW_CONFIG.hotelsFolderId)
      : INJECT_HEBREW_CONFIG.hotelsFolderId;

    await job.run({
      ...INJECT_HEBREW_CONFIG,
      masterSpreadsheetId: masterId,
      hotelsFolderId: folderId
    });

    console.log(chalk.cyan("🎉 Inject Hebrew completed."));
  } catch (err) {
    console.error(chalk.red("❌ Inject Hebrew failed:"), err);
  }


} else if (MODE === "semantic-match-unmatched") {
  const job = new SemanticMatchUnmatchedJob(sheets);

  try {
    const masterId = sheets.parseSpreadsheetId(SEMANTIC_MATCH_UNMATCHED_CONFIG.masterSpreadsheetId);

    const folderId = SEMANTIC_MATCH_UNMATCHED_CONFIG.hotelsFolderId.includes("folders/")
      ? (SEMANTIC_MATCH_UNMATCHED_CONFIG.hotelsFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1]
          ?? SEMANTIC_MATCH_UNMATCHED_CONFIG.hotelsFolderId)
      : SEMANTIC_MATCH_UNMATCHED_CONFIG.hotelsFolderId;

    await job.run({
      ...SEMANTIC_MATCH_UNMATCHED_CONFIG,
      masterSpreadsheetId: masterId,
      hotelsFolderId: folderId,
    });

    console.log(chalk.cyan("🎉 Semantic match unmatched completed."));
  } catch (err) {
    console.error(chalk.red("❌ Semantic match unmatched failed:"), err);
  }
  
} else if (MODE === "vlookup-hebrew") {
  const job = new VlookupHebrewFromUnmatchedJob(sheets);

  try {
    const masterId = sheets.parseSpreadsheetId(VLOOKUP_HEBREW_CONFIG.masterSpreadsheetId);

    await job.run({
      ...VLOOKUP_HEBREW_CONFIG,
      masterSpreadsheetId: masterId,
    });

    console.log(chalk.cyan("🎉 Vlookup Hebrew completed."));
  } catch (err) {
    console.error(chalk.red("❌ Vlookup Hebrew failed:"), err);
  }



  } else if (MODE === "duplicate-rewrite-hebrew") {
  const job = new DuplicateRewriteHebrewJob(agent, sheets);

  // Dynamic input (כמו translate)
  let targets: Array<{ spreadsheetId: string; hebrewHotelNameExact?: string }> = [];

  const outputFolderId = DUPLICATE_REWRITE_OUTPUT_FOLDER.trim()
    ? (DUPLICATE_REWRITE_OUTPUT_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? DUPLICATE_REWRITE_OUTPUT_FOLDER.trim())
    : undefined;

  if (process.env.DYNAMIC_TARGET_ID) {
    const inputId = process.env.DYNAMIC_TARGET_ID;
    const inputType = (process.env.DYNAMIC_INPUT_TYPE || "sheet").toLowerCase();

    if (inputType === "folder") {
      const folderId = inputId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? inputId;
      const ids = await sheets.listSpreadsheetIdsInFolder(folderId);
      targets = ids.map((id) => ({ spreadsheetId: id }));
    } else {
      const sheetId = sheets.parseSpreadsheetId(inputId);
      targets = [{ spreadsheetId: sheetId }];
    }
  } else {
    // From list
    const fromList = DUPLICATE_REWRITE_SHEETS
      .map((x) => {
        try {
          return { spreadsheetId: sheets.parseSpreadsheetId(x.spreadsheet), hebrewHotelNameExact: x.hebrewHotelNameExact };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as any[];

    // From folder
    let fromFolder: any[] = [];
    if (DUPLICATE_REWRITE_FOLDER.trim()) {
      const folderId = DUPLICATE_REWRITE_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? DUPLICATE_REWRITE_FOLDER.trim();
      const ids = await sheets.listSpreadsheetIdsInFolder(folderId);
      fromFolder = ids.map((spreadsheetId) => ({ spreadsheetId }));
    }

    const seen = new Set<string>();
    targets = [...fromList, ...fromFolder].filter((t) => {
      if (seen.has(t.spreadsheetId)) return false;
      seen.add(t.spreadsheetId);
      return true;
    });
  }

  for (const t of targets) {
    try {
      const res = await job.run({
        spreadsheetId: t.spreadsheetId,
        outputFolderId,
        questionCol: 1,            // B
        answerCol: 2,              // C
        headerRow: 1,
        hebrewHotelNameExact: t.hebrewHotelNameExact, // אם רוצים לקבע ידנית
        rewriteStrength: "strong"  // לא עדין מדי
      });

      const title = await sheets.getSpreadsheetTitle(t.spreadsheetId);
      console.log(chalk.green(`✅ Duplicated + rewritten Hebrew tab: ${title}`));
      console.log(chalk.gray(`   New: https://docs.google.com/spreadsheets/d/${res.newSpreadsheetId}/edit`));
    } catch (err) {
      console.error(chalk.red("⚠️ Skipping due to error:"), t, err);
      continue;
    }
  }

  console.log(chalk.cyan("🎉 Duplicate Hebrew rewrite completed."));


} else if (MODE === "hotels-catalog") {
  const job = new HotelsCatalogFromWebJob(sheets);

  const languages = HOTELS_CATALOG_LANGS.map(code => {
    const origin = HOTELS_CATALOG_LANG_ORIGINS[code];
    return origin ? { code, origin } : code;
  });

  const res = await job.run({
    destinationsUrl: HOTELS_CATALOG_DESTINATIONS_URL,
    sheetTitle: HOTELS_CATALOG_SHEET_TITLE,

    baseLanguageCode: HOTELS_CATALOG_BASE_LANG,
    languages,
    i18nConcurrency: HOTELS_CATALOG_I18N_CONCURRENCY,
  });

  console.log("📄 Google Sheet:", `https://docs.google.com/spreadsheets/d/${res.spreadsheetId}/edit`);
  console.log(`✅ Countries: ${res.countries} | Cities: ${res.cities} | Hotels: ${res.hotels}`);



  } else if (MODE === "inject-hebrew-from-unmatched") {
  const job = new InjectHebrewFromUnmatchedJob(sheets);

  try {
    const masterId = sheets.parseSpreadsheetId(INJECT_HEBREW_FROM_UNMATCHED_CONFIG.masterSpreadsheetId);

    const folderId = INJECT_HEBREW_FROM_UNMATCHED_CONFIG.hotelsFolderId.includes("folders/")
      ? (INJECT_HEBREW_FROM_UNMATCHED_CONFIG.hotelsFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1]
          ?? INJECT_HEBREW_FROM_UNMATCHED_CONFIG.hotelsFolderId)
      : INJECT_HEBREW_FROM_UNMATCHED_CONFIG.hotelsFolderId;

    await job.run({
      ...INJECT_HEBREW_FROM_UNMATCHED_CONFIG,
      masterSpreadsheetId: masterId,
      hotelsFolderId: folderId,
    });

    console.log(chalk.cyan("🎉 Inject Hebrew from Unmatched completed."));
  } catch (err) {
    console.error(chalk.red("❌ Inject Hebrew from Unmatched failed:"), err);
  }

  } else if (MODE === "qa-hebrew-injection") {
  const job = new HebrewInjectionQaJob(sheets, agent);

  try {
    const processedId = sheets.parseSpreadsheetId(HEBREW_INJECTION_QA_CONFIG.processedSpreadsheetId);
    const originalId = sheets.parseSpreadsheetId(HEBREW_INJECTION_QA_CONFIG.originalSpreadsheetId);

    await job.run({
      ...HEBREW_INJECTION_QA_CONFIG,
      processedSpreadsheetId: processedId,
      originalSpreadsheetId: originalId,
      aiSemanticCheck: true,
aiBatchSize: 20,
aiMinScore: 0.85,
aiMaxRows: 3000,
    });

    console.log(chalk.cyan("🎉 Hebrew Injection QA completed."));
  } catch (err) {
    console.error(chalk.red("❌ Hebrew Injection QA failed:"), err);
  }


} else if (MODE === "import-hebrew-meta-tags") {
  const job = new ImportHebrewMetaTagsJob(sheets);

  try {
    const masterId = sheets.parseSpreadsheetId(IMPORT_HEBREW_META_TAGS_CONFIG.masterSpreadsheetId);

    const folderId = IMPORT_HEBREW_META_TAGS_CONFIG.questionnairesFolderId.includes("folders/")
      ? (IMPORT_HEBREW_META_TAGS_CONFIG.questionnairesFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1]
          ?? IMPORT_HEBREW_META_TAGS_CONFIG.questionnairesFolderId)
      : IMPORT_HEBREW_META_TAGS_CONFIG.questionnairesFolderId;

    const mapSheetId = sheets.parseSpreadsheetId(IMPORT_HEBREW_META_TAGS_CONFIG.hotelNameMap.spreadsheetId);

    await job.run({
      ...IMPORT_HEBREW_META_TAGS_CONFIG,
      masterSpreadsheetId: masterId,
      questionnairesFolderId: folderId,
      hotelNameMap: {
        ...IMPORT_HEBREW_META_TAGS_CONFIG.hotelNameMap,
        spreadsheetId: mapSheetId,
      },
    });

    console.log(chalk.cyan("🎉 Import Hebrew meta tags completed."));
  } catch (err) {
    console.error(chalk.red("❌ Import Hebrew meta tags failed:"), err);
  }
  

} else if (MODE === "fattal-faq") {
    await runFattalFaqResearch(agent, sheets, FATTAL_CONFIG);

    } else if (MODE === "faq-petal-israel") {
  try {
    await runAllPetalIsraelFaq(agent, sheets, HOTELS);
    console.log(chalk.cyan("🎉 Petal Israel FAQ completed."));
  } catch (err) {
    console.error(chalk.red("❌ Petal Israel FAQ failed:"), err);
  }



  
  } else {
    await runAllHotelsResearch(agent, sheets, HOTELS);
  }
}

main().catch(err => {
  console.error(chalk.red("❌ Run failed:"), err);
  process.exit(1);
});

 