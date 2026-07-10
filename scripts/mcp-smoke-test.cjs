const { spawn } = require("child_process");

const child = spawn("npx", ["tsx", "src/mcp/server.ts"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  stdout += chunk;
});

child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "carmelon-mcp-smoke", version: "0.1.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "list_workflows",
      arguments: { runnableOnly: true },
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "prepare_workflow_run",
      arguments: {
        workflowId: "translate-demo",
        payload: {
          sourceType: "sheet",
          targetLangs: ["fr"],
          spreadsheetId: "spreadsheet-id-for-smoke-test",
        },
        userRequest: "Translate this sheet to French.",
        requireRunnable: true,
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "validate_workflow_payload",
      arguments: {
        workflowId: "site-ai-audit",
        payload: {},
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 6,
    method: "resources/read",
    params: { uri: "workflow://workflows/translate-demo" },
  },
  { jsonrpc: "2.0", id: 7, method: "prompts/list" },
];

for (const request of requests) {
  child.stdin.write(`${JSON.stringify(request)}\n`);
}

child.stdin.end();

child.on("close", (code) => {
  const lines = stdout.trim().split(/\n/).filter(Boolean);
  const responses = lines.map((line) => JSON.parse(line));
  const byId = new Map(responses.map((response) => [response.id, response]));

  const summary = {
    exitCode: code,
    responses: responses.length,
    ids: responses.map((response) => response.id),
    toolCount: byId.get(2)?.result?.tools?.length,
    runnableCount: byId.get(3)?.result?.structuredContent?.count,
    prepareReady: byId.get(4)?.result?.structuredContent?.ready,
    prepareRunnerAvailable: byId.get(4)?.result?.structuredContent?.runnerAvailable,
    prepareMode: byId.get(4)?.result?.structuredContent?.preparedRun?.mode,
    invalidValidation: byId.get(5)?.result?.structuredContent?.validation?.valid,
    resourceContents: byId.get(6)?.result?.contents?.length,
    promptCount: byId.get(7)?.result?.prompts?.length,
    stderr: stderr.trim(),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (
    code !== 0 ||
    responses.length !== 7 ||
    summary.toolCount !== 5 ||
    summary.prepareReady !== true ||
    summary.prepareRunnerAvailable !== false ||
    summary.prepareMode !== "translate-demo" ||
    summary.invalidValidation !== false ||
    summary.resourceContents !== 1 ||
    summary.promptCount !== 3
  ) {
    process.exit(1);
  }
});
