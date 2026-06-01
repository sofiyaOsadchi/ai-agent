# Modes And Jobs

`src/index.ts` is the mode router. The active mode is:

```ts
const MODE = (process.env.MODE ?? "faq").toLowerCase();
```

## Web Modes

These are normally invoked by `src/server-demo.ts` from the local UI.

| Mode | UI file | Job/function | Input source | Main output |
| --- | --- | --- | --- | --- |
| `faq-playground` | `public/faq-playground.html` | `runFaqPlayground` | `DYNAMIC_PAYLOAD` with `subjects` and `tasks` | New Google Sheet per subject |
| `translate-demo` | `public/translate-demo.html` | `TranslateFromSheetDemoJob.runFromEnv()` | Sheet/folder ID, target languages, prompts, glossary, terminology | New translated tabs in target Sheets |
| `design-formatting` | `public/design-formatting.html` | `DesignFormattingJob.run(payload)` | Full payload | Formatting writes or dry-run preview events |
| `sheet-utilities` | `public/sheet-utilities.html` | `SheetUtilitiesJob.run(payload)` | Full payload | Reads/writes/report tabs depending on operation |
| `client-reports` | `public/client-reports.html` | `ClientReportsJob.runFromEnv()` | Full payload | JSON dashboard result, optional report tab |
| `client-reports-edit` | `public/insight-editor.js` | `ClientReportsEditJob.runFromEnv()` | Insight edit command + current blocks | JSON updated insight block |

## Web Payload Notes

`server-demo.ts` passes the full payload for:

- `translate-demo`
- `design-formatting`
- `sheet-utilities`
- `ai-editing`
- `client-reports`
- `client-reports-edit`

For `faq-playground`, if `config.tasks` exists, the payload is simplified to:

```json
{
  "subjects": [],
  "tasks": []
}
```

Legacy fallback payload:

```json
{
  "hotels": [],
  "prompts": {},
  "steps": {}
}
```

## Package Scripts

| Script | Command | Notes |
| --- | --- | --- |
| `dev` | `tsx watch src/index.ts` | Runs default `faq` unless `MODE` is set outside |
| `build` | `tsc` | Compiles `src/` to `dist/` |
| `start` | `node dist/server-demo.js` | Requires prior build |
| `demo-ui` | `tsx watch src/server-demo.ts` | Main local UI |
| `translate-demo` | `cross-env MODE=translate-demo tsx src/index.ts` | Usually easier from UI |
| `translate` | `MODE=translate tsx src/index.ts` | Uses config in `src/index.ts` unless dynamic env is provided |
| `rewrite` | `MODE=rewrite tsx src/index.ts` | Rewrite/QA job |
| `validate-lite` | `MODE=validate-lite tsx src/index.ts` | Lightweight FAQ QA |
| `meta-schema` | `MODE=meta-schema tsx src/index.ts` | Generate meta/schema rows |
| `faq-audit` | `MODE=faq-audit tsx src/index.ts` | Web FAQ audit |
| `qa-lang-master` | `cross-env MODE=qa-lang-master tsx src/index.ts` | Deterministic translated master QA |
| `qa-master-triage` | `MODE=qa-master-triage tsx src/index.ts` | AI triage of QA rows |
| `qa-master-apply-fixes` | `MODE=qa-master-apply-fixes tsx src/index.ts` | Applies triage fixes |
| `master-coverage` | `MODE=master-coverage tsx src/index.ts` | Coverage report |
| `sheet-utilities` | No package script | Use UI or `MODE=sheet-utilities` with `DYNAMIC_PAYLOAD` |
| `client-reports` | No package script | Use UI or env payload |

## Full Mode Inventory

### `faq` default

Fallback when no mode matches. Calls:

```ts
runAllHotelsResearch(agent, sheets, HOTELS)
```

Uses `HOTELS` array in `src/index.ts`.

### `translate`

Job: `TranslateFromSheetJob`

Purpose: Production-ish translation flow for Google Sheets. Supports:

- static `SHEETS` list,
- static `TRANSLATE_FOLDER`,
- dynamic `DYNAMIC_TARGET_ID`,
- dynamic `DYNAMIC_INPUT_TYPE=sheet|folder`,
- dynamic `DYNAMIC_LANGS`.

Writes translated tabs back to the target spreadsheet(s).

### `translate-demo`

Job: `TranslateFromSheetDemoJob`

Purpose: UI-controlled translation demo. Reads `DYNAMIC_PAYLOAD`, supports:

- source sheet,
- selected target languages,
- optional source tab,
- optional source range in A1 notation,
- prompt overrides,
- glossary by language,
- terminology by language,
- optional final natural polish pass without glossary/terminology/language-note rule injection,
- split into two parts,
- model selection, including `anthropic:claude-sonnet-4-6` when Anthropic is configured.

Important behavior:

- Reads `sourceRange` from the selected tab, defaulting to `A1:Z68`.
- Preserves matrix shape.
- Creates translated tabs while keeping blank rows aligned.
- Optional final polish runs once on the full translated sheet after split parts are merged. In split mode this keeps the run to a maximum of five model calls per language: draft and polish for each part, plus one final natural polish pass.
- Default prompt templates live in `src/jobs/translate-from-sheet-demo.ts` and are exposed to the UI through `GET /api/translate-demo/defaults`.
- `model` controls the draft and terminology-polish stages. Optional `finalPolishModel` controls only the final natural polish pass when Step 3 is enabled; when omitted, the final pass uses `model`.

UI note:

- `public/translate-demo.html` keeps the full advanced form in a manual tab and exposes `window.translateDemoBridge`.
- The manual UI pulls default prompts and language notes from `GET /api/translate-demo/defaults` when served by `src/server-demo.ts`.
- The `translation-glossary.ts` Master glossary and `terminology-management.ts` Master terminology are available as optional manual loads; they are not applied by default.
- `public/translate-chatbot.js` adds a separate chat tab that asks focused Hebrew/English questions and fills the same form.
- The chat starts from a single Google Sheet or Drive Folder URL/ID and auto-detects `sourceType` from the link.
- Chat choices use one primary submit button to advance; language/model chips only update the selection.
- The right chat sidebar is editable and mirrors the current setup state.
- The right chat sidebar includes local browser-only save/load/delete for unfinished work using `localStorage`.
- The chat asks for draft and polish prompt notes, but does not ask about header translation or sheet splitting.
- The chat does not ask about tone/style. Users can still edit language notes manually in the manual tab.
- The chat loads serious default draft/polish prompt notes as editable starting points. Chat prompt notes are summarized into the draft/polish prompt fields, and users can edit those fields before running.
- File names, sheet/tab/folder names and IDs are treated as fixed variables in prompts.
- `public/translate-chatbot.css` owns the chat UI styling.
- The chat does not replace the backend mode or job; it prepares the existing `translate-demo` payload.

### `rewrite`

Job: `RewriteFromSheetJob`

Purpose: Applies client comments, light QA, question fixes, QA notes, hotel-name status, and missing FAQ suggestions.

Typical columns:

- Category: A
- Question: B
- Original answer: C
- Client comment/corrected answer: D
- Final answer: F
- Question correction: G
- QA note: H
- Hotel name notes/status: I

### `validate-lite`

Job: `ValidateLiteJob`

Purpose: Light FAQ validation. Flags only clear issues and writes suggested fixes.

Can read:

- explicit spreadsheet IDs,
- Drive folder,
- optional control sheet.

Supports `tabs: "ALL"` or specific tabs.

### `meta-schema`

Job: `MetaSchemaFromSheetJob`

Purpose: Builds meta title, meta description and FAQ schema from FAQ rows.

Key config:

- `metaRow`
- `schemaRow`
- `metaStartCol`
- `schemaCol`
- `lang`
- optional Hebrew hotel-name map

### `inject-meta-schema`

Job: `InjectMetaSchemaToMasterJob`

Purpose: Pulls meta/schema payloads from hotel sheets in a folder and injects them into a master sheet.

### `faq-audit`

Job: `FaqAuditFromWebJob`

Purpose: Crawls Leonardo-style hotel destination pages, discovers hotel FAQ URLs, compares DOM FAQ and JSON-LD schema, writes an audit sheet.

Environment controls include:

- `FAQ_AUDIT_START_URL`
- `FAQ_AUDIT_SHEET_TITLE`
- `FAQ_AUDIT_LOCALE`
- `FAQ_AUDIT_MAX_CALLS_PER_HOTEL`
- `FAQ_AUDIT_RENDER`
- `FAQ_AUDIT_PLAYWRIGHT_CHANNEL`
- discovery and scroll/click tuning vars

### `faq-audit-structure`

Job: `FaqAuditStructureFromWebJob`

Purpose: More structural FAQ/schema audit. Can use Playwright render mode and fallback render.

### `match-hotels`

Job: `EnrichHotelDataJob`

Purpose: Enrich FAQ rows with hotel name/country by matching hotel names from a separate hotel catalog sheet.

### `filter-country`

Job: `FilterByCountryJob`

Purpose: Filters FAQ rows by one or more countries and creates a new sorted spreadsheet.

### `cross-check`

Job: `CrossCheckJob`

Purpose: Compares a master FAQ sheet to individual hotel sheets. Also repairs missing answers by copying from individual sheets when possible.

### `translate-master`

Job: `TranslateMasterJob`

Purpose: Translates master question/answer columns into target language columns.

### `faq-playground`

Function: `runFaqPlayground`

Purpose: Creator Studio for prompt chains.

New UI mode:

- Input: `subjects`, `tasks`.
- Tasks are sorted by `id`.
- Variables supported in prompts: `{{subject}}`, `{{hotel}}`, `{{last}}`.
- Prefers task `#2` as base TSV if it looks like TSV.
- Later non-TSV task outputs become additional columns.
- Creates a new spreadsheet named `Creator: <subject>`.

Legacy mode:

- Input: `hotels`, `steps`, `prompts`.
- Steps: questions, answers, QA.
- QA adds Duplicate, Source OK, Grammar Fix columns.

### `inject-lang`

Job: `InjectLangToMasterJob`

Purpose: Injects translated question/answer pairs from hotel sheets into a master sheet.

Supports:

- target language,
- lang tab auto-detection,
- exact or fuzzy question matching,
- unmatched report tab,
- dry run,
- overwrite controls.

### `semantic-match-unmatched`

Job: `SemanticMatchUnmatchedJob`

Purpose: Uses OpenAI embeddings to match rows in an unmatched tab against hotel sheets. Writes match candidates and scores back to the unmatched tab.

Default model: `text-embedding-3-small`.

### `vlookup-hebrew`

Job: `VlookupHebrewFromUnmatchedJob`

Purpose: Simple VLOOKUP-like copy from unmatched columns into master Hebrew columns.

### `duplicate-rewrite-hebrew`

Job: `DuplicateRewriteHebrewJob`

Purpose: Copies a hotel spreadsheet and rewrites Hebrew content into a dedicated flow, enforcing expected Hebrew hotel names where available.

### `hotels-catalog`

Job: `HotelsCatalogFromWebJob`

Purpose: Scrapes Leonardo destinations and creates a countries/cities/hotels catalog, optionally with language-specific hotel names.

### `inject-hebrew-from-unmatched`

Job: `InjectHebrewFromUnmatchedJob`

Purpose: Injects matched Hebrew question/answer pairs from unmatched rows into master.

### `qa-hebrew-injection`

Job: `HebrewInjectionQaJob`

Purpose: QA for Hebrew injection. Checks missing rows, duplicate IDs, English mismatches, missing Hebrew, internal consistency, duplicate Hebrew/English content, and optional AI semantic checks.

### `import-hebrew-meta-tags`

Job: `ImportHebrewMetaTagsJob`

Purpose: Pulls Hebrew meta title/description/H1/schema from questionnaire files and writes them back to master columns.

### `fattal-faq`

Function: `runFattalFaqResearch`

Purpose: Hebrew/Fattal-oriented FAQ research and sheet generation.

### `faq-petal-israel`

Function: `runAllPetalIsraelFaq`

Purpose: Petal Israel FAQ generation flow.

### `qa-lang-master`

Job: `QaLangMasterJob`

Purpose: Deterministic QA for translated master sheets.

Checks include:

- missing target question/answer,
- language heuristic,
- hotel name missing in target,
- number mismatches,
- English hotel-name mismatch,
- English question form,
- English Q/A mismatch heuristic.

### `qa-master-triage`

Job: `QaMasterTriageJob`

Purpose: Reads deterministic QA output, filters noise, optionally asks AI for true issues and fixes, and writes a cleaner triage tab.

### `qa-master-apply-fixes`

Job: `QaMasterApplyFixesJob`

Purpose: Applies `fix_question` and/or `fix_answer` from triage output back to the master tab.

Environment overrides:

- `SPREADSHEET_ID`
- `TARGET_LANG`
- `QA_MASTER_TAB`
- `QA_TRIAGE_TAB`

### `wrap-p`

Job: `WrapPFromSheetJob`

Purpose: Wraps every non-empty cell in a target column, default F, with `<p>...</p>`.

### `sync-fg`

Job: `SyncFgFromSourcesJob`

Purpose: Builds a map from source files using column A as ID and source columns F:G, then writes F:G into master rows by matching ID.

### `tid-crosscheck`

Job: `TranslatableIdCrossCheckJob`

Purpose: Compares translatable IDs between master and fixes sheet and reports missing IDs, duplicates and hotel mismatches.

### `tid-hotel-in-question`

Job: `TidHotelInQuestionCrossCheckJob`

Purpose: Checks whether the hotel name associated with a translatable ID appears in the fixes question text.

Note: This mode branch appears twice in `src/index.ts`; the first branch wins.

### `discover-questions`

Job: `HotelQuestionDiscoveryJob`

Purpose: Discovers hotel-related questions from suggest/SERP/PAA style sources and writes them to a Sheet.

Environment controls include `DISCOVER_*` variables.

### `qna-consistency`

Job: `QnaConsistencyJob`

Purpose: Checks question-answer consistency with node-only heuristics or AI hybrid mode. Writes status, issue type, reason, confidence and cleaned text columns.

### `qa-master-sync-originals`

Job: `QaMasterSyncOriginalsJob`

Purpose: Uses triage rows to update original hotel source sheets and optionally the master.

### `master-coverage`

Job: `MasterCoverageFromSheetsJob`

Purpose: Checks whether questions from source sheets/folders are covered in the master. Can write report tab and fail when missing questions exist.
