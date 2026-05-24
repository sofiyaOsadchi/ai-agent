# AI Workspace Assistant - Super Chat Research and Action Plan

Created: 2026-05-24
Backup: `backups/assistant-chat-20260524-092055/`

## Executive conclusion

The central chat should stop behaving like a keyword router with UI bubbles. It needs to become a controlled task orchestrator:

1. Interpret each user message into a small set of structured commands.
2. Apply those commands to an explicit task state.
3. Validate the state against the selected tool capability.
4. Ask only for the next missing or unsafe field.
5. Build a payload only after the operation is correct.
6. Run or hand off through a single primary action.
7. Store result objects, not just terminal text.

The best model is not "LLM decides everything". The best model is "LLM maps natural language to commands, code owns state transitions and safety".

## Research patterns worth adopting

### 1. Rasa CALM-style command generation

Rasa CALM separates dialogue understanding from dialogue management. The LLM reads the conversation, active flow, and collected slots, then emits commands like starting a flow or setting a slot. Business logic remains controlled in flows.

What to borrow:

- A small command vocabulary: `start_task`, `switch_task`, `set_field`, `append_instruction`, `confirm_run`, `ask_clarification`, `show_result`, `open_workspace`.
- Slot/state updates are applied by code, not directly by the model.
- Conversation repair patterns handle "no", "go back", "not that", "use the previous Sheet", "change C to F".

Fit for our project:

- Tool required inputs become slots.
- Current FAQ custom flow becomes the first real flow.
- Follow-ups like "move it to C" become `set_field(targetColumn, "C")` on the active Sheet-edit task.

### 2. LangGraph-style state checkpoints

LangGraph's useful idea here is persistent graph state: every task has a checkpointed state, can be resumed, inspected, and interrupted before risky actions.

What to borrow:

- A `TaskState` object with stable fields and versioning.
- State snapshots for debugging and tests, not user-facing snapshots unless requested.
- Interrupt points before write/crawl/cost actions.
- Ability to resume from "waiting for field", "ready", "running", "result ready".

Fit for our project:

- We can implement this locally in JS first, without adopting LangGraph.
- Store task history in browser memory/localStorage later if needed.
- Regression tests can assert exact task-state transitions.

### 3. OpenAI Agents-style handoffs and guardrails

OpenAI Agents frames specialized agents/tools through handoffs and guardrails. The important part is that a manager can transfer to a specialist with typed input, while guardrails validate tool calls.

What to borrow:

- One manager brain for routing.
- Specialist adapters per tool.
- Guardrails around dangerous fields:
  - source URL
  - target Sheet
  - write mode
  - output columns
  - max pages
  - AI/cost mode
- Handoffs with a typed payload, not loose text.

Fit for our project:

- `assistant-tools.js` already has a tool registry; it should become the handoff/capability registry.
- Smart preflight should not choose the operation. It should only refine safe text fields after the planner has locked tool, operation, source, destination, and risk.

### 4. CopilotKit / generative UI-style shared state

CopilotKit's useful pattern is shared state between the agent and UI. The agent does not only "say" what happened; it updates state, and UI renders cards, progress, results, and actions.

What to borrow:

- The chat emits structured UI state: active task, missing fields, payload preview, run status, outputs.
- Generated outputs should be first-class cards, not parsed terminal leftovers.
- Buttons are actions against state, not natural-language messages.

Fit for our project:

- We already have Active task, Run log, Sources, Generated outputs.
- The next step is to feed them from a normalized `TaskState` and `ResultModel`.

## Current architecture diagnosis

Current strengths:

- `public/assistant-tools.js` is a good start for a registry.
- `public/assistant-workspace.js` already has task memory, source/output panels, direct run, and several mature custom flows.
- `scripts/assistant-chat-regression.cjs` now gives a baseline for conversation QA.
- Existing tools already know how to run; the chat does not need to rewrite them.

Current weak points:

- Routing, field collection, task memory, UI rendering, payload building, and run policy all live in one large file.
- Natural follow-ups are interpreted through scattered regex checks.
- AI is called too late or too generally.
- There is no canonical command/result model.
- The assistant still sometimes treats UI buttons as chat messages.
- Task switching is not explicit enough.
- "Ready to run" and "needs confirmation" are not always the same concept.

## Target architecture

### Core objects

`AssistantCommand`

```ts
type AssistantCommand =
  | { type: "start_task"; toolId: string; reason: string; fields?: Record<string, unknown> }
  | { type: "switch_task"; toolId: string; fields?: Record<string, unknown> }
  | { type: "set_field"; key: string; value: unknown; confidence: number }
  | { type: "append_instruction"; text: string }
  | { type: "confirm_run" }
  | { type: "request_dry_run" }
  | { type: "open_workspace" }
  | { type: "show_payload" }
  | { type: "show_result"; target?: "latest" | "report" | "sheet" }
  | { type: "clarify"; question: string; options?: AssistantOption[] };
```

`TaskState`

```ts
type TaskState = {
  id: string;
  toolId: string;
  status: "collecting" | "ready" | "confirming" | "running" | "complete" | "blocked";
  locale: "he" | "en";
  fields: Record<string, unknown>;
  missingFields: string[];
  lockedFields: string[];
  operation?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  result?: ResultModel;
  history: TaskEvent[];
};
```

`ResultModel`

```ts
type ResultModel = {
  status: "success" | "partial" | "failed";
  summary: string;
  changed?: Array<{ kind: string; location: string; count?: number }>;
  outputs?: Array<{ type: string; title: string; url?: string; key?: string }>;
  warnings?: string[];
  nextActions?: AssistantOption[];
};
```

### Runtime pipeline

1. User or UI action enters as `ChatInput`.
2. `ContextAssembler` builds a compact context:
   - active task
   - last task
   - recent sources
   - generated outputs
   - selected tool capability
   - last assistant question
3. `CommandPlanner` emits structured commands.
4. `CommandReducer` applies commands to `TaskState`.
5. `ToolAdapter` validates fields and chooses next step.
6. `PayloadBuilder` creates payload only when tool + operation + destinations are valid.
7. `GuardrailValidator` blocks risky mismatches.
8. `Renderer` turns state into short chat text, primary button, secondary actions, and cards.
9. `Runner` starts backend job only from a confirmed safe state.
10. `ResultParser` writes a normalized `ResultModel`.

## Tool capability registry upgrades

Every tool should expose:

- `intents`: natural language examples and negative examples.
- `fields`: required/optional fields with types and validation.
- `operations`: named operations with required fields.
- `followUps`: supported follow-up actions.
- `runPolicy`: `direct`, `confirm`, `workspace_only`, `draft_only`.
- `riskPolicy`: what is locked after user confirmation.
- `resultParser`: how to convert logs/markers into `ResultModel`.
- `uiPolicy`: primary action label and secondary actions.

Example for Sheet Editing:

```ts
operations: {
  replace_column_when_value: {
    fields: ["targetUrl", "sourceColumn", "targetColumn", "tabName"],
    guardrails: ["sourceColumn != targetColumn for live write"],
    followUps: ["change_source_column", "change_target_column", "dry_run", "confirm_live_write"]
  },
  faq_answer_research: {
    fields: ["targetUrl", "questionColumn", "answerColumn", "outputColumn"],
    runPolicy: "confirm",
    followUps: ["change_output_column", "source_policy", "show_changed_cells"]
  }
}
```

## Open-source ideas to inspect deeper

1. OpenAI Agents SDK
   - Use as design reference for manager/specialist handoffs and guardrails.
   - Do not migrate the current frontend to it yet.

2. Rasa CALM
   - Use as design reference for command generation, slots, flows, and repair patterns.
   - This maps best to our current tool registry.

3. LangGraph
   - Use as design reference for persisted state, interrupts, and resumable workflows.
   - Consider later if backend orchestration grows beyond browser JS.

4. CopilotKit / AG-UI
   - Use as design reference for shared state and structured UI events.
   - We can implement a lightweight equivalent in the current vanilla JS UI.

5. assistant-ui / Open WebUI / Vercel AI SDK UI
   - Useful for chat UX patterns, but not enough for our orchestration problem by themselves.

## Implementation roadmap

### Phase 0 - Freeze baseline

Done:

- Backed up current assistant files to `backups/assistant-chat-20260524-092055/`.
- Regression suite exists and passes for the current known flows.

Next:

- Add a `docs/progress/assistant-super-chat-test-matrix.md`.
- Define 80-120 conversation scripts across all tools before deeper refactor.

### Phase 1 - Extract architecture without changing behavior

Goal: make the current behavior easier to reason about before making it smarter.

Files to add:

- `public/assistant-state.js`
- `public/assistant-command-planner.js`
- `public/assistant-command-reducer.js`
- `public/assistant-tool-adapters.js`
- `public/assistant-render-model.js`

First extraction targets:

- state factory and memory helpers
- quick reply/action model
- tool field assignment
- payload build wrapper
- result model parser

Acceptance:

- UI looks the same.
- Regression remains green.
- No live jobs run during tests.

### Phase 2 - Command planner

Goal: every message becomes structured commands before state changes.

Implement:

- Deterministic planner for:
  - buttons
  - yes/no
  - continue
  - column references
  - URLs
  - languages
  - result-location questions
- AI planner endpoint for ambiguous messages:
  - returns JSON only
  - cannot run tools
  - cannot change locked dangerous fields
  - must include confidence and reason

Acceptance:

- "take the answers from F and put them in C" maps to `set_field(sourceColumn=F)` + `set_field(targetColumn=C)` on Sheet edit.
- "no, edit what you just created" switches from FAQ creation to Sheet edit against latest generated Sheet.
- "where did it put the report?" maps to `show_result`.

### Phase 3 - Flow/slot layer per tool

Goal: replace ad hoc pending-question logic with declared flows.

Start with these flows:

1. FAQ Builder
2. Sheet Editing
3. Site Audit
4. Translation
5. Schema Builder

Each flow has:

- fields
- validation
- multi-select rules
- skip rules
- source policy
- run policy
- preview text

Acceptance:

- Multi-select works with click, Continue, and empty Send.
- The assistant never asks a field already filled unless user asks to change it.
- Language remains stable across the whole task.

### Phase 4 - Smart task switching

Goal: handle small adjacent tasks quickly.

Add task-switch detection:

- New task: "now audit this website"
- Continue active task: "make it 50 pages"
- Edit last output: "clean column C in the Sheet you created"
- Result query: "where is the file?"
- Correction: "not F, C"

Acceptance:

- Assistant names the switch briefly: "Switching to Sheet edit on the generated Sheet."
- It reuses last source/output safely.
- It asks only if the target is ambiguous.

### Phase 5 - Result model

Goal: stop leaving important output in terminal logs.

Implement parsers for:

- Google Sheet created
- Site audit report
- FAQ audit report Sheet
- Design-formatting cells changed
- Schema preview/write
- Translation tabs created
- Client report

Acceptance:

- Every completed run produces a visible output card.
- The chat can answer "what changed?", "where is it?", "open the report", "what failed?"

### Phase 6 - Large test suite

Build scripted tests:

- 20 FAQ creation scripts
- 15 Sheet editing scripts
- 15 Site audit scripts
- 10 Translation scripts
- 10 Schema scripts
- 10 Meta scripts
- 10 Result/follow-up scripts
- 10 task-switch scripts

Each script asserts:

- active tool
- state fields
- missing fields
- primary action
- no duplicate confirmations
- language stability
- payload shape

## Immediate next implementation slice

Best next slice:

1. Add `assistant-command-model.js` with command constants and validators.
2. Add a deterministic `planDeterministicCommands(text, state)` for known follow-ups.
3. Route `handleFreeText()` through the command planner first.
4. Keep existing functions as reducers/adapters behind it.
5. Add 20 regression scripts for task switching and Sheet/FAQ confusion.

This gives us a smarter assistant without a dangerous rewrite.

## Non-goals for the first implementation

- Do not migrate to React.
- Do not replace all local routing with AI.
- Do not introduce a new backend framework yet.
- Do not let AI mutate source/write/output fields after confirmation.
- Do not expose legacy `src/index.ts` modes until each has a safe adapter.

## Definition of "super chat"

The assistant is good enough when it can:

- Understand a natural message in Hebrew or English.
- Know whether it is a new task, follow-up, correction, result question, or tool command.
- Update the active task state without repeating old questions.
- Reuse the latest generated Sheet/report/source safely.
- Build the right payload before preflight.
- Run directly when safe and clearly confirmed by the primary action.
- Open a workspace only when review/manual editing is useful.
- Return clear result cards and next actions.
- Be testable through scripted conversation regressions.
