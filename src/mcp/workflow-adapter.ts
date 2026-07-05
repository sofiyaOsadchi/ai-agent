import {
  getWorkflowById,
  listRunnableWorkflows,
  listWorkflows,
  validateWorkflowPayload,
  type WorkflowDefinition,
  type WorkflowField,
  type WorkflowPayloadValidation,
} from "../workflows/registry.js";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export const MCP_SERVER_INFO = {
  name: "carmelon-ai-agent-workflows",
  title: "Carmelon AI Agent Workflow Registry",
  version: "0.1.0",
} as const;

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: readonly string[];
  format?: string;
  additionalProperties?: boolean | JsonSchema;
};

export type McpTextContent = {
  type: "text";
  text: string;
};

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: Record<string, unknown>;
};

export type McpToolResult = {
  content: McpTextContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

export type McpResource = {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
};

export type McpResourceTemplate = {
  uriTemplate: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
};

export type McpPrompt = {
  name: string;
  title: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
};

export type McpPromptResult = {
  description: string;
  messages: Array<{
    role: "user" | "assistant";
    content: McpTextContent;
  }>;
};

const REGISTRY_RESOURCE_URI = "workflow://registry";
const RUNNABLE_RESOURCE_URI = "workflow://workflows/runnable";
const WORKFLOW_RESOURCE_PREFIX = "workflow://workflows/";
const JSON_MIME_TYPE = "application/json";

const TOOL_INPUTS = {
  listWorkflows: {
    type: "object",
    properties: {
      runnableOnly: {
        type: "boolean",
        description: "When true, return workflows that can be launched from the demo layer.",
      },
      includeInternal: {
        type: "boolean",
        description: "When true, include internal support workflows.",
      },
      category: {
        type: "string",
        description: "Optional workflow category filter.",
      },
      status: {
        type: "string",
        description: "Optional workflow status filter.",
      },
    },
    additionalProperties: false,
  },
  getWorkflow: {
    type: "object",
    properties: {
      workflowId: {
        type: "string",
        description: "Workflow id from the registry.",
      },
    },
    required: ["workflowId"],
    additionalProperties: false,
  },
  validatePayload: {
    type: "object",
    properties: {
      workflowId: {
        type: "string",
        description: "Workflow id from the registry.",
      },
      payload: {
        type: "object",
        description: "Candidate dynamic payload for the workflow.",
        additionalProperties: true,
      },
    },
    required: ["workflowId", "payload"],
    additionalProperties: false,
  },
  planRun: {
    type: "object",
    properties: {
      workflowId: {
        type: "string",
        description: "Workflow id from the registry.",
      },
      payload: {
        type: "object",
        description: "Candidate dynamic payload. May be partial.",
        additionalProperties: true,
      },
      userRequest: {
        type: "string",
        description: "Original user request, if available.",
      },
    },
    required: ["workflowId"],
    additionalProperties: false,
  },
} satisfies Record<string, JsonSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function summarizeWorkflow(workflow: WorkflowDefinition) {
  return {
    id: workflow.id,
    title: workflow.title,
    description: workflow.description,
    mode: workflow.mode,
    category: workflow.category,
    status: workflow.status,
    riskLevel: workflow.riskLevel,
    supportsDryRun: workflow.supportsDryRun,
    requiredFields: workflow.requiredFields,
    requiredOneOf: workflow.requiredOneOf || [],
    defaultPolicy: workflow.defaultPolicy,
  };
}

function getVisibleWorkflows(options: {
  runnableOnly?: boolean;
  includeInternal?: boolean;
  category?: string;
  status?: string;
}): readonly WorkflowDefinition[] {
  let workflows = options.runnableOnly ? listRunnableWorkflows() : listWorkflows();

  if (!options.includeInternal) {
    workflows = workflows.filter((workflow) => workflow.status !== "internal");
  }

  if (options.category) {
    workflows = workflows.filter((workflow) => workflow.category === options.category);
  }

  if (options.status) {
    workflows = workflows.filter((workflow) => workflow.status === options.status);
  }

  return workflows;
}

function schemaForField(field: WorkflowField): JsonSchema {
  if (field.type === "enum") {
    return {
      type: "string",
      description: field.description || field.label,
      enum: field.values,
    };
  }

  if (field.type === "url") {
    return {
      type: "string",
      format: "uri",
      description: field.description || field.label,
    };
  }

  if (field.type === "array") {
    return {
      type: "array",
      description: field.description || field.label,
      items: {},
    };
  }

  if (field.type === "object") {
    return {
      type: "object",
      description: field.description || field.label,
      additionalProperties: true,
    };
  }

  if (field.type === "unknown") {
    return {
      description: field.description || field.label,
    };
  }

  return {
    type: field.type,
    description: field.description || field.label,
  };
}

function payloadSchemaForWorkflow(workflow: WorkflowDefinition): JsonSchema {
  const allFields = [...workflow.requiredFields, ...workflow.optionalFields];
  const properties: Record<string, JsonSchema> = {};

  for (const field of allFields) {
    properties[field.key] = schemaForField(field);
  }

  return {
    type: "object",
    properties,
    required: workflow.requiredFields.map((field) => field.key),
    additionalProperties: true,
  };
}

function getWorkflowContract(workflow: WorkflowDefinition) {
  return {
    ...workflow,
    payloadSchema: payloadSchemaForWorkflow(workflow),
    canRunFromDemo: workflow.status !== "needs_review" && workflow.defaultPolicy.allowRunFromDemo,
    canRunDirectlyFromAssistant: workflow.status !== "needs_review" && workflow.defaultPolicy.allowDirectRunFromAssistant,
  };
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function resultFromJson(structuredContent: unknown): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: stringifyJson(structuredContent),
      },
    ],
    structuredContent,
  };
}

function errorResult(message: string, details?: unknown): McpToolResult {
  const structuredContent = {
    error: message,
    details,
  };

  return {
    content: [
      {
        type: "text",
        text: stringifyJson(structuredContent),
      },
    ],
    structuredContent,
    isError: true,
  };
}

function buildMissingQuestions(workflow: WorkflowDefinition, validation: WorkflowPayloadValidation): string[] {
  const questions: string[] = [];

  for (const fieldKey of validation.missingFields) {
    const field = workflow.requiredFields.find((candidate) => candidate.key === fieldKey);
    questions.push(
      field
        ? `What should ${field.label} be?${field.description ? ` ${field.description}` : ""}`
        : `What should ${fieldKey} be?`
    );
  }

  for (const groupMessage of validation.missingFieldGroups) {
    questions.push(groupMessage);
  }

  return questions;
}

function getNextAction(workflow: WorkflowDefinition, validation: WorkflowPayloadValidation): string {
  if (workflow.status === "needs_review") {
    return "manual_contract_review";
  }

  if (validation.missingFields.length > 0 || validation.missingFieldGroups.length > 0) {
    return "collect_missing_inputs";
  }

  if (workflow.defaultPolicy.preferWorkspace || !workflow.defaultPolicy.allowDirectRunFromAssistant) {
    return "open_workspace_for_user_review";
  }

  if (workflow.defaultPolicy.requiresConfirmation) {
    return "review_payload_and_ask_for_confirmation";
  }

  return "ready_for_future_runner";
}

export function listMcpTools(): McpTool[] {
  return [
    {
      name: "list_workflows",
      title: "List workflows",
      description: "List read-only workflow contracts from src/workflows/registry.ts.",
      inputSchema: TOOL_INPUTS.listWorkflows,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    {
      name: "get_workflow",
      title: "Get workflow contract",
      description: "Return one workflow contract, including fields, risk, policy, source files, and payload schema.",
      inputSchema: TOOL_INPUTS.getWorkflow,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    {
      name: "validate_workflow_payload",
      title: "Validate workflow payload",
      description: "Validate that a candidate payload contains the required fields for a workflow. This does not run jobs.",
      inputSchema: TOOL_INPUTS.validatePayload,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    {
      name: "plan_workflow_run",
      title: "Plan workflow run",
      description: "Create a read-only execution plan: missing inputs, safety policy, next action, and dynamic env mapping.",
      inputSchema: TOOL_INPUTS.planRun,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
  ];
}

export function callMcpTool(name: string, args: unknown): McpToolResult {
  const input = isRecord(args) ? args : {};

  if (name === "list_workflows") {
    const workflows = getVisibleWorkflows({
      runnableOnly: input.runnableOnly === true,
      includeInternal: input.includeInternal === true,
      category: asString(input.category),
      status: asString(input.status),
    });

    return resultFromJson({
      count: workflows.length,
      workflows: workflows.map(summarizeWorkflow),
    });
  }

  if (name === "get_workflow") {
    const workflowId = asString(input.workflowId);
    if (!workflowId) return errorResult("workflowId is required.");

    const workflow = getWorkflowById(workflowId);
    if (!workflow) return errorResult(`Unknown workflow: ${workflowId}`);

    return resultFromJson(getWorkflowContract(workflow));
  }

  if (name === "validate_workflow_payload") {
    const workflowId = asString(input.workflowId);
    if (!workflowId) return errorResult("workflowId is required.");

    const validation = validateWorkflowPayload(workflowId, input.payload);
    const workflow = getWorkflowById(workflowId);

    return resultFromJson({
      validation,
      workflow: workflow ? summarizeWorkflow(workflow) : null,
    });
  }

  if (name === "plan_workflow_run") {
    const workflowId = asString(input.workflowId);
    if (!workflowId) return errorResult("workflowId is required.");

    const workflow = getWorkflowById(workflowId);
    if (!workflow) return errorResult(`Unknown workflow: ${workflowId}`);

    const payload = isRecord(input.payload) ? input.payload : {};
    const validation = validateWorkflowPayload(workflowId, payload);
    const missingQuestions = buildMissingQuestions(workflow, validation);

    return resultFromJson({
      workflow: summarizeWorkflow(workflow),
      payload,
      userRequest: asString(input.userRequest) || "",
      validation,
      missingQuestions,
      nextAction: getNextAction(workflow, validation),
      dynamicEnv: workflow.dynamicEnv,
      safety: {
        riskLevel: workflow.riskLevel,
        supportsDryRun: workflow.supportsDryRun,
        defaultPolicy: workflow.defaultPolicy,
        readOnlyMcpSkeleton: true,
      },
      runnerAvailable: false,
    });
  }

  return errorResult(`Unknown tool: ${name}`);
}

export function listMcpResources(): McpResource[] {
  return [
    {
      uri: REGISTRY_RESOURCE_URI,
      name: "workflow-registry",
      title: "Workflow Registry",
      description: "All workflows currently known to src/workflows/registry.ts.",
      mimeType: JSON_MIME_TYPE,
    },
    {
      uri: RUNNABLE_RESOURCE_URI,
      name: "runnable-workflows",
      title: "Runnable Workflows",
      description: "Workflows that can be launched from the demo layer according to the registry policy.",
      mimeType: JSON_MIME_TYPE,
    },
    ...listWorkflows().map((workflow) => ({
      uri: `${WORKFLOW_RESOURCE_PREFIX}${workflow.id}`,
      name: workflow.id,
      title: workflow.title,
      description: workflow.description,
      mimeType: JSON_MIME_TYPE,
    })),
  ];
}

export function listMcpResourceTemplates(): McpResourceTemplate[] {
  return [
    {
      uriTemplate: `${WORKFLOW_RESOURCE_PREFIX}{workflowId}`,
      name: "workflow-by-id",
      title: "Workflow by ID",
      description: "Read a workflow contract by registry id.",
      mimeType: JSON_MIME_TYPE,
    },
  ];
}

export function readMcpResource(uri: string): { uri: string; mimeType: string; text: string } | undefined {
  if (uri === REGISTRY_RESOURCE_URI) {
    return {
      uri,
      mimeType: JSON_MIME_TYPE,
      text: stringifyJson({
        count: listWorkflows().length,
        workflows: listWorkflows().map(getWorkflowContract),
      }),
    };
  }

  if (uri === RUNNABLE_RESOURCE_URI) {
    return {
      uri,
      mimeType: JSON_MIME_TYPE,
      text: stringifyJson({
        count: listRunnableWorkflows().length,
        workflows: listRunnableWorkflows().map(getWorkflowContract),
      }),
    };
  }

  if (uri.startsWith(WORKFLOW_RESOURCE_PREFIX)) {
    const workflowId = uri.slice(WORKFLOW_RESOURCE_PREFIX.length);
    const workflow = getWorkflowById(workflowId);
    if (!workflow) return undefined;

    return {
      uri,
      mimeType: JSON_MIME_TYPE,
      text: stringifyJson(getWorkflowContract(workflow)),
    };
  }

  return undefined;
}

function registrySummaryForPrompt(): string {
  return listWorkflows()
    .filter((workflow) => workflow.status !== "internal")
    .map((workflow) => {
      const fields = workflow.requiredFields.map((field) => field.key).join(", ") || "none";
      const oneOf = (workflow.requiredOneOf || []).map((group) => group.keys.join(" or ")).join("; ") || "none";
      return `- ${workflow.id}: ${workflow.title}; category=${workflow.category}; status=${workflow.status}; risk=${workflow.riskLevel}; required=${fields}; oneOf=${oneOf}`;
    })
    .join("\n");
}

export function listMcpPrompts(): McpPrompt[] {
  return [
    {
      name: "choose-workflow",
      title: "Choose workflow",
      description: "Route a natural-language user request to the best workflow and identify missing inputs.",
      arguments: [
        {
          name: "userRequest",
          description: "The user's natural-language request.",
          required: true,
        },
      ],
    },
    {
      name: "collect-workflow-inputs",
      title: "Collect workflow inputs",
      description: "Ask only the missing questions needed before a workflow can be prepared.",
      arguments: [
        {
          name: "workflowId",
          description: "Workflow id from the registry.",
          required: true,
        },
        {
          name: "userRequest",
          description: "The original user request or conversation summary.",
        },
      ],
    },
    {
      name: "review-workflow-payload",
      title: "Review workflow payload",
      description: "Review a candidate payload against a workflow contract before any future runner is used.",
      arguments: [
        {
          name: "workflowId",
          description: "Workflow id from the registry.",
          required: true,
        },
        {
          name: "payloadJson",
          description: "Candidate payload as JSON text.",
          required: true,
        },
      ],
    },
  ];
}

export function getMcpPrompt(name: string, args: unknown): McpPromptResult | undefined {
  const input = isRecord(args) ? args : {};

  if (name === "choose-workflow") {
    const userRequest = asString(input.userRequest) || "";
    return {
      description: "Route a user request to one workflow using the read-only registry.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "You are routing a user request to one Carmelon AI Agent workflow.",
              "Use only the registry below. Do not invent workflows.",
              "If the request contains multiple jobs, split it into ordered workflow steps.",
              "Before any run, identify the missing inputs and ask concise follow-up questions.",
              "Return JSON with: workflowId, confidence, orderedSteps, missingQuestions, riskLevel, shouldOpenWorkspace, and explanation.",
              "",
              `User request: ${userRequest}`,
              "",
              "Workflow registry:",
              registrySummaryForPrompt(),
            ].join("\n"),
          },
        },
      ],
    };
  }

  if (name === "collect-workflow-inputs") {
    const workflowId = asString(input.workflowId);
    const workflow = workflowId ? getWorkflowById(workflowId) : undefined;
    if (!workflow) return undefined;

    return {
      description: "Ask for missing inputs before preparing a workflow payload.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Workflow: ${workflow.id} - ${workflow.title}`,
              `User request: ${asString(input.userRequest) || ""}`,
              "",
              "Workflow contract:",
              stringifyJson(getWorkflowContract(workflow)),
              "",
              "Ask only the questions required to safely prepare this workflow.",
              "Prefer one compact question at a time when ambiguity affects routing or payload shape.",
              "Do not claim the workflow has run.",
            ].join("\n"),
          },
        },
      ],
    };
  }

  if (name === "review-workflow-payload") {
    const workflowId = asString(input.workflowId);
    const workflow = workflowId ? getWorkflowById(workflowId) : undefined;
    if (!workflow) return undefined;

    const payloadJson = asString(input.payloadJson) || "{}";
    let payload: unknown = {};
    let payloadParseError = "";

    try {
      payload = JSON.parse(payloadJson);
    } catch (error) {
      payloadParseError = error instanceof Error ? error.message : "Invalid JSON";
    }

    return {
      description: "Review a payload against the workflow contract.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Workflow: ${workflow.id} - ${workflow.title}`,
              "",
              "Workflow contract:",
              stringifyJson(getWorkflowContract(workflow)),
              "",
              "Candidate payload:",
              payloadJson,
              "",
              "Current registry validation:",
              payloadParseError
                ? stringifyJson({ valid: false, errors: [payloadParseError] })
                : stringifyJson(validateWorkflowPayload(workflow.id, payload)),
              "",
              "Review whether this payload is safe and complete. Return missing fields, risky assumptions, and the next user-facing question.",
            ].join("\n"),
          },
        },
      ],
    };
  }

  return undefined;
}
