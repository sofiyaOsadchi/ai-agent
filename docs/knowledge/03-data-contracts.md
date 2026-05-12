# Data Contracts

This file captures the implicit contracts between UI, server, jobs, Google Sheets and stdout parsers.

## Global Env Vars

| Variable | Used by | Meaning |
| --- | --- | --- |
| `OPENAI_API_KEY` | `AIAgent`, embedding jobs | OpenAI API key |
| `OWNER_EMAIL` | `SheetsService` | Delegated Google Workspace subject |
| `GOOGLE_APPLICATION_CREDENTIALS` | `SheetsService` | Service account JSON path |
| `PORT` | `server-demo.ts` | Local demo server port, default 3000 |
| `NODE_ENV` | `server-demo.ts` | If not `production`, server tries to auto-open browser |
| `MODE` | `src/index.ts` | Selects job branch |
| `DYNAMIC_PAYLOAD` | UI-driven modes | Serialized JSON payload from web UI |
| `DYNAMIC_TARGET_ID` | translate/wrap/dynamic modes | Sheet or folder ID/URL |
| `DYNAMIC_INPUT_TYPE` | translate/wrap/dynamic modes | Usually `sheet`, `folder` or `none` |
| `DYNAMIC_LANGS` | translation modes | Comma-separated target languages |

## FAQ Audit Env Vars

Common variables:

- `FAQ_AUDIT_START_URL`
- `FAQ_AUDIT_SHEET_TITLE`
- `FAQ_AUDIT_LOCALE`
- `FAQ_AUDIT_MAX_CALLS_PER_HOTEL`
- `FAQ_AUDIT_CLICK_PAUSE_MS`
- `FAQ_AUDIT_LOADMORE_CYCLES`
- `FAQ_AUDIT_SCROLL_STEPS`
- `FAQ_AUDIT_SCROLL_DELTA`
- `FAQ_AUDIT_RENDER`
- `FAQ_AUDIT_RENDER_FALLBACK`
- `FAQ_AUDIT_PLAYWRIGHT_CHANNEL`
- `FAQ_AUDIT_DISCOVERY_MAX_PAGES`
- `FAQ_AUDIT_DISCOVERY_MAX_DEPTH`
- `FAQ_AUDIT_MIN_NEAR_MATCH`

## Discovery Env Vars

`HotelQuestionDiscoveryJob` reads:

- `DISCOVER_LOCALE`
- `DISCOVER_MAX_QUESTIONS`
- `DISCOVER_MAX_DEPTH`
- `DISCOVER_MAX_SERP_FETCHES`
- `DISCOVER_SUGGEST_MAX_CALLS`
- `DISCOVER_SUGGEST_DELAY_MIN_MS`
- `DISCOVER_SUGGEST_DELAY_MAX_MS`
- `DISCOVER_SERP_DELAY_MIN_MS`
- `DISCOVER_SERP_DELAY_MAX_MS`
- `DISCOVER_BLOCK_RETRIES`
- `DISCOVER_BLOCK_COOLDOWN_MIN_MS`
- `DISCOVER_BLOCK_COOLDOWN_MAX_MS`
- `DISCOVER_PAA_EXPAND_CLICKS`
- `DISCOVER_PLAYWRIGHT_CHANNEL`

## Web Socket Contract

Client side:

```js
socket.emit("start-agent", payload);
socket.on("log", handler);
socket.on("done", handler);
socket.on("preview-event", handler); // design-formatting only
```

Server side:

- Receives `start-agent`.
- Spawns child process.
- Sends stdout/stderr line-by-line as `log`.
- Sends `done` on child close or child error.
- Converts preview JSON lines to `preview-event`.

## Dynamic Env Mapping In server-demo

`buildDynamicEnv(mode, config, payloadData)` always sets:

```ts
MODE: mode
DYNAMIC_PAYLOAD: JSON.stringify(payloadData)
```

Special cases:

### `client-reports`

```ts
DYNAMIC_TARGET_ID = config.spreadsheetId || ""
DYNAMIC_INPUT_TYPE = "sheet"
DYNAMIC_LANGS = ""
```

### `client-reports-edit`

```ts
DYNAMIC_TARGET_ID = ""
DYNAMIC_INPUT_TYPE = "none"
DYNAMIC_LANGS = ""
```

### `translate-demo`

```ts
DYNAMIC_TARGET_ID = config.spreadsheetId || config.sourceFolderId || ""
DYNAMIC_INPUT_TYPE = config.sourceType || "sheet"
DYNAMIC_LANGS = config.targetLangs.join(",")
```

### `design-formatting`

```ts
DYNAMIC_TARGET_ID = config.targetId || ""
DYNAMIC_INPUT_TYPE = config.sourceType || "sheet"
DYNAMIC_LANGS = ""
```

Default:

```ts
DYNAMIC_TARGET_ID = config.targetId || ""
DYNAMIC_INPUT_TYPE = config.inputType || config.sourceType || "sheet"
DYNAMIC_LANGS = config.langs || ""
```

## UI Payloads

### `faq-playground`

```json
{
  "mode": "faq-playground",
  "subjects": ["Hotel or subject name"],
  "tasks": [
    {
      "id": 1,
      "enabled": true,
      "name": "Questions",
      "system": "...",
      "user": "..."
    }
  ]
}
```

Prompt variables:

- `{{subject}}`
- `{{hotel}}`
- `{{last}}`
- `${subject}`
- `${hotel}`
- `${last}`
- `[subject]`
- `[hotel]`
- `[last]`

Task `#2` is preferred as the base TSV. Later non-TSV task outputs become extra columns.

### `translate-demo`

```json
{
  "mode": "translate-demo",
  "sourceType": "sheet",
  "spreadsheetId": "...",
  "sourceFolderId": "",
  "sourceTab": "Sheet1",
  "model": "o3",
  "targetLangs": ["de", "es"],
  "translateHeader": true,
  "splitIntoTwo": true,
  "prompts": {
    "draftSystem": "...",
    "draftUser": "...",
    "polishSystem": "...",
    "polishUser": "..."
  },
  "languageNotes": {},
  "glossaryByLang": {},
  "terminologyByLang": {}
}
```

Important job behavior:

- Reads from `A1:Z68`.
- Uses first tab if `sourceTab` is missing or invalid.
- Enforces same matrix shape on output.
- Defaults to `o3` if selected model is not in the allow-list.

Guided chat layer:

- `public/translate-demo.html` has two setup tabs: manual setup and chat setup.
- `public/translate-chatbot.js` collects source URL/ID, tab, languages, model, draft prompt notes, polish prompt notes, glossary and terminology.
- The chat does not make the user choose Sheet vs Folder first. It auto-detects `sourceType` from a pasted Google Sheet or Drive Folder URL/ID.
- The chat uses a wizard-like primary action button for progress. Source/language/model option chips update state, while the primary button advances.
- The right chat sidebar is an editable compact setup form, not just a read-only summary.
- The right chat sidebar stores resumable work locally in `localStorage` under `translate-demo-chat-workspaces-v1`. This is browser-local only, limited to the same machine/browser profile, and is not a database or shared workspace.
- The chat intentionally does not ask about header handling or split behavior; it keeps the existing safe defaults and leaves advanced controls in the manual tab.
- The chat intentionally does not ask for tone/style notes; advanced language notes remain editable in the manual tab.
- Draft/polish notes from chat start from serious editable defaults, then are written into the existing prompts as a concise instruction summary.
- File names, sheet/tab/folder names and IDs are treated as fixed variables in the default prompts and should not be translated, renamed or moved.
- It fills the existing form via `window.translateDemoBridge.fillSetupFromChatbot(config)`.
- It can optionally call `window.translateDemoBridge.runTranslationFromChatbot()` after filling the form.
- The generated setup still flows through the normal `runTranslation()` payload above.

### `design-formatting`

```json
{
  "mode": "design-formatting",
  "sourceType": "sheet",
  "targetId": "...",
  "tabName": "Sheet1",
  "maxFiles": 30,
  "dryRun": true,
  "createBackup": false,
  "range": {
    "columnScope": "columns",
    "columns": "A:C",
    "rowScope": "range",
    "rows": "2:"
  },
  "operation": {
    "type": "text_replace"
  }
}
```

Supported operations:

- `text_replace`
- `wrap_html`
- `normalize_spaces`
- `normalize_line_breaks`
- `plain_to_html_paragraphs`
- `case_transform`
- `format_table`
- `header_style`
- `wrap_text`
- `align_cells`
- `set_column_widths`
- `set_row_heights`
- `extract_comments`
- `add_column`
- `rename_column`
- `reorder_columns`
- `duplicate_tab_template`

`extract_comments` currently supports only `sourceType: "sheet"`.

### `sheet-utilities`

```json
{
  "mode": "sheet-utilities",
  "operation": {
    "type": "lookup_copy"
  },
  "dryRun": true,
  "createBackup": false
}
```

Supported operation types:

- `lookup_copy`
- `folder_to_master_injection`
- `cross_check`
- `coverage_report`
- `copy_columns`
- `build_work_file`

Common operation fields:

- `headerRow`
- `overwriteExisting`
- `trimValues`
- `caseSensitive`

### `client-reports`

```json
{
  "mode": "client-reports",
  "spreadsheetId": "...",
  "sourceTab": "Sheet1",
  "reportType": "campaign-performance-overview",
  "primaryMetric": "conversions",
  "breakdown": "campaign",
  "dateRange": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  },
  "columnMapping": {
    "date": "Date",
    "campaign": "Campaign",
    "spend": "Spend",
    "clicks": "Clicks",
    "conversions": "Conversions"
  },
  "dashboardConfig": {},
  "options": {
    "dryRun": true,
    "exportToSheet": false,
    "includeAiSummary": true,
    "includeRecommendations": true,
    "outputTabName": "Client Report"
  }
}
```

Supported report types:

- `campaign-performance-overview`
- `monthly-client-report`
- `channel-comparison-report`
- `budget-pacing-report`
- `leads-conversions-report`
- `seo-traffic-report`
- `ecommerce-roas-report`
- `anomaly-opportunities-report`
- `executive-summary-report`
- `custom-metrics-dashboard`

### `client-reports-edit`

```json
{
  "command": {
    "type": "rephrase",
    "blockId": "summary"
  },
  "currentBlocks": [],
  "context": {}
}
```

For a custom prompt:

```json
{
  "command": {
    "type": "custom-prompt",
    "prompt": "Add a concise recommendation about CPA."
  },
  "currentBlocks": [],
  "context": {}
}
```

## Preview Event Schema

File: `src/jobs/subjobs/preview-events.ts`

Prefix:

```text
CARMELON_PREVIEW_EVENT_JSON=
```

Event union:

```ts
type PreviewEvent =
  | PreviewChangeEvent
  | PreviewPlanEvent
  | SheetPreviewEvent;
```

`PreviewChangeEvent`:

```ts
{
  kind: "change";
  fileName: string;
  spreadsheetId: string;
  tabName: string;
  cell: string;
  row: number;
  column: string;
  before: string;
  after: string;
}
```

`PreviewPlanEvent`:

```ts
{
  kind: "plan";
  fileName: string;
  spreadsheetId: string;
  tabName?: string;
  title: string;
  details: string[];
}
```

`SheetPreviewEvent`:

```ts
{
  kind: "sheet_preview";
  fileName: string;
  spreadsheetId: string;
  tabName: string;
  rangeA1: string;
  columns: string[];
  rows: SheetPreviewRow[];
  changedCellsCount: number;
}
```

## Client Report Markers

`client-reports` stdout result:

```text
CLIENT_REPORT_RESULT_JSON_START
<json>
CLIENT_REPORT_RESULT_JSON_END
```

`client-reports-edit` stdout result:

```text
CLIENT_REPORT_EDIT_RESULT_JSON_START
<json>
CLIENT_REPORT_EDIT_RESULT_JSON_END
```

The UI parser expects these exact markers.

## Common Sheet Layouts

### FAQ Sheet

Typical generated FAQ layout:

| Column | Meaning |
| --- | --- |
| A | Category |
| B | Question |
| C | Answer |
| D | Frequency or client/comment depending on flow |
| E-G | Workflow-specific output columns |

`SheetsService.formatSheet` styles A:G.

### Rewrite Sheet

Typical rewrite flow:

| Column | Meaning |
| --- | --- |
| A | Category |
| B | Question |
| C | Original answer |
| D | Client comment/corrected answer |
| F | Final answer |
| G | Question correction |
| H | QA note |
| I | Hotel name notes/status |

### Translation Sheet

Translation jobs usually read source rows from the first or configured tab, then create or update target language tabs. Language tab naming varies by job; examples include `Sheet1 - DE`, `Sheet1 – es`, or auto-detected language suffixes.

### Master Language QA

`QaLangMasterJob` locates columns by normalized headers where possible. It writes a QA report tab, often named:

```text
QA - <LANG> Master
```

`QaMasterTriageJob` reads that and writes:

```text
QA - <LANG> True Issues
```

`QaMasterApplyFixesJob` then applies fix columns from the triage tab back to the master tab.

## Google ID Parsing

Several jobs accept either a raw ID or a Google URL. Common helpers extract:

- Spreadsheet ID from `/spreadsheets/d/<ID>`.
- Drive folder ID from `/folders/<ID>`.

Do not assume every job accepts every URL shape. Check the specific job before passing unusual links.
