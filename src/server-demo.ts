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

import {
  isPreviewEventLine,
  parsePreviewEventLine,
} from "./jobs/subjobs/preview-events.js";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const publicPath = path.join(__dirname, "..", "public");

app.use(express.static(publicPath));
app.use(express.json());

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
    "- For faq-playground: improve task user/system prompts while preserving task ids, enabled flags, and subjects.",
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
    dynamicEnv.DYNAMIC_INPUT_TYPE = "sheet";
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
