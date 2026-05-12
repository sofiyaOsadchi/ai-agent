# Site AI General Audit - Internal Treatment + Client Report Plan

Last updated: 2026-05-09

## Goal

Build the general site audit into a practical agency tool for two audiences:

1. Internal agency users who need a clear treatment list and enough evidence to improve a client site.
2. Clients and prospects who need a readable, polished report that explains what matters, why it matters, and what the agency can do next.

The FAQ audit is now working well and should stay separate. This plan is for the general crawler and reporting layer.

## Active Decision

FAQ audit is considered a completed separate feature for now.

Current focus only:

- Product: `AI Site Audit Crawler`
- UI: `public/site-ai-audit.html`
- Logic: `src/jobs/site-ai-audit-crawler.ts`

Do not mix the FAQ-specific workflow into this stage. FAQ findings can appear as one category inside a broader site audit, but the dedicated FAQ source comparison feature and FAQ-only report are separate.

## Product Context

Primary users:

- Employees in a digital agency.
- They use the crawler to audit existing client sites and discover meaningful improvement work.
- They also use it as a sales tool for prospects by producing a credible, client-friendly report.

Business jobs-to-be-done:

1. Find what is holding a website back technically, structurally, and content-wise.
2. Turn findings into a prioritized work plan the agency can execute.
3. Explain findings to clients in plain language without exposing too much internal noise.
4. Help the agency sell improvement work: SEO, content, AI readiness, schema, technical cleanup, UX/conversion fixes, and ongoing monitoring.

Core principle:

- Internal view should be precise, practical, and action-heavy.
- Client view should be readable, polished, selective, and persuasive.

## Current Baseline

Relevant files:

- `src/jobs/site-ai-audit-crawler.ts`
- `public/site-ai-audit.html`
- `src/index.ts` mode: `site-ai-audit`
- `src/server-demo.ts` passthrough mode: `site-ai-audit`

Current capabilities:

- Crawls a site with configurable max pages and depth.
- Supports static or rendered mode.
- Checks:
  - robots.txt
  - sitemap.xml
  - llms.txt
  - page status
  - noindex / robots meta
  - title, meta description, H1, canonical, Open Graph
  - word count / thin content
  - FAQ DOM and FAQPage schema alignment
  - schema presence
  - answerability signals
  - internal and external links
- Produces:
  - score breakdown
  - issue list
  - page diagnostics
  - recommendations
  - internal/client HTML downloads
  - executive summary markdown
  - raw JSON

Current limitation:

- It now produces a first operational treatment backlog via `actionItems`.
- Client report exists, but the agency user needs stronger control over what goes into it.
- The general crawler is not yet packaged as a structured sales + improvement workflow.

## Implementation Progress

### 2026-05-08 - Phase 1 Started

Implemented in the general crawler only:

- Added `actionItems` to `SiteAiAuditResult` in `src/jobs/site-ai-audit-crawler.ts`.
- Added issue-to-action mapping:
  - priority
  - workstream
  - owner
  - effort
  - impact
  - client-visible flag
  - recommended fix
  - evidence
- Added first derived checks for duplicate `title` and duplicate `meta description`.
- Added an on-screen `לטיפול` section in `public/site-ai-audit.html`.
- Added `הורד לטיפול CSV` export.
- Internal mode shows more evidence and owner/effort/impact.
- Client mode shows a shorter, client-safe action list.

Still pending:

- Filters for priority/workstream/owner/client-visible/status.
- Per-row hide/show controls for the client report.
- Google Sheet export for the general crawler.
- More advanced checks: broken links, redirect chains, sitemap coverage, image alt, conversion paths, richer schema completeness.

### 2026-05-09 - UX Tightening For General Crawler

Implemented after reviewing a long Leonardo Hotels raw report:

- Reduced action noise by grouping repeated issues into one action item per issue type and page type.
  - Example: instead of dozens of separate `Missing H1` rows, the report can show one task for the affected page group with example URLs.
- Added `pageType` classification to crawled pages:
  - homepage
  - hotel
  - destination
  - FAQ
  - offer
  - meeting
  - brand
  - blog
  - legal
  - contact
  - technical
  - other
- Added page-type summary in the internal report so the user can see what the crawler actually mapped.
- Made the client report shorter by default:
  - client mode starts with summary, score and action items only.
  - internal mode opens the fuller working report.
  - the user can still choose which rubrics to show.
- Adjusted `Low answerability signals` so it does not fire on every thin, broken, or already-FAQ page.
- Changed recommendation wording so it does not imply “create FAQs” when FAQ content already exists; it now points to direct answers or linking to existing FAQ where relevant.

Remaining UX work:

- Add filters above the internal action table.
- Add a stronger “rendered check needed” diagnostic for JS-heavy pages that return empty/static shell content.
- Continue improving page discovery strategy so sampled pages are intentionally balanced by page type and weighted toward the most important sitemap groups.

### 2026-05-09 - Visual Report Redesign Started

Implemented for `AI Site Audit Crawler` only:

- Rebuilt the top of the report in `public/site-ai-audit.html` as a visual dashboard:
  - large 0-100 score ring
  - metric cards for pages, sitemap coverage, action items and critical findings
  - score bars for the five scoring areas
  - short insight cards that explain what matters first
- Added sitemap-aware page mapping in the UI:
  - compares sitemap URLs against crawled URLs
  - groups by page type: homepage, hotel, destination, offer, meeting, brand, FAQ, blog, contact, legal, other
  - highlights important commercial/content page groups
  - shows crawled count vs sitemap count and example URLs
- Added per-action client report controls:
  - internal action table now has a checkbox per row
  - checked rows are included in the downloadable client report and executive summary
  - unchecked rows stay in the internal report only
- Client mode now includes page mapping by default, but still lets the user remove it with the section toggles.
- Updated general crawler wording so “low answerability” and “thin content” do not automatically imply creating duplicate FAQ sections when a site already has FAQ content.

Verified:

- `npx tsc --noEmit --pretty false`
- Inline script parse check for `public/site-ai-audit.html`

Still pending for this phase:

- Visual browser QA on a real audit result after restarting the demo server.
- Add filters above the action table: priority, workstream, owner, page type and client-visible.
- Add a stronger rendered/static-shell diagnostic.
- Consider Google Sheet export for the general crawler later, but this needs a separate decision because it may touch service-level Sheets logic.

### 2026-05-09 - Internal-First Reading UX

Implemented after feedback that the report was still hard to read:

- Default report mode is now `דוח פנימי`.
- The report header now explains that the internal report is the working view and the client report is derived from it.
- The user can still switch to `דוח לקוח`, but the workflow is now internal-first.
- Reworked the report into clearer reading blocks:
  - executive/work summary
  - score section
  - schema/FAQ diagnostic section
  - grouped action backlog
  - grouped findings
  - page map
- Added accordion-style sections so long areas can be collapsed and scanned.
- Replaced the dense action table on screen with grouped action cards:
  - grouped by workstream
  - each card explains `מה הבעיה`, `מה עושים`, and examples
  - each internal task still has a checkbox controlling whether it appears in the client report
  - CSV export remains available for a tabular backlog
- Added a clearer schema diagnostic:
  - counts pages with JSON-LD
  - counts pages without JSON-LD
  - flags visible FAQ without FAQPage schema
  - flags question mismatches between DOM and schema
  - shows schema types and concrete question examples where available
- Meta/link/findings sections are now collapsed by default to reduce the wall-of-text feeling.

Verified:

- `npx tsc --noEmit --pretty false`
- Inline script parse check for `public/site-ai-audit.html`
- Playwright render smoke test with a synthetic audit result, including screenshot at `/private/tmp/site-ai-audit-redesign.png`

Next:

- Add filters for action cards.
- Plan a stronger scoring strategy per section.

### 2026-05-09 - Noise Reduction + Evidence Transparency

Implemented after feedback on the Leonardo general audit view:

- Added a visible arrow indicator to accordion summaries so users can immediately see that sections can be opened/closed.
- Reduced default visual overload:
  - only the first action group opens by default
  - meta, links, FAQ sample and technical evidence remain collapsible
  - page mapping and sample detail stay lower in the report
- Changed schema logic in the UI:
  - `עמודים בלי JSON-LD` is now presented as a mapping fact, not a problem
  - regular pages without schema are no longer added to the problem-card list
  - important pages without schema are shown separately as `הזדמנויות סכמה, לא תקלות`
- Changed crawler logic:
  - boilerplate questions such as newsletter/cookie/login/search text are filtered out of FAQ extraction
  - schema Q/A comparison now filters the same boilerplate before calculating DOM/schema gaps
  - question-like headings alone no longer force a FAQPage/schema issue
  - missing structured data is only surfaced as a low-priority internal opportunity for central entity/commercial pages
- Added internal jump links from action cards to the relevant report area:
  - schema/FAQ
  - meta
  - links
  - page map
  - grouped findings
- Turned example URLs into clickable links in the major diagnostic cards.
- Added a collapsible `מה נאסף בפועל מהאתר` coverage matrix in the technical appendix.
  - Collected today: status code, title, meta description, canonical, robots.txt, meta robots, sitemap, H1, internal/external links, JSON-LD/structured data, HTML/rendered content depending on mode.
  - Partial/missing and planned: redirect chain, H2 list as structured data, image/alt diagnostics, static-vs-rendered content delta.

Important product note:

- The general crawler currently makes **0 AI model calls**. It is deterministic crawler logic plus parsing and validation.
- A future AI layer should be optional and should run after raw evidence is collected, likely as a small number of report-level analysis calls rather than one call per page.

Verified:

- `npx tsc --noEmit --pretty false`
- Inline script parse check for `public/site-ai-audit.html`
- Local render smoke on `http://localhost:3105/site-ai-audit.html`
- Synthetic report render check for accordion arrows, anchors and action jump-link DOM output

Next:

- Add real data fields for redirect chain, H2 list, image/alt diagnostics and static-vs-rendered content delta.
- Add action-card filters.
- Define the scoring strategy per section before changing score math.

### 2026-05-09 - Visual Dashboard + One-Call AI Plan

Checkpoint saved before continuing:

- `2026-05-09T12-04-50-708Z__approved-checkpoint-after-site-ai-audit-report-ux`

Implemented in `public/site-ai-audit.html`:

- Added a richer visual analytics block near the top of the internal report:
  - donut chart for issue severity
  - colored bar chart for action items by workstream
  - colored bar chart for page-type coverage
  - stacked schema status bar
- Added a bit more color variety while keeping the report professional:
  - teal/blue for healthy and structural signals
  - amber for attention areas
  - red for critical gaps
  - violet/pink accents for AI/summary areas
- Added `העתק בריף AI` button.
- Added an internal `שכבת AI אופציונלית` panel:
  - explicitly states that the crawler currently makes 0 AI calls
  - recommends a future single GPT-5.5 call over a compact evidence pack
  - clarifies that AI should interpret and write conclusions, not replace crawler evidence
- Added `buildAiAnalysisPrompt(result)` in the page script.
  - It prepares a compact JSON evidence pack from the current audit result.
  - It asks for Hebrew JSON output with: executive summary, client narrative, internal risks, opportunities, next steps, uncertainty flags and suggested client sections.

Not implemented yet:

- No live API call was added.
- No `.env`, credentials, `src/core/agent.ts`, `src/services/sheets.ts`, `src/index.ts`, `src/server-demo.ts`, or `package.json` changes were made for this step.
- To run a real AI call later, wire the existing `AIAgent` from `src/index.ts` into the site audit job or into a separate post-processing job, with explicit approval because `src/index.ts` is protected.

Verified:

- `npx tsc --noEmit --pretty false`
- Inline script parse check for `public/site-ai-audit.html`
- Local render smoke on `http://localhost:3105/site-ai-audit.html`
- Synthetic report check confirmed visual chart DOM and AI panel DOM render.

### 2026-05-09 - Carmelon Branding + AI Analysis Prep

Implemented after the Carmelon logo feedback:

- Added `public/carmelon-logo-header-x2.png` and placed it in the top header of `public/site-ai-audit.html`.
- Updated the report palette to match the logo:
  - purple/violet as primary
  - teal for structural/site signals
  - pink for AI/insight accents
  - yellow/orange for attention and movement
- Added a visible runtime indicator while a crawl is running:
  - shows estimated remaining time
  - adapts the estimate by max pages, depth, static/rendered mode, FAQ-only mode and whether AI analysis is enabled
  - changes to completion state when the structured result arrives
- Added more visual charts to the internal report:
  - metadata/title health stacked bar
  - internal vs external link stacked bar
  - kept the existing severity donut, workstream bars, page-type coverage and schema stack
- Reduced FAQ repetition in the general Site Audit report:
  - the main section is now `סכמה ונתונים מובנים`
  - deep FAQ sample diagnostics are hidden unless the user explicitly runs `faq-only`
  - the markdown/export wording now summarizes structured data instead of listing FAQ pages repeatedly
- Removed the visible “copy AI prompt/brief” UI from the main report because it felt like planning text rather than product behavior.
- Added `src/jobs/subjobs/site-ai-audit-ai-analysis.ts`:
  - builds a compact evidence pack from the deterministic crawler result
  - makes one report-level AI call through the existing `AIAgent`
  - asks for strict Hebrew JSON, client-facing phrasing and internal risks
  - normalizes the output into `result.aiAnalysis`
- Added optional `includeAiAnalysis` and `aiModel` fields to the site audit config/result types in `src/jobs/site-ai-audit-crawler.ts`.
- The UI now renders an `AI analysis` section only when the backend returns `result.aiAnalysis`; otherwise it does not show explanatory filler.

Protected change still needed:

- To activate the real AI call from the demo UI, `src/index.ts` needs one import and a small call after `runSiteAiAuditFromPayload(payload)`.
- This was not edited yet because `src/index.ts` is protected and requires explicit separate approval.

Verified:

- `npx tsc --noEmit`
- Playwright smoke test confirmed:
  - page loads
  - Carmelon logo renders
  - AI checkbox exists
  - runtime progress starts hidden
  - synthetic report renders 6 visual cards
  - `AI analysis` section renders when `result.aiAnalysis` exists
  - deep FAQ diagnostics do not render in normal `site` mode

### 2026-05-09 - Deterministic Scoring Model

Implemented after feedback that the 0-100 score was not transparent enough:

- Replaced the old five-part 20-point score with a deterministic 100-point rubric:
  - GEO / AI Readiness: 25
  - Technical SEO: 20
  - Content + E-E-A-T: 20
  - Structured Data: 15
  - Crawler accessibility / JS rendering: 10
  - Basic Performance: 5
  - Confidence: 5
- Added score sections and subcomponents to `SiteAiReadinessScore`.
  - Each component now includes score, max score, evidence strings and an evidence level: `verified`, `heuristic`, or `missing`.
- Added real page evidence fields:
  - response time
  - HTML byte size
  - final URL / redirect detection
  - image count and missing alt count
  - lazy-loaded image count
  - script and stylesheet counts
  - viewport meta
  - H2 / heading count
  - paragraph count and quote-friendly paragraph count
  - content signals for entity clarity, dates, expertise, examples, numbers and source links
  - JSON-LD property names, not only schema types
- Added robots analysis for AI crawler access:
  - GPTBot
  - OAI-SearchBot
  - ClaudeBot
  - PerplexityBot
- Updated the report UI:
  - top score bars now use each section’s real max score instead of assuming `/20`
  - score section now includes collapsible method cards
  - every method card shows sub-scores and evidence so the user can understand how the score was calculated
- Kept the general report separate from the FAQ-specific audit.

Verified:

- `npx tsc --noEmit`

Still pending:

- Browser QA on a real crawl result after restarting/rerunning the demo page.
- Real static-vs-rendered delta still needs a dual-fetch comparison.
- Lighthouse/PageSpeed/Core Web Vitals and GSC are not connected yet, so those sub-scores correctly appear as missing evidence.

### 2026-05-09 - Report Reading Flow + Pastel Brand Polish

Implemented after reviewing the Leonardo raw result and report screenshot:

- Reordered the generated report so the reading path is clearer:
  - overview hero
  - deterministic score breakdown
  - executive summary and reading instructions
  - treatment tasks
  - visual work map
  - deeper evidence sections
  - AI conclusions section only near the bottom if backend evidence exists
- Moved score details before the written summary/recommendations, per UX feedback.
- Collapsed the detailed scoring methodology behind `איך הציון חושב בפועל` so the top of the report shows the score first and only expands the evidence if needed.
- Reworked `מבט חזותי מהיר` into `מפת עבודה חזותית`:
  - it now explains what the graphs are for
  - reduced chart count from six mixed cards to four clearer cards
  - combined schema/meta/link signals into one technical-signals card
- Softened the Carmelon palette:
  - pastel purple, teal, pink and amber
  - removed gradients from UI cards/rubrics
  - kept chart rings/stacks as functional data visualizations only
- Improved executive text:
  - less generic FAQ repetition
  - explains the weakest score area dynamically
  - connects findings to action items instead of repeating raw issue categories
- Deduplicated automatic recommendations by topic so one issue family does not dominate the first recommendations.

Verified next:

- Run TypeScript and browser smoke after this change.

### 2026-05-09 - Trust Layer + Main Report Triage

Implemented after feedback that `Missing H1` appeared on pages that visually had an H1:

- Added page-level `extractionReliability` in `src/jobs/site-ai-audit-crawler.ts`.
  - A page is marked low-confidence when it returns a successful status but the crawler receives no readable text, no headings, no links, no canonical/meta, and no JSON-LD.
  - Low-confidence pages now generate `Page content could not be verified` instead of false metadata/content/schema tasks.
  - Metadata and content scoring now use reliable pages first, so an empty shell response does not drag down H1/title/content scores as if it were a proven SEO problem.
  - Rendered mode now waits for `networkidle` before extracting HTML, reducing early DOM snapshots.
- Updated `public/site-ai-audit.html` so the default internal report is lighter:
  - default visible sections: overview, score, action backlog, schema, meta
  - default hidden detail sections: links, raw grouped findings, page map, raw recommendations, technical appendix
  - visual work map is collapsed by default
  - schema diagnostics are collapsed by default
  - action cards that point to low-confidence pages are demoted, removed from client visibility, and marked `נדרש אימות`
  - metadata diagnostics exclude low-confidence pages from `Title/H1/Description missing` counts and show them separately as `לא אומתו`

Report section ranking for the next UX pass:

1. Must stay in the main reading path:
   - Overall score + deterministic score breakdown
   - Executive summary / business meaning
   - `לטיפול` action backlog
   - Trust warnings such as low-confidence extraction
2. Important but should be compact/collapsed:
   - Schema and structured-data diagnostics
   - Metadata diagnostics
   - Visual work map
3. Useful as detail layer, off by default:
   - Link diagnostics
   - Page map / sitemap coverage
   - Raw grouped findings
   - Raw recommendations
   - Technical evidence appendix
4. Not client-facing by default:
   - Low-confidence crawler extraction warnings
   - Raw issue groups
   - Technical collection matrix
   - Full page samples

Verified:

- `npx tsc --noEmit --pretty false`
- Inline script parse check for `public/site-ai-audit.html`
- Playwright render check against `www.leonardo-hotels.com-2026-05-09-raw-result (1).json`
  - default internal checked sections: overview, score, FAQ/schema, meta, actions
  - raw issue detail section hidden by default
  - visual map collapsed by default
  - schema diagnostics collapsed by default
  - 20 low-confidence pages marked separately instead of being counted as missing title/description/H1

### 2026-05-10 - Multi-Agent Phase: UX, Page Selection, Schema Draft Actions

Checkpoint saved before continuing:

- `2026-05-10T12-23-35-020Z__approved-checkpoint-before-site-audit-multi-agent-phase`

User-approved direction:

- Split the work into parallel tracks:
  - UX/UI cleanup and modern setup/report feel.
  - Better page mapping and explanation of the page limit.
  - Turn treatment actions into an active workflow, starting with schema generation drafts.
  - Independent QA pass.

Implemented in `public/site-ai-audit.html`:

- Reworked the setup screen language:
  - `מספר עמודים מקסימלי` is now presented as `תקציב עמודים לבדיקה`.
  - The UI explains that the crawler maps many candidate URLs and then selects a balanced audit sample.
  - Static vs rendered mode is now shown as two clear cards:
    - `בדיקה מהירה`
    - `בדיקה עמוקה עם רינדור`
  - Last entered URL is remembered locally in the browser.
- Added a compact internal section: `איך נבחר מדגם העמודים`.
  - Shows page budget, candidate URL count, sitemap candidates, link-discovered candidates, and selected/crawled page types.
  - Makes the sampling logic visible before the user reads the rest of the report.
- Added `service` page type support to the frontend labels and classifier so facilities/services pages are not mixed into generic hotel/destination groups.
- Added first version of treatment action tools:
  - schema/FAQ action cards can now show `צור טיוטת סכמה`.
  - Opens an editable modal with JSON-LD draft.
  - FAQ pages produce a draft `FAQPage`; other pages produce a conservative `WebPage` draft.
  - Includes copy, download, and Rich Results Test buttons.
  - The modal clearly labels the output as a draft that must be reviewed before publishing.
- Downloaded standalone reports intentionally do not include the live schema-draft buttons.

Implemented in `src/jobs/site-ai-audit-crawler.ts`:

- `maxPages` is now treated and documented as an audit sample budget, not as a claim that the crawler should scan the entire site.
- Added `discoveryStrategy` and `pageSelectionSummary` to the structured result.
- Added balanced URL selection from sitemap and discovered links.
- Added page-type priority for sample selection:
  - homepage
  - destination
  - hotel
  - service/facilities
  - FAQ
  - offer
  - meeting
  - brand
  - contact
  - blog
  - legal
  - other/technical
- Sitemap candidate analysis can consider a much larger sitemap pool before selecting the sample.
- Discovered internal links are prioritized by page type before being added to the crawl queue.

Verified:

- `npx tsc --noEmit --pretty false`
- Inline script parse check for `public/site-ai-audit.html`
- In-app browser smoke check confirmed the updated setup labels render on `http://localhost:3000/site-ai-audit.html`.
- Playwright synthetic report check confirmed:
  - `איך נבחר מדגם העמודים` renders from `pageSelectionSummary`.
  - schema action card shows `צור טיוטת סכמה`.
  - schema draft dialog opens.
  - generated draft contains `FAQPage` and editable TODO answer placeholders.
- Final manual QA also confirmed TypeScript and page script checks still pass after tightening the schema draft edge case.

Open next steps:

- The fourth QA agent was started but did not finish within the session timeout; it was closed after manual verification passed.
- Decide whether schema generation should remain deterministic draft-only or later call an AI helper for richer draft suggestions.
- If real AI post-analysis should run from the UI, it still needs separate approval for protected `src/index.ts`.
- Continue UX cleanup: decide whether the setup sidebar should be collapsed, removed, or converted into a compact help strip.

## Track 1: Internal Treatment Report

Purpose: give the agency worker a practical backlog of what to fix and why.

### 1. Add One Main `לטיפול` View

Create a unified action table in the general audit result and UI.

Each row should include:

- Priority: `Critical`, `High`, `Medium`, `Low`
- Workstream:
  - Crawlability / indexing
  - Discovery / sitemap / robots / llms.txt
  - Metadata
  - Structured data
  - FAQ / answerability
  - Content quality
  - Internal links
  - External links / trust
  - Conversion / contact path
  - Technical rendering
- URL or `site-wide`
- Page title / H1
- Finding
- Why it matters
- Recommended fix
- Owner suggestion:
  - SEO
  - Content
  - Developer
  - Project manager
  - Client input needed
- Effort estimate:
  - Quick fix
  - Medium
  - Larger project
- Impact estimate:
  - High
  - Medium
  - Low
- Evidence / examples
- Client-visible: yes/no
- Status:
  - New
  - Approved
  - In progress
  - Done
  - Ignored

### 2. Convert Raw Issues Into Better Agency Tasks

Current issue examples are technical. Add a mapping layer from crawler issue to action item.

Examples:

- `Missing meta description`
  - Task: write a page-level meta description that summarizes the service, location, and search intent.
  - Owner: SEO / Content
  - Effort: Quick fix
  - Client-visible: optional

- `Thin readable content`
  - Task: add crawlable explanatory copy answering what the page offers, who it is for, pricing/location/service details, and common questions.
  - Owner: Content
  - Effort: Medium
  - Client-visible: yes

- `Page blocks indexing`
  - Task: remove noindex if this page should rank or be read by AI tools.
  - Owner: Developer / SEO
  - Effort: Quick fix
  - Client-visible: yes, if important page.

- `llms.txt not found`
  - Task: create a curated AI-readable map for important services, locations, FAQs, policies, and contact pages.
  - Owner: SEO / Developer
  - Effort: Medium
  - Client-visible: optional, good for AI-readiness positioning.

### 3. Improve Checks For Real Agency Use

Add more check categories over time:

- Important pages missing from sitemap.
- Sitemap contains noindex or broken pages.
- Canonical mismatch severity by page type.
- Duplicate titles and duplicate meta descriptions.
- Weak page titles that do not mention service/location/brand.
- Thin pages grouped by template or content type.
- Internal link orphan hints: pages with too few internal links.
- Important page depth: useful pages buried too deep.
- Broken links / redirect chains.
- External links grouped by domain and risk:
  - social
  - booking engines
  - maps
  - partner/trust
  - unknown
- Image alt coverage if images are available in HTML.
- Structured data types by page:
  - Organization
  - LocalBusiness
  - Hotel / LodgingBusiness
  - Product / Service
  - BreadcrumbList
  - FAQPage
  - Article / BlogPosting
- Schema validation warnings:
  - missing required fields
  - impossible types
  - duplicate schema
  - schema exists but visible content does not support it
- AI answerability:
  - direct answer blocks
  - question headings
  - comparison tables
  - policy clarity
  - pricing clarity
  - location/service coverage
- Conversion readiness:
  - contact links
  - phone/mail links
  - booking/lead form path
  - CTA presence on important pages

### 4. Internal Outputs

Recommended outputs:

- On-screen `לטיפול` table with filters:
  - priority
  - workstream
  - owner
  - client-visible
  - status
- Google Sheet export:
  - `Summary`
  - `לטיפול`
  - `Pages`
  - `Metadata`
  - `Schema`
  - `Links`
  - `Content`
  - `Raw Issues`
- HTML internal report for quick review.
- JSON for repeat analysis and later automation.

### 5. Acceptance Criteria

The internal report is good when:

- A digital agency worker can open one tab and know what to fix first.
- Every issue has a clear next action.
- Technical issues are translated into agency workstreams.
- The report separates serious blocking issues from polish.
- It is possible to mark which rows should be included in a client report.

## Track 2: Client-Facing Report

Purpose: create a clear, polished, editable report that helps sell and explain the agency's work.

### 1. Client View Controls

Add controls before export:

- Include/exclude sections:
  - Executive summary
  - Overall score
  - Key risks
  - Top opportunities
  - Examples from site
  - Recommended 30-day plan
  - Recommended 90-day plan
  - Technical appendix
- Hide/show issue categories:
  - Metadata
  - Content
  - Schema
  - FAQ
  - Links
  - AI readiness
  - Crawlability
- Hide/show individual action rows.
- Tone:
  - sales/prospect
  - existing client
  - internal-friendly but client-safe
- Detail level:
  - concise
  - standard
  - detailed

### 2. Client Report Structure

Recommended sections:

1. Cover:
   - site name
   - checked date
   - score
   - readiness label

2. Executive summary:
   - what was checked
   - what is working
   - what is holding the site back
   - the practical opportunity

3. Score cards:
   - Discoverability
   - Crawlability
   - Structured data
   - Answerability
   - Content quality
   - Links/trust

4. What This Means:
   - plain-language explanation for business owners.
   - e.g. "The site is crawlable, but AI and search tools may miss important answers because structured data and direct-answer content are incomplete."

5. Top Findings:
   - 5-8 client-safe findings.
   - Each finding should include:
     - issue
     - why it matters
     - example
     - recommended next step

6. Recommended Plan:
   - Immediate fixes: 1-2 weeks
   - Short-term improvements: 30 days
   - Growth layer: 60-90 days

7. Optional appendix:
   - page examples
   - technical notes
   - raw issue counts

### 3. Sales-Oriented Layer

For bringing new clients, add a version that frames findings as opportunities:

- "Quick wins" section.
- "Growth opportunities" section.
- "Risk if ignored" section.
- "Suggested agency package" section:
  - SEO foundations
  - AI readiness cleanup
  - FAQ/schema implementation
  - content expansion
  - monitoring/checkup

This should be optional and controlled by the user, because existing clients may need a softer tone.

### 4. Export Formats

Recommended exports:

- HTML client report.
- Google Docs or Google Sheet client report if existing Google integration is enough.
- PDF later, if layout can be controlled reliably.
- Markdown executive summary for email.

### 5. Acceptance Criteria

The client report is good when:

- It can be sent without exposing too much internal noise.
- It explains findings in plain language.
- It includes enough evidence to feel credible.
- It gives practical next steps.
- The agency worker can control what appears before sending.

## Proposed Build Order

### Phase 1: Internal Treatment Layer

1. Add `actionItems` to `SiteAiAuditResult`.
2. Build an issue-to-action mapper in `src/jobs/site-ai-audit-crawler.ts`.
3. Add internal `לטיפול` section to `public/site-ai-audit.html`.
4. Add CSV/HTML export for action items.
5. Verify on Stay Master and Leonardo-like site.

### Phase 2: Client View Controls

1. Add checkboxes/toggles for report sections.
2. Add per-category visibility controls.
3. Add "client-visible" flag derived from action items.
4. Add editable intro/summary fields in the UI.
5. Export client HTML with selected content only.

### Phase 3: Google Sheet Export

1. Add `writeGoogleSheet` support to the general crawler.
2. Create tabs:
   - `Summary`
   - `לטיפול`
   - `Client View`
   - `Pages`
   - `Meta`
   - `Schema`
   - `Links`
   - `Raw Issues`
3. Format sheet for readability.
4. Return a Google Sheet link in the UI.

### Phase 4: More Advanced Checks

1. Duplicate metadata detection.
2. Broken link checks.
3. Redirect chain checks.
4. Sitemap vs crawled pages comparison.
5. Schema type completeness checks.
6. Image alt checks.
7. Conversion path checks.
8. AI answer block scoring.

### Phase 5: Saved Projects / Comparison Over Time

1. Save raw audit JSON locally in browser storage first.
2. Add optional "load previous audit" comparison.
3. Show improved/regressed items.
4. Export progress report for existing clients.

## Important Guardrails

- Keep FAQ audit separate from general crawler.
- Do not edit the old internal crawler file unless explicitly approved.
- Do not edit `src/services/sheets.ts`; use existing methods or ask for approval if new Google methods are required.
- Do not edit `.env` or credentials.
- `src/index.ts`, `src/server-demo.ts`, and `public/index.html` require explicit approval before changes.
- Any broad project-wide change needs separate user approval.

## Next Recommended Step

### 2026-05-10 Runtime Stability Update

Implemented a stability pass after a 25-page rendered audit took a long time and looked stuck:

- Added live crawler logs in `src/jobs/site-ai-audit-crawler.ts` for preflight, robots, sitemap, page fetch start/done, scoring, and rendered browser lifecycle.
- Added fetch timeouts for static/sitemap/robots requests so slow sockets cannot hang silently.
- Reused one Playwright Chromium context per rendered audit instead of launching a new browser for every page.
- Shortened rendered waits and capped automatic accordion/FAQ clicks.
- Added AI-analysis start/completion/timeout logs in `src/jobs/subjobs/site-ai-audit-ai-analysis.ts`.
- Compact AI evidence payload and limit the AI summary stage to 90 seconds.
- Changed `public/site-ai-audit.html` so AI analysis is optional and off by default, language selection is user-friendly, static/rendered selection is visibly selected, and the setup uses one primary `הרץ בדיקה` action.

Verification completed:

- `npx tsc --noEmit --pretty false`
- Playwright UI smoke test on `http://localhost:3000/site-ai-audit.html`
- Static crawler smoke test on Leonardo with 2 pages
- Rendered crawler smoke test on Leonardo with 1 page

### Next Strategic Step

The current crawler still mixes discovery and deep audit in one flow. The preferred product flow should become:

1. **Fast mapping**: quickly collect sitemap/link candidates, classify page types, show a visual site map, and propose an audit sample.
2. **User approval**: user reviews which templates/groups enter the deep audit.
3. **Deep audit**: run deterministic checks only on the approved sample.
4. **Client view**: transform the internal findings into a cleaner selected report.

This is the right answer to "can the whole site be scanned?":

- Yes, the system can map many or all discoverable URLs from sitemap/internal links.
- It should not deeply render every URL by default.
- To prevent stuck runs, use budgets, per-request timeouts, page-type sampling, optional rendered mode, and visible progress logs.
- For very large sites, run mapping first and deep-check representative templates plus any manually selected URLs.

Start with Phase 1:

- Add `actionItems` to the general crawler result.
- Render a clear on-screen `לטיפול` section in `site-ai-audit.html`.
- Keep the existing client report as-is until the internal treatment model is stable.

This will give the agency user a reliable work list before we polish the client-facing story.
