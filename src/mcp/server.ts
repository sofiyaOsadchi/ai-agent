import {
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  callMcpTool,
  getMcpPrompt,
  listMcpPrompts,
  listMcpResourceTemplates,
  listMcpResources,
  listMcpTools,
  readMcpResource,
} from "./workflow-adapter.js";

type RpcId = string | number | null;

type RpcMessage = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

type RpcResponse = {
  jsonrpc: "2.0";
  id: RpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown
  ) {
    super(message);
  }
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeId(value: unknown): RpcId {
  if (typeof value === "string" || typeof value === "number" || value === null) {
    return value;
  }

  return null;
}

function isNotification(message: RpcMessage): boolean {
  return !Object.prototype.hasOwnProperty.call(message, "id");
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createResult(id: RpcId, result: unknown): RpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function createError(id: RpcId, code: number, message: string, data?: unknown): RpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function getParamsObject(params: unknown): Record<string, unknown> {
  if (params === undefined) return {};
  if (!isRecord(params)) {
    throw new RpcError(INVALID_PARAMS, "Params must be an object.");
  }

  return params;
}

async function handleMethod(method: string, params: unknown): Promise<unknown> {
  if (method === "initialize") {
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: MCP_SERVER_INFO,
      instructions: [
        "Read-only workflow registry MCP server for Carmelon AI Agent.",
        "This server exposes workflow contracts, payload validation, and planning prompts only.",
        "It does not run jobs, write Google Sheets, crawl websites, or call AI providers.",
      ].join(" "),
    };
  }

  if (method === "ping") {
    return {};
  }

  if (method === "tools/list") {
    return {
      tools: listMcpTools(),
    };
  }

  if (method === "tools/call") {
    const input = getParamsObject(params);
    const name = asString(input.name);

    if (!name) {
      throw new RpcError(INVALID_PARAMS, "tools/call requires params.name.");
    }

    return callMcpTool(name, input.arguments);
  }

  if (method === "resources/list") {
    return {
      resources: listMcpResources(),
    };
  }

  if (method === "resources/templates/list") {
    return {
      resourceTemplates: listMcpResourceTemplates(),
    };
  }

  if (method === "resources/read") {
    const input = getParamsObject(params);
    const uri = asString(input.uri);

    if (!uri) {
      throw new RpcError(INVALID_PARAMS, "resources/read requires params.uri.");
    }

    const resource = readMcpResource(uri);
    if (!resource) {
      throw new RpcError(INVALID_PARAMS, `Unknown resource: ${uri}`);
    }

    return {
      contents: [resource],
    };
  }

  if (method === "prompts/list") {
    return {
      prompts: listMcpPrompts(),
    };
  }

  if (method === "prompts/get") {
    const input = getParamsObject(params);
    const name = asString(input.name);

    if (!name) {
      throw new RpcError(INVALID_PARAMS, "prompts/get requires params.name.");
    }

    const prompt = getMcpPrompt(name, input.arguments);
    if (!prompt) {
      throw new RpcError(INVALID_PARAMS, `Unknown prompt or invalid prompt arguments: ${name}`);
    }

    return prompt;
  }

  if (method === "notifications/initialized") {
    return undefined;
  }

  throw new RpcError(METHOD_NOT_FOUND, `Unknown method: ${method}`);
}

async function handleRpcMessage(value: unknown): Promise<RpcResponse | RpcResponse[] | undefined> {
  if (Array.isArray(value)) {
    const responses = await Promise.all(value.map((item) => handleRpcMessage(item)));
    return responses.flatMap((response) => response || []);
  }

  if (!isRecord(value)) {
    return createError(null, INVALID_REQUEST, "JSON-RPC message must be an object.");
  }

  const message = value as RpcMessage;
  const id = normalizeId(message.id);

  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return createError(id, INVALID_REQUEST, "Invalid JSON-RPC request.");
  }

  try {
    const result = await handleMethod(message.method, message.params);

    if (isNotification(message)) {
      return undefined;
    }

    return createResult(id, result === undefined ? {} : result);
  } catch (error) {
    if (isNotification(message)) {
      return undefined;
    }

    if (error instanceof RpcError) {
      return createError(id, error.code, error.message, error.data);
    }

    return createError(
      id,
      INTERNAL_ERROR,
      error instanceof Error ? error.message : "Internal server error."
    );
  }
}

function writeResponse(response: RpcResponse | RpcResponse[] | undefined): void {
  if (!response) return;
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function handleLine(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const parsed = JSON.parse(trimmed);
    writeResponse(await handleRpcMessage(parsed));
  } catch (error) {
    writeResponse(createError(
      null,
      PARSE_ERROR,
      error instanceof Error ? error.message : "Parse error."
    ));
  }
}

let buffer = "";
let pendingLines = Promise.resolve();

function enqueueLine(line: string): void {
  pendingLines = pendingLines
    .then(() => handleLine(line))
    .catch((error) => {
      writeResponse(createError(
        null,
        INTERNAL_ERROR,
        error instanceof Error ? error.message : "Internal server error."
      ));
    });
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;

  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    enqueueLine(line);
    newlineIndex = buffer.indexOf("\n");
  }
});

process.stdin.on("end", () => {
  if (buffer.trim()) {
    enqueueLine(buffer);
  }

  void pendingLines.finally(() => {
    process.stdout.write("", () => process.exit(0));
  });
});

process.stdin.resume();
