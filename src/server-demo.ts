// src/server-demo.ts
// Code in English. Comments can be Hebrew.

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import open from "open";

import {
  isPreviewEventLine,
  parsePreviewEventLine,
} from "./jobs/subjobs/preview-events.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const publicPath = path.join(__dirname, "..", "public");

app.use(express.static(publicPath));
app.use(express.json());

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
    mode === "client-reports-edit"
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

  if (process.env.NODE_ENV !== "production") {
    try {
      await open(defaultUrl);
    } catch {
      // Browser auto-open failed. Server is still running.
    }
  }
});