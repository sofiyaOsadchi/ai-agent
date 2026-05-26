// src/server-demo.ts
// Code in English. Comments can be Hebrew.

import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import open from "open";
import OpenAI from "openai";
import { config as loadEnv } from "dotenv";
import crypto from "crypto";

import { AnalyticsService } from "./services/analytics.js";
import { FaqDemandService } from "./services/faq-demand.js";
import {
  isPreviewEventLine,
  parsePreviewEventLine,
} from "./jobs/subjobs/preview-events.js";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const httpServer = createServer(app);
const io = new Server(httpServer);

const publicPath = path.join(__dirname, "..", "public");

const AUTH_COOKIE_NAME = "carmelon_workspace_auth";
const AUTH_TTL_MS = resolveAuthTtlMs(process.env.APP_AUTH_TTL_HOURS);
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const APP_AUTH_SECRET = process.env.APP_AUTH_SECRET || APP_PASSWORD;
const IS_DEPLOYED_RUNTIME = Boolean(process.env.K_SERVICE || process.env.K_REVISION || process.env.K_CONFIGURATION);
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

if ((process.env.NODE_ENV === "production" || IS_DEPLOYED_RUNTIME) && !APP_PASSWORD) {
  throw new Error("APP_PASSWORD must be configured before starting the production workspace server.");
}

function resolveAuthTtlMs(rawValue?: string): number {
  const hours = Number(rawValue);

  if (Number.isFinite(hours) && hours > 0) {
    return Math.min(hours, 168) * 60 * 60 * 1000;
  }

  return 12 * 60 * 60 * 1000;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };

    return replacements[char] || char;
  });
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function passwordMatches(candidate: string): boolean {
  return Boolean(APP_PASSWORD) && safeCompare(candidate, APP_PASSWORD);
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const part of String(cookieHeader || "").split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
}

function parseCookieValues(cookieHeader: string | undefined, cookieName: string): string[] {
  const values: string[] = [];

  for (const part of String(cookieHeader || "").split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();

    if (key !== cookieName) {
      continue;
    }

    const value = part.slice(separatorIndex + 1).trim();

    try {
      values.push(decodeURIComponent(value));
    } catch {
      values.push(value);
    }
  }

  return values;
}

function signAuthPayload(payload: string): string {
  return crypto.createHmac("sha256", APP_AUTH_SECRET).update(payload).digest("base64url");
}

function createAuthToken(): string {
  const payload = ["v1", Date.now().toString(36), crypto.randomBytes(16).toString("hex")].join(".");
  return `${payload}.${signAuthPayload(payload)}`;
}

function verifyAuthToken(token?: string): boolean {
  if (!APP_PASSWORD || !APP_AUTH_SECRET || !token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 4 || parts[0] !== "v1") {
    return false;
  }

  const payload = parts.slice(0, 3).join(".");
  const signature = parts[3];

  if (!safeCompare(signature, signAuthPayload(payload))) {
    return false;
  }

  const issuedAt = Number.parseInt(parts[1], 36);

  if (!Number.isFinite(issuedAt)) {
    return false;
  }

  const ageMs = Date.now() - issuedAt;
  return ageMs >= 0 && ageMs <= AUTH_TTL_MS;
}

function requestHasBasicAuth(req: IncomingMessage): boolean {
  const header = req.headers.authorization || "";

  if (!header.toLowerCase().startsWith("basic ")) {
    return false;
  }

  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : decoded;

    return passwordMatches(password);
  } catch {
    return false;
  }
}

type AuthState = "ok" | "missing-config" | "unauthorized";

function getRequestAuthState(req: IncomingMessage): AuthState {
  if (!APP_PASSWORD) {
    return (process.env.NODE_ENV === "production" || IS_DEPLOYED_RUNTIME) ? "missing-config" : "ok";
  }

  const authTokens = parseCookieValues(req.headers.cookie, AUTH_COOKIE_NAME);

  if (authTokens.some((token) => verifyAuthToken(token)) || requestHasBasicAuth(req)) {
    return "ok";
  }

  return "unauthorized";
}

function isSecureRequest(req: Request): boolean {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

function serializeAuthCookie(token: string, req: Request): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${Math.floor(AUTH_TTL_MS / 1000)}`,
    "SameSite=Strict",
  ];

  if (isSecureRequest(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function serializeClearAuthCookie(req: Request): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "SameSite=Strict",
  ];

  if (isSecureRequest(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function getSafeNext(rawValue: unknown): string {
  const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const next = String(raw || "/index.html");

  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return "/index.html";
  }

  return next;
}

function getClientKey(req: Request): string {
  return req.ip || String(req.socket.remoteAddress || "unknown");
}

function isLoginRateLimited(req: Request): boolean {
  const now = Date.now();
  const key = getClientKey(req);
  const entry = loginAttempts.get(key);

  if (!entry || entry.resetAt <= now) {
    return false;
  }

  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(req: Request): void {
  const now = Date.now();
  const key = getClientKey(req);
  const entry = loginAttempts.get(key);

  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_ATTEMPT_WINDOW_MS });
    return;
  }

  entry.count += 1;
}

function clearFailedLogins(req: Request): void {
  loginAttempts.delete(getClientKey(req));
}

function wantsHtml(req: Request): boolean {
  if (req.method !== "GET" || req.path.startsWith("/api/")) {
    return false;
  }

  return Boolean(req.accepts("html"));
}

function renderLoginPage(options: {
  next: string;
  error?: string;
  missingConfig?: boolean;
}): string {
  const title = options.missingConfig ? "Authentication is not configured" : "Carmelon AI Workspace";
  const message = options.missingConfig
    ? "APP_PASSWORD must be configured on the server before this workspace can be used."
    : "Enter the workspace password to continue.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | Carmelon AI Workspace</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7fb; color: #111827; }
    main { width: min(420px, calc(100vw - 32px)); padding: 28px; border: 1px solid #d8dee8; border-radius: 8px; background: #fff; box-shadow: 0 24px 60px rgba(15, 23, 42, .12); }
    h1 { margin: 0 0 10px; font-size: 24px; line-height: 1.2; letter-spacing: 0; }
    p { margin: 0 0 18px; color: #526071; line-height: 1.5; }
    label { display: grid; gap: 8px; font-size: 13px; font-weight: 800; color: #293241; }
    input { width: 100%; min-height: 44px; border: 1px solid #bac4d3; border-radius: 6px; padding: 10px 12px; font: inherit; }
    input:focus { outline: 3px solid rgba(37, 99, 235, .18); border-color: #2563eb; }
    .show-password { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; font-weight: 800; color: #526071; }
    .show-password input { width: 16px; min-height: 16px; margin: 0; }
    button { width: 100%; min-height: 44px; margin-top: 16px; border: 0; border-radius: 6px; background: #111827; color: #fff; font: inherit; font-weight: 900; cursor: pointer; }
    .error { margin: 0 0 14px; padding: 10px 12px; border: 1px solid #fecaca; border-radius: 6px; background: #fef2f2; color: #991b1b; font-size: 13px; font-weight: 800; }
    code { padding: 2px 5px; border-radius: 4px; background: #eef2f7; color: #111827; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${options.error ? `<div class="error">${escapeHtml(options.error)}</div>` : ""}
    ${options.missingConfig ? `<p>Set <code>APP_PASSWORD</code> as a Google Cloud environment variable or Secret Manager value, then restart the service.</p>` : `<form method="post" action="/login" autocomplete="off">
      <input type="hidden" name="next" value="${escapeHtml(options.next)}" />
      <label>
        Password
        <input name="password" id="passwordInput" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" autofocus required />
      </label>
      <label class="show-password"><input type="checkbox" id="showPassword" /> Show password</label>
      <button type="submit">Continue</button>
    </form>`}
  </main>
  <script>
    const passwordInput = document.getElementById("passwordInput");
    document.getElementById("showPassword")?.addEventListener("change", (event) => {
      passwordInput.type = event.target.checked ? "text" : "password";
      passwordInput.focus();
    });
  </script>
</body>
</html>`;
}

function sendAuthFailure(req: Request, res: Response, state: AuthState): void {
  if (state === "missing-config") {
    if (wantsHtml(req)) {
      res.status(503).type("html").send(renderLoginPage({
        next: getSafeNext(req.originalUrl),
        missingConfig: true,
      }));
      return;
    }

    res.status(503).json({ error: "APP_PASSWORD is not configured for the workspace server." });
    return;
  }

  if (wantsHtml(req)) {
    res.redirect(303, `/login?next=${encodeURIComponent(getSafeNext(req.originalUrl))}`);
    return;
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Carmelon AI Workspace"');
  res.status(401).json({ error: "Authentication required." });
}

function requireWorkspaceAuth(req: Request, res: Response, next: NextFunction): void {
  const state = getRequestAuthState(req);

  if (state === "ok") {
    next();
    return;
  }

  sendAuthFailure(req, res, state);
}

function sendSocketHttpAuthFailure(res: ServerResponse, state: AuthState): void {
  const status = state === "missing-config" ? 503 : 401;
  const error = state === "missing-config"
    ? "APP_PASSWORD is not configured for the workspace server."
    : "Authentication required.";

  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "WWW-Authenticate": 'Basic realm="Carmelon AI Workspace"',
  });
  res.end(JSON.stringify({ error }));
}

function installSocketClientAuth(): void {
  type SocketIoServeHost = {
    serve?: (req: IncomingMessage, res: ServerResponse) => void;
  };

  const serverWithServe = io as unknown as SocketIoServeHost;
  const originalServe = serverWithServe.serve?.bind(io);

  if (!originalServe) {
    return;
  }

  serverWithServe.serve = (req: IncomingMessage, res: ServerResponse) => {
    const state = getRequestAuthState(req);

    if (state === "ok") {
      originalServe(req, res);
      return;
    }

    sendSocketHttpAuthFailure(res, state);
  };
}

installSocketClientAuth();

app.use(express.urlencoded({ extended: false }));

app.get("/login", (req, res) => {
  const next = getSafeNext(req.query.next);
  const state = getRequestAuthState(req);
  res.setHeader("Cache-Control", "no-store");

  if (state === "ok") {
    res.redirect(303, next);
    return;
  }

  res.status(state === "missing-config" ? 503 : 200).type("html").send(renderLoginPage({
    next,
    missingConfig: state === "missing-config",
  }));
});

app.post("/login", (req, res) => {
  const next = getSafeNext(req.body?.next || req.query.next);
  res.setHeader("Cache-Control", "no-store");

  if (!APP_PASSWORD) {
    res.status(503).type("html").send(renderLoginPage({ next, missingConfig: true }));
    return;
  }

  if (isLoginRateLimited(req)) {
    res.status(429).type("html").send(renderLoginPage({
      next,
      error: "Too many attempts. Wait 15 minutes and try again.",
    }));
    return;
  }

  if (!passwordMatches(String(req.body?.password || ""))) {
    recordFailedLogin(req);
    res.status(401).type("html").send(renderLoginPage({
      next,
      error: "Incorrect password.",
    }));
    return;
  }

  clearFailedLogins(req);
  res.setHeader("Set-Cookie", serializeAuthCookie(createAuthToken(), req));
  res.redirect(303, next);
});

function logout(req: Request, res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", serializeClearAuthCookie(req));
  res.redirect(303, "/login");
}

app.get("/logout", logout);
app.post("/logout", logout);

app.use(requireWorkspaceAuth);
app.use((req, res, next) => {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
});
app.use(express.static(publicPath));
app.use(express.json());

io.engine.use((req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
  const state = getRequestAuthState(req);

  if (state === "ok") {
    next();
    return;
  }

  sendSocketHttpAuthFailure(res, state);
});

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
    const response: any = await openai.responses.create({
      model: "gpt-5.4-mini",
      store: false,
      instructions: assistantPreflightSystemPrompt(),
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
    } as any);

    const parsed = extractJsonObject(response.output_text || "");
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

  delete dynamicEnv.APP_PASSWORD;
  delete dynamicEnv.APP_AUTH_SECRET;
  delete dynamicEnv.APP_AUTH_TTL_HOURS;

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

  socket.on("start-agent", (config) => {
    const mode = normalizeMode(config);

    console.log(`🔹 WEB COMMAND: ${mode}`);

    const payloadData = buildPayloadData(mode, config);
    const dynamicEnv = buildDynamicEnv(mode, config, payloadData);

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

    child.on("close", (code) => {
      const remainingStdout = stdoutBuffer.trim();
      const remainingStderr = stderrBuffer.trim();

      if (remainingStdout) {
        if (isPreviewEventLine(remainingStdout)) {
          const event = parsePreviewEventLine(remainingStdout);
          if (event) socket.emit("preview-event", event);
        } else {
          socket.emit("log", remainingStdout);
        }
      }

      if (remainingStderr) {
        if (isPreviewEventLine(remainingStderr)) {
          const event = parsePreviewEventLine(remainingStderr);
          if (event) socket.emit("preview-event", event);
        } else {
          socket.emit("log", remainingStderr);
        }
      }

      socket.emit("done");
      console.log(`Process finished with code ${code}`);
    });

    child.on("error", (error) => {
      socket.emit("log", `❌ Failed to start process: ${error.message}`);
      socket.emit("done");
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
