export {};
console.log("smoke start");

const imports = [
  "./core/agent.js",
  "./config/safety.js",
  "./services/sheets.js",
  "./jobs/translate-from-sheet.js",
  "./jobs/rewrite-from-sheet.js",
  "./jobs/validate-lite.js",
  "./jobs/faq-from-scratch.js",
  "./jobs/meta-schema-from-sheet.js",
  "./jobs/faq-audit-from-web.js",
  "./jobs/enrich-hotel-data.js",
  "./jobs/filter-by-country.js",
  "./jobs/cross-check.js",
  "./jobs/translate-master.js",
  "./jobs/faq-playground.js",
  "./jobs/inject-hebrew-to-master.js",
  "./jobs/duplicate-rewrite-hebrew.js",
  "./jobs/hotels-catalog-from-web.js",
  "./jobs/semanticMatchUnmatched.js",
  "./jobs/inject-hebrew-from-unmatched.js",
  "./jobs/vlookup-hebrew-from-unmatched.js",
  "./jobs/qa-hebrew-injection.js",
  "./jobs/import-hebrew-meta-from-folder.js",
  "./jobs/faq-fattal-il.js",
  "./jobs/faq-petal-israel.js",
  "./jobs/translate-from-sheet-demo.js",
  "./jobs/qa-lang-master.js",
  "./jobs/qa-master-triage.js",
  "./jobs/qa-master-apply-fixes.js",
  "./jobs/inject-meta-schema-to-master.js",
  "./jobs/wrap-p-from-sheet.js",
  "./jobs/faq-audit-structure-from-web.js",
  "./jobs/sync-fg-from-sources.js",
  "./jobs/translatable-id-crosscheck.js",
  "./jobs/tid-hotel-in-question-crosscheck.js",
  "./jobs/hotel-question-discovery.js",
  "./jobs/forum-question-discovery.js",
];

for (const path of imports) {
  console.log(`before ${path}`);
  await import(path);
  console.log(`after ${path}`);
}

console.log("smoke done");