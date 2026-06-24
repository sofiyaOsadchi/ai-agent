// src/server-demo.ts
// Code in English. Comments can be Hebrew.

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import open from "open";
import OpenAI from "openai";
import { config as loadEnv } from "dotenv";

import { AnalyticsService } from "./services/analytics.js";
import { FaqDemandService } from "./services/faq-demand.js";
import { SheetsService } from "./services/sheets.js";
import {
  isPreviewEventLine,
  parsePreviewEventLine,
} from "./jobs/subjobs/preview-events.js";
import { HOTEL_NAME_HE_MAP } from "./jobs/subjobs/hotel-name-hebrew-map.js";
import {
  getTranslateDemoDefaultLanguageNotes,
  getTranslateDemoDefaultPrompts,
} from "./jobs/translate-from-sheet-demo.js";
import { TRANSLATION_GLOSSARY } from "./jobs/subjobs/translation-glossary.js";
import { TERMINOLOGY_MANAGEMENT } from "./jobs/subjobs/terminology-management.js";
import { writeFirestoreHealthCheck } from "./firebase/firestore.js";
import { getCurrentUser, getCurrentUserFromHeaders, requireActiveCurrentUser } from "./auth/current-user.js";
import { updateUserDisplayName } from "./users/user.service.js";
import planRoutes from "./plans/plan.routes.js";
import runRoutes from "./runs/run.routes.js";
import { createRun, updateRun } from "./runs/run.service.js";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const httpServer = createServer(app);
const io = new Server(httpServer);

const publicPath = path.join(__dirname, "..", "public");

function slugifyReportPart(value: string): string {
  return String(value || "site-audit")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "site-audit";
}

function normalizeReportHtml(value: unknown): string {
  const html = String(value || "").trim();

  if (!html) {
    throw new Error("Missing report HTML.");
  }

  if (Buffer.byteLength(html, "utf8") > 20 * 1024 * 1024) {
    throw new Error("Report HTML is too large.");
  }

  if (!/<!doctype html|<html[\s>]/i.test(html)) {
    throw new Error("Report HTML must be a standalone HTML document.");
  }

  return html;
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const mod: any = await (Function("return import('playwright')")() as Promise<any>);
  const browser = await mod.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1600 },
      deviceScaleFactor: 1,
    });

    await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "16mm",
        right: "12mm",
        bottom: "16mm",
        left: "12mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

app.use(express.urlencoded({ extended: false }));

app.get("/api/me", async (req, res) => {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user,
    });
  } catch {
    res.status(500).json({ error: "Failed to resolve current user" });
  }
});

app.post("/api/me/profile", express.json({ limit: "32kb" }), async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const updatedUser = await updateUserDisplayName(user.email, req.body?.displayName);

    res.json({
      authenticated: true,
      user: updatedUser,
    });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || "Failed to update user profile" });
  }
});

app.use("/api/plans", express.json({ limit: "1mb" }), planRoutes);
app.use("/api/runs", runRoutes);

app.post(
  "/api/site-ai-audit/export-pdf",
  express.json({ limit: "25mb" }),
  async (req, res) => {
    try {
      const html = normalizeReportHtml(req.body?.html);
      const host = String(req.body?.host || req.body?.title || "site-audit");
      const filename = `${slugifyReportPart(host)}-site-ai-audit-report.pdf`;
      const pdf = await renderHtmlToPdf(html);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");
      res.send(pdf);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to export PDF." });
    }
  }
);

app.use((req, res, next) => {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
});
app.use(express.static(publicPath));
app.use(express.json());

app.get("/api/analytics/accounts", (_req, res) => {
  try {
    const accounts = new AnalyticsService().listAccounts();
    res.json({
      accounts: accounts.length
        ? accounts
        : [{ id: "default-ga4", name: "Connected GA4 account", propertyId: "" }]
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to list Analytics accounts." });
  }
});

app.get("/api/faq-demand/sources", async (_req, res) => {
  try {
    const sources = await new FaqDemandService().listSources();
    res.json(sources);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to list FAQ demand sources." });
  }
});

app.get("/api/translate-demo/defaults", (_req, res) => {
  res.json({
    prompts: getTranslateDemoDefaultPrompts(),
    languageNotes: getTranslateDemoDefaultLanguageNotes(),
    glossarySources: [
      {
        id: "original-translation-glossary",
        label: "Master glossary - translation-glossary.ts",
        glossaryByLang: TRANSLATION_GLOSSARY,
      },
    ],
    terminologySources: [
      {
        id: "original-terminology-management",
        label: "Master terminology - terminology-management.ts",
        terminologyByLang: TERMINOLOGY_MANAGEMENT,
      },
    ],
  });
});

app.get("/api/firestore-health", async (_req, res) => {
  try {
    await writeFirestoreHealthCheck();
    res.json({ ok: true });
  } catch {
    res.status(500).json({
      ok: false,
      error: "Firestore health check failed",
    });
  }
});

function buildResourceGeneratorPrompt(input: {
  mode: string;
  targetLang: string;
  sourceText: string;
  existingGlossary: unknown;
  existingTerminology: unknown;
}): string {
  const modeLabel =
    input.mode === "translated"
      ? "translated spreadsheet"
      : input.mode === "client-comments"
        ? "translated spreadsheet with client comments"
        : "raw source-language spreadsheet";

  return [
    "You are a senior hospitality localization lead.",
    "Generate practical glossary and terminology resources for a hotel/web translation workflow.",
    "The output must help translations sound human, friendly, natural, and suitable for hotel websites.",
    "",
    `Mode: ${modeLabel}`,
    `Target language code: ${input.targetLang}`,
    "",
    "How to reason:",
    "- If the input is raw source only, infer likely fixed terms, property terms, amenities, booking/payment terms, accessibility terms, and phrases that should stay consistent.",
    "- If the input is already translated, identify useful exact glossary terms and terminology rules from what works well or what sounds too translated.",
    "- If the input includes client comments, turn the comments into clear avoid/prefer terminology rules and few-shot examples.",
    "- Prefer short, reusable rules. Avoid overfitting to one sentence unless it reflects a repeated wording issue.",
    "- Do not invent property facts. Preserve brand names, emails, phone numbers, URLs, room names, and product names.",
    "- Use the existing resources as context. Add only useful new items or improved replacements.",
    "",
    "Return only valid JSON in this exact shape:",
    "{",
    "  \"title\": \"short human name for this resource set\",",
    "  \"summary\": \"one sentence\",",
    "  \"glossary\": { \"source term\": \"preferred target-language wording\" },",
    "  \"terminology\": {",
    "    \"mappings\": [",
    "      { \"forbidden\": \"bad/stiff target-language wording\", \"preferred\": \"natural target-language wording\", \"reason\": \"short reason\", \"tags\": [\"generated\"] }",
    "    ],",
    "    \"examples\": [",
    "      { \"draft\": \"stiff translated target-language sentence\", \"polish\": \"natural target-language sentence\", \"note\": \"short note\", \"tags\": [\"generated\"] }",
    "    ]",
    "  },",
    "  \"notes\": [\"short implementation note\"]",
    "}",
    "",
    "Limits:",
    "- glossary: 12-45 entries.",
    "- terminology mappings: 8-35 rules.",
    "- examples: 0-8 examples.",
    "- Do not include empty strings.",
    "",
    "Existing glossary for this language:",
    JSON.stringify(input.existingGlossary || {}, null, 2).slice(0, 12000),
    "",
    "Existing terminology for this language:",
    JSON.stringify(input.existingTerminology || {}, null, 2).slice(0, 12000),
    "",
    "Input spreadsheet/file text:",
    input.sourceText.slice(0, 65000)
  ].join("\n");
}

function sanitizeGeneratedResourceSet(parsed: any): any {
  const glossaryInput = parsed?.glossary && typeof parsed.glossary === "object" && !Array.isArray(parsed.glossary)
    ? parsed.glossary
    : {};
  const glossary: Record<string, string> = {};
  for (const [source, target] of Object.entries(glossaryInput).slice(0, 80)) {
    const sourceText = String(source || "").trim();
    const targetText = String(target || "").trim();
    if (sourceText && targetText) glossary[sourceText] = targetText;
  }

  const mappingsInput = Array.isArray(parsed?.terminology?.mappings)
    ? parsed.terminology.mappings
    : [];
  const examplesInput = Array.isArray(parsed?.terminology?.examples)
    ? parsed.terminology.examples
    : [];

  const mappings = mappingsInput.slice(0, 60).map((item: any) => ({
    forbidden: String(item?.forbidden || "").trim(),
    preferred: String(item?.preferred || "").trim(),
    reason: String(item?.reason || "").trim(),
    tags: Array.isArray(item?.tags) ? item.tags.map(String).filter(Boolean).slice(0, 6) : ["generated"]
  })).filter((item: any) => item.forbidden && item.preferred);

  const examples = examplesInput.slice(0, 20).map((item: any) => ({
    draft: String(item?.draft || "").trim(),
    polish: String(item?.polish || "").trim(),
    note: String(item?.note || "").trim(),
    tags: Array.isArray(item?.tags) ? item.tags.map(String).filter(Boolean).slice(0, 6) : ["generated"]
  })).filter((item: any) => item.draft && item.polish);

  return {
    title: String(parsed?.title || "Generated resource set").trim().slice(0, 120),
    summary: String(parsed?.summary || "").trim().slice(0, 400),
    glossary,
    terminology: { mappings, examples },
    notes: Array.isArray(parsed?.notes) ? parsed.notes.map(String).filter(Boolean).slice(0, 8) : []
  };
}

const RESOURCE_TERM_STOPWORDS = new Set([
  "Question",
  "Answer",
  "Yes",
  "No",
  "What",
  "Where",
  "When",
  "How",
  "Does",
  "Can",
  "Is",
  "Are",
  "The",
  "This",
  "Guests",
  "Guest",
  "Hotel",
  "Property",
]);

function collectLikelyResourceTerms(sourceText: string): string[] {
  const terms = new Set<string>();
  const text = String(sourceText || "");
  const knownPatterns = [
    /\bWi-?Fi\b/gi,
    /\bWhatsApp\b/gi,
    /\bPIN code\b/gi,
    /\bself-check-in\b/gi,
    /\bwasher-dryer(?:s)?\b/gi,
    /\bserviced apartments?\b/gi,
    /\bhousekeeping\b/gi,
    /\blate check-out\b/gi,
    /\bearly check-in\b/gi,
    /\bairport transfers?\b/gi,
    /\bcredit card\b/gi,
    /\bsecurity deposit\b/gi,
    /\bcongestion charge\b/gi,
    /\bUltra Low Emission Zones?\b/gi,
  ];

  for (const pattern of knownPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[0]) terms.add(match[0].trim());
    }
  }

  for (const match of text.matchAll(/\b(?:[A-Z][A-Za-z0-9'.’&-]+)(?:\s+(?:[A-Z][A-Za-z0-9'.’&-]+|St\.?|Royal|Hotel|Apartments?)){0,5}\b/g)) {
    const term = String(match[0] || "").replace(/\s+/g, " ").trim();
    if (term.length < 3 || term.length > 80) continue;
    if (RESOURCE_TERM_STOPWORDS.has(term)) continue;
    if (/^(Question|Answer|Yes|No|The|This|What|Where|When|How|Does|Can|Is|Are)\b/.test(term)) continue;
    terms.add(term);
  }

  for (const match of text.matchAll(/["“”']([^"“”'\n]{3,60})["“”']/g)) {
    const term = String(match[1] || "").replace(/\s+/g, " ").trim();
    if (term && !RESOURCE_TERM_STOPWORDS.has(term)) terms.add(term);
  }

  return Array.from(terms).slice(0, 36);
}

function extractAvoidPreferRules(sourceText: string): Array<{ forbidden: string; preferred: string; reason: string; tags: string[] }> {
  const rules: Array<{ forbidden: string; preferred: string; reason: string; tags: string[] }> = [];
  const text = String(sourceText || "");
  const patterns = [
    /(?:do not use|don't use|avoid)\s+["“”']?([^"“”'\n.;]+)["“”']?.{0,80}?(?:use|prefer|replace with)\s+["“”']?([^"“”'\n.;]+)["“”']?/gi,
    /["“”']([^"“”'\n]{2,60})["“”']\s*(?:->|=>|instead of)\s*["“”']([^"“”'\n]{2,60})["“”']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const forbidden = String(match[1] || "").trim();
      const preferred = String(match[2] || "").trim();
      if (forbidden && preferred && forbidden !== preferred) {
        rules.push({
          forbidden,
          preferred,
          reason: "Extracted from pasted feedback or wording notes.",
          tags: ["generated", "local"],
        });
      }
    }
  }

  return rules.slice(0, 20);
}

function buildLocalResourceFallback(input: { mode: string; targetLang: string; sourceText: string }): any {
  const glossary: Record<string, string> = {};
  for (const term of collectLikelyResourceTerms(input.sourceText)) {
    glossary[term] = term;
  }

  const extractedRules = extractAvoidPreferRules(input.sourceText);
  const genericRules = [
    {
      forbidden: "literal word-for-word phrasing",
      preferred: "natural guest-facing website wording",
      reason: "Keep the translation readable and native, not mechanical.",
      tags: ["generated", "local"],
    },
    {
      forbidden: "overly formal service language",
      preferred: "warm, clear hospitality wording",
      reason: "Hotel website copy should feel helpful and approachable.",
      tags: ["generated", "local"],
    },
    {
      forbidden: "translated brand, property, room, URL, email or phone wording",
      preferred: "preserve official names, product names, URLs, emails and phone numbers exactly",
      reason: "These are factual identifiers and should stay consistent.",
      tags: ["generated", "local"],
    },
  ];

  return sanitizeGeneratedResourceSet({
    title: `Local ${input.targetLang.toUpperCase()} resources`,
    summary: "Generated locally from the pasted text. Add AI generation for richer language-specific wording.",
    glossary,
    terminology: {
      mappings: [...extractedRules, ...genericRules],
      examples: [],
    },
    notes: [
      input.mode === "client-comments"
        ? "Client comments were scanned for avoid/prefer wording."
        : "Local fallback keeps likely fixed terms and adds broad naturalness rules.",
    ],
  });
}

function extractJsonCandidateText(text: string): string {
  const clean = String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) return clean.slice(start, end + 1);
  return clean;
}

async function parseResourceGeneratorJson(openai: any, rawText: string): Promise<{ parsed: any; repaired: boolean }> {
  try {
    return { parsed: extractJsonObject(rawText), repaired: false };
  } catch (firstError: any) {
    const brokenJson = extractJsonCandidateText(rawText).slice(0, 90000);
    const repairResponse: any = await openai.responses.create({
      model: "gpt-5.4-mini",
      store: false,
      instructions: [
        "You repair invalid JSON.",
        "Return only valid JSON. Do not wrap in markdown.",
        "Preserve the same semantic data where possible.",
        "The repaired JSON must use this top-level shape: title, summary, glossary, terminology, notes.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            "Repair this invalid JSON into valid JSON only.",
            `Parser error: ${firstError?.message || "unknown JSON parse error"}`,
            "",
            brokenJson,
          ].join("\n"),
        },
      ],
    } as any);

    try {
      return { parsed: extractJsonObject(repairResponse.output_text || ""), repaired: true };
    } catch (secondError: any) {
      throw new Error(`AI returned invalid JSON and automatic repair failed: ${firstError?.message || secondError?.message || "invalid JSON"}`);
    }
  }
}

app.post("/api/translate-demo/generate-resources", async (req, res) => {
  try {
    const mode = String(req.body?.mode || "raw-source");
    const targetLang = String(req.body?.targetLang || "").trim().toLowerCase();
    const sourceText = String(req.body?.sourceText || "").trim();

    if (!targetLang) {
      res.status(400).json({ error: "Missing target language." });
      return;
    }
    if (sourceText.length < 20) {
      res.status(400).json({ error: "Add or upload enough spreadsheet text to analyze." });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json({
        ...buildLocalResourceFallback({ mode, targetLang, sourceText }),
        modelUsed: "local fallback"
      });
      return;
    }

    const openai = new OpenAI({ apiKey });
    const response: any = await openai.responses.create({
      model: "gpt-5.4-mini",
      store: false,
      instructions: "Return only JSON. Do not wrap in markdown.",
      input: [
        {
          role: "user",
          content: buildResourceGeneratorPrompt({
            mode,
            targetLang,
            sourceText,
            existingGlossary: req.body?.existingGlossary || {},
            existingTerminology: req.body?.existingTerminology || {}
          })
        }
      ]
    } as any);

    const { parsed, repaired } = await parseResourceGeneratorJson(openai, response.output_text || "");
    res.json({
      ...sanitizeGeneratedResourceSet(parsed),
      modelUsed: repaired ? "gpt-5.4-mini + JSON repair" : "gpt-5.4-mini",
      jsonRepaired: repaired
    });
  } catch (error: any) {
    console.error("Translate resource generation failed:", error?.message || error);
    res.status(500).json({ error: error?.message || "Failed to generate glossary and terminology." });
  }
});

app.post("/api/translate-demo/source-text", async (req, res) => {
  try {
    const spreadsheetId = String(req.body?.spreadsheetId || "").trim();
    if (!spreadsheetId) {
      res.status(400).json({ error: "Missing spreadsheet ID." });
      return;
    }

    const sourceRange = String(req.body?.sourceRange || "A1:Z68").trim() || "A1:Z68";
    const sheets = new SheetsService();
    const sourceTab = String(req.body?.sourceTab || "").trim() || await sheets.getFirstSheetTitle(spreadsheetId);
    const values = await sheets.readValues(spreadsheetId, `${sourceTab}!${sourceRange}`);
    const text = values.map((row) => (row || []).map((cell) => String(cell || "")).join("\t")).join("\n");

    res.json({ sourceTab, sourceRange, rows: values.length, text });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to read source sheet text." });
  }
});

app.post("/api/faq-demand/analyze", async (req, res) => {
  try {
    const result = await new FaqDemandService().analyze(req.body || {});
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to analyze FAQ demand signals." });
  }
});

function chooseAssistantModel(message: string): string {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const connectorCount = (lower.match(/\b(and|then|also|after|before|וגם|ואז|אחרי|לפני)\b/g) || []).length;
  const looksComplex =
    text.length > 700 ||
    connectorCount >= 3 ||
    /architecture|orchestr|backend|index\.ts|server|api|file edit|multi[- ]step|refactor|design system|תשתית|ארכיטקטורה|בקאנד|שרת|קובץ|קבצים/.test(lower);

  return looksComplex ? "gpt-5.4" : "gpt-5.4-mini";
}

function extractJsonObject(text: string): any {
  const clean = String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Assistant response did not contain JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function assistantSystemPrompt(): string {
  return [
    "You are Carmelon AI Workspace Assistant: a natural chat assistant that understands a local AI tools workspace.",
    "Reply in the user's language. If the user writes Hebrew, reply in Hebrew. If uncertain, use English. Never switch to Arabic unless the latest user message is Arabic. Be concise, useful, and specific.",
    "Your job is to either answer generally, or prepare one or more structured tool actions from the tool registry.",
    "If activeAction is provided, continue or update that existing task unless the user clearly asks for a different workflow.",
    "Use activeAction.taskMemory for follow-ups and pronouns. Hebrew phrases like 'זה', 'שם', 'אותו', 'עכשיו' and English phrases like 'it', 'that', 'there', 'now' often refer to the last tool/source/operation/output columns.",
    "Do not create duplicate actions for the same workflow just because the user answered a follow-up question.",
    "Never invent a tool id. Use only tool ids from the registry.",
    "Protected files: .env, credentials, package.json. Do not suggest direct edits to them; say the user should handle those manually.",
    "Important routing nuance: the word 'model' alone does not mean vehicle. Choose vehicle only when the request is clearly about cars, vehicles, trims, engines, EV, hybrid, lease, or automotive models.",
    "If a user asks for a hotel or property FAQ, choose faq-playground with workflowType='hotel'.",
    "If a user provides a Google Sheet/Drive link and asks to edit, clean, format, apply notes, find missing answers, verify answers, replace unavailable answers, or research source-backed answers, choose design-formatting. Put the Sheet/Drive link in targetUrl and preserve the full user request in instruction.",
    "If the user asks to remove source links, citations, URLs, references, or 'קישורים למקורות' from answers/cells, this is cleanup, not answer research. Choose design-formatting with operationType='faq_language_review' and preserve the requested answer column, usually C.",
    "If the last remembered task is design-formatting and the user asks to move/copy/replace 'it' into a column, keep toolId='design-formatting', set values.operationType='replace_column_when_value', reuse the last Sheet/tab from taskMemory, and set source/target columns from the user text or taskMemory.lastOutputColumns.",
    "For design-formatting answer-research requests, keep words like [VERIFY], Information is currently not available, official sources, Booking, trusted sources, and replacement/overwrite instructions inside values.instruction.",
    "If the user asks where output/results/answers were saved, answer generally with actions: [] unless the browser state already has a tool action to continue.",
    "If the user asks a normal AI question that does not require a registered tool, answer directly with actions: [].",
    "If information is missing, still create a draft action when useful and list the missing fields in the reply.",
    "For faq-playground, the values.subjects field means the actual entities/pages/products to build the FAQ for, one per line. Do not put FAQ categories there. Example: if the user asks for a hotel named Bacar House, set subjects='Bacar House', workflowType='hotel'.",
    "For faq-playground, categories and prompt details are generated later inside the builder from workflowType, audience, and subjects.",
    "For faq-playground, if the user specifies exact words or phrases to avoid, put them in values.forbiddenPhrases as a newline-separated list. Do not mix exact banned phrases into questionGuidance or answerGuidance.",
    "Return only valid JSON with this shape:",
    "{",
    "  \"reply\": \"human chat response\",",
    "  \"actions\": [",
    "    { \"toolId\": \"registered-tool-id\", \"values\": { \"fieldKey\": \"value\" }, \"confidence\": 0.0, \"reason\": \"short reason\" }",
    "  ],",
    "  \"missing\": [\"field name\"],",
    "  \"complexity\": \"simple|complex\"",
    "}",
    "Use actions: [] for a pure general answer."
  ].join("\n");
}

app.post("/api/assistant-chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const tools = Array.isArray(req.body?.tools) ? req.body.tools : [];
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
  const activeAction = req.body?.activeAction || null;

  if (!message) {
    res.status(400).json({ error: "Missing message." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "OPENAI_API_KEY is not configured for the assistant endpoint." });
    return;
  }

  const model = chooseAssistantModel(message);
  const openai = new OpenAI({ apiKey });

  try {
    const response: any = await openai.responses.create({
      model,
      store: false,
      instructions: assistantSystemPrompt(),
      input: [
        {
          role: "user",
          content: JSON.stringify({
            message,
            history,
            tools,
            activeAction
          })
        }
      ]
    } as any);

    const outputText = response.output_text || "";
    const parsed = extractJsonObject(outputText);

    res.json({
      reply: String(parsed.reply || ""),
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      complexity: parsed.complexity === "complex" ? "complex" : "simple",
      modelUsed: model
    });
  } catch (error: any) {
    console.error("Assistant chat failed:", error?.message || error);
    res.status(500).json({
      error: error?.message || "Assistant chat failed.",
      modelUsed: model
    });
  }
});

function assistantPreflightSystemPrompt(): string {
  return [
    "You are a careful preflight planner for Carmelon AI tool runs.",
    "You receive a tool id, collected values, and the exact payload that is about to be sent to an existing backend job.",
    "Your task is to improve prompt quality and add missing reasoning guidance without changing the user's chosen source, destination, languages, model, run mode, write mode, or safety-sensitive fields.",
    "Write reply and warnings in the same language as the latest user message. If uncertain, use English. Never switch to Arabic unless the latest user message is Arabic.",
    "Allowed changes:",
    "- For translate-demo: improve languageNotes, glossaryByLang, terminologyByLang, and full prompt templates only if you preserve required variables such as {{rows}}, {{draftJson}}, {{sourceRows}}, {{lang}}, {{hotelName}}, {{glossaryRules}}, {{strictTerminology}}, {{languageNotes}}.",
    "- For faq-playground: improve task user/system prompts while preserving task ids, enabled flags, subjects, and any forbidden phrase rules.",
    "- For design-formatting: do not change operation, operations, selectedOperation, target columns, or dryRun. Only add assistantPreflightNotes or warnings.",
    "- For other tools: add concise instructions or warnings only.",
    "Do not change spreadsheetId, sourceFolderId, targetId, sourceUrl, targetLangs, outputCell, previewOnly, dryRun, mode, sourceType, model, operation, operations, or selectedOperation.",
    "Return only valid JSON with this shape:",
    "{",
    "  \"reply\": \"short human-readable note\",",
    "  \"warnings\": [\"short warning\"],",
    "  \"payloadPatch\": { \"safe fields only\": \"...\" },",
    "  \"valuesPatch\": { \"safe UI fields only\": \"...\" }",
    "}",
    "Use empty objects when no patch is needed."
  ].join("\n");
}

function assistantFaqValidationSystemPrompt(): string {
  return [
    "You are a fast validation router for Carmelon FAQ runs.",
    "You do not generate FAQ content and you do not run tools.",
    "Your only job is to verify that the FAQ subject, language, locale, and user goal are separated cleanly before a spreadsheet is created.",
    "The user may mix Hebrew, English, transliteration, punctuation, and instructions in one sentence.",
    "Extract the actual entity/page/product/service as normalizedSubject.",
    "Move language and locale instructions out of the subject.",
    "Also find the best official factual source URL for the normalized subject, such as the official hotel page. Prefer the brand/property website over OTAs, maps, review sites, or aggregators.",
    "If a source URL is already provided by the user, keep it unless it is clearly not relevant. Otherwise use web search to find a likely official source.",
    "If no official source can be identified with reasonable confidence, leave sourceUrlCandidate empty and set needsSourceConfirmation=true.",
    "If the requested output language is English, the normalizedSubject should normally be an English/Latin official name, not Hebrew transliteration.",
    "If the subject is transliterated, misspelled, or ambiguous, normalize it only when the intent is clear. Otherwise set needsConfirmation=true and needsCorrection=true.",
    "For hotel names, prefer the official hotel/property name. Do not silently keep a Hebrew typo as the subject when an English official name is likely.",
    "Examples:",
    "- 'מלון לאונדרו ברלין? אנגלית uk' means normalizedSubject='Leonardo Hotel Berlin', requestedLanguage='English', requestedLocale='UK'.",
    "- Do not include '? אנגלית uk', 'English UK', target language, count, style, audience, or workflow words inside normalizedSubject.",
    "Write reply, warnings, and confirmationQuestion in the same language as the latest user message.",
    "Return only valid JSON with this shape:",
    "{",
    "  \"normalizedSubject\": \"Leonardo Hotel Berlin\",",
    "  \"detectedBrandOrEntity\": \"Leonardo Hotel Berlin\",",
    "  \"requestedLanguage\": \"English\",",
    "  \"requestedLocale\": \"UK\",",
    "  \"contentGoal\": \"Build an FAQ question plan\",",
    "  \"removedInstructionFragments\": [\"אנגלית uk\"],",
    "  \"confidence\": 0.82,",
    "  \"needsConfirmation\": true,",
    "  \"needsCorrection\": false,",
    "  \"officialNameVerified\": true,",
    "  \"sourceUrlCandidate\": \"https://www.leonardo-hotels.com/berlin/leonardo-hotel-berlin\",",
    "  \"sourceTitle\": \"Leonardo Hotel Berlin official page\",",
    "  \"sourceType\": \"official\",",
    "  \"sourceConfidence\": 0.9,",
    "  \"needsSourceConfirmation\": true,",
    "  \"riskFlags\": [\"official-name-normalized\", \"subject-contained-language-instruction\"],",
    "  \"confirmationQuestion\": \"I understood the FAQ topic as Leonardo Hotel Berlin and the output language as UK English. Is that correct?\",",
    "  \"warnings\": [],",
    "  \"reply\": \"\"",
    "}",
    "Use empty strings or arrays where unknown."
  ].join("\n");
}

function normalizeFaqLookupText(value: unknown): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[׳'"`´’‘]/g, "")
    .replace(/\b(?:faq|questions?|answers?|questionnaire|builder|page)\b/gi, " ")
    .replace(/\b(?:english|hebrew|german|french|spanish|uk|gb|us|usa|language|locale)\b/gi, " ")
    .replace(/(?:אנגלית|עברית|גרמנית|צרפתית|ספרדית|שפה|בריטית|אמריקאית)/gi, " ")
    .replace(/(?:לאונדרו|ליאונדרו|ליאונרדו|ליאונרדו)/gi, "לאונרדו")
    .replace(/(?:^|\s)(?:מלון|המלון|בית מלון)(?=\s|$)/g, " ")
    .replace(/[^a-z0-9\u0590-\u05ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectFaqSubjectCandidates(values: any, payload: any, parsed: any): string[] {
  const candidates = [
    values?.subjects,
    values?.subjectRaw,
    parsed?.normalizedSubject,
    parsed?.detectedBrandOrEntity,
    parsed?.subject,
  ];
  if (Array.isArray(payload?.subjects)) candidates.push(...payload.subjects);
  if (Array.isArray(values?.subjects)) candidates.push(...values.subjects);
  return candidates
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function findKnownFaqOfficialSubject(values: any, payload: any, parsed: any): string {
  const lookupCandidates = collectFaqSubjectCandidates(values, payload, parsed)
    .map((item) => normalizeFaqLookupText(item))
    .filter(Boolean);
  if (!lookupCandidates.length) return "";

  let best: { official: string; score: number } | null = null;
  for (const [official, hebrewName] of Object.entries(HOTEL_NAME_HE_MAP)) {
    const aliases = [official, hebrewName];
    for (const alias of aliases) {
      const aliasLookup = normalizeFaqLookupText(alias);
      if (!aliasLookup) continue;
      for (const candidate of lookupCandidates) {
        let score = 0;
        if (candidate === aliasLookup) score = 100;
        else if (candidate.length >= 6 && aliasLookup.includes(candidate)) score = 80;
        else if (aliasLookup.length >= 6 && candidate.includes(aliasLookup)) score = 75;
        if (score > (best?.score || 0)) best = { official, score };
      }
    }
  }

  for (const candidate of lookupCandidates) {
    if (candidate.includes("לאונרדו") && candidate.includes("ברלין") && (!best || best.score < 70)) {
      best = { official: "Leonardo Hotel Berlin", score: 70 };
    }
  }

  return best && best.score >= 70 ? best.official : "";
}

function knownFaqOfficialSourceUrl(officialSubject: string): { url: string; title: string } | null {
  if (officialSubject === "Leonardo Hotel Berlin") {
    return {
      url: "https://www.leonardo-hotels.com/berlin/leonardo-hotel-berlin",
      title: "Leonardo Hotel Berlin official page"
    };
  }
  return null;
}

function isEnglishFaqLanguageValue(language: unknown, locale: unknown): boolean {
  const lang = String(language || "").trim();
  const region = String(locale || "").trim();
  return /^english(?:\b|\s|\()/i.test(lang) || /^en(?:[-_][a-z]+)?$/i.test(lang) || /^(uk|gb|us|usa|en-gb|en-us)$/i.test(region);
}

function enhanceFaqValidation(parsed: any, values: any, payload: any): any {
  const next = { ...(parsed || {}) };
  const riskFlags = new Set(Array.isArray(next.riskFlags) ? next.riskFlags.map(String).filter(Boolean) : []);
  const officialSubject = findKnownFaqOfficialSubject(values, payload, next);
  if (officialSubject) {
    if (String(next.normalizedSubject || "").trim() !== officialSubject) {
      riskFlags.add("official-name-normalized");
      next.normalizedSubject = officialSubject;
      next.detectedBrandOrEntity = officialSubject;
      next.needsConfirmation = true;
    }
    next.officialNameVerified = true;
    next.confidence = Math.max(Number(next.confidence) || 0, 0.92);
    const knownSource = knownFaqOfficialSourceUrl(officialSubject);
    if (knownSource && !next.sourceUrlCandidate && !next.officialSourceUrl) {
      riskFlags.add("official-source-found");
      next.sourceUrlCandidate = knownSource.url;
      next.sourceTitle = knownSource.title;
      next.sourceType = "official";
      next.sourceConfidence = Math.max(Number(next.sourceConfidence) || 0, 0.9);
      next.needsSourceConfirmation = true;
      next.needsConfirmation = true;
    }
  }

  const subjectText = collectFaqSubjectCandidates(values, payload, next).join(" ");
  if (/(?:אנגלית|עברית|גרמנית|צרפתית|ספרדית|english|hebrew|german|french|spanish|\buk\b|\bus\b|language|locale)/i.test(subjectText)) {
    riskFlags.add("subject-contained-language-instruction");
    next.needsConfirmation = true;
  }

  const normalizedSubject = String(next.normalizedSubject || "").trim();
  if (isEnglishFaqLanguageValue(next.requestedLanguage || values?.language, next.requestedLocale || next.locale) && /[\u0590-\u05ff]/.test(normalizedSubject) && !next.officialNameVerified) {
    riskFlags.add("english-output-subject-not-normalized");
    next.needsCorrection = true;
    next.needsConfirmation = true;
    next.confidence = Math.min(Number(next.confidence) || 0.6, 0.6);
  }

  next.riskFlags = Array.from(riskFlags);
  return next;
}

function sanitizeFaqValidation(parsed: any): any {
  const confidence = Number(parsed?.confidence);
  return {
    normalizedSubject: String(parsed?.normalizedSubject || parsed?.subject || "").trim().slice(0, 180),
    detectedBrandOrEntity: String(parsed?.detectedBrandOrEntity || "").trim().slice(0, 180),
    requestedLanguage: String(parsed?.requestedLanguage || parsed?.language || "").trim().slice(0, 80),
    requestedLocale: String(parsed?.requestedLocale || parsed?.locale || "").trim().slice(0, 40),
    contentGoal: String(parsed?.contentGoal || "").trim().slice(0, 180),
    removedInstructionFragments: Array.isArray(parsed?.removedInstructionFragments)
      ? parsed.removedInstructionFragments.map((item: any) => String(item || "").trim()).filter(Boolean).slice(0, 10)
      : [],
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    needsConfirmation: parsed?.needsConfirmation === true,
    needsCorrection: parsed?.needsCorrection === true || parsed?.needsUserCorrection === true,
    officialNameVerified: parsed?.officialNameVerified === true,
    sourceUrlCandidate: String(parsed?.sourceUrlCandidate || parsed?.officialSourceUrl || parsed?.sourceUrl || "").trim().slice(0, 500),
    sourceTitle: String(parsed?.sourceTitle || parsed?.officialSourceTitle || "").trim().slice(0, 180),
    sourceType: String(parsed?.sourceType || "").trim().slice(0, 60),
    sourceConfidence: Number.isFinite(Number(parsed?.sourceConfidence))
      ? Math.max(0, Math.min(1, Number(parsed.sourceConfidence)))
      : 0,
    needsSourceConfirmation: parsed?.needsSourceConfirmation === true || parsed?.sourceNeedsConfirmation === true,
    riskFlags: Array.isArray(parsed?.riskFlags)
      ? parsed.riskFlags.map((item: any) => String(item || "").trim()).filter(Boolean).slice(0, 12)
      : [],
    confirmationQuestion: String(parsed?.confirmationQuestion || "").trim().slice(0, 240),
  };
}

function sanitizeAssistantPreflightPatch(toolId: string, payloadPatch: any, valuesPatch: any): { payloadPatch: any; valuesPatch: any } {
  const cleanPayloadPatch =
    payloadPatch && typeof payloadPatch === "object" && !Array.isArray(payloadPatch)
      ? { ...payloadPatch }
      : {};
  const cleanValuesPatch =
    valuesPatch && typeof valuesPatch === "object" && !Array.isArray(valuesPatch)
      ? { ...valuesPatch }
      : {};

  const lockedPayloadKeys = [
    "mode",
    "sourceType",
    "sourceUrl",
    "spreadsheetId",
    "sourceFolderId",
    "folderId",
    "targetId",
    "targetUrl",
    "targetLangs",
    "languages",
    "outputCell",
    "previewOnly",
    "dryRun",
    "model",
    "operation",
    "operations",
    "selectedOperation",
  ];

  for (const key of lockedPayloadKeys) {
    delete cleanPayloadPatch[key];
  }

  if (toolId === "design-formatting") {
    for (const key of [
      "operation",
      "operations",
      "selectedOperation",
      "targetCol",
      "targetColumn",
      "outputColumn",
      "answerCol",
      "questionCol",
      "dryRun",
    ]) {
      delete cleanValuesPatch[key];
    }
  }

  return { payloadPatch: cleanPayloadPatch, valuesPatch: cleanValuesPatch };
}

app.post("/api/assistant-preflight", async (req, res) => {
  const phase = String(req.body?.phase || "").trim();
  const toolId = String(req.body?.toolId || "").trim();
  const payload = req.body?.payload || {};
  const values = req.body?.values || {};
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-10) : [];

  if (!toolId || !payload || typeof payload !== "object") {
    res.status(400).json({ error: "Missing toolId or payload." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "OPENAI_API_KEY is not configured for assistant preflight." });
    return;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const responseRequest: any = {
      model: "gpt-5.4-mini",
      store: false,
      instructions: phase === "faq-subject-validation" ? assistantFaqValidationSystemPrompt() : assistantPreflightSystemPrompt(),
      input: [
        {
          role: "user",
          content: JSON.stringify({
            toolId,
            values,
            payload,
            messages
          })
        }
      ]
    };

    if (phase === "faq-subject-validation") {
      responseRequest.tools = [{ type: "web_search" }];
      responseRequest.tool_choice = "auto";
    }

    const response: any = await openai.responses.create(responseRequest);

    const parsed = extractJsonObject(response.output_text || "");
    if (phase === "faq-subject-validation") {
      const enhancedFaqValidation = enhanceFaqValidation(parsed, values, payload);
      res.json({
        reply: String(enhancedFaqValidation.reply || ""),
        warnings: Array.isArray(enhancedFaqValidation.warnings) ? enhancedFaqValidation.warnings.map(String) : [],
        faqValidation: sanitizeFaqValidation(enhancedFaqValidation),
        modelUsed: "gpt-5.4-mini"
      });
      return;
    }

    const sanitized = sanitizeAssistantPreflightPatch(toolId, parsed.payloadPatch, parsed.valuesPatch);
    res.json({
      reply: String(parsed.reply || ""),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      payloadPatch: sanitized.payloadPatch,
      valuesPatch: sanitized.valuesPatch,
      modelUsed: "gpt-5.4-mini"
    });
  } catch (error: any) {
    console.error("Assistant preflight failed:", error?.message || error);
    res.status(500).json({
      error: error?.message || "Assistant preflight failed.",
      modelUsed: "gpt-5.4-mini"
    });
  }
});

function normalizeMode(config: any): string {
  return String(config?.mode || "").trim() || "faq";
}

function buildPayloadData(mode: string, config: any): any {
  // These modes are controlled from the UI and need the full payload.
  if (
    mode === "translate-demo" ||
    mode === "design-formatting" ||
    mode === "sheet-utilities" ||
    mode === "ai-editing" ||
    mode === "client-reports" ||
    mode === "client-reports-edit" ||
    mode === "meta-tags" ||
    mode === "schema-builder" ||
    mode === "site-ai-audit" ||
    mode === "site-ai-discovery" ||
    mode === "site-ai-faq-audit"
  ) {
    return config;
  }

  // FAQ playground has a special newer structure.
  if (mode === "faq-playground" && Array.isArray(config?.tasks)) {
    return {
      subjects: config.subjects,
      tasks: config.tasks,
      faqDemand: config.faqDemand,
    };
  }

  // Legacy fallback.
  return {
    hotels: config.hotels,
    prompts: config.prompts,
    steps: config.steps,
  };
}

function buildDynamicEnv(mode: string, config: any, payloadData: any): Record<string, string> {
  const dynamicEnv: Record<string, string> = {
    ...process.env,
    MODE: mode,
    DYNAMIC_PAYLOAD: JSON.stringify(payloadData),
  };

  if (mode === "client-reports") {
    dynamicEnv.DYNAMIC_TARGET_ID = config?.spreadsheetId || "";
    dynamicEnv.DYNAMIC_INPUT_TYPE = config?.sourceType || "sheet";
    dynamicEnv.DYNAMIC_LANGS = "";
    return dynamicEnv;
  }

  if (mode === "client-reports-edit") {
    // Edit job לא צריך גישה ל-Sheet, רק AI agent.
    dynamicEnv.DYNAMIC_TARGET_ID = "";
    dynamicEnv.DYNAMIC_INPUT_TYPE = "none";
    dynamicEnv.DYNAMIC_LANGS = "";
    return dynamicEnv;
  }

  if (mode === "meta-tags") {
    dynamicEnv.DYNAMIC_TARGET_ID = config?.spreadsheetId || config?.folderId || "";
    dynamicEnv.DYNAMIC_INPUT_TYPE = config?.sourceType || "manual";
    dynamicEnv.DYNAMIC_LANGS = config?.language || "";
    return dynamicEnv;
  }

if (mode === "translate-demo") {
  dynamicEnv.DYNAMIC_TARGET_ID =
    config?.spreadsheetId || config?.sourceFolderId || "";

  dynamicEnv.DYNAMIC_INPUT_TYPE =
    config?.sourceType || "sheet";

  dynamicEnv.DYNAMIC_LANGS = Array.isArray(config?.targetLangs)
    ? config.targetLangs.join(",")
    : "";

  return dynamicEnv;
}

  if (mode === "design-formatting") {
    dynamicEnv.DYNAMIC_TARGET_ID = config?.targetId || "";
    dynamicEnv.DYNAMIC_INPUT_TYPE = config?.sourceType || "sheet";
    dynamicEnv.DYNAMIC_LANGS = "";
    return dynamicEnv;
  }

  dynamicEnv.DYNAMIC_TARGET_ID = config?.targetId || "";
  dynamicEnv.DYNAMIC_INPUT_TYPE = config?.inputType || config?.sourceType || "sheet";
  dynamicEnv.DYNAMIC_LANGS = config?.langs || "";

  return dynamicEnv;
}

type OutputLinks = {
  sheets: string[];
  driveFolders: string[];
  docs: string[];
  googleUrls: string[];
};

function createEmptyOutputLinks(): OutputLinks {
  return {
    sheets: [],
    driveFolders: [],
    docs: [],
    googleUrls: [],
  };
}

function addUniqueLink(links: string[], url: string): void {
  if (!links.includes(url)) {
    links.push(url);
  }
}

function normalizeDetectedUrl(value: string): string {
  return value.replace(/[),.;\]}]+$/g, "");
}

function collectOutputLinksFromText(text: string, outputLinks: OutputLinks): void {
  const matches = text.match(/https?:\/\/[^\s"'<>]+/g) || [];

  for (const match of matches) {
    const url = normalizeDetectedUrl(match);

    try {
      const parsedUrl = new URL(url);

      if (!parsedUrl.hostname.endsWith("google.com")) {
        continue;
      }

      if (parsedUrl.hostname === "docs.google.com" && parsedUrl.pathname.startsWith("/spreadsheets/d/")) {
        addUniqueLink(outputLinks.sheets, url);
      } else if (parsedUrl.hostname === "drive.google.com" && parsedUrl.pathname.startsWith("/drive/folders/")) {
        addUniqueLink(outputLinks.driveFolders, url);
      } else if (parsedUrl.hostname === "docs.google.com" && parsedUrl.pathname.startsWith("/document/d/")) {
        addUniqueLink(outputLinks.docs, url);
      } else {
        addUniqueLink(outputLinks.googleUrls, url);
      }
    } catch {
      // Ignore malformed URLs in process output.
    }
  }
}

function getPlanIdFromConfig(config: any): string | undefined {
  const planId = String(config?.planId || "").trim();
  return planId || undefined;
}

function createStreamHandler(socket: any) {
  let buffer = "";

  return function handleStreamData(data: Buffer | string) {
    buffer += data.toString();

    const lines = buffer.split(/\r?\n/);

    // Keep last partial line in buffer until the next chunk.
    buffer = lines.pop() || "";

    for (const line of lines) {
      const cleanLine = line.trimEnd();

      if (!cleanLine.trim()) {
        continue;
      }

      if (isPreviewEventLine(cleanLine)) {
        const event = parsePreviewEventLine(cleanLine);

        if (event) {
          socket.emit("preview-event", event);
        }

        // חשוב: לא שולחים את ה-JSON הענק לטרמינל.
        continue;
      }

      socket.emit("log", cleanLine);
    }
  };
}

function flushStreamBuffer(socket: any, handlerBufferGetter: () => string) {
  const remaining = handlerBufferGetter().trim();

  if (!remaining) {
    return;
  }

  if (isPreviewEventLine(remaining)) {
    const event = parsePreviewEventLine(remaining);

    if (event) {
      socket.emit("preview-event", event);
    }

    return;
  }

  socket.emit("log", remaining);
}

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("start-agent", async (config) => {
    let user;

    try {
      user = await getCurrentUserFromHeaders(socket.handshake.headers);
    } catch {
      socket.emit("log", "Unauthorized");
      socket.emit("done");
      return;
    }

    if (!user) {
      socket.emit("log", "Unauthorized");
      socket.emit("done");
      return;
    }

    if (user.status === "blocked") {
      socket.emit("log", "User blocked");
      socket.emit("done");
      return;
    }

    const mode = normalizeMode(config);

    console.log(`🔹 WEB COMMAND: ${mode}`);

    let run;

    try {
      run = await createRun({
        userEmail: user.email,
        mode,
        planId: getPlanIdFromConfig(config),
        configSnapshot: config ?? {},
      });
    } catch {
      socket.emit("log", "Could not create run history item");
      socket.emit("done");
      return;
    }

    const payloadData = buildPayloadData(mode, config);
    const dynamicEnv = buildDynamicEnv(mode, config, payloadData);
    dynamicEnv.RUN_ID = run.id;
    dynamicEnv.USER_EMAIL = user.email;
    const outputLinks = createEmptyOutputLinks();
    let runFinalized = false;
    let doneEmitted = false;

    const emitDoneOnce = () => {
      if (!doneEmitted) {
        doneEmitted = true;
        socket.emit("done");
      }
    };

    const finalizeRun = async (status: "completed" | "failed", errorMessage?: string) => {
      if (runFinalized) {
        return;
      }

      runFinalized = true;

      try {
        await updateRun(run.id, {
          status,
          finishedAt: true,
          outputLinks,
          ...(errorMessage ? { errorMessage } : {}),
        });
      } catch {
        socket.emit("log", "Could not update run history item");
      }
    };

    const child = spawn("npx", ["tsx", "src/index.ts"], {
      env: dynamicEnv as any,
      shell: true,
      cwd: process.cwd(),
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";

    const handleStdout = (data: Buffer | string) => {
      stdoutBuffer += data.toString();

      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trimEnd();

        if (!cleanLine.trim()) {
          continue;
        }

        collectOutputLinksFromText(cleanLine, outputLinks);

        if (isPreviewEventLine(cleanLine)) {
          const event = parsePreviewEventLine(cleanLine);

          if (event) {
            socket.emit("preview-event", event);
          }

          continue;
        }

        socket.emit("log", cleanLine);
      }
    };

    const handleStderr = (data: Buffer | string) => {
      stderrBuffer += data.toString();

      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trimEnd();

        if (!cleanLine.trim()) {
          continue;
        }

        collectOutputLinksFromText(cleanLine, outputLinks);

        if (isPreviewEventLine(cleanLine)) {
          const event = parsePreviewEventLine(cleanLine);

          if (event) {
            socket.emit("preview-event", event);
          }

          continue;
        }

        socket.emit("log", cleanLine);
      }
    };

    child.stdout.on("data", handleStdout);
    child.stderr.on("data", handleStderr);

    child.on("close", async (code) => {
      const remainingStdout = stdoutBuffer.trim();
      const remainingStderr = stderrBuffer.trim();

      if (remainingStdout) {
        collectOutputLinksFromText(remainingStdout, outputLinks);

        if (isPreviewEventLine(remainingStdout)) {
          const event = parsePreviewEventLine(remainingStdout);
          if (event) socket.emit("preview-event", event);
        } else {
          socket.emit("log", remainingStdout);
        }
      }

      if (remainingStderr) {
        collectOutputLinksFromText(remainingStderr, outputLinks);

        if (isPreviewEventLine(remainingStderr)) {
          const event = parsePreviewEventLine(remainingStderr);
          if (event) socket.emit("preview-event", event);
        } else {
          socket.emit("log", remainingStderr);
        }
      }

      if (code === 0) {
        await finalizeRun("completed");
      } else {
        await finalizeRun("failed", `Process exited with code ${code ?? "unknown"}`);
      }

      emitDoneOnce();
      console.log(`Process finished with code ${code}`);
    });

    child.on("error", async (error) => {
      await finalizeRun("failed", "Failed to start process");
      socket.emit("log", `❌ Failed to start process: ${error.message}`);
      emitDoneOnce();
    });
  });
});

const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, async () => {
  const baseUrl = `http://localhost:${PORT}`;
  const defaultUrl = `${baseUrl}/index.html`;

  console.log("🚀 Demo server is running");
  console.log(`Main Hub:           ${defaultUrl}`);
  console.log(`FAQ Playground:     ${baseUrl}/faq-playground.html`);
  console.log(`FAQ Builder Plan:   ${baseUrl}/faq-builder-plan.html`);
  console.log(`Design Formatting:  ${baseUrl}/design-formatting.html`);
  console.log(`Translate Demo:     ${baseUrl}/translate-demo.html`);
  console.log(`Sheet Utilities:    ${baseUrl}/sheet-utilities.html`);
  console.log(`Client Reports:     ${baseUrl}/client-reports.html`);
  console.log(`Client Reports Edit:${baseUrl}/client-reports-edit.html`);
  console.log(`Site AI Audit V2:   ${baseUrl}/site-ai-audit-v2.html`);
  console.log(`Site AI Discovery:   ${baseUrl}/site-ai-discovery.html`);
  console.log(`Site AI FAQ Audit:  ${baseUrl}/site-ai-faq-audit.html`);

  if (process.env.NODE_ENV !== "production") {
    try {
      await open(defaultUrl);
    } catch {
      // Browser auto-open failed. Server is still running.
    }
  }
});
