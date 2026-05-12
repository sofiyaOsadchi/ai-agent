# Site AI Audit Crawler

This is the new experimental crawler path. It does not replace the existing Leonardo FAQ audit.

## Files

- `src/jobs/site-ai-audit-crawler.ts`
- `public/site-ai-audit.html`

Protected files intentionally not touched:

- `src/jobs/faq-audit-from-web.ts`
- `src/jobs/faq-audit-structure-from-web.ts`
- `src/index.ts`
- `src/core/agent.ts`
- `src/services/sheets.ts`
- `package.json`
- `.env` and credentials

## Current Status

The new crawler is a standalone logic file and is also wired as `MODE=site-ai-audit`.

It can be run directly:

```bash
npx tsx src/jobs/site-ai-audit-crawler.ts --url 'https://example.com' --max-pages 25 --max-depth 2
```

FAQ-focused run:

```bash
npx tsx src/jobs/site-ai-audit-crawler.ts --url 'https://example.com' --max-pages 25 --max-depth 3 --faq-only
```

For JavaScript-rendered sites:

```bash
npx tsx src/jobs/site-ai-audit-crawler.ts --url 'https://example.com' --max-pages 25 --max-depth 2 --render
```

The HTML page can send the audit config through the demo server using Socket.IO.

Wired pieces:

- `src/index.ts`: imports `runSiteAiAuditFromPayload` and handles `MODE === "site-ai-audit"`.
- `src/server-demo.ts`: passes the full payload for `site-ai-audit`.
- `public/site-ai-audit.html`: has a run button, streams logs, parses the structured JSON result markers, builds a client-facing report and exposes downloads for the client report, executive summary and raw JSON.
- The UI supports two scopes: full site sample and FAQ-only sample. FAQ-only crawls additional candidates behind the scenes but returns only pages with visible FAQ, FAQPage schema or clear FAQ page signals.

## What It Checks

Global:

- `robots.txt`
- `sitemap.xml`
- `llms.txt`
- crawl result count

Per page:

- HTTP status
- title
- meta description
- H1
- canonical URL
- robots meta / `noindex`
- readable word count
- internal links
- JSON-LD types
- FAQPage schema Q/A count
- visible DOM Q/A count
- schema-only questions
- DOM-only questions
- question/answerability signals
- FAQ candidate flag
- visible FAQ questions
- FAQPage schema questions
- meta diagnostics: title length, description length, H1 count, canonical, Open Graph, Twitter card
- link diagnostics: internal count, external count, outbound domains, mailto/tel counts

## Score Model

The result includes a 0-100 `score`:

- `discoverability`: 20 points
- `crawlability`: 20 points
- `structuredData`: 20 points
- `answerability`: 20 points
- `contentQuality`: 20 points

The score is deterministic for now. AI review can be layered later on top of the collected evidence.

## Tool Research Notes

Current recommendation:

- Keep the first version on existing stack: `fetch`, `cheerio`, optional `playwright`.
- This avoids new dependencies, new API keys, package changes, and lock-in.

Future candidates:

- Crawlee: strong next step for queue management, retries, concurrency and switching between static and rendered crawlers.
- Firecrawl: strong candidate for hosted AI-ready scraping, markdown extraction, crawl/map endpoints and agent-style web data gathering, but requires API dependency and key management.
- Keep Playwright for high-control rendering and UI interaction, especially for FAQ accordions and tabs.

## Current Wiring Notes

The browser UI now runs through the existing `start-agent` Socket.IO flow. If `server-demo.ts` was already running before these changes, restart the demo server so the in-memory server process includes the new `site-ai-audit` payload handling.

The current result is browser-based. The UI keeps the parsed result in memory after a run and can download:

- Client report as standalone HTML.
- Internal report as standalone HTML.
- Executive summary as Markdown.
- Raw crawler result as JSON.

It does not write to Google Sheets or a database yet.

## Client Report Layer

The current report structure:

1. Executive summary
2. AI readiness score
3. Crawling and indexability findings
4. Structured data / FAQ schema findings
5. Answerability and content gaps
6. Detailed FAQ and schema diagnostics
7. Meta tag diagnostics
8. Link and external-domain diagnostics
9. Priority fixes
10. Practical implementation checklist
11. Evidence appendix with page URLs and extracted issues

The report panel has two modes:

- Client view: cleaner language, hides the technical appendix by default.
- Internal view: turns on technical evidence and keeps deeper details for task planning.

The report panel also has section toggles, so the user can decide what stays in the downloadable client report and what should be removed.

Important limitation: if the browser page is refreshed after a run, the in-memory report result is lost. For persistent saved audits, add local file storage or a small server-side report archive later, with a separate approval because that affects the broader project flow.
