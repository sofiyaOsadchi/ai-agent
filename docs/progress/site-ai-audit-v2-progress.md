# Site AI Audit V2 Progress

Last updated: 2026-05-08

## User Decisions

- Approved work items 1-3 from the reset plan:
  1. URL discovery and site mapping before audit.
  2. User selection of URL groups / patterns before scanning.
  3. Dedicated FAQ audit engine.
- FAQ audits should use rendered pages by default. Static-only checks are not reliable enough for FAQ/schema work.
- FAQ report is not a client report. It should be a clear internal table with exact page-level diagnostics.
- Client report is derived from the general crawler report: shorter, visual, editable by the user, and safe to show to a client.
- General crawler report should become more visual and presentation-ready later.

## Guardrails

- Do not touch `.env` or credentials.
- Do not edit `package.json`; suggest changes only if needed.
- Do not edit `src/core/agent.ts` or `src/services/sheets.ts`; suggest changes only.
- Changes to `src/index.ts`, `src/server-demo.ts`, or the main index page require separate user approval.
- Current work should stay in new job files, public UI prototypes, and docs until approved for wiring.

## Implemented In This Pass

### URL Discovery

File: `src/jobs/site-ai-audit-discovery.ts`

Status: implemented and TypeScript passes.

What it does:

- Normalizes the start URL.
- Reads `robots.txt` for sitemap hints.
- Reads `sitemap.xml` and nested sitemap files.
- Crawls internal links from the start page up to a depth limit.
- Merges sitemap and page-link URLs.
- Actively generates and checks likely `/faq` URLs from discovered hotel/property/location URLs.
- Sorts FAQ URLs before applying the final URL limit, so a large sitemap cannot push FAQ pages out of the result.
- Classifies URLs into groups:
  - `faq`
  - `hotel`
  - `location`
  - `offer`
  - `blog`
  - `legal`
  - `contact`
  - `booking`
  - `asset`
  - `other`
- Returns group summaries with counts and example URLs.
- Returns FAQ candidate diagnostics:
  - candidates checked
  - valid FAQ pages found
  - example FAQ candidate URLs

Direct command:

```bash
npx tsx src/jobs/site-ai-audit-discovery.ts --url 'https://example.com' --max-urls 600 --max-depth 2
```

Stay Master verification:

- With `maxUrls: 120`, discovery found 13 FAQ URLs from `https://www.stay-master.com`.
- Confirmed `https://www.stay-master.com/bat-yam/master-bat-yam/faq` appears in the FAQ URL set.
- Root cause of the previous miss: `page-sitemap.xml` filled the old `maxUrls` limit before `page-sitemap2.xml`, where the FAQ URLs live, was allowed into the merged result.
- Fix: collect first, classify/sort with FAQ priority, then apply the limit.

### Dedicated FAQ Audit

File: `src/jobs/site-ai-faq-audit.ts`

Status: implemented and TypeScript passes.

What it does:

- Accepts explicit URLs or uses discovery to select URLs by groups.
- Defaults to rendered Playwright checks for FAQ/schema accuracy.
- Falls back to static HTML if rendering fails.
- Extracts visible FAQ Q/A from:
  - `details > summary`
  - microdata `Question`
  - FAQ/accordion containers
  - `aria-controls` FAQ/accordion patterns
- Filters out section/category headings such as `General Information`, so they are not counted as FAQ questions.
- Decodes HTML entities before comparing visible questions to schema questions, preventing false gaps such as `’` vs `&#8217;`.
- Extracts JSON-LD FAQ schema from:
  - direct `FAQPage`
  - arrays
  - `@graph`
  - nested `mainEntity`
  - `Question` objects with `acceptedAnswer`
- Returns a page table model:
  - URL
  - title
  - H1
  - rendered/static status
  - schema types
  - FAQPage object count
  - visible Q/A count
  - schema Q/A count
  - visible questions
  - schema questions
  - visible-only questions
  - schema-only questions
  - empty/short answer indicators
  - invalid JSON-LD count
  - status: `ok`, `missing-schema`, `missing-visible-faq`, `mismatch`, `no-faq`, `fetch-failed`
- Can create a Google Sheets report when `writeGoogleSheet: true`.

Google Sheets report tabs:

- `Summary`
- `Pages`
- `Gaps`
- `Questions`

Direct command:

```bash
npx tsx src/jobs/site-ai-faq-audit.ts --url 'https://example.com' --groups faq,hotel,location --max-pages 50 --max-depth 3
```

Explicit URL list:

```bash
npx tsx src/jobs/site-ai-faq-audit.ts --url 'https://example.com' --urls 'https://example.com/faq,https://example.com/hotel-a'
```

Static-only fallback test:

```bash
npx tsx src/jobs/site-ai-faq-audit.ts --url 'https://example.com' --groups faq --static
```

Stay Master verification:

- Checked `https://www.stay-master.com/athens/master-plaka-athens/faq`.
- Before the extraction fix, visible Q/A was 71 and included category headings like `General Information`.
- After the extraction fix, visible Q/A is 64, schema Q/A is 64, status is `ok`, and `General Information` is not counted as a question.

### V2 UI Prototype

File: `public/site-ai-audit-v2.html`

Status: implemented and wired.

Primary public entry:

- `public/site-ai-faq-audit.html`

Compatibility/prototype entry:

- `public/site-ai-audit-v2.html`

What it does:

- Keeps FAQ audit separate from the general site crawler.
- Maps the site first, before any FAQ audit.
- Shows URL groups with counts and example URLs.
- Lets the user choose groups such as FAQ, hotel and location pages.
- Lets the user add manual URLs and URL-contains filters.
- Runs a dedicated FAQ audit after selection via `site-ai-faq-audit`.
- Displays an internal FAQ table with exact page-level diagnostics.
- Exports the FAQ report as HTML, CSV and JSON.
- Adds a `Create Google Sheet` action that reruns the FAQ audit with `writeGoogleSheet: true` and returns a shareable Google Sheets link.

Expected backend markers:

```text
SITE_AI_DISCOVERY_RESULT_JSON_START
SITE_AI_DISCOVERY_RESULT_JSON_END
SITE_FAQ_AUDIT_RESULT_JSON_START
SITE_FAQ_AUDIT_RESULT_JSON_END
```

## Pipeline Backlog

### Phase A: Discovery UI

Status: implemented and smoke-tested through the browser.

Goal: let the user map the site first and choose which URL groups to scan.

Tasks:

- Create/extend a V2 UI screen for discovery results.
- Show URL groups with counts and example URLs.
- Let user select groups such as `faq`, `hotel`, `location`.
- Let user paste/add specific URLs manually.
- Let user filter by URL contains text, e.g. `/hotels/`, `/london`, `/faq`.
- Only after selection, run FAQ/general audit.

Requires wiring approval if run through the demo server:

- `src/index.ts`
- `src/server-demo.ts`

### Phase B: FAQ Report Table

Status: prototype implemented and smoke-tested through the browser. Real-site verification is still pending.

Goal: create a precise table report, not a client summary.

Columns:

- Page URL
- Page title
- Rendered/static
- Visible FAQ count
- Schema FAQ count
- FAQPage object count
- Status
- Visible-only questions
- Schema-only questions
- Empty/short answers
- JSON-LD types
- Notes

Downloads:

- HTML table
- CSV
- JSON

### Phase C: General Crawler Visual Report

Status: pending.

Goal: improve the general crawler report as a visual client-facing document.

Needed sections:

- Executive summary
- Score cards
- Visual score breakdown
- Content/indexability/schema/meta/link sections
- Editable client-view toggles
- Internal appendix

### Phase D: Schema Engine Improvements

Status: started in FAQ audit.

Already added:

- `@graph`
- arrays
- nested `mainEntity`
- direct `Question`
- `acceptedAnswer`

Still needed:

- Better answer text cleanup from HTML inside schema.
- Microdata/RDFa support if relevant.
- Clear distinction between static schema and rendered schema.
- Better warnings when render fallback was used.

### Phase E: Verification

Status: pending.

Test targets:

- A known FAQ page.
- A known hotel/location page with FAQ.
- A page with rendered-only FAQ/schema.
- A page with schema but no visible FAQ.
- A page with visible FAQ but no schema.

Expected acceptance:

- The FAQ audit lists the exact pages checked.
- The FAQ audit reports exact visible Q/A count and schema Q/A count.
- If schema exists, it is detected in rendered mode.
- If the page is not a FAQ candidate, it is not shown in FAQ report unless user explicitly selected it.

## Latest Verification

Passed:

- `node -e` inline script parse check for `public/site-ai-audit-v2.html`
- `npx tsc --noEmit --pretty false`

Next:

- Run V2 against known FAQ/hotel/location pages and verify rendered FAQ/schema counts.
- Improve URL classification against real hotel/location patterns if real-site discovery misses important page groups.
- Continue improving the general crawler report separately; do not mix it into the FAQ audit screen.

Browser smoke tests passed:

- Main hub shows both `AI Site Audit Crawler` and `AI FAQ Audit`.
- `AI Site Audit Crawler` points to `/site-ai-audit.html`.
- `AI FAQ Audit` points to `/site-ai-faq-audit.html`.
- `/site-ai-faq-audit.html` runs `site-ai-discovery` through Socket.IO.
- `/site-ai-faq-audit.html` runs `site-ai-faq-audit` through Socket.IO with manual URLs.

```bash
npx tsc --noEmit --pretty false
```

Not yet done:

- Real network crawl verification against Stay Master or Leonardo from the UI.
- V2 UI wiring through the demo server.

## 2026-05-08: FAQ Source Comparison Add-on

Status: implemented, smoke-tested locally.

User goal:

- After the FAQ crawler finds and audits live FAQ pages, compare the live site against the original FAQ source files.
- Typical case: 13 FAQ pages on the site, but only 10 original Google Sheets source files.
- Verify that the site contains the exact questions and answers from the original files and did not introduce obvious content mistakes.
- Add light QA checks only, not deep editorial review.

Implemented in:

- `src/jobs/site-ai-faq-audit.ts`
- `public/site-ai-faq-audit.html`

No changes were needed in:

- `src/index.ts`
- `src/server-demo.ts`
- `src/services/sheets.ts`
- `package.json`

Behavior added:

- Optional `sourceCompareEnabled` flow inside the existing `site-ai-faq-audit` mode.
- Accepts a Drive folder URL/ID or Google Sheet URLs/IDs via `sourceInput`.
- Reads source spreadsheets through existing `SheetsService`.
- Uses the first tab by default, with optional `sourceTabName`.
- Detects source columns from headers such as `Question`, `Answer`, `Final Answer`; falls back to B/C/F style layout.
- Matches each source file to a crawled FAQ page by source filename tokens, e.g. `master Wola` to `.../master-wola/faq`.
- Compares source questions against live visible FAQ first, falling back to schema Q/A if visible FAQ is unavailable.
- Reports:
  - source questions missing on site
  - site questions not found in source
  - answer mismatches using token similarity
  - source duplicate questions
  - source file with no matching page
  - source file read failures

Light QA checks added:

- Duplicate questions in the same source file or same live page.
- Empty or very short answers.
- HTML entity residue such as `&#8217;`.
- Unbalanced double quotes.
- Repeated punctuation.
- Leading punctuation in a question.
- Missing question mark when text clearly starts like a question.
- Replacement character `�`.
- Placeholder text such as `TODO`, `TBD`, `lorem ipsum`.
- Invalid JSON-LD on site pages.

Google Sheet report additions:

- `לטיפול` - one combined action list for all issues that should be handled.
- `Source Compare`
- `QA Checks`
- `Source Questions`

`לטיפול` combines:

- DOM/schema gaps:
  - visible FAQ question missing in schema
  - schema question missing on page
  - visible FAQ without FAQPage schema
  - FAQPage schema without visible FAQ
  - no FAQ found
  - page fetch failure
  - short/missing visible or schema answers
  - invalid JSON-LD
- Source-vs-site implementation gaps:
  - source file could not be read
  - source file has no matching FAQ page
  - source file has no detected FAQ questions
  - source question missing on site
  - site question missing from source
  - answer differs from source
  - duplicate source questions
- Light QA checks:
  - duplicated questions
  - very short answers
  - HTML entity residue
  - unbalanced quotes
  - repeated punctuation
  - leading punctuation
  - missing question mark
  - encoding replacement character
  - placeholder text

UI additions:

- Optional source comparison panel under URL selection in `/site-ai-faq-audit.html`.
- Source folder / source spreadsheet input.
- Optional source tab name.
- Optional header row override.
- On-page source comparison table after the FAQ audit table.
- On-page light QA issues table.
- HTML download now includes the FAQ table plus source comparison and QA sections.

Verification:

```bash
npx tsc --noEmit --pretty false
node -e "const fs=require('fs'); const html=fs.readFileSync('public/site-ai-faq-audit.html','utf8'); const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); scripts.forEach((code,i)=>{ new Function(code); console.log('script',i+1,'ok'); });"
```

Browser smoke check:

- `/site-ai-faq-audit.html` loads.
- Hidden source comparison controls exist in the DOM:
  - `#sourceCompareEnabled`
  - `#sourceInput`
  - `#sourceComparePanel`

Recommended next real test:

1. Run discovery on `https://www.stay-master.com`.
2. Select FAQ pages.
3. Enable source comparison.
4. Paste the Drive folder containing the original `master ...` FAQ Google Sheets.
5. Run FAQ audit.
6. Create Google Sheet report.
7. Confirm `Source Compare` matches each source file to the expected FAQ URL.
8. Confirm `QA Checks` does not over-report category headings as questions.
