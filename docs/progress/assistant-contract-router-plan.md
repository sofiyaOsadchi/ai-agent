# Assistant Contract and Intent Router Plan

Created: 2026-05-26

## Purpose

This document is the handoff point for future chats working on the central AI Workspace Assistant.
It captures the architecture decisions, the implementation order, and a concise status log.

The assistant should become a reliable stateful orchestrator for the existing workspace tools, not an uncontrolled free-form agent.
It should understand flexible user language, choose or continue the right task, collect missing fields, build safe payloads, and run existing jobs only through explicit contracts and guardrails.

## Current Direction

The agreed flow is:

```text
User writes freely
-> fast deterministic rules
-> state-aware command resolver
-> if unclear: AI Intent Router
-> strict JSON decision
-> Tool Contract validation
-> ask / update / run / open workspace / answer generally
```

The AI Intent Router should not run tools directly. It should translate natural language into a structured decision:

```json
{
  "decisionType": "start_tool | update_active_tool | switch_tool | ask_clarification | general_answer",
  "toolId": "design-formatting",
  "confidence": 0.86,
  "userGoal": "Clean source links from FAQ answers",
  "fields": {
    "targetUrl": "...",
    "instruction": "...",
    "answerColumn": "C",
    "dryRun": true
  },
  "missingFields": ["targetUrl"],
  "clarifyingQuestion": "",
  "safetyNotes": [],
  "reply": "Short user-facing response in the user's language."
}
```

## Architecture Decisions

- The central chat is an orchestrator, not a free executor.
- The browser chat may draft file-edit requests, but it must not write local files by itself.
- The AI router may suggest fields and intent, but final payload construction must stay inside a tool contract.
- The model must only choose registered tool ids.
- Tool runs must continue to go through `src/server-demo.ts` -> `src/index.ts` -> existing job modes.
- Risky actions require run policy checks before socket execution.
- Direct AI calls in the chat layer are for routing/preflight/general answer only.
- Content generation, translation, report writing, and audit analysis belong to the jobs below the chat.

## Tool Contract Target

Every chat-registered tool should eventually expose:

- `fields`: normalized required and optional fields.
- `validate(values, context)`: returns validity, missing fields, warnings, and blocking errors.
- `buildPayload(values, context)`: builds the exact backend payload.
- `runPolicy(values, payload, context)`: returns whether direct run is allowed, whether confirmation is required, and why.
- `resultPolicy(resultOrEvent, context)`: maps backend markers/events/log outputs into a normalized result model.

The first runtime contract should be additive and backward-compatible. Existing tool behavior should not be replaced until regression coverage passes.

## ResultModel Target

All generated outputs should eventually become a normalized result:

```json
{
  "id": "result-id",
  "toolId": "schema-builder",
  "title": "Schema preview ready",
  "description": "Preview only, 24 questions",
  "type": "preview | google-sheet | audit-report | faq-audit-report | report | dry-run | error",
  "url": "",
  "status": "ready | running | failed | cancelled",
  "createdAt": "ISO timestamp",
  "metadata": {}
}
```

## Recommended Implementation Order

1. Add regression coverage for a few critical behaviors before major refactors.
2. Add a runtime Tool Contract compatibility layer.
3. Move two tools into the contract shape first:
   - `schema-builder`: simple preview/write behavior.
   - `design-formatting`: higher-risk dry-run/live-write behavior.
4. Add a normalized `ResultModel` mapping layer.
5. Align `faq-playground` with the same contract, while preserving its custom guided flow.
6. Add basic Run History.
7. Add Cancel Run.
8. Only then split `public/assistant-workspace.js` into smaller modules.

## FAQ Subject Validation Issue

Observed user case:

```text
אני חושבת על בניית עמוד faq
אתה יכול לבנות לי שאלון על מלון לאונדרו ברלין? אנגלית uk
```

The assistant routed correctly to FAQ creation and continued the guided flow, but it treated the topic too literally.
The generated sheet title and FAQ content used a polluted subject such as `מלון לאונדרו ברלין? אנגלית uk`, mixing:

- the actual entity: `Leonardo Hotel Berlin`
- the requested output language/locale: `English UK`
- punctuation from the user's sentence
- Hebrew transliteration / partial spelling

Expected behavior:

- Extract and normalize the subject before generation.
- Separate `subject`, `brand/entity`, `language`, `locale`, and `content goal`.
- Confirm or ask when the subject looks ambiguous, transliterated, or mixed with instructions.
- Never send raw first-message text directly as the FAQ topic if it includes language, format, or workflow instructions.

Recommended solution:

- Add a cheap, fast AI validation step before FAQ payload creation, after deterministic routing and before running the job.
- This step should not generate FAQ content and should not run tools.
- It should only normalize the request into structured JSON and flag uncertainty.
- If confidence is low or the normalized subject changed materially, the chat should confirm with the user before creating a sheet.

Suggested JSON shape:

```json
{
  "toolId": "faq-playground",
  "normalizedSubject": "Leonardo Hotel Berlin",
  "detectedBrandOrEntity": "Leonardo Hotel Berlin",
  "requestedLanguage": "English",
  "requestedLocale": "UK",
  "contentGoal": "Build an FAQ questionnaire / FAQ page plan",
  "removedInstructionFragments": ["אנגלית uk"],
  "confidence": 0.82,
  "needsConfirmation": true,
  "confirmationQuestion": "I understood the FAQ topic as Leonardo Hotel Berlin and the output language as UK English. Is that correct?"
}
```

Automated regression now covers:

```text
User: אני חושבת על בניית עמוד faq
User: אתה יכול לבנות לי שאלון על מלון לאונדרו ברלין? אנגלית uk
Expected: assistant routes to FAQ, extracts subject as `Leonardo Hotel Berlin`, extracts locale as `UK English`, and asks for confirmation if it is not fully certain.
Not expected: sheet title or generated questions contain `? אנגלית uk` as part of the hotel name.
```

## Chat Copy and Tone Pass

Observed schema-builder case:

- The schema workflow itself worked.
- The assistant correctly identified the sheet, tab/columns, output cell, preview/write mode, and completed the run.
- The user-facing chat text felt too technical, mixed-language, and not friendly enough.

Examples of current rough copy:

- `Write mode is on. Current output location: E76. You can change it before running.`
- `איפה לשים את ה-JSON-LD? לשלוח תא כמו E73, או טאב/תא כמו FAQPage Schema!A1.`
- `כותבת FAQPage schema ל-E76.`
- Buttons such as `payload`, `workspace`, or terse technical labels can feel internal rather than helpful.

Expected behavior:

- Keep technical accuracy, but speak like a helpful workspace assistant.
- Prefer short, warm, concrete Hebrew when the conversation is in Hebrew.
- Explain risk clearly before writes, without sounding like a system log.
- Keep raw terms like `JSON-LD` and cell references only where they help the user decide; avoid `Preview`, `payload`, `workspace`, and run-log wording in normal Hebrew chat copy.
- Hide or soften internal implementation language unless the user explicitly asks for technical detail.
- Button labels should describe the user action, not the internal mechanism.
- Do not tell the user there is “a warning in the log” unless the warning is explained and requires user action. Internal preflight warnings should stay in the run log only.

Suggested friendlier copy direction:

```text
מצאתי את הנתונים בגיליון.
כרגע זו בדיקה מקדימה, אז לא אכתוב כלום לגיליון.
אם תרצי שאכתוב את הסכמה, אבחר תא יעד ואז אבקש אישור לפני הכתיבה.
```

For write mode:

```text
אני מוכנה לכתוב את הסכמה לתא E76.
זו פעולה שתעדכן את הגיליון. להמשיך?
```

Suggested button label direction:

- `לכתוב ל-E76` -> `לכתוב לתא E76`
- `לחזור ל-Preview` -> `לחזור לבדיקה מקדימה`
- `לשנות תא פלט` -> `לבחור תא אחר`
- `להציג payload` -> `להציג פרטים טכניים`
- `לפתוח workspace` -> `לפתוח את כלי הסכמה`

Manual regression to continue applying across tools:

```text
User asks in Hebrew to build FAQ schema from a Google Sheet.
Expected: assistant replies in natural Hebrew, explains preview/write mode clearly, asks before write actions, and avoids unnecessary English system text.
Not expected: raw internal copy such as `Write mode is on`, `payload`, or awkward mixed Hebrew/English in the main assistant message.
```

## Run Confirmation UX Rule

Observed schema-builder case from manual testing:

- The user chose to write schema to a cell.
- The assistant then asked for confirmation again before writing.
- The second confirmation did not add meaningful safety information, so the flow felt repetitive.

New rule:

- One clear confirmation is enough for one risky action.
- If the first question already asks the user to choose write mode, target cell, and overwrite behavior, pressing the write button should run.
- Additional confirmation is only justified when new risk appears after the user's choice, for example: a different destination, a live AI/web-search cost, a destructive overwrite that was not previously disclosed, or ambiguous fields.
- The user-facing question should include the full risk package at once: target, write/read mode, existing-cell behavior, and any cost/AI usage.

Schema chat target:

```text
מצאתי את נתוני השאלות והתשובות.
אקרא שאלות מעמודה B ותשובות מעמודה C בטאב Sheet1.
כרגע זו בדיקה מקדימה בלבד, בלי כתיבה לגיליון.
אם נכתוב לתא F79 ויש שם כבר ערך, מה לעשות?
```

Expected buttons:

- `לכתוב לתא F79 רק אם התא ריק`
- `לדרוס את F79`
- `להישאר בבדיקה מקדימה`
- `לבחור תא אחר`

Meta Tags target:

- Same rule as Schema: do not ask twice for the same write action.
- Include overwrite/skip behavior before any writeback.
- Default should protect existing content.

Manual tools target:

- Add an explicit overwrite/skip toggle where the tool can write to existing cells.
- Default: skip existing values.
- User can switch to overwrite intentionally.

Implementation direction:

- Add a shared write policy field to relevant tool payloads, e.g. `existingValuePolicy: "skip" | "overwrite"`.
- For chat, store the user's choice in `state.collectedInputs` and pass it into the payload.
- For manual UIs, expose the same choice as a toggle/segmented control with safe default `skip`.
- Make `needsRunConfirmation` aware of a previously confirmed write choice so it does not ask again for the same target/policy.

Read-only agent findings:

- Schema currently treats `schema:write` as a mode switch, not as the actual run. It sets `previewOnly=false` and then the user still needs to run/write, which creates the double-confirmation feeling.
- Some paths call `runCurrentTool({ confirmed: true })`, while `needsRunConfirmation()` still exists for risky writes. This makes the confirmation model inconsistent across buttons/free text.
- Free text like “write it” can be swallowed as configuration only: Schema flips to write mode; Meta flips output mode. The user still needs a second action.
- Meta has less explicit write UX than Schema: the manifest exposes preview/template/AI choices, but not a clear “write to Sheet” step.
- Schema and Meta currently overwrite target cells/ranges when writing. There is no `skip if existing` or `fail if existing` policy.
- Manual Schema and Meta UIs also lack overwrite/skip safeguards.
- Meta smart-preflight locking should include `outputMode`, `outputTabName`, and `outputStartCell` so AI preflight cannot alter write destination after user intent.

Implementation notes from this finding:

- Pick one model and keep it consistent. Preferred: selecting the final write button runs the action, because the prior question already disclosed target and policy.
- If a step is only a mode switch, label it as mode switch, not as write.
- Better target: “לכתוב לתא F79 רק אם התא ריק” should be the final write action, not just a setup toggle.
- Add overwrite/skip support in the job layer before relying on chat labels.

## Primary Action Button Rule

Observed issue:

- Some tool states show too many quick replies at once.
- The actual run/write button can visually disappear among secondary actions such as technical details, open tool, add detail, or start over.

New rule:

- Each ready state should have exactly one visually primary next action.
- The primary action should appear first, use concrete wording, and be specific to the current state.
- Secondary actions should stay available but visually secondary.
- Technical actions such as details/payload should not compete with run/write.

Review target:

- FAQ Builder
- Schema Builder
- Meta Tags Studio
- Translation
- Design Formatting
- Site AI Audit
- FAQ Audit
- Client Reports
- Sheet Utilities
- File Draft

Read-only agent findings:

- Primary run/action buttons often exist, but quick replies dilute them with too many secondary options.
- Only a narrow set of values currently auto-render as primary: `run`, `run-tool`, `tool:confirm-run`, `format:dry-run`, `format:live-run`.
- Many “continue” actions in multi-select steps are not styled as primary, so users may miss the next step.
- Feature-specific recommendations:
  - FAQ Builder: primary should be `Generate FAQ Sheet`; move technical/details/reset actions later.
  - Schema: preview primary should say no-write clearly; write mode primary should say exact target cell.
  - Meta: add visible write option, not just preview/template/AI.
  - Translation: primary should mention that it writes Sheet tabs.
  - Design Formatting: distinguish preview edit from final Sheet write; include columns for column-copy actions.
  - Site AI Audit: primary should include page budget, e.g. `Run site audit (25 pages)`.
  - FAQ Audit: primary should include selected URL count, e.g. `Run FAQ audit on N URLs`.
  - Client Reports / Sheet Utilities / File Draft: replace generic `Open workspace` with tool-specific builder/handoff wording.

Implementation notes from this finding:

- Expand primary styling for terminal setup actions such as `*-done`, `lang-done`, `audit-checks-done`, `qa-done`, `style-done`, and `categories-done`.
- Ready states should usually show one primary action plus at most 3-4 secondary actions.
- Technical actions (`פרטים טכניים`, copy payload, reset) should not visually compete with run/write.

## Chat Visibility / Missing Messages Bug

Observed issue:

- In manual testing, some answers appear partially hidden or not visible in the chat viewport.
- The screenshot shows the top of a message cropped near the top of the scroll area while quick replies remain visible at the bottom.

Investigation target:

- `renderMessages`
- `bot` / `user` message append flow
- scroll-to-bottom behavior
- interaction between the sticky/fixed quick reply bar and message list height
- re-render after `renderWorkspace`
- any max-height/overflow CSS around the chat log

Expected behavior:

- Every new assistant/user message should be visible after it is added.
- Long messages should wrap and scroll normally.
- Quick replies should not cover the latest message.
- Switching active tasks should not remove or visually hide recent messages.

Read-only agent findings:

- There is no full `renderMessages()` flow; messages are appended imperatively by `addMessage()`.
- `addMessage()` scrolls immediately, before `ask()` renders quick replies and before workspace re-rendering can change layout height.
- Quick replies can wrap into multiple rows, shrinking the visible chat log after the scroll position has already been calculated.
- Long assistant messages are always bottom-aligned; if a message is taller than the visible chat area, the top of it can be hidden. This matches the screenshot symptom.
- The assistant panel CSS declares three grid rows but the panel has four children: header, chat log, quick replies, composer. The implicit row makes vertical budgeting fragile.
- Mobile is more sensitive because the chat area is capped and the composer can be sticky.

Implementation notes from this finding:

- Add a shared `scrollChatToLatest()` helper and call it after messages, quick replies, and workspace updates, using `requestAnimationFrame`.
- Change assistant panel grid rows to `auto minmax(0, 1fr) auto auto`.
- For long new assistant messages, scroll the message top into view when the message is taller than the viewport; otherwise pin to bottom.
- Consider a `ResizeObserver` for quick replies/composer/chat log so the chat stays pinned when the user is already near the bottom.
- Add tests or manual QA for long messages, many quick replies, short desktop height, mobile viewport, and browser zoom.

## Guardrails

- Do not edit `.env`, credentials, or `package.json` without explicit approval.
- Do not edit `src/core/agent.ts`, `src/services/sheets.ts`, or `src/index.ts` without separate explicit approval.
- Do not stage, commit, push, create snapshots, or run live Google Sheets/OpenAI jobs without explicit approval.
- After code changes, run `npx tsc --noEmit`.
- If central chat behavior changes, run `node scripts/assistant-chat-regression.cjs`.

## Task Breakdown

| Step | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Create this decision and roadmap document | Done | Document added as the durable handoff file. |
| 2 | Add additive Tool Contract runtime file | Done | Added `public/assistant-tool-contract.js`; not yet behavior-changing by itself. |
| 3 | Load the contract before `assistant-tools.js` | Done | `assistant-workspace.html` now loads the contract before the manifest. |
| 4 | Add contract adapters for `schema-builder` and `design-formatting` | Done | Built-in adapters added and applied through manifest normalization. |
| 5 | Keep existing behavior passing | Done | `node --check` passed for changed JS files, `npx tsc --noEmit` passed, and chat regression passed 34/34. |
| 6 | Record outcomes here | Done | This table and the status log were updated after implementation and verification. |
| 7 | Add FAQ subject validation / normalization before generation | Done | Added a dedicated `faq-subject-validation` preflight phase before sheet creation, confirmation UX, and regression coverage. |
| 8 | Improve Schema chat copy and tone | Done | Second Schema pass completed: removed most Hebrew `Preview`/`Generated outputs`/`payload`/`workspace` wording from chat-facing copy. |
| 9 | Extend friendly copy pass to remaining tools | In progress | First broad pass applied to central chat messages, Design Formatting, FAQ Audit mapping, FAQ validation visibility, and home/status labels. Still keep this as a gate for future feature work. |
| 10 | Reduce duplicate confirmations before writes | Pending | Make write intent, target, and overwrite policy part of the first confirmation; do not ask again unless new risk appears. |
| 11 | Add overwrite/skip policy for Schema and Meta writes | Pending | Chat and manual UIs should default to skip existing values, with an explicit overwrite option. |
| 12 | Audit primary run buttons across chat tools | Pending | Ensure one clear primary action per ready state; secondary actions should not bury the run/write action. |
| 13 | Investigate missing/hidden chat messages | Pending | Review scroll/render/overflow behavior so recent answers are not hidden behind layout chrome or quick replies. |
| 14 | Multi-agent review of chat UX risks | Done | Three read-only agents reviewed double-confirmation/write policy, primary action clarity, and message visibility; findings are recorded above. |

## Status Log

- 2026-05-26: Plan created from the chat architecture discussion.
- 2026-05-26: Step 1 completed. The durable decision and roadmap document now exists at `docs/progress/assistant-contract-router-plan.md`.
- 2026-05-26: Step 2 completed. Added a browser-safe Tool Contract runtime with default validation, run policy, result model creation, and built-in adapters for `schema-builder` and `design-formatting`.
- 2026-05-26: Steps 3-4 completed. The assistant page now loads the contract runtime before the manifest, and registered tools are normalized through it when available.
- 2026-05-26: Step 5 completed. `node --check public/assistant-tool-contract.js`, `node --check public/assistant-tools.js`, and `npx tsc --noEmit` passed.
- 2026-05-26: Step 5 completed. `node scripts/assistant-chat-regression.cjs` passed 34/34 against a temporary localhost server with test-only auth env vars.
- 2026-05-26: Step 6 completed. Outcomes were recorded here for future handoff.
- 2026-05-26: Added the FAQ subject validation issue and regression case. The next implementation should prevent mixed subject/language strings like `מלון לאונדרו ברלין? אנגלית uk` from becoming sheet titles or generation topics.
- 2026-05-26: Added a chat copy/tone pass task. Schema builder behavior works, but user-facing messages should become warmer, clearer, and less internal/technical.
- 2026-05-26: Step 7 completed. FAQ runs now call a dedicated AI validation phase before creating a sheet. If the subject/language is normalized or uncertain, the chat asks for confirmation before emitting `start-agent`.
- 2026-05-26: Step 8 completed as a first pass for Schema Builder. Hebrew Schema messages and buttons were softened, and write confirmation now explains the Sheet update plainly.
- 2026-05-26: Regression updated and passed 35/35, including `FaqSubjectValidationBeforeRun`.
- 2026-05-26: Step 8 received a second pass after manual UI review. Schema chat text now says things like `בודקת את הסכמה בלי לכתוב לגיליון`, `סיימתי את הבדיקה המקדימה`, `פרטים טכניים`, and `לפתוח כלי סכמה` instead of internal/log-like wording.
- 2026-05-26: Regression passed 35/35 after the second copy pass.
- 2026-05-26: Step 9 started. Broad chat-copy cleanup now replaces Hebrew-facing `dry run`/`Preview`/`workspace` style wording with `בדיקה בלי כתיבה`, `כלי`, `פרטים טכניים`, and clearer local-server messages. FAQ validation now shows a visible “checking subject/language” chat message before sheet creation.
- 2026-05-26: Step 9 first broad pass verified. `node --check public/assistant-workspace.js`, `node --check scripts/assistant-chat-regression.cjs`, `npx tsc --noEmit`, and `node scripts/assistant-chat-regression.cjs` passed; chat regression is 35/35.
- 2026-05-26: Added new UX rules from manual testing: avoid duplicate confirmations, add skip/overwrite behavior before writes, audit primary run buttons, and investigate hidden/missing chat messages. Started multi-agent read-only review for these three areas.
- 2026-05-26: Step 14 completed. Read-only agents confirmed the double-confirmation root cause, button-priority issues, and likely scroll/visibility causes; detailed notes are now recorded in the relevant sections above.
- 2026-05-26: Removed generic user-facing “warning in the log” preflight copy. Smart preflight warnings still go to the run log for debugging, but the chat no longer scares the user with an unexplained warning.
