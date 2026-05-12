# Development Notes

## Principles For Changes

- Treat `src/` as source of truth. `dist/` is build output.
- Reading `src/index.ts` is allowed when needed, but editing it requires a separate explicit user approval.
- Do not edit `src/core/agent.ts` or `src/services/sheets.ts`; if a change is needed there, send the user the proposed change instead.
- Do not access `.env` or `src/credentials/`.
- Do not edit `package.json`; if a script/dependency change is needed, send the user the proposed change.
- Any project-wide change requires a special additional approval.
- Current work should mostly stay in `public/*.html` and the supporting jobs under `src/jobs/`.
- Prefer adding focused jobs under `src/jobs/` and small shared helpers under `src/jobs/subjobs/`.
- Keep UI payload contracts explicit. If the UI payload changes, update the matching job and `server-demo.ts` if env mapping changes.
- Use `dryRun` by default for destructive or write-heavy Google Sheets changes.

## Minimum Verification

After TypeScript changes:

```bash
npm run build
```

After UI/server changes:

```bash
npm run demo-ui
```

Then open:

```text
http://localhost:3000/index.html
```

There is no automated test suite currently defined in `package.json`.

## Local Version Snapshots

Do not create local snapshots automatically. Create one only after the user explicitly approves it, usually after a substantial feature is finished, tested, approved, and worth keeping as a rollback point.

```bash
npm run snapshot -- "approved checkpoint after <feature name>"
```

List available snapshots:

```bash
npm run snapshot:list
```

Restore a snapshot:

```bash
npm run snapshot:restore -- <snapshot-id> --force
```

Restore is intentionally guarded by `--force` because it replaces managed project paths. The restore command first creates a `pre-restore-*` snapshot of the current state, so the restore itself can be undone.

Because restore is project-wide, get explicit user approval before running it.

Prune old snapshots and keep the newest 20:

```bash
npm run snapshot:prune -- 20
```

Snapshot storage:

- Stored under `.local-history/snapshots/`.
- `.local-history/` is gitignored.
- Script: `scripts/local-version.mjs`.

Managed paths:

- `src`
- `public`
- `prompts`
- `docs`
- `scripts`
- `README.md`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.gitignore`

Excluded by design:

- `.env`
- `src/credentials`
- `node_modules`
- `dist`
- `.git`
- `.local-history`

## Adding A New Web Tool

1. Create a UI page in `public/`.
2. Add it to `public/index.html`.
3. Make the UI emit:

```js
socket.emit("start-agent", {
  mode: "your-mode",
  ...
});
```

4. In `src/server-demo.ts`, decide whether the full payload should be passed through in `buildPayloadData`.
5. If needed, add special env mapping in `buildDynamicEnv`.
6. If a new `MODE` branch is needed in `src/index.ts`, stop and get separate explicit approval before editing.
7. Create a job under `src/jobs/your-job.ts`.
8. Add docs to `README.md`, `02-modes-and-jobs.md`, and `03-data-contracts.md`.
9. Run `npm run build`.

## Adding A New CLI Mode

This usually requires editing `src/index.ts`, so it needs separate explicit user approval before implementation.

1. Add or import the job in `src/index.ts`.
2. Add a config object near the other configs, or read from env.
3. Add an `else if (MODE === "...")` branch.
4. If a package script is needed, send the exact `package.json` change to the user instead of editing it directly.
5. Document the mode in `02-modes-and-jobs.md`.
6. Run `npm run build`.

## Debugging Flow

For a UI issue:

1. Check the browser page payload builder.
2. Check `server-demo.ts` env mapping.
3. Check the matching `MODE` branch in `src/index.ts`.
4. Check the job's `run` or `runFromEnv`.
5. Check stdout logs in the UI terminal.

For a Google Sheets issue:

1. Verify the spreadsheet ID parsing.
2. Verify tab name, including Unicode dash variants and NBSP.
3. Verify column letters vs 0-based column indexes.
4. Verify service account permissions.
5. Check whether the job uses first-tab fallback.

For an OpenAI issue:

1. Do not inspect `.env`; ask the user to confirm `OPENAI_API_KEY` is configured.
2. Verify model name.
3. Remember that `AIAgent` uses Responses API for `o*` and `gpt-5*`.
4. Remember that `AIAgent.executeChain()` runs tasks as independent chats.

## Useful Search Commands

```bash
rg "MODE ===" src/index.ts
rg "socket.emit\\(\"start-agent\"" public
rg "DYNAMIC_PAYLOAD|DYNAMIC_TARGET_ID|DYNAMIC_LANGS" src public
rg "CLIENT_REPORT.*JSON" src public
rg "CARMELON_PREVIEW_EVENT_JSON|preview-event" src public
rg "export type .*Config|async run\\(" src/jobs
```

## Known Issues And Caveats

### Large `src/index.ts`

`src/index.ts` mixes:

- imports,
- constants,
- Google Sheet IDs,
- Drive folder IDs,
- helper functions,
- mode routing,
- execution logic.

This makes accidental changes easy. When editing, keep diffs small.

### Duplicate mode branch

`tid-hotel-in-question` appears twice in `src/index.ts`. The first matching branch runs, so the second is unreachable.

### Unused stream helpers

`src/server-demo.ts` defines:

- `createStreamHandler`
- `flushStreamBuffer`

The active stdout/stderr handling currently duplicates similar logic inline. This is a cleanup opportunity.

### Package formatting

`package.json` has inconsistent indentation. Do not reformat it unless the task is specifically cleanup, because it can create noisy diffs.

### No test command

There is no `npm test`. Build is the baseline check.

### Credentials path

`SheetsService` fallback credentials path is:

```text
./src/credentials/service-account.json
```

This file should be local-only.

### Hardcoded operational IDs

Many Google Sheet and Drive IDs/URLs are hardcoded in `src/index.ts`. Treat them as live operational config.

### stdout is an API

Some UI flows parse stdout:

- `client-reports`
- `client-reports-edit`
- `design-formatting` preview events

Be careful when changing logs around markers.

## Refactor Opportunities

Good future cleanup targets:

- Split `src/index.ts` into `mode-router.ts` plus per-mode config files.
- Move hardcoded Google IDs to `.env` or local config JSON.
- Replace duplicated stream handling in `server-demo.ts` with `createStreamHandler`.
- Add a real test script for pure helpers:
  - `report-calculations.ts`
  - `report-chart-data.ts`
  - `preview-events.ts`
  - ID parsing helpers
- Add schema validation for web payloads.
- Standardize tab name normalization utilities.

## Safe Run Checklist

Before running a write-heavy job:

1. Confirm whether the user explicitly asked to create a local snapshot. If not, do not create one.
2. Confirm the change does not touch protected files without approval.
3. Confirm target spreadsheet/folder ID.
4. Confirm tab name.
5. Confirm column mapping and whether columns are letters or indexes.
6. Confirm `dryRun` if available.
7. Confirm service account has access without inspecting credentials.
8. Confirm whether job overwrites existing data.
9. Read the job's `run` method around write calls.

## Notes On Specific Flows

### Translation

There are two translation flows:

- `TranslateFromSheetJob` for older/production config in `src/index.ts`.
- `TranslateFromSheetDemoJob` for UI-controlled translation.

The demo job has richer UI overrides and stronger matrix-shape protection.

### Formatting

`DesignFormattingJob` is built for UI dry-runs and preview events. It supports formatting and text operations over a range. Some operations use values API; others use batchUpdate formatting requests.

### Sheet Utilities

`SheetUtilitiesJob` is a generic operational toolbox. It supports matching/copying/reporting flows that can modify many rows. It defaults to dry run unless the payload says otherwise.

### Client Reports

`ClientReportsJob` normalizes marketing data rows, infers column mapping, calculates totals/comparison/breakdowns, optionally generates AI insight blocks, and returns JSON for the browser dashboard.

`ClientReportsEditJob` edits those insight blocks through the shared `report-insights.ts` helpers.
