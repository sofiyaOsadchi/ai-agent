import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import open from "open";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const publicPath = path.join(__dirname, "..", "public");
app.use(express.static(publicPath));
app.use(express.json());

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("start-agent", (config) => {
    console.log(`🔹 WEB COMMAND: ${config?.mode}`);

    const mode = String(config?.mode || "").trim() || "faq";

    // payloadData: always send the whole config for translate-demo.
    // faq-playground stays as-is.
    const payloadData =
      mode === "faq-playground" && Array.isArray(config?.tasks)
        ? { subjects: config.subjects, tasks: config.tasks }
        : mode === "translate-demo"
          ? config
          : { hotels: config.hotels, prompts: config.prompts, steps: config.steps };

    const dynamicEnv: Record<string, string> = {
      ...process.env,
      MODE: mode,
      DYNAMIC_PAYLOAD: JSON.stringify(payloadData),
    };

    // Backwards compatibility (your existing translate mode uses these)
    if (mode === "translate-demo") {
      dynamicEnv.DYNAMIC_TARGET_ID = config?.spreadsheetId || "";
      dynamicEnv.DYNAMIC_INPUT_TYPE = "sheet";
      dynamicEnv.DYNAMIC_LANGS = Array.isArray(config?.targetLangs)
        ? config.targetLangs.join(",")
        : "";
    } else {
      dynamicEnv.DYNAMIC_TARGET_ID = config?.targetId || "";
      dynamicEnv.DYNAMIC_INPUT_TYPE = config?.inputType || "sheet";
      dynamicEnv.DYNAMIC_LANGS = config?.langs || "";
    }

    const child = spawn("npx", ["tsx", "src/index.ts"], {
      env: dynamicEnv as any,
      shell: true,
      cwd: process.cwd(),
    });

    child.stdout.on("data", (data) => socket.emit("log", data.toString()));
    child.stderr.on("data", (data) => socket.emit("log", data.toString()));

    child.on("close", (code) => {
      socket.emit("done");
      console.log(`Process finished with code ${code}`);
    });
  });
});

const PORT = 3000;

httpServer.listen(PORT, async () => {
  const url = `http://localhost:${PORT}/translate-demo.html`;
  console.log(`🚀 Server running at ${url}`);
  try { await open(url); } catch (e) {}
});