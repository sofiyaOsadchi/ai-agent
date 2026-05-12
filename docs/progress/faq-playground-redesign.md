# FAQ Playground Redesign Progress

Last updated: 2026-05-10

## Current checkpoint

- Local backup snapshot was created before the redesign:
  `.local-history/snapshots/2026-05-10T20-12-13-159Z__approved-checkpoint-before-faq-playground-redesign`
- The redesigned screen is implemented in `public/faq-playground.html`.
- No changes were made to `src/index.ts`, `src/server-demo.ts`, `package.json`, env files, credentials, `src/core/agent.ts`, or `src/services/sheets.ts`.

## What changed

- Rebuilt the FAQ Playground as `Carmelon FAQ Creator Studio`.
- Added Carmelon logo and a visual language aligned with the newer audit screens:
  soft background, purple/teal/orange palette, clean panels, clear selected states.
- Added a category builder with collapsible cards:
  General Information, Booking & Payment, Check-in & Check-out, Rooms & Amenities,
  Location & Transportation, Food & Dining, Policies & House Rules, Trust & Support.
- Added presets:
  Hotel, Local Business, Schema-ready.
- Added global controls:
  model, target question count, output language, audience, source strategy, sheet prefix.
- Added per-task model override. Backend already supports `task.model`.
- Preserved the backend payload contract:
  `{ mode: "faq-playground", subjects, tasks }`.
- Added local browser persistence with `localStorage` so the user can resume edits.
- Added a category plan variable that is expanded in the browser before sending:
  `{{categoryPlan}}`.
- Kept server-side variables intact:
  `{{subject}}`, `{{hotel}}`, `{{last}}`.
- Rewrote default prompts to produce a more useful workflow:
  question research, TSV answers, QA notes column, optional schema readiness, optional translation.

## Validation

- HTML inline script syntax passed with Node extraction.
- TypeScript passed:
  `npx tsc --noEmit --pretty false`
- Browser smoke test passed on `http://localhost:3000/faq-playground.html`:
  logo present, 8 category cards, 5 task cards, default model `o3`, run button visible.
- Payload smoke test passed with mocked Socket.IO:
  `start-agent` event, `mode: "faq-playground"`, 5 tasks, `enabled` values are booleans,
  first task includes the expanded category plan, model is sent as `o3`.

## Research notes

- FAQ generation should start from real user intent and page/service context.
- Categories should represent user journey moments:
  before booking, booking/payment, arrival, room/service details, location, policy, support.
- FAQPage structured data should mirror visible FAQ content, not hidden or unrelated text.
- Google FAQ rich results are limited and should not be the only goal; the FAQ output should be useful for users, AI answerability, and internal content QA.

## Suggested next steps

- Test one real FAQ run with 1 subject and default settings.
- Decide whether to keep task 4 schema readiness disabled by default or turn it on for schema-heavy workflows.
- If users need direct Google Sheet naming control, extend the backend later to read `sheetPrefix`; currently it is only stored in UI state.
- Consider adding a dedicated export mode for FAQPage JSON-LD in a future phase.

## 2026-05-11 refinement

- Reduced visual noise: removed page/card gradients and kept the layout mostly white with Carmelon accents.
- Category cards are now editable:
  display name, internal English name, description, question target mode, target count, and question intents.
- Question targets can now be:
  numeric target, as many as found, or quality-first without a hard target.
- Added editable source instructions instead of relying only on a preset selector.
- Added editable naming rules for the property/product name.
- Sheet naming is now clearer in the UI:
  the sheet name is previewed as `Creator: {subject}`, matching current backend behavior.
- Added work-plan export/import:
  users can download the full FAQ setup as JSON and load it later to continue consistently.
- Browser payload check confirmed:
  category edits update the visible card, JSON buttons exist, sheet preview updates from subject,
  source/naming rules enter the prompt, as-found question target enters the prompt, and task `enabled`
  values remain booleans.
