# Architecture

## Purpose

The project is a local operations console for AI-assisted spreadsheet work. Most workflows read Google Sheets, optionally call OpenAI, and write results back to Google Sheets or create new spreadsheets.

Core domains:

- Hotel FAQ generation and QA.
- Translation of FAQ Sheets into multiple languages.
- Master sheet synchronization and coverage checks.
- Google Sheets formatting and utility operations.
- Client performance dashboard generation.

## Runtime Layers

```text
public/*.html
src/server-demo.ts
src/index.ts
src/jobs/*.ts
src/jobs/subjobs/*.ts
src/core/agent.ts
src/services/sheets.ts
Google APIs / OpenAI
```

## Web Demo Runtime

The web runtime starts from:

```bash
npm run demo-ui
```

This runs:

```bash
tsx watch src/server-demo.ts
```

`src/server-demo.ts` does four things:

1. Starts Express and serves the `public/` directory.
2. Opens `/index.html` in development.
3. Listens for Socket.IO `start-agent` events.
4. Spawns `npx tsx src/index.ts` with dynamic environment variables.

Important function roles:

- `normalizeMode(config)` - takes `config.mode`, defaults to `faq`.
- `buildPayloadData(mode, config)` - chooses which part of the UI config becomes `DYNAMIC_PAYLOAD`.
- `buildDynamicEnv(mode, config, payloadData)` - adds `MODE`, `DYNAMIC_PAYLOAD`, `DYNAMIC_TARGET_ID`, `DYNAMIC_INPUT_TYPE`, `DYNAMIC_LANGS`.
- stdout/stderr handlers - stream logs to the UI and intercept preview events.

## CLI Runtime

`src/index.ts` is the central mode router. It initializes:

- `config()` from `dotenv`.
- `SafetyManager("development")`.
- `AIAgent`.
- `SheetsService("info@carmelon.co.il")`.

Then it reads:

```ts
const MODE = (process.env.MODE ?? "faq").toLowerCase();
```

Each `else if (MODE === "...")` branch creates a job and runs it with either:

- hardcoded config objects from the top of `src/index.ts`,
- env overrides,
- or `DYNAMIC_PAYLOAD` from the web server.

If no known mode matches, it runs `runAllHotelsResearch(agent, sheets, HOTELS)`.

## Services

### AIAgent

File: `src/core/agent.ts`

`AIAgent` wraps OpenAI:

- Uses Responses API for models starting with `o` or `gpt-5`.
- Uses Chat Completions for other models.
- Enables `web_search_preview` automatically for Responses API calls.
- Stores tasks in memory, runs each task as a separate independent chat.
- Supports:
  - `run(prompt, model)`
  - `runWithSystem(userPrompt, system, model)`
  - `addTask`
  - `addTaskWithSystem`
  - `executeChain`

Important implication: `executeChain()` does not carry model context across tasks. Chaining is handled manually through prompts and saved `last` output in caller code.

### SafetyManager

File: `src/config/safety.ts`

Tracks API call count and token totals. In `src/index.ts`, it is created with `development`, currently:

- `maxCalls: 200`
- `maxTokens: 3000`
- `maxTasks: 5`
- `delay: 1500ms`

This is a soft local guard, not a billing guarantee.

### SheetsService

File: `src/services/sheets.ts`

Main Google Sheets/Drive abstraction.

Capabilities:

- Read/write values.
- Batch write values.
- Append rows.
- Create spreadsheets.
- Share created spreadsheets.
- Parse spreadsheet IDs from URLs.
- List spreadsheets in folders, including recursive folder traversal.
- Resolve tab titles and sheet IDs.
- Ensure tabs and columns.
- Duplicate, rename and delete tabs.
- Copy spreadsheets to folders.
- Format FAQ-like sheets.
- Retry retryable Google API errors with exponential backoff.

Authentication:

- Reads credentials from `GOOGLE_APPLICATION_CREDENTIALS`.
- Fallback path: `./src/credentials/service-account.json`.
- Uses JWT with scopes for Drive, Sheets and Docs.
- Uses `OWNER_EMAIL` as delegated subject.

### DocsService

File: `src/services/docs.ts`

Small helper for Google Docs creation. Currently less central than `SheetsService`.

## Jobs

Jobs live in `src/jobs/`. Most expose either:

- a class with `run(config)`,
- a class with `runFromEnv()`,
- or an exported function like `runFaqPlayground(...)`.

Subjobs live in `src/jobs/subjobs/` and provide shared logic:

- `translation-glossary.ts`
- `terminology-management.ts`
- `utility-translate.ts`
- `report-calculations.ts`
- `report-chart-data.ts`
- `report-insights.ts`
- `preview-events.ts`
- `faq-seo-checks.ts`
- `hotel-name-hebrew-map.ts`

## Preview Event Flow

`DesignFormattingJob` can emit special stdout lines using:

```ts
printPreviewEvent(event)
```

That prints:

```text
CARMELON_PREVIEW_EVENT_JSON=<json>
```

`server-demo.ts` parses those lines and sends:

```ts
socket.emit("preview-event", event)
```

This keeps large preview JSON out of the visible terminal log.

## Client Reports Result Flow

`ClientReportsJob.runFromEnv()` prints result JSON between markers:

```text
CLIENT_REPORT_RESULT_JSON_START
{...}
CLIENT_REPORT_RESULT_JSON_END
```

`public/client-reports.html` collects stdout between those markers, parses JSON, and renders the dashboard.

`ClientReportsEditJob.runFromEnv()` does the same for insight editing:

```text
CLIENT_REPORT_EDIT_RESULT_JSON_START
{...}
CLIENT_REPORT_EDIT_RESULT_JSON_END
```

## File Map

Top-level:

- `package.json` - scripts and dependencies.
- `tsconfig.json` - ESM TypeScript build to `dist/`.
- `README.md` - primary project docs.
- `public/` - static UI pages and browser JS.
- `src/` - TypeScript source.
- `dist/` - compiled output, not source of truth.
- `prompts/` - JSON prompt presets.
- `*.tsv`, `*.txt` - local data/export artifacts.

Source directories:

- `src/core/` - AI runtime wrapper.
- `src/config/` - safety limits.
- `src/services/` - Google API services.
- `src/jobs/` - executable business workflows.
- `src/jobs/subjobs/` - shared helper modules.
- `src/prompts/` - prompt management code.

## Dependency Overview

Runtime dependencies:

- `express`
- `socket.io`
- `open`
- `dotenv`
- `chalk`
- `ora`
- `openai`
- `googleapis`
- `google-auth-library`
- `cheerio`
- `inquirer`

Dev dependencies:

- `tsx`
- `typescript`
- `playwright`
- `cross-env`
- `ts-node`
- `nodemon`

