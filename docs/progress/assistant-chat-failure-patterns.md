# Assistant Chat Failure Patterns

Created: 2026-05-24

## Common denominator

The repeated bugs are not separate UI issues. They all come from the same deeper problem:

The chat sometimes hides state from the user, then treats later clicks or short follow-ups as if the user knew that hidden state.

That creates surprising behavior:

- A default option is already selected, so clicking it turns it off.
- A button looks like an answer, but is actually a command.
- `Continue` becomes a user message instead of confirming selected values.
- The assistant asks for the wrong next field because it lost the active task.
- A run button looks secondary, while secondary options look equally important.
- A language choice leaks into later labels after the conversation language was already established.
- Results stay in the log instead of becoming a visible output card.

## Global interaction rules

1. No hidden defaults for meaningful multi-select choices.
   If a default matters, show it as a separate `Recommended` action.

2. Toggle buttons must be reversible.
   If clicking an already selected item clears it, that must be visible through the checkmark.

3. Administrative buttons should not echo as chat messages.
   `Continue`, `Back`, `Clear`, and `Recommended` update state. They should not appear as user intent bubbles.

4. A selected multi-choice step should summarize the real selected values exactly once.
   The summary bubble should contain the selected labels, not the word `Continue`.

5. Every meaningful choice step needs a recovery path.
   At minimum: clear selection, recommended/default restore, or back to the previous setup step.

6. The primary action must be visually primary.
   Run / map / create / write actions should be the strongest button. Payload, workspace, and detail actions are secondary.

7. Payload builders must not restore defaults that the UI explicitly cleared.
   If a user selects no custom checks, the state should block continuation rather than silently restoring all checks.

8. The assistant must preserve the conversation language unless the user explicitly changes it.
   Mixed Hebrew/English is allowed only for product/tool names and source values.

9. Task switching should be explicit.
   If the user moves from FAQ creation to Sheet editing or FAQ implementation audit, the chat should say it switched and stop asking the old flow questions.

10. Results should be modeled, not only logged.
    Any created Sheet, report, preview, or discovery map should appear as a generated-output card.

## Fixes already applied

- FAQ audit group selection no longer starts with hidden selected groups.
- FAQ audit group selection has `Recommended groups`, `All groups`, `Clear selection`, `Back`, and `Continue`.
- FAQ audit group `Continue` no longer echoes as a separate user message.
- Site audit check selection no longer starts with hidden selected checks.
- Site audit check selection has explicit `Recommended checks` and reversible `All checks`.
- Payload generation for custom site-audit checks no longer silently turns every check back on.
- Quick-reply rendering now suppresses administrative command echo by default.
- Regression coverage includes multi-select confirmation, task switching, column targeting, FAQ audit discovery, and hidden-default prevention.

## Remaining work

- Add a real shared `Back` stack for all flows, not only selected steps.
- Move more routing from ad-hoc regex branches into the command model.
- Normalize all tool adapters with the same `fields -> validate -> payload -> guardrail -> result` path.
- Expand regression scripts from 19 scenarios to a full 80-120 conversation matrix.
- Add language-stability assertions for every tool, not only FAQ.
- Convert terminal-only outputs into `ResultModel` cards for every backend marker.
