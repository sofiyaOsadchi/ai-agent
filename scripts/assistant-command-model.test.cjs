// Pure-function unit tests for public/assistant-command-model.js.
// Run: node scripts/assistant-command-model.test.cjs
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const file = process.argv[2] || path.join(__dirname, "..", "public", "assistant-command-model.js");
const code = fs.readFileSync(file, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const model = sandbox.window.AssistantCommandModel;
const plan = (text, snapshot = {}) => model.planDeterministicCommands(text, snapshot);

const SHEET = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit";
const SHEET2 = "https://docs.google.com/spreadsheets/d/2ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321/edit";
const FOLDER = "https://drive.google.com/drive/folders/1FoLdErAbCdEfGhIjKlMnOpQr";
const SITE = "https://www.example-hotel.com";

const memorySnapshot = {
  latestSheetUrl: SHEET,
  lastSheetUrl: SHEET,
  latestGeneratedSheetUrl: SHEET,
  lastOperation: { type: "faq_answer_research", targetCol: "F", answerCol: "C" },
  activeToolId: "design-formatting"
};

const cases = [
  { name: "FAQ creation EN", text: "Build FAQ for Leonardo Hotel Berlin", expect: { type: "start_task", toolId: "faq-playground" } },
  { name: "FAQ creation HE", text: "תבנה FAQ למלון לאונרדו ברלין", expect: { type: "start_task", toolId: "faq-playground" } },
  { name: "FAQ creation HE guests", text: "שאלות ותשובות לאורחים של המלון", expect: { type: "start_task", toolId: "faq-playground" } },
  { name: "Existing FAQ gap questions", text: "יש לי עמוד שכבר יש לו faq https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv אני צריכה שתסרוק אותו ותכתוב לי מסמך שיט עם שאלות שלא מופיעות בו", expect: { type: "start_task", toolId: "faq-playground" } },

  { name: "FAQ impl audit EN", text: `Check if FAQ schema is implemented on ${SITE}`, expect: { type: "start_task", toolId: "site-ai-faq-audit", field: ["siteUrl", SITE] } },
  { name: "FAQ impl audit JSON-LD", text: "Audit the FAQPage JSON-LD on the site", expect: { type: "start_task", toolId: "site-ai-faq-audit" } },
  { name: "FAQ impl audit HE", text: "לבדוק אם ה-FAQ מוטמע באתר", expect: { type: "start_task", toolId: "site-ai-faq-audit" } },
  { name: "Schema audit HE site", text: "בדיקת סכמה באתר", expect: { type: "start_task", toolId: "site-ai-audit" } },
  { name: "Plural schema audit HE pages", text: "אני צריכה לבדוק אם יש סכמות בעמודים באתר של לאונרדו", expect: { type: "start_task", toolId: "site-ai-audit" } },
  { name: "Compare visible FAQ to schema", text: "Compare the visible FAQ to the schema on the website", expect: { type: "start_task", toolId: "site-ai-faq-audit" } },
  { name: "Sheet answers QA stays sheet edit", text: "לבדוק את התשובות בעמודה C בגיליון ולתקן אותן", snapshot: memorySnapshot, expectNot: "site-ai-faq-audit" },
  { name: "General audit incl FAQ pages", text: `Run a full site audit including the FAQ pages of ${SITE}`, expect: { type: "start_task", toolId: "site-ai-audit" } },

  { name: "Sheet schema HE is not site audit", text: `לבדוק את הסכמה בגיליון הזה ${SHEET}`, expect: { type: "start_task", toolId: "schema-builder", field: ["sourceUrl", SHEET] } },
  { name: "Sheet JSON-LD validation is schema builder", text: `Validate JSON-LD in this Google Sheet ${SHEET}`, expect: { type: "start_task", toolId: "schema-builder", field: ["sourceUrl", SHEET] } },
  { name: "Sheet column schema errors are not FAQ audit", text: `Check schema errors in column E of this sheet ${SHEET}`, expect: { type: "start_task", toolId: "schema-builder", field: ["sourceUrl", SHEET] } },

  { name: "Site audit EN", text: `Run site audit for ${SITE}`, expect: { type: "start_task", toolId: "site-ai-audit", field: ["siteUrl", SITE] } },
  { name: "AI readiness audit", text: `AI readiness audit for ${SITE}`, expect: { type: "start_task", toolId: "site-ai-audit" } },
  { name: "Site audit HE", text: "אודיט אתר בבקשה", expect: { type: "start_task", toolId: "site-ai-audit" } },
  { name: "Crawl HE", text: `סריקת אתר ${SITE}`, expect: { type: "start_task", toolId: "site-ai-audit" } },

  { name: "Translate sheet EN", text: `Translate this Google Sheet to German ${SHEET}`, expect: { type: "start_task", toolId: "translate-demo", field: ["sourceUrl", SHEET] } },
  { name: "Translate HE", text: `תרגמי את הקובץ לצרפתית ${SHEET}`, expect: { type: "start_task", toolId: "translate-demo" } },
  { name: "Translate folder", text: `Translate this Drive folder ${FOLDER} to Spanish and Greek`, expect: { type: "start_task", toolId: "translate-demo", field: ["sourceUrl", FOLDER] } },
  { name: "Edit existing translation HE", text: `תתקני את התרגום בעמודה D בקובץ ${SHEET}`, expect: { type: "start_sheet_edit" } },
  { name: "Edit existing translation EN", text: `Fix the German translation in column D of this sheet ${SHEET}`, expect: { type: "start_sheet_edit" } },

  { name: "Clean column C", text: `Clean column C in ${SHEET}`, expect: { type: "start_sheet_edit", field: ["targetUrl", SHEET] } },
  { name: "Remove source links", text: `Remove source links from the answers in ${SHEET}`, expect: { type: "start_sheet_edit" } },
  { name: "Remove source links HE memory", text: "להסיר קישורים למקורות מהתשובות", snapshot: memorySnapshot, expectOneOf: ["append_instruction", "start_sheet_edit"] },
  { name: "Apply client notes", text: `Apply the client notes in ${SHEET}`, expect: { type: "start_sheet_edit" } },
  { name: "Insert answers to column C HE", text: `להכניס את התשובות לעמודה C בגיליון ${SHEET}`, expectOneOf: ["start_column_transfer", "start_sheet_edit"] },
  { name: "Find missing answers no URL", text: "Complete the unavailable answers with trusted sources in the sheet", expect: { type: "start_sheet_edit" } },

  { name: "VLOOKUP", text: `Run a VLOOKUP between ${SHEET} and ${SHEET2}`, expect: { toolId: "sheet-utilities" } },
  { name: "Cross-check master HE", text: `הצלבה מול מאסטר ${SHEET}`, expect: { toolId: "sheet-utilities" } },
  { name: "Coverage report HE", text: "בדיקת כיסוי מול קבצי המקור", expect: { toolId: "sheet-utilities" } },
  { name: "Folder to master", text: `Folder to master injection from ${FOLDER} into ${SHEET}`, expect: { toolId: "sheet-utilities" } },
  { name: "Copy columns between files", text: `Copy columns between ${SHEET} and ${SHEET2}`, expect: { toolId: "sheet-utilities" } },
  { name: "Single-sheet copy stays formatting", text: `תעתיקי את עמודה F לעמודה C בקובץ ${SHEET}`, expectOneOf: ["start_column_transfer", "start_sheet_edit"] },

  { name: "Schema from sheet EN", text: `Generate FAQPage JSON-LD from this Sheet ${SHEET}`, expect: { toolId: "schema-builder", field: ["sourceUrl", SHEET] } },
  { name: "Schema HE", text: `לבנות סכמה מהשאלות בגיליון ${SHEET}`, expect: { toolId: "schema-builder" } },

  { name: "Meta titles", text: "Create meta titles for the hotel pages", expect: { toolId: "meta-tags" } },
  { name: "SEO title and description", text: `SEO title and description for ${SITE}`, expect: { toolId: "meta-tags", field: ["pageList", SITE] } },
  { name: "Meta HE", text: "תגיות מטא לעמודים", expect: { toolId: "meta-tags" } },
  { name: "Schema+meta ambiguity clarifies", text: "Create schema and meta tags from the sheet", expect: { type: "clarify" } },

  { name: "Client dashboard", text: "Build a client dashboard from GA4", expect: { toolId: "client-reports" } },
  { name: "Monthly report HE", text: "דוח לקוח חודשי מגוגל אנליטיקס", expect: { toolId: "client-reports" } },

  { name: "Sheet link never file-draft", text: `Fix the header row in this file ${SHEET}`, expectNot: "file-draft" },

  { name: "Follow-up now put it in C", text: "now put it in column C", snapshot: memorySnapshot, expect: { type: "start_column_transfer" } },
  { name: "Follow-up HE not C to F", text: "לא C, ל-F", snapshot: memorySnapshot, expect: { type: "start_column_transfer" } },
  { name: "Follow-up HE now F", text: "עכשיו ל-F", snapshot: memorySnapshot, expect: { type: "start_column_transfer" } },

  { name: "Where did it save EN", text: "where did it save?", expect: { type: "show_result" } },
  { name: "Where did it save HE", text: "איפה זה נשמר?", expect: { type: "show_result" } },
  { name: "Run it continues ready task", text: "run it", snapshot: { ...memorySnapshot, step: "ready" }, expect: { type: "confirm_run" } },
  { name: "URL answer fills pending field", text: SITE, snapshot: { activeToolId: "site-ai-audit", step: "toolField", pendingQuestion: { key: "siteUrl" } }, expect: { type: "set_field", key: "siteUrl" } }
];

let passed = 0;
const failures = [];
for (const testCase of cases) {
  const commands = plan(testCase.text, testCase.snapshot || {});
  const first = commands[0] || {};
  let ok = true;
  let why = "";
  if (testCase.expect) {
    if (testCase.expect.type && first.type !== testCase.expect.type) {
      ok = false;
      why = `type=${first.type || "none"} expected=${testCase.expect.type}`;
    }
    if (ok && testCase.expect.toolId && first.toolId !== testCase.expect.toolId) {
      ok = false;
      why = `toolId=${first.toolId || "none"} expected=${testCase.expect.toolId}`;
    }
    if (ok && testCase.expect.key && first.key !== testCase.expect.key) {
      ok = false;
      why = `key=${first.key}`;
    }
    if (ok && testCase.expect.field) {
      const [fieldKey, fieldValue] = testCase.expect.field;
      if ((first.fields || {})[fieldKey] !== fieldValue) {
        ok = false;
        why = `fields.${fieldKey}=${(first.fields || {})[fieldKey]}`;
      }
    }
  }
  if (ok && testCase.expectOneOf && !testCase.expectOneOf.includes(first.type)) {
    ok = false;
    why = `type=${first.type || "none"} expected one of ${testCase.expectOneOf.join("/")}`;
  }
  if (ok && testCase.expectNot && (first.toolId === testCase.expectNot || first.type === testCase.expectNot)) {
    ok = false;
    why = `routed to forbidden ${testCase.expectNot}`;
  }
  if (ok) {
    passed += 1;
    console.log(`PASS  ${testCase.name}`);
  } else {
    failures.push(testCase.name);
    console.log(`FAIL  ${testCase.name} -> ${why} | got ${JSON.stringify(first)}`);
  }
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(failures.length ? 1 : 0);
