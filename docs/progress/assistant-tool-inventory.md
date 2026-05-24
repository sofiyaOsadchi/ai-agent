# Assistant Tool Inventory

Updated: 2026-05-21

## How the main chat runs work

`public/assistant-workspace.html` is the central chat UI. It does not run as its own `MODE`.

The runtime path is:

1. The chat chooses or continues a task using local routing, task memory, and the registered tools in `public/assistant-tools.js`.
2. A small operation planner resolves follow-ups before payload build, for example last researched answers in column `F` -> answer column `C`.
3. The tool adapter builds a payload with `mode`.
4. Smart preflight may refine safe prompt fields after the payload exists.
5. `src/server-demo.ts` receives `start-agent`.
6. The server runs `npx tsx src/index.ts` with `MODE=<payload.mode>` and `DYNAMIC_PAYLOAD=<payload>`.
7. `src/index.ts` dispatches to the matching job.

This means the chat only knows tools that have an adapter/manifest entry. A mode can exist in `src/index.ts` and still be invisible to the chat.

## Chat-registered tools

Each registered tool now carries a `capability` object in `public/assistant-tools.js`:

- `operationModes`
- `requiredInputs`
- `optionalInputs`
- `canRunDirectly` / `directRunAllowed`
- `needsConfirmation`
- `outputType`
- `workspaceUrl`
- `resultParser`
- `followUpActions`

| Tool id | Mode | Surface | Status | Notes |
| --- | --- | --- | --- | --- |
| `faq-playground` | `faq-playground` | `public/faq-playground.html` | Partial | Product-critical. Chat has a custom FAQ flow; manifest payload is a draft shape, while runtime uses `subjects + tasks`. Needs adapter cleanup. |
| `translate-demo` | `translate-demo` | `public/translate-demo.html` | Strong | Good payload adapter and guided inputs. Needs continued checks for glossary/preserve-term UX. |
| `schema-builder` | `schema-builder` | `public/schema-builder.html` | Strong | Direct preview/write flow exists. Needs output-location copy polish. |
| `meta-tags` | `meta-tags` | `public/meta-tags.html` | Partial | Direct payload exists; workspace handoff/report return path needs verification. |
| `site-ai-audit` | `site-ai-audit` | `public/site-ai-audit.html` | In progress | Needs chat-side audit type choices and report handoff. |
| `site-ai-faq-audit` | `site-ai-faq-audit` | `public/site-ai-faq-audit.html` | Partial | Direct payload exists; compare-source and report output need deeper QA. |
| `design-formatting` | `design-formatting` | `public/design-formatting.html` | In progress | Handles FAQ sheet edits, formatting, answer research, and column replacement. Chat task memory resolves follow-ups like “move it to C” against the last Sheet/operation. Direct dry-run and live confirmation exist. |
| `file-draft` | none | Chat only | Draft only | Correctly does not write files from the browser. Codex applies local edits with review. |

## Dynamic modes in `src/index.ts`

These modes already consume `DYNAMIC_PAYLOAD` or are wired for web payloads:

| Mode | Chat coverage | Notes |
| --- | --- | --- |
| `translate-demo` | Registered | Uses `TranslateFromSheetDemoJob.runFromEnv()`. |
| `design-formatting` | Registered | Uses `DesignFormattingJob.run(payload)`. |
| `schema-builder` | Registered | Uses `SchemaBuilderJob.run(payload)`. |
| `meta-tags` | Registered | Uses `MetaTagsJob.run(payload)`. |
| `faq-playground` | Registered custom flow | Uses `runFaqPlayground(agent, sheets, { subjects, tasks })`. |
| `client-reports` | Missing | Server can route it; chat needs adapter. |
| `client-reports-edit` | Missing | Server can route it; chat needs adapter and output display. |
| `site-ai-audit` | Registered | Needs better chat UX/report handoff. |
| `site-ai-discovery` | Missing | Server/index support it; could become its own discovery tool or a pre-step for audit. |
| `site-ai-faq-audit` | Registered | Needs output/workspace QA. |
| `sheet-utilities` | Missing | Server/index support it; likely important for a true assistant workspace. |

## Legacy/script modes

These modes exist in `src/index.ts` but are script-like or config-bound, so they should not be exposed to chat until an adapter decides how to collect inputs safely:

`translate`, `rewrite`, `validate-lite`, `meta-schema`, `inject-meta-schema`, `faq-audit`, `match-hotels`, `filter-country`, `cross-check`, `translate-master`, `inject-lang`, `semantic-match-unmatched`, `vlookup-hebrew`, `duplicate-rewrite-hebrew`, `hotels-catalog`, `inject-hebrew-from-unmatched`, `qa-hebrew-injection`, `import-hebrew-meta-tags`, `fattal-faq`, `faq-petal-israel`, `qa-lang-master`, `qa-master-triage`, `qa-master-apply-fixes`, `wrap-p`, `faq-audit-structure`, `sync-fg`, `tid-crosscheck`, `tid-hotel-in-question`, `discover-questions`, `qna-consistency`, `qa-master-sync-originals`, `master-coverage`.

## Immediate build order

1. Stabilize `design-formatting` answer research and column follow-ups with dry-run/live QA.
2. Fix `site-ai-audit` end-to-end: choices, run policy, and report handoff.
3. Normalize `faq-playground` so the manifest adapter and custom chat flow produce the same runnable payload.
4. Add missing adapters for `sheet-utilities` and `client-reports`.
5. Add regression conversation tests for Hebrew and English prompts.
