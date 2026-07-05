// Central registry for workflows that are actually launched by src/server-demo.ts.
// This is intentionally not an MCP server and not a runner. It is a typed contract
// that future adapters can use before exposing jobs to chat, MCP, or other hosts.

export type WorkflowStatus = "ready" | "beta" | "workspace_first" | "internal" | "needs_review";

export type WorkflowCategory =
  | "faq"
  | "translation"
  | "sheet_operations"
  | "seo"
  | "audits"
  | "reports"
  | "internal"
  | "unknown";

export type WorkflowRiskLevel =
  | "read_only"
  | "ai_cost"
  | "external_crawl"
  | "creates_google_file"
  | "writes_to_sheet"
  | "needs_review";

export type WorkflowFieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "url"
  | "enum"
  | "unknown";

export type WorkflowPayloadStrategy =
  | "full_dynamic_payload"
  | "faq_playground_tasks_or_legacy"
  | "unverified_full_dynamic_payload";

export type DynamicEnvMapping = {
  mode: string;
  payload: "DYNAMIC_PAYLOAD";
  targetId: string;
  inputType: string;
  langs: string;
};

export type WorkflowField = {
  key: string;
  label: string;
  type: WorkflowFieldType;
  description?: string;
  defaultValue?: unknown;
  values?: readonly string[];
};

export type WorkflowRequiredOneOf = {
  keys: readonly string[];
  message: string;
};

export type WorkflowDefaultPolicy = {
  allowRunFromDemo: boolean;
  allowDirectRunFromAssistant: boolean;
  requiresConfirmation: boolean;
  preferWorkspace: boolean;
  defaultDryRun?: boolean;
  exposeToExternalAiByDefault: boolean;
};

export type WorkflowDefinition = {
  id: string;
  title: string;
  description: string;
  mode: string;
  category: WorkflowCategory;
  status: WorkflowStatus;
  sourceFiles: readonly string[];
  requiredFields: readonly WorkflowField[];
  optionalFields: readonly WorkflowField[];
  requiredOneOf?: readonly WorkflowRequiredOneOf[];
  payloadStrategy: WorkflowPayloadStrategy;
  dynamicEnv: DynamicEnvMapping;
  riskLevel: WorkflowRiskLevel;
  defaultPolicy: WorkflowDefaultPolicy;
  supportsDryRun: boolean;
  notes: readonly string[];
};

export type WorkflowPayloadValidation = {
  workflowId: string;
  valid: boolean;
  status: WorkflowStatus | "missing_workflow";
  missingFields: string[];
  missingFieldGroups: string[];
  warnings: string[];
  errors: string[];
};

const FULL_DYNAMIC_ENV_FALLBACK: DynamicEnvMapping = {
  mode: "config.mode -> MODE",
  payload: "DYNAMIC_PAYLOAD",
  targetId: "config.targetId || ''",
  inputType: "config.inputType || config.sourceType || 'sheet'",
  langs: "config.langs || ''",
};

const CONFIRM_DRY_RUN_POLICY: WorkflowDefaultPolicy = {
  allowRunFromDemo: true,
  allowDirectRunFromAssistant: false,
  requiresConfirmation: true,
  preferWorkspace: true,
  defaultDryRun: true,
  exposeToExternalAiByDefault: false,
};

const CONFIRM_AI_POLICY: WorkflowDefaultPolicy = {
  allowRunFromDemo: true,
  allowDirectRunFromAssistant: false,
  requiresConfirmation: true,
  preferWorkspace: true,
  exposeToExternalAiByDefault: false,
};

export const WORKFLOW_REGISTRY = [
  {
    id: "faq-playground",
    title: "FAQ Workflow Builder",
    description: "Build FAQ question plans, answer prompts, QA prompts, and generated FAQ Sheets from UI-provided tasks.",
    mode: "faq-playground",
    category: "faq",
    status: "ready",
    sourceFiles: [
      "public/faq-playground.html",
      "public/assistant-tools.js",
      "public/assistant-workspace.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/faq-playground.ts",
    ],
    requiredFields: [
      { key: "subjects", label: "Subjects", type: "array", description: "Hotel, page, product, service, or other FAQ subjects." },
      { key: "tasks", label: "Tasks", type: "array", description: "Ordered prompt tasks produced by the FAQ builder." },
    ],
    optionalFields: [
      { key: "faqDemand", label: "FAQ demand data", type: "object" },
      { key: "hotels", label: "Legacy hotel list", type: "array" },
      { key: "steps", label: "Legacy steps", type: "array" },
      { key: "prompts", label: "Legacy prompts", type: "array" },
    ],
    payloadStrategy: "faq_playground_tasks_or_legacy",
    dynamicEnv: FULL_DYNAMIC_ENV_FALLBACK,
    riskLevel: "creates_google_file",
    defaultPolicy: {
      ...CONFIRM_AI_POLICY,
      allowDirectRunFromAssistant: true,
      preferWorkspace: true,
    },
    supportsDryRun: false,
    notes: [
      "server-demo.ts sends a reduced payload when tasks are present: subjects, tasks, and faqDemand.",
      "src/index.ts also supports a legacy hotels, steps, prompts payload.",
      "This workflow can create Google Sheets and spend AI calls.",
    ],
  },
  {
    id: "translate-demo",
    title: "AI Translation Engine",
    description: "Translate a Google Sheet or Drive folder with glossary, terminology, language notes, and model settings.",
    mode: "translate-demo",
    category: "translation",
    status: "ready",
    sourceFiles: [
      "public/translate-demo.html",
      "public/assistant-tools.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/translate-from-sheet-demo.ts",
      "src/jobs/subjobs/translation-glossary.ts",
      "src/jobs/subjobs/terminology-management.ts",
    ],
    requiredFields: [
      { key: "sourceType", label: "Source type", type: "enum", values: ["sheet", "folder"], defaultValue: "sheet" },
      { key: "targetLangs", label: "Target languages", type: "array" },
    ],
    requiredOneOf: [
      { keys: ["spreadsheetId", "sourceFolderId"], message: "Provide spreadsheetId for sheet mode or sourceFolderId for folder mode." },
    ],
    optionalFields: [
      { key: "spreadsheetId", label: "Spreadsheet ID or URL", type: "string" },
      { key: "sourceFolderId", label: "Drive folder ID or URL", type: "string" },
      { key: "sourceTab", label: "Source tab", type: "string" },
      { key: "model", label: "Model", type: "string", defaultValue: "o3" },
      { key: "translateHeader", label: "Translate header", type: "boolean", defaultValue: true },
      { key: "splitIntoTwo", label: "Split into two calls", type: "boolean", defaultValue: true },
      { key: "prompts", label: "Prompt overrides", type: "object" },
      { key: "languageNotes", label: "Language notes by language", type: "object" },
      { key: "glossaryByLang", label: "Glossary by language", type: "object" },
      { key: "terminologyByLang", label: "Terminology by language", type: "object" },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: {
      mode: "translate-demo -> MODE",
      payload: "DYNAMIC_PAYLOAD",
      targetId: "config.spreadsheetId || config.sourceFolderId || ''",
      inputType: "config.sourceType || 'sheet'",
      langs: "Array.isArray(config.targetLangs) ? config.targetLangs.join(',') : ''",
    },
    riskLevel: "writes_to_sheet",
    defaultPolicy: CONFIRM_DRY_RUN_POLICY,
    supportsDryRun: false,
    notes: [
      "server-demo.ts derives DYNAMIC_TARGET_ID and DYNAMIC_LANGS specially for translate-demo.",
      "No dry-run contract is visible in the demo server mapping; require confirmation before exposing externally.",
    ],
  },
  {
    id: "design-formatting",
    title: "FAQ Editing Workspace",
    description: "Edit, format, research, clean, or transform Google Sheet content with preview events and dry-run support.",
    mode: "design-formatting",
    category: "sheet_operations",
    status: "ready",
    sourceFiles: [
      "public/design-formatting.html",
      "public/assistant-tools.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/design-formatting-job.ts",
    ],
    requiredFields: [
      { key: "targetId", label: "Target Sheet or folder", type: "string" },
      { key: "operation", label: "Operation", type: "object" },
    ],
    optionalFields: [
      { key: "sourceType", label: "Source type", type: "enum", values: ["sheet", "folder"], defaultValue: "sheet" },
      { key: "tabName", label: "Tab name", type: "string", defaultValue: "Sheet1" },
      { key: "dryRun", label: "Dry run", type: "boolean", defaultValue: true },
      { key: "operations", label: "Operations", type: "array" },
      { key: "assistantInstruction", label: "Assistant instruction", type: "string" },
      { key: "assistantSourceUrl", label: "Research source URL", type: "url" },
      { key: "selectedOperation", label: "Selected operation", type: "string" },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: {
      mode: "design-formatting -> MODE",
      payload: "DYNAMIC_PAYLOAD",
      targetId: "config.targetId || ''",
      inputType: "config.sourceType || 'sheet'",
      langs: "''",
    },
    riskLevel: "writes_to_sheet",
    defaultPolicy: CONFIRM_DRY_RUN_POLICY,
    supportsDryRun: true,
    notes: [
      "Direct chat runs should default to dryRun=true.",
      "Live writes need explicit confirmation.",
      "Preview events are emitted through CARMELON_PREVIEW_EVENT_JSON and handled by server-demo.ts.",
    ],
  },
  {
    id: "sheet-utilities",
    title: "Sheet Utilities",
    description: "Run cross-file Sheet utilities such as lookup copy, coverage reports, cross-checks, folder-to-master injection, and column copies.",
    mode: "sheet-utilities",
    category: "sheet_operations",
    status: "workspace_first",
    sourceFiles: [
      "public/sheet-utilities.html",
      "public/assistant-tools.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/sheet-utilities-job.ts",
    ],
    requiredFields: [
      { key: "operationType", label: "Operation type", type: "string" },
      { key: "instruction", label: "Instruction", type: "string" },
    ],
    optionalFields: [
      { key: "sourceUrl", label: "Source Sheet or folder", type: "url" },
      { key: "targetUrl", label: "Target Sheet", type: "url" },
      { key: "dryRun", label: "Dry run", type: "boolean", defaultValue: true },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: FULL_DYNAMIC_ENV_FALLBACK,
    riskLevel: "writes_to_sheet",
    defaultPolicy: CONFIRM_DRY_RUN_POLICY,
    supportsDryRun: true,
    notes: [
      "Workspace review is preferred because mappings can be ambiguous and destructive if guessed.",
      "The registry intentionally does not map every utility-specific payload shape yet.",
    ],
  },
  {
    id: "ai-editing",
    title: "AI Editing",
    description: "Unverified mode listed in server-demo.ts full-payload handling, but no matching src/index.ts handler was found.",
    mode: "ai-editing",
    category: "unknown",
    status: "needs_review",
    sourceFiles: [
      "src/server-demo.ts",
    ],
    requiredFields: [],
    optionalFields: [],
    payloadStrategy: "unverified_full_dynamic_payload",
    dynamicEnv: FULL_DYNAMIC_ENV_FALLBACK,
    riskLevel: "needs_review",
    defaultPolicy: {
      allowRunFromDemo: false,
      allowDirectRunFromAssistant: false,
      requiresConfirmation: true,
      preferWorkspace: true,
      exposeToExternalAiByDefault: false,
    },
    supportsDryRun: false,
    notes: [
      "server-demo.ts includes ai-editing in buildPayloadData.",
      "src/index.ts does not appear to handle MODE=ai-editing; running it could fall through to the default FAQ-from-scratch path.",
      "Do not expose this mode until the intended job and payload contract are confirmed.",
    ],
  },
  {
    id: "client-reports",
    title: "Client Reports Dashboard",
    description: "Build client performance dashboards from Google Analytics or Google Sheets.",
    mode: "client-reports",
    category: "reports",
    status: "workspace_first",
    sourceFiles: [
      "public/client-reports.html",
      "public/assistant-tools.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/client-reports-job.ts",
    ],
    requiredFields: [
      { key: "sourceType", label: "Source type", type: "enum", values: ["analytics", "sheet"], defaultValue: "analytics" },
    ],
    optionalFields: [
      { key: "spreadsheetId", label: "Spreadsheet ID or URL", type: "string" },
      { key: "sourceTab", label: "Source tab", type: "string" },
      { key: "analytics", label: "Analytics source", type: "object" },
      { key: "reportType", label: "Report type", type: "string", defaultValue: "seo-traffic-report" },
      { key: "datePreset", label: "Date preset", type: "string", defaultValue: "all" },
      { key: "primaryMetric", label: "Primary metric", type: "string", defaultValue: "sessions" },
      { key: "breakdown", label: "Breakdown", type: "string", defaultValue: "channel" },
      { key: "columnMapping", label: "Column mapping", type: "object" },
      { key: "options", label: "Report options", type: "object" },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: {
      mode: "client-reports -> MODE",
      payload: "DYNAMIC_PAYLOAD",
      targetId: "config.spreadsheetId || ''",
      inputType: "config.sourceType || 'sheet'",
      langs: "''",
    },
    riskLevel: "creates_google_file",
    defaultPolicy: {
      ...CONFIRM_AI_POLICY,
      preferWorkspace: true,
    },
    supportsDryRun: true,
    notes: [
      "server-demo.ts derives DYNAMIC_TARGET_ID and DYNAMIC_INPUT_TYPE specially for client-reports.",
      "The assistant tool contract prefers opening the dashboard workspace before generating.",
    ],
  },
  {
    id: "client-reports-edit",
    title: "Client Reports Edit",
    description: "Edit existing client report insight blocks with an AI command and current block context.",
    mode: "client-reports-edit",
    category: "reports",
    status: "beta",
    sourceFiles: [
      "public/client-reports-edit.html",
      "public/insight-editor.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/client-reports-edit-job.ts",
      "src/jobs/subjobs/report-insights.ts",
    ],
    requiredFields: [
      { key: "command", label: "Edit command", type: "object" },
      { key: "currentBlocks", label: "Current insight blocks", type: "array" },
      { key: "context", label: "Report context", type: "object" },
    ],
    optionalFields: [],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: {
      mode: "client-reports-edit -> MODE",
      payload: "DYNAMIC_PAYLOAD",
      targetId: "''",
      inputType: "'none'",
      langs: "''",
    },
    riskLevel: "ai_cost",
    defaultPolicy: CONFIRM_AI_POLICY,
    supportsDryRun: false,
    notes: [
      "This workflow edits in-memory report blocks; it does not require Sheet access in server-demo.ts.",
      "src/jobs/client-reports-edit-job.ts validates command, currentBlocks, and context.",
    ],
  },
  {
    id: "meta-tags",
    title: "Meta Tags Studio",
    description: "Create meta titles, descriptions, H1, and Open Graph rows from manual pages, Sheets, or Drive folders.",
    mode: "meta-tags",
    category: "seo",
    status: "ready",
    sourceFiles: [
      "public/meta-tags.html",
      "public/meta-tags.js",
      "public/assistant-tools.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/meta-tags-job.ts",
    ],
    requiredFields: [
      { key: "sourceType", label: "Source type", type: "enum", values: ["manual", "sheet", "folder"], defaultValue: "manual" },
      { key: "pageList", label: "Pages", type: "string" },
    ],
    optionalFields: [
      { key: "spreadsheetId", label: "Spreadsheet ID or URL", type: "string" },
      { key: "folderId", label: "Drive folder ID or URL", type: "string" },
      { key: "language", label: "Primary language", type: "string" },
      { key: "languages", label: "Languages", type: "array" },
      { key: "generationMode", label: "Generation mode", type: "enum", values: ["template", "ai"], defaultValue: "template" },
      { key: "outputMode", label: "Output mode", type: "string", defaultValue: "preview" },
      { key: "outputTabName", label: "Output tab", type: "string", defaultValue: "Meta Tags" },
      { key: "outputStartCell", label: "Output start cell", type: "string" },
      { key: "existingValuePolicy", label: "Existing value policy", type: "enum", values: ["skip", "overwrite"], defaultValue: "skip" },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: {
      mode: "meta-tags -> MODE",
      payload: "DYNAMIC_PAYLOAD",
      targetId: "config.spreadsheetId || config.folderId || ''",
      inputType: "config.sourceType || 'manual'",
      langs: "config.language || ''",
    },
    riskLevel: "writes_to_sheet",
    defaultPolicy: CONFIRM_DRY_RUN_POLICY,
    supportsDryRun: true,
    notes: [
      "Preview mode is safe; writing metadata to Sheets requires confirmation.",
      "The assistant UI has extra output-target state that should remain the source of truth until this registry is wired in.",
    ],
  },
  {
    id: "schema-builder",
    title: "Schema Builder",
    description: "Generate FAQPage JSON-LD from a Google Sheet or Drive folder and optionally write it back to a target cell.",
    mode: "schema-builder",
    category: "seo",
    status: "ready",
    sourceFiles: [
      "public/schema-builder.html",
      "public/assistant-tools.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/schema-builder-job.ts",
    ],
    requiredFields: [
      { key: "sourceType", label: "Source type", type: "enum", values: ["sheet", "folder"], defaultValue: "sheet" },
      { key: "targetId", label: "Source Sheet or Drive folder", type: "string" },
    ],
    optionalFields: [
      { key: "tabName", label: "FAQ tab", type: "string", defaultValue: "Sheet1" },
      { key: "questionColumn", label: "Question column", type: "string", defaultValue: "B" },
      { key: "answerColumn", label: "Answer column", type: "string", defaultValue: "C" },
      { key: "startRow", label: "Start row", type: "number", defaultValue: 2 },
      { key: "maxRows", label: "Max rows", type: "number", defaultValue: 500 },
      { key: "outputCell", label: "Output cell", type: "string", defaultValue: "E73" },
      { key: "previewOnly", label: "Preview only", type: "boolean", defaultValue: true },
      { key: "dryRun", label: "Dry run", type: "boolean", defaultValue: true },
      { key: "existingValuePolicy", label: "Existing value policy", type: "enum", values: ["skip", "overwrite"], defaultValue: "skip" },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: FULL_DYNAMIC_ENV_FALLBACK,
    riskLevel: "writes_to_sheet",
    defaultPolicy: CONFIRM_DRY_RUN_POLICY,
    supportsDryRun: true,
    notes: [
      "Preview runs should be allowed before writes.",
      "Writing JSON-LD back to Sheets requires confirmation and existingValuePolicy handling.",
    ],
  },
  {
    id: "site-ai-audit",
    title: "AI Site Audit Crawler",
    description: "Crawl a website and audit sitemap, llms.txt, FAQ, schema, answerability, metadata, links, and optional AI summary.",
    mode: "site-ai-audit",
    category: "audits",
    status: "ready",
    sourceFiles: [
      "public/site-ai-audit.html",
      "public/site-ai-audit-v2.html",
      "public/assistant-tools.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/site-ai-audit-crawler.ts",
      "src/jobs/subjobs/site-ai-audit-ai-analysis.ts",
    ],
    requiredFields: [
      { key: "startUrl", label: "Start URL", type: "url" },
    ],
    optionalFields: [
      { key: "maxPages", label: "Max pages", type: "number", defaultValue: 25 },
      { key: "maxDepth", label: "Max depth", type: "number", defaultValue: 2 },
      { key: "renderMode", label: "Render mode", type: "enum", values: ["static", "rendered"], defaultValue: "static" },
      { key: "auditFocus", label: "Audit focus", type: "string" },
      { key: "includeSitemap", label: "Check sitemap", type: "boolean" },
      { key: "includeLlmsTxt", label: "Check llms.txt", type: "boolean" },
      { key: "includeFaqAudit", label: "Check FAQ", type: "boolean" },
      { key: "includeStructuredData", label: "Check structured data", type: "boolean" },
      { key: "includeAnswerability", label: "Check AI answerability", type: "boolean" },
      { key: "includeMetaAudit", label: "Check metadata", type: "boolean" },
      { key: "includeLinkAudit", label: "Check links and trust", type: "boolean" },
      { key: "includeAiAnalysis", label: "Include AI analysis", type: "boolean", defaultValue: false },
      { key: "writeGoogleSheet", label: "Write Google Sheet", type: "boolean", defaultValue: false },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: FULL_DYNAMIC_ENV_FALLBACK,
    riskLevel: "external_crawl",
    defaultPolicy: CONFIRM_AI_POLICY,
    supportsDryRun: true,
    notes: [
      "The assistant chat collects additional questions before run: page budget, render mode, AI summary, and checks.",
      "includeAiAnalysis spends AI calls; writeGoogleSheet creates a Google Sheet report.",
    ],
  },
  {
    id: "site-ai-discovery",
    title: "Site AI Discovery",
    description: "Discover and group candidate URLs before a deeper site or FAQ audit.",
    mode: "site-ai-discovery",
    category: "internal",
    status: "internal",
    sourceFiles: [
      "public/site-ai-audit-v2.html",
      "public/site-ai-faq-audit.html",
      "public/assistant-workspace.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/site-ai-audit-discovery.ts",
    ],
    requiredFields: [
      { key: "startUrl", label: "Start URL", type: "url" },
    ],
    optionalFields: [
      { key: "maxUrls", label: "Max URLs", type: "number", defaultValue: 1000 },
      { key: "maxDepth", label: "Max depth", type: "number", defaultValue: 3 },
      { key: "maxFaqCandidateChecks", label: "Max FAQ candidate checks", type: "number" },
      { key: "faqCandidateConcurrency", label: "FAQ candidate concurrency", type: "number", defaultValue: 12 },
      { key: "fetchTimeoutMs", label: "Fetch timeout", type: "number", defaultValue: 5000 },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: FULL_DYNAMIC_ENV_FALLBACK,
    riskLevel: "external_crawl",
    defaultPolicy: {
      ...CONFIRM_AI_POLICY,
      allowDirectRunFromAssistant: false,
      preferWorkspace: true,
    },
    supportsDryRun: true,
    notes: [
      "This is a supporting workflow used by site audit and FAQ audit UIs.",
      "Keep it internal until an external tool has a clear reason to call discovery directly.",
    ],
  },
  {
    id: "site-ai-faq-audit",
    title: "AI FAQ Audit",
    description: "Audit visible FAQ, FAQPage JSON-LD, and optional source comparison for website pages.",
    mode: "site-ai-faq-audit",
    category: "audits",
    status: "ready",
    sourceFiles: [
      "public/site-ai-faq-audit.html",
      "public/assistant-tools.js",
      "public/assistant-workspace.js",
      "src/server-demo.ts",
      "src/index.ts",
      "src/jobs/site-ai-faq-audit.ts",
    ],
    requiredFields: [
      { key: "startUrl", label: "Start URL", type: "url" },
    ],
    optionalFields: [
      { key: "urls", label: "Explicit URLs", type: "array" },
      { key: "groups", label: "Mapped groups", type: "array" },
      { key: "urlIncludes", label: "URL include filters", type: "array" },
      { key: "sourceInput", label: "Source Sheet or folder", type: "url" },
      { key: "sourceTabName", label: "Source tab", type: "string" },
      { key: "sourceHeaderRow", label: "Source header row", type: "number", defaultValue: 0 },
      { key: "maxPages", label: "Max pages", type: "number", defaultValue: 50 },
      { key: "maxDiscoveryUrls", label: "Max discovery URLs", type: "number", defaultValue: 1000 },
      { key: "renderMode", label: "Render mode", type: "enum", values: ["static", "rendered"], defaultValue: "rendered" },
    ],
    payloadStrategy: "full_dynamic_payload",
    dynamicEnv: FULL_DYNAMIC_ENV_FALLBACK,
    riskLevel: "creates_google_file",
    defaultPolicy: CONFIRM_AI_POLICY,
    supportsDryRun: true,
    notes: [
      "The FAQ audit UI can run site-ai-discovery first, then run selected groups or URLs.",
      "The audit can create a Google Sheet report.",
    ],
  },
] as const satisfies readonly WorkflowDefinition[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value === null || value === undefined) return false;
  return true;
}

export function getWorkflowById(id: string): WorkflowDefinition | undefined {
  return WORKFLOW_REGISTRY.find((workflow) => workflow.id === id);
}

export function listWorkflows(): readonly WorkflowDefinition[] {
  return WORKFLOW_REGISTRY;
}

export function listRunnableWorkflows(): readonly WorkflowDefinition[] {
  return WORKFLOW_REGISTRY.filter((workflow) => (
    workflow.status !== "needs_review" &&
    workflow.defaultPolicy.allowRunFromDemo
  ));
}

export function validateWorkflowPayload(
  workflowId: string,
  payload: unknown
): WorkflowPayloadValidation {
  const workflow = getWorkflowById(workflowId);

  if (!workflow) {
    return {
      workflowId,
      valid: false,
      status: "missing_workflow",
      missingFields: [],
      missingFieldGroups: [],
      warnings: [],
      errors: [`Unknown workflow: ${workflowId}`],
    };
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  if (workflow.status === "needs_review") {
    warnings.push("Workflow is marked needs_review and should not be exposed or run without a manual contract review.");
  }

  if (!isRecord(payload)) {
    return {
      workflowId,
      valid: false,
      status: workflow.status,
      missingFields: workflow.requiredFields.map((field) => field.key),
      missingFieldGroups: (workflow.requiredOneOf || []).map((group) => group.message),
      warnings,
      errors: ["Payload must be an object."],
    };
  }

  const missingFields = workflow.requiredFields
    .filter((field) => !hasValue(payload[field.key]))
    .map((field) => field.key);

  const missingFieldGroups = (workflow.requiredOneOf || [])
    .filter((group) => !group.keys.some((key) => hasValue(payload[key])))
    .map((group) => group.message);

  return {
    workflowId,
    valid: errors.length === 0 && missingFields.length === 0 && missingFieldGroups.length === 0 && workflow.status !== "needs_review",
    status: workflow.status,
    missingFields,
    missingFieldGroups,
    warnings,
    errors,
  };
}
