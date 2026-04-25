Error.stackTraceLimit = 0;
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
import { InjectLangToMasterJob, InjectLangToMasterConfig } from "./jobs/inject-hebrew-to-master.js";
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
import { QaLangMasterJob } from "./jobs/qa-lang-master.js";
import { QaMasterTriageJob, QaMasterTriageConfig } from "./jobs/qa-master-triage.js";
import { QaMasterApplyFixesJob } from "./jobs/qa-master-apply-fixes.js";
import type { InjectMetaSchemaToMasterConfig } from "./jobs/inject-meta-schema-to-master.js";
import { InjectMetaSchemaToMasterJob } from "./jobs/inject-meta-schema-to-master.js";
import { WrapPFromSheetJob } from "./jobs/wrap-p-from-sheet.js";
import { FaqAuditStructureFromWebJob } from "./jobs/faq-audit-structure-from-web.js";
import { SyncFgFromSourcesJob, SyncFgFromSourcesConfig } from "./jobs/sync-fg-from-sources.js";
import { TranslatableIdCrossCheckJob, TranslatableIdCrossCheckConfig } from "./jobs/translatable-id-crosscheck.js";
import { TidHotelInQuestionCrossCheckJob, TidHotelInQuestionCrossCheckConfig } from "./jobs/tid-hotel-in-question-crosscheck.js";
import { HotelQuestionDiscoveryJob } from "./jobs/hotel-question-discovery.js";
import { QnaConsistencyJob, QnaConsistencyConfig } from "./jobs/qna-consistency.js";
import { QaMasterSyncOriginalsJob, QaMasterSyncOriginalsConfig } from "./jobs/qa-master-sync-originals.js";
import { MasterCoverageFromSheetsJob, MasterCoverageFromSheetsConfig } from "./jobs/master-coverage-from-sheets.js";
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
 "master Wola",

];



  // ← התרגום
const SHEETS: Array<{ spreadsheet: string; tab?: string }> = [

    { spreadsheet: "https://docs.google.com/spreadsheets/d/1auzgM9OZvQO5r1o_emNJ2QDEmqKhI7OcMTD0eueaxac/edit?usp=sharing" },


];

const TRANSLATE_FOLDER: string = "";

const LANGS = ["it", ];



const ENRICH_CONFIG: EnrichConfig = {
  faqSpreadsheetId: "https://docs.google.com/spreadsheets/d/1Uz-Kp-3U_kiDhUTMnKZaLzt5zmZjRTBGRdfGNUCKt14/edit?usp=sharing",  // תכניסי את ה-ID מקובץ 1
  faqTabName: "faq",                       // שם הטאב בקובץ השאלות
  
  hotelsSpreadsheetId: "https://docs.google.com/spreadsheets/d/1RHjrYtzsnFaHAO8kNvmAfeZCzr68KcjHH4l-ZkIM3dE/edit?usp=sharing", // תכניסי את ה-ID מקובץ 2
  hotelsTabName: "Hotels",                   // לפי מה שראיתי בקובץ
  
  questionColIndex: 2, // עמודה C = אינדקס 2
  targetHotelCol: "A", 
  targetCountryCol: "B"
};


const FILTER_CONFIG = {
  // במקום מחרוזת אחת:
  // targetCountry: "Israel",

  // עכשיו אפשר כמה:
  targetCountry: ["Spain" ],

  spreadsheetId: "https://docs.google.com/spreadsheets/d/1Uz-Kp-3U_kiDhUTMnKZaLzt5zmZjRTBGRdfGNUCKt14/edit?usp=sharing",
  sourceTabName: "faq",
  countryColIndex: 1,
  hotelColIndex: 0
};
const INJECT_LANG_CONFIG: InjectLangToMasterConfig = {
  masterSpreadsheetId: "https://docs.google.com/spreadsheets/d/1LcrOpkKoGf3GPSdfIBzO_rhQ5WAiq6LM39xMmOg1pjk/edit?usp=sharing",
  masterTabName: "Sheet1",
  hotelsFolderId: "https://drive.google.com/drive/folders/1_gfwmAf-WGMSw_WzQVk05aGILn8lcX9K?usp=sharing",

  // חדש
  targetLang: "it", // למשל

  // אופציונלי - אם הטאבים שלך הם בדיוק "Sheet1 - DE"
  hotelLangTabBaseName: "Sheet1",
  // hotelLangTabName: "Sheet1 - DE", // אם רוצים לכפות שם מדויק

  overwriteExisting: false,
  dryRun: false,
};

const QA_LANG_MASTER_CONFIG = {
  spreadsheetId: "https://docs.google.com/spreadsheets/d/1LcrOpkKoGf3GPSdfIBzO_rhQ5WAiq6LM39xMmOg1pjk/edit?usp=sharing",
  tabName: "Sheet1",
  targetLang: "it",

  outputTabName: "QA - IT Master",
  templateTabName: "QA - TEMPLATE",

  maxIssuesInReport: 1500,

  checkMissingTarget: true,
  checkLanguageHeuristic: true,
  checkHotelNameInTarget: true,
  checkNumbersPreserved: true,
};


const QA_MASTER_TRIAGE_CONFIG: QaMasterTriageConfig = {
  spreadsheetId: "1LcrOpkKoGf3GPSdfIBzO_rhQ5WAiq6LM39xMmOg1pjk",
  sourceQaTabName: "QA - IT Master", // זה הטאב שהדטרמיניסטי מייצר
  targetLang: "it",

  outputTabName: "QA - IT True Issues",
  // templateTabName: "QA - TEMPLATE", // אופציונלי אם יש לך
  model: "o3",

  maxItemsToProcess: 800,
  aiBatchSize: 10,
  deterministicOnly: false,

  emptyCellMarker: "∅",
};


const QA_MASTER_SYNC_ORIGINALS_CONFIG: QaMasterSyncOriginalsConfig = {
  spreadsheetId: "1B3Uarv9a1CerDSENC3_CCuHqAHPVAQnMwOa39sxjMLs",
  triageTabName: "QA - IT True Issues",
  targetLang: "it",

  originalsRootFolderId: "1gm8IQdX_tmkSRYx8Tuf3sN2N2KwmiO3x",

  originalEnglishTabName: "Sheet1",
  originalTargetTabName: "Sheet1 – IT",

  emptyCellMarker: "∅",
  maxRowsToProcess: 500,

  updateOriginalEnglish: true,
  updateOriginalTarget: true,
  updateMasterAfterSync: false,

  // אם בעתיד תרצי גם לעדכן מאסטר מתוך אותו ג'וב
  masterTabName: "Sheet1",
};

// Apply fixes back to master (VLOOKUP-like)
const QA_MASTER_APPLY_FIXES_CONFIG = {
  spreadsheetId: "1B3Uarv9a1CerDSENC3_CCuHqAHPVAQnMwOa39sxjMLs",

  targetLang: "it",

  masterTabName: "Sheet1",          // או "QA - DE Master" אם זה הטאב שאת רוצה לעדכן בפועל
  triageTabName: "QA - IT True Issues",

  // התנהגות מומלצת:
  // applyOnlyWhenFixExists: true,
  // overwriteExisting: true/false,
  // dryRun: false,
};


const MASTER_COVERAGE_CONFIG: MasterCoverageFromSheetsConfig = {
  masterSpreadsheetId: "1xY2JkZuiT_W04NVWizeNVoG1kdv7KJPaEhOkJzG_04A",
  masterTabName: "Sheet1",
  masterHotelCol: 0,
  masterQuestionCol: 4,

  sourceFolderId: "https://drive.google.com/drive/folders/1_gfwmAf-WGMSw_WzQVk05aGILn8lcX9K?usp=sharing",
  sourceFolderRecursive: true,
  sourceSheets: [
    // { spreadsheet: "https://docs.google.com/spreadsheets/d/.../edit", tab: "Sheet1", hotelNameExact: "Leonardo ..." },
  ],
  sourceTabName: "Sheet1 – IT",
  sourceQuestionCol: 1,
  // sourceHotelCol: 0,

  reportTabName: "Master Coverage Report",
  writeReport: true,
  strictHotelNameMatch: false,
  failIfMissing: true,
  ignoreQuestionsContaining: [],
};


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
    tab: "Sheet1 – IT",
    metaRow: 70,
    metaStartCol: "A",
    schemaCol: "E",

    // NEW
    lang: "it",

  },
];

// ← מטא+סכימה (תיקייה בגוגל דרייב – ירוץ על כל הגיליונות בתיקייה)
const META_SCHEMA_FOLDER: string =
  "https://drive.google.com/drive/folders/1_zPQ1g2PJsplxAMQxtFNzTTYC35trNxT?usp=sharing";

const META_SCHEMA_FOLDER_DEFAULTS: Partial<(typeof META_SCHEMA_SHEETS)[number]> = {
  tab: "Sheet1 – IT",
  metaRow: 70,
  metaStartCol: "A",
  schemaCol: "E",
  lang: "it",
  // אין hotelNameMap כאן בכלל, כי זה לא עברית
};

const INJECT_META_SCHEMA_CONFIG: InjectMetaSchemaToMasterConfig = {
  masterSpreadsheetId: "1SMsvv3KUaj3fB4EkUw03ntMkSjINdtXTfK_FzmX5WKU",
  masterTabName: "Sheet1",

  hotelsFolderId: "https://drive.google.com/drive/folders/1EOyF1SyKy9aYVSfCYE0LzuMHYBOSWi4u?usp=sharing",

  targetLocale: "he",
  sourceTabName: "Sheet1 – IT",

  overwriteExisting: true,
  dryRun: false,
};



// Wrap-P (only column F) - single sheet (no folder)
const WRAP_P_SHEET: string =
  "https://docs.google.com/spreadsheets/d/1hFMr-OGAiNZEWfhznoeSGHvJJWmT8XL9xPkYyzaJrSw/edit?usp=sharing";


const FAQ_AUDIT_STRUCTURE_COUNTRY_URL =
  "https://www.leonardo-hotels.com/spain";

const FAQ_AUDIT_STRUCTURE_SHEET_TITLE =
 "Spain Hotels FAQ Audit - Structure Only";

// NEW – FAQ Audit config

//const FAQ_AUDIT_COUNTRY_URL = "https://www.leonardo-hotels.com/spain";
//const FAQ_AUDIT_SHEET_TITLE = "Spain Hotels FAQ Audit";

type SiteLocale = "en" | "he" | "de"  ;

const FAQ_AUDIT_CONFIG: {
  locale: SiteLocale;
  countryUrl: string;
  sheetTitle: string;
} = {
  locale: "he",
  countryUrl: "https://www.leonardo-hotels.co.il/germany",
  sheetTitle: "Germany Hotels FAQ Audit",
};


  



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
    spreadsheet: "https://docs.google.com/spreadsheets/d/1mI6M7_2DLAOkZDfaNvNhCV0NOFyI6_B5cY_WccIt-Ts/edit?usp=sharing",
    commentCol: "D",      // ההערות של המלון
    answerCol: "C",       // התשובה המקורית
    targetCol: "F",       // לעמודה החדשה
    header: "Agent Final Answer"
  },



];

const REWRITE_FOLDER: string = process.env.REWRITE_FOLDER_ID ?? ""; 


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



const DUPLICATE_REWRITE_FOLDER: string =
  process.env.DUPLICATE_REWRITE_FOLDER_ID ??
  "https://drive.google.com/drive/folders/1UgsRtC5Mno2D3e_FjqhaOI1etGAHP5Ch?usp=sharing";

const DUPLICATE_REWRITE_SHEETS: Array<{ spreadsheet: string; hebrewHotelNameExact?: string }> = [
  { spreadsheet: "" },
];

// אופציונלי: תיקיית יעד לפלט (אם לא - נשמור ליד המקור)
const DUPLICATE_REWRITE_OUTPUT_FOLDER: string =
  process.env.DUPLICATE_REWRITE_OUTPUT_FOLDER_ID ?? "";



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


const SYNC_FG_CONFIG: SyncFgFromSourcesConfig = {
  masterSpreadsheetId: "https://docs.google.com/spreadsheets/d/1hB3Yc-c9v466n00GtfOTTwb3bLtEPy1pBZX0p8hhU6E/edit?usp=sharing",
  masterTabName: "Sheet1",

  // אופציונלי: קבצים ספציפיים
  sources: [
    // { spreadsheetId: "https://docs.google.com/spreadsheets/d/AAA...", tabName: "Sheet1" },
  ],
};

// חדש: רשימת תיקיות שממנה נבנה sources דינמי
const SYNC_FG_FOLDERS: Array<{ folder: string; tabName?: string }> = [
  { folder: "https://drive.google.com/drive/folders/1DXNI_VFz4VISIdLd3KmA3Rskg9xwZ2b3?usp=sharing", tabName: "Sheet1" },
];

function extractFolderId(input: string): string {
  return input.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? input.trim();
}

async function expandSyncFgSourcesFromFolders(): Promise<Array<{ spreadsheetId: string; tabName?: string }>> {
  const out: Array<{ spreadsheetId: string; tabName?: string }> = [];

  for (const f of SYNC_FG_FOLDERS) {
    const folderId = extractFolderId(f.folder);
    const ids = await sheets.listSpreadsheetIdsInFolder(folderId);

    for (const id of ids) {
      out.push({ spreadsheetId: id, tabName: f.tabName });
    }
  }

  // dedupe לפי spreadsheetId
  const seen = new Set<string>();
  return out.filter(x => {
    if (seen.has(x.spreadsheetId)) return false;
    seen.add(x.spreadsheetId);
    return true;
  });
}

const TID_CROSSCHECK_CONFIG: TranslatableIdCrossCheckConfig = {
  masterSpreadsheetId: "17EyPMlXyaMf8qXvEHPfNTNooUDQgznM6PznPQEBy-Gw",
  masterTabName: "faq",
  masterTranslatableIdCol: 1, // B
  masterHotelCol: 2,          // C

  fixesSpreadsheetId: "1Ht0jb0wfGIVYdmaMZ6R8XnNNV6fpA-iDUTqY15L3ZWg",
  fixesTabName: "Sheet1",
  fixesTranslatableIdCol: 1,  // B
  fixesHotelCol: 2,           // C

  outputTitle: "TranslatableId CrossCheck Work File",
};


const TID_HOTEL_IN_QUESTION_CONFIG: TidHotelInQuestionCrossCheckConfig = {
  masterSpreadsheetId: "17EyPMlXyaMf8qXvEHPfNTNooUDQgznM6PznPQEBy-Gw",
  masterTabName: "faq",
  masterTranslatableIdCol: 1, // B
  masterHotelCol: 2,          // C

  fixesSpreadsheetId: "1Ht0jb0wfGIVYdmaMZ6R8XnNNV6fpA-iDUTqY15L3ZWg",
  fixesTabName: "Sheet1",
  fixesTranslatableIdCol: 1,  // B
  fixesQuestionCol: 2,        // C

  outputTitle: "TID Hotel-in-Question Work File",
};


const DISCOVER = {
  hotelName: "master Altona",
  locale: "en" as const, // "en" | "he" | "de"
  sheetTitle: "master Altona - Question Discovery",
};


const QNA_CONSISTENCY_CONFIG = {
  spreadsheet: "https://docs.google.com/spreadsheets/d/1pWyviz2bDZp-khUMnbZKd35IqOC8xC60telUYyT_4ic/edit?usp=sharing",
  tab: "Sheet1",
  mode: "ai-hybrid" as const,
};








// מצב הפעלה: faq (ברירת מחדל) או translate
const MODE = (process.env.MODE ?? "faq").toLowerCase();
console.log(chalk.yellow(`MODE = ${MODE}`));

async function main() {if (MODE === "translate") {
    console.log(chalk.magenta("Entered main()"));

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
          if (inputType === "folder") {
  try {
    const folderId =
      inputId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? inputId.trim();

    const ids = await sheets.listSpreadsheetIdsInFolderRecursive(folderId);

    targets = ids.map((id) => ({ spreadsheetId: id }));

    console.log(
      chalk.cyan(`📂 Loaded ${ids.length} sheets from dynamic folder tree`)
    );
  } catch (err) {
    console.error(chalk.red("❌ Failed to load folder tree:"), err);
  }
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
       let fromFolder: Array<{ spreadsheetId: string }> = [];

if (TRANSLATE_FOLDER.trim()) {
  const folderId =
    TRANSLATE_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ??
    TRANSLATE_FOLDER.trim();

  const ids = await sheets.listSpreadsheetIdsInFolderRecursive(folderId);

  fromFolder = ids.map((spreadsheetId) => ({ spreadsheetId }));

  console.log(
    chalk.cyan(`📂 Loaded ${ids.length} sheets from translate folder tree`)
  );
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

  // Master columns (Master: A-D)
  categoryCol: "A",
  questionCol: "B",
  answerCol: conf?.answerCol ?? "C",
  commentCol: conf?.commentCol ?? "D", // Corrected Answer במאסטר

  // Outputs
  targetCol: conf?.targetCol ?? "F",
  header: conf?.header ?? "Final Answer",

  // NEW outputs
  questionFixCol: "G",
  questionFixHeader: "Question Correction",
  qaNoteCol: "H",
  qaNoteHeader: "QA Note",

  // QA on answers (same behavior as before - controlled by the flag)
  checkOriginalGrammar: true,

  // Status
  hotelNameCol: "I",
  hotelNameHeader: "Hotel Name Notes",

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

  function inferLangFromTabName(tab?: string): string | undefined {
    const t = (tab ?? "").trim();
    if (!t) return undefined;

    // Supports: "Sheet1 - DE", "FAQ - HE", also unicode dashes
    const m = t.match(/[-\u2013\u2014]\s*([A-Za-z]{2,3})\s*$/);
    return m?.[1]?.toLowerCase();
  }

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

  // 2) גם מתיקייה (אם מולאה), כולל תיקיות פנימיות
let fromFolder: Array<{ spreadsheetId: string }> = [];
if (META_SCHEMA_FOLDER.trim()) {
  const folderId =
    META_SCHEMA_FOLDER.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ??
    META_SCHEMA_FOLDER.trim();

  try {
    const ids = await sheets.listSpreadsheetIdsInFolderRecursive(folderId);
    fromFolder = ids.map((spreadsheetId) => ({ spreadsheetId }));

    console.log(
      chalk.cyan(
        `📂 Found ${ids.length} spreadsheets in folder tree for meta-schema`
      )
    );
  } catch (err) {
    console.error(
      chalk.red("⚠️ Failed to list recursive meta-schema folder sheets:"),
      err
    );
  }
}

  // 3) ייחוד targets
  const seen = new Set<string>();
  const targets = [
    ...fromList.map((x) => ({ spreadsheetId: x.spreadsheetId, item: x.item })),
    ...fromFolder.map((x) => ({
      spreadsheetId: x.spreadsheetId,
      item: META_SCHEMA_FOLDER_DEFAULTS as any,
    })),
  ].filter(({ spreadsheetId }) => {
    if (seen.has(spreadsheetId)) return false;
    seen.add(spreadsheetId);
    return true;
  });

  // לא להריץ על קובץ המיפוי עצמו בטעות
  const mapSheetIdToSkip = (() => {
    const m = META_SCHEMA_FOLDER_DEFAULTS?.hotelNameMap?.spreadsheet;
    if (!m) return null;
    try {
      return sheets.parseSpreadsheetId(m);
    } catch {
      return null;
    }
  })();

  const finalTargets = targets.filter((t) => t.spreadsheetId !== mapSheetIdToSkip);

  // 4) ריצה
  for (const t of finalTargets) {
    const cfgItem = {
      ...META_SCHEMA_FOLDER_DEFAULTS,
      ...((t as any).item ?? {}),
      hotelNameMap: {
        ...(META_SCHEMA_FOLDER_DEFAULTS.hotelNameMap ?? {}),
        ...(((t as any).item ?? {}).hotelNameMap ?? {}),
      },
    };

    // lang: אם לא הוגדר, נסיק מהטאב. אם אין גם טאב עם סיומת, ניפול ל-"en"
    const inferredLang = inferLangFromTabName(cfgItem.tab);
    const finalLang = (cfgItem.lang ?? inferredLang ?? "en").toLowerCase();

    try {
      await job.run({
        spreadsheetId: t.spreadsheetId,

        // זה הטאב לעיבוד. יכול להיות כל טאב שתבחרי בקונפיג
        sourceTab: cfgItem.tab ?? undefined,

        metaRow: cfgItem.metaRow ?? 70,
        schemaRow: cfgItem.schemaRow ?? undefined,
        metaStartCol: cfgItem.metaStartCol ?? "A",
        schemaCol: cfgItem.schemaCol ?? "E",

        // השפה מגיעה מהקונפיג או משם הטאב
        lang: finalLang,

        // hotelNameMap רק לעברית
        hotelNameMap:
          finalLang.startsWith("he") && cfgItem.hotelNameMap?.spreadsheet
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
      console.log(chalk.green(`✅ Meta & Schema created for: ${title} (lang=${finalLang})`));
    } catch (err) {
      console.error(chalk.red("⚠️ Skipping due to error:"), t, err);
      continue;
    }
  }

  console.log(chalk.cyan("🎉 Meta & Schema run completed."));


} else if (MODE === "inject-meta-schema") {
  const job = new InjectMetaSchemaToMasterJob(sheets);

  await job.run(INJECT_META_SCHEMA_CONFIG);

  console.log(chalk.green("✅ inject-meta-schema completed"));



    } else if (MODE === "faq-audit") {                 // NEW
 const job = new FaqAuditFromWebJob(agent, sheets);

const result = await job.run({
  countryUrl: FAQ_AUDIT_CONFIG.countryUrl,
  sheetTitle: FAQ_AUDIT_CONFIG.sheetTitle,
  shareResults: true,
  locale: FAQ_AUDIT_CONFIG.locale
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
      targetCountry: FILTER_CONFIG.targetCountry, // יכול להיות string או string[]
      countryColIndex: FILTER_CONFIG.countryColIndex,
      hotelColIndex: FILTER_CONFIG.hotelColIndex,
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


} else if (MODE === "inject-lang") {
  const job = new InjectLangToMasterJob(sheets);

  try {
    const masterId = sheets.parseSpreadsheetId(INJECT_LANG_CONFIG.masterSpreadsheetId);

    const folderId = INJECT_LANG_CONFIG.hotelsFolderId.includes("folders/")
      ? (INJECT_LANG_CONFIG.hotelsFolderId.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? INJECT_LANG_CONFIG.hotelsFolderId)
      : INJECT_LANG_CONFIG.hotelsFolderId;

    await job.run({
      ...INJECT_LANG_CONFIG,
      masterSpreadsheetId: masterId,
      hotelsFolderId: folderId,
    });

    console.log(chalk.cyan("🎉 Inject language completed."));
  } catch (err) {
    console.error(chalk.red("❌ Inject language failed:"), err);
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


  } else if (MODE === "qa-lang-master") {
  const job = new QaLangMasterJob(sheets);

  try {
    const spreadsheetId = sheets.parseSpreadsheetId(QA_LANG_MASTER_CONFIG.spreadsheetId);

    await job.run({
      spreadsheetId,
      tabName: QA_LANG_MASTER_CONFIG.tabName,

      targetLang: (QA_LANG_MASTER_CONFIG.targetLang || "de").toLowerCase(),

      outputTabName: QA_LANG_MASTER_CONFIG.outputTabName,
      templateTabName: QA_LANG_MASTER_CONFIG.templateTabName,

      maxIssuesInReport: QA_LANG_MASTER_CONFIG.maxIssuesInReport,

      checkMissingTarget: QA_LANG_MASTER_CONFIG.checkMissingTarget,
      checkLanguageHeuristic: QA_LANG_MASTER_CONFIG.checkLanguageHeuristic,
      checkHotelNameInTarget: QA_LANG_MASTER_CONFIG.checkHotelNameInTarget,
      checkNumbersPreserved: QA_LANG_MASTER_CONFIG.checkNumbersPreserved,
    });

    console.log(chalk.cyan("🎉 QA lang master completed."));
  } catch (err) {
    console.error(chalk.red("❌ QA lang master failed:"), err);
  }

  } else if (MODE === "qa-master-triage") {
  const job = new QaMasterTriageJob(agent, sheets);
  await job.run(QA_MASTER_TRIAGE_CONFIG);

  } else if (MODE === "qa-master-apply-fixes") {
  const job = new QaMasterApplyFixesJob(sheets);

  // אם אצלך ה-Job מקבל גם agent (לא יודע בלי לראות את הקובץ),
  // אז תשני ל:
  // const job = new QaMasterApplyFixesJob(agent, sheets);

  await job.run({
    ...QA_MASTER_APPLY_FIXES_CONFIG,

    // מאפשר override דרך ENV בלי להדפיס כלום בטרמינל
    spreadsheetId: process.env.SPREADSHEET_ID
      ? sheets.parseSpreadsheetId(process.env.SPREADSHEET_ID)
      : QA_MASTER_APPLY_FIXES_CONFIG.spreadsheetId,

    targetLang: (process.env.TARGET_LANG ?? QA_MASTER_APPLY_FIXES_CONFIG.targetLang).toLowerCase(),

    masterTabName: process.env.QA_MASTER_TAB ?? QA_MASTER_APPLY_FIXES_CONFIG.masterTabName,
    triageTabName: process.env.QA_TRIAGE_TAB ?? QA_MASTER_APPLY_FIXES_CONFIG.triageTabName,
  });

  console.log(chalk.cyan("🎉 QA master apply fixes completed."));
} else if (MODE === "wrap-p") {
  const job = new WrapPFromSheetJob(sheets);

  // 1) קובץ שמגיע מה-UI (אם קיים) או fallback לקונפיג למעלה
  const inputId = (process.env.DYNAMIC_TARGET_ID?.trim() || WRAP_P_SHEET?.trim());

  if (!inputId) {
    console.log(chalk.red("❌ wrap-p mode requires a sheet link. Set WRAP_P_SHEET (top config) or DYNAMIC_TARGET_ID (UI)."));
    return;
  }

  // 2) רק קובץ בודד - בלי תיקיות
  const spreadsheetId = sheets.parseSpreadsheetId(inputId);

  try {
    await job.run({
      spreadsheetId,
      targetCol: "f",    
      skipHeader: true,
    });

    const title = await sheets.getSpreadsheetTitle(spreadsheetId);
    console.log(chalk.green(`✅ wrap-p done: ${title}`));
  } catch (err) {
    console.error(chalk.red("❌ wrap-p failed:"), err);
  }
} else if (MODE === "faq-audit-structure") {

  if (!FAQ_AUDIT_STRUCTURE_COUNTRY_URL) {
    throw new Error("Missing FAQ_AUDIT_STRUCTURE_COUNTRY_URL");
  }

  const job = new FaqAuditStructureFromWebJob(agent, sheets);

  const result = await job.run({
    countryUrl: FAQ_AUDIT_STRUCTURE_COUNTRY_URL,
    sheetTitle: FAQ_AUDIT_STRUCTURE_SHEET_TITLE,
    locale: "de",
    shareResults: true,
  });

  console.log(`https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`);


} else if (MODE === "sync-fg") {
  const job = new SyncFgFromSourcesJob(sheets);

  // 1) קבצים מהקונפיג הידני (אם יש)
  const manualSources = (SYNC_FG_CONFIG.sources ?? []).map(s => ({
    spreadsheetId: sheets.parseSpreadsheetId(s.spreadsheetId),
    tabName: s.tabName
  }));

  // 2) קבצים מתיקיות (המון)
  const folderSources = await expandSyncFgSourcesFromFolders();

  // 3) איחוד + dedupe
  const seen = new Set<string>();
  const sources = [...manualSources, ...folderSources].filter(x => {
    if (seen.has(x.spreadsheetId)) return false;
    seen.add(x.spreadsheetId);
    return true;
  });

  await job.run({
    ...SYNC_FG_CONFIG,
    masterSpreadsheetId: sheets.parseSpreadsheetId(SYNC_FG_CONFIG.masterSpreadsheetId),
    sources
  });

  console.log(chalk.cyan("🎉 sync-fg completed."));
  return;

  } else if (MODE === "tid-crosscheck") {
  const job = new TranslatableIdCrossCheckJob(sheets);
  await job.run(TID_CROSSCHECK_CONFIG);

  } else if (MODE === "tid-hotel-in-question") {
  const job = new TidHotelInQuestionCrossCheckJob(sheets);
  await job.run(TID_HOTEL_IN_QUESTION_CONFIG);

 } else if (MODE === "tid-hotel-in-question") {
  const job = new TidHotelInQuestionCrossCheckJob(sheets);
  await job.run(TID_HOTEL_IN_QUESTION_CONFIG);


  } else if (MODE === "discover-questions") {
  const job = new HotelQuestionDiscoveryJob(sheets);

  await job.run({
    hotelName: DISCOVER.hotelName,
    locale: DISCOVER.locale,
    sheetTitle: DISCOVER.sheetTitle,
  });

} else if (MODE === "qna-consistency") {
  try {
    const { QnaConsistencyJob } = await import("./jobs/qna-consistency.js");

    const job = new QnaConsistencyJob(agent, sheets);
    await job.run(QNA_CONSISTENCY_CONFIG);

    console.log(chalk.cyan("🎉 Q&A consistency completed."));
  } catch (err) {
    console.error(chalk.red("❌ Q&A consistency failed:"), err);
  }

  
} else if (MODE === "qa-master-sync-originals") {
  const job = new QaMasterSyncOriginalsJob(sheets);
  await job.run(QA_MASTER_SYNC_ORIGINALS_CONFIG);

  console.log(chalk.cyan("🎉 QA master sync originals completed."));

  }

  else if (MODE === "master-coverage") {
  const job = new MasterCoverageFromSheetsJob(sheets);

  await job.run(MASTER_COVERAGE_CONFIG);

  console.log(chalk.cyan("🎉 Master coverage run completed."));

   }

  else {
    await runAllHotelsResearch(agent, sheets, HOTELS);
  }
}

main().catch(err => {
  console.error(chalk.red("❌ Run failed:"), err);
  process.exit(1);
});

 