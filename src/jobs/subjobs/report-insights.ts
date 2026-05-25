// src/jobs/subjobs/report-insights.ts
// Code in English. Comments can be Hebrew.

import { AIAgent } from "../../core/agent.js";
import {
  type BreakdownRow,
  type ComparisonResult,
  type ReportMetricKey,
  type ReportTotals,
} from "./report-calculations.js";

export type ReportInsightInput = {
  reportType: string;
  primaryMetric: ReportMetricKey;
  breakdown: string;
  totals: ReportTotals;
  comparison: ComparisonResult[];
  topBreakdownRows: BreakdownRow[];
  anomalies: string[];
  reportBrief?: string;
};

export type ReportInsightOutput = {
  summary: string;
  recommendations: string[];
};

export type InsightBlockKind = "summary" | "recommendation" | "observation" | "custom";

export type InsightBlockSource = "ai" | "manual";

export type InsightBlock = {
  id: string;
  kind: InsightBlockKind;
  title?: string;
  content: string;
  source: InsightBlockSource;
  pinned?: boolean;
  order: number;
};

export type ReportInsightBlocksInput = ReportInsightInput & {
  preservedBlocks?: InsightBlock[];
};

export type ReportInsightBlocksOutput = {
  blocks: InsightBlock[];
};

export type InsightEditCommand =
  | { type: "rephrase"; blockId: string }
  | { type: "shorten"; blockId: string }
  | { type: "expand"; blockId: string }
  | { type: "translate-he"; blockId: string }
  | { type: "translate-en"; blockId: string }
  | { type: "custom-prompt"; prompt: string; targetBlockId?: string };

export type InsightEditContext = {
  reportType: string;
  primaryMetric: ReportMetricKey;
  breakdown: string;
  totals: ReportTotals;
  comparison: ComparisonResult[];
  topBreakdownRows: BreakdownRow[];
};

export type InsightEditInput = {
  command: InsightEditCommand;
  currentBlocks: InsightBlock[];
  context: InsightEditContext;
};

export type InsightEditOutput = {
  updatedBlock: InsightBlock;
  action: "replace" | "append";
};

// === Backward-compatible simple insights ===

export function buildDeterministicInsights(input: ReportInsightInput): ReportInsightOutput {
  const blocks = buildDeterministicInsightBlocks(input).blocks;

  const summary = blocks.find((block) => block.kind === "summary")?.content || "";
  const recommendations = blocks
    .filter((block) => block.kind === "recommendation")
    .sort((a, b) => a.order - b.order)
    .map((block) => block.content)
    .slice(0, 5);

  return {
    summary,
    recommendations,
  };
}

export async function generateAiInsights(
  agent: AIAgent,
  input: ReportInsightInput
): Promise<ReportInsightOutput> {
  const result = await generateAiInsightBlocks(agent, input);

  const summary = result.blocks.find((block) => block.kind === "summary")?.content || "";
  const recommendations = result.blocks
    .filter((block) => block.kind === "recommendation")
    .sort((a, b) => a.order - b.order)
    .map((block) => block.content)
    .slice(0, 6);

  return {
    summary,
    recommendations,
  };
}

// === Structured insight blocks ===

export function buildDeterministicInsightBlocks(
  input: ReportInsightBlocksInput
): ReportInsightBlocksOutput {
  const blocks: InsightBlock[] = [];
  const top = input.topBreakdownRows[0];

  const summaryParts = [
    `The report includes ${input.topBreakdownRows.length} breakdown segments.`,
    top ? `${top.label} is the strongest segment by ${input.primaryMetric}.` : "",
    input.totals.spend > 0 ? `Total spend is ${input.totals.spend}.` : "",
    input.totals.revenue > 0 ? `Total revenue is ${input.totals.revenue}.` : "",
    input.totals.conversions > 0 ? `Total conversions are ${input.totals.conversions}.` : "",
  ].filter(Boolean);

  blocks.push({
    id: "summary",
    kind: "summary",
    content: summaryParts.join(" "),
    source: "ai",
    order: 0,
  });

  const recommendations: string[] = [];

  if (input.totals.spend > 0 && input.totals.roas > 0) {
    if (input.totals.roas >= 4) {
      recommendations.push("Consider scaling budget gradually on the strongest segments while monitoring CPA and ROAS.");
    } else if (input.totals.roas < 2) {
      recommendations.push("Review budget allocation before scaling because ROAS is currently limited.");
    }
  }

  if (input.totals.ctr > 0 && input.totals.ctr < 1) {
    recommendations.push("Review creatives, ad copy, and targeting because CTR is below a healthy starting point.");
  }

  if (input.totals.cpa > 0) {
    recommendations.push("Prioritize optimization on high-spend segments with weak CPA before increasing total budget.");
  }

  if (top) {
    recommendations.push(`Use ${top.label} as the first segment to review because it leads the selected breakdown.`);
  }

  const dedupedRecommendations = Array.from(new Set(recommendations)).slice(0, 5);
  const observations = input.anomalies.slice(0, 3);

  dedupedRecommendations.forEach((content, index) => {
    blocks.push({
      id: `rec-${index + 1}`,
      kind: "recommendation",
      content,
      source: "ai",
      order: index + 1,
    });
  });

  observations.forEach((content, index) => {
    blocks.push({
      id: `obs-${index + 1}`,
      kind: "observation",
      content,
      source: "ai",
      order: dedupedRecommendations.length + index + 1,
    });
  });

  return {
    blocks: mergePreservedBlocks(blocks, input.preservedBlocks),
  };
}

export async function generateAiInsightBlocks(
  agent: AIAgent,
  input: ReportInsightBlocksInput
): Promise<ReportInsightBlocksOutput> {
  const fallback = buildDeterministicInsightBlocks(input);

  const system = [
    "You are a senior performance marketing analyst.",
    "Write client-facing insights in clear, professional English.",
    "Do not invent data.",
    "Use only the JSON provided by the user.",
    "Return strict JSON only.",
  ].join("\n");

  const user = `
Create a short client-facing report with structured insight blocks.

Rules:
- Return only valid JSON.
- JSON shape:
{
  "summary": "string, 2-4 sentences",
  "recommendations": ["string", "string", "string"],
  "observations": ["string"]
}
- Keep recommendations specific and action-oriented.
- Observations should describe notable patterns or anomalies. Use 0-3 items.
- If reportBrief is provided, use it to decide what to emphasize, but do not invent data outside the JSON.
- Do not mention missing data unless it materially affects interpretation.
- Do not use em dashes.

DATA:
${JSON.stringify(stripPreservedFromInput(input), null, 2)}
`.trim();

  try {
    agent.clearTasks();
    agent.addTaskWithSystem(user, system, "gpt-4o");
    await agent.executeChain();

    const raw = agent.getLastResult() || "";
    const jsonText = extractJson(raw);
    const parsed = JSON.parse(jsonText);

    const blocks: InsightBlock[] = [];

    blocks.push({
      id: "summary",
      kind: "summary",
      content: String(parsed.summary || fallback.blocks[0]?.content || "").trim(),
      source: "ai",
      order: 0,
    });

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 6)
      : [];

    recommendations.forEach((content: string, index: number) => {
      blocks.push({
        id: `rec-${index + 1}`,
        kind: "recommendation",
        content,
        source: "ai",
        order: index + 1,
      });
    });

    const observations = Array.isArray(parsed.observations)
      ? parsed.observations.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 3)
      : [];

    observations.forEach((content: string, index: number) => {
      blocks.push({
        id: `obs-${index + 1}`,
        kind: "observation",
        content,
        source: "ai",
        order: recommendations.length + index + 1,
      });
    });

    return {
      blocks: mergePreservedBlocks(blocks, input.preservedBlocks),
    };
  } catch (err) {
    console.warn("AI insight blocks failed. Using deterministic fallback.", err);
    return fallback;
  }
}

// === Insight editing ===

export async function executeInsightEdit(
  agent: AIAgent,
  input: InsightEditInput
): Promise<InsightEditOutput> {
  const { command, currentBlocks, context } = input;

  if (command.type === "custom-prompt") {
    return executeCustomPrompt(agent, command, currentBlocks, context);
  }

  const targetBlock = currentBlocks.find((block) => block.id === command.blockId);

  if (!targetBlock) {
    throw new Error(`insight-edit: block with id "${command.blockId}" not found.`);
  }

  const newContent = await runEditCommand(agent, command, targetBlock, context);

  return {
    updatedBlock: {
      ...targetBlock,
      content: newContent,
      source: "manual",
    },
    action: "replace",
  };
}

async function runEditCommand(
  agent: AIAgent,
  command: Exclude<InsightEditCommand, { type: "custom-prompt" }>,
  block: InsightBlock,
  context: InsightEditContext
): Promise<string> {
  const instruction = buildInstructionForCommand(command);

  const system = [
    "You are a senior performance marketing analyst.",
    "You edit a single insight in a client-facing report.",
    "Do not invent data.",
    "Use only the JSON context provided.",
    "Return only the rewritten text - no JSON, no quotes, no preamble.",
    "Do not use em dashes.",
  ].join("\n");

  const user = `
${instruction}

ORIGINAL TEXT:
${block.content}

CONTEXT:
${JSON.stringify(context, null, 2)}
`.trim();

  try {
    agent.clearTasks();
    agent.addTaskWithSystem(user, system, "gpt-4o");
    await agent.executeChain();

    const raw = (agent.getLastResult() || "").trim();
    return cleanContent(raw) || block.content;
  } catch (err) {
    console.warn(`insight-edit: AI edit "${command.type}" failed. Returning original.`, err);
    return block.content;
  }
}

async function executeCustomPrompt(
  agent: AIAgent,
  command: Extract<InsightEditCommand, { type: "custom-prompt" }>,
  currentBlocks: InsightBlock[],
  context: InsightEditContext
): Promise<InsightEditOutput> {
  const targetBlock = command.targetBlockId
    ? currentBlocks.find((block) => block.id === command.targetBlockId)
    : null;

  const system = [
    "You are a senior performance marketing analyst.",
    "You write a single insight for a client-facing report based on user instructions.",
    "Do not invent data.",
    "Use only the JSON context provided.",
    "Return only the insight text - no JSON, no quotes, no preamble.",
    "Keep it to 1-3 sentences unless the user explicitly asks otherwise.",
    "Do not use em dashes.",
  ].join("\n");

  const userParts = [
    `USER INSTRUCTION:\n${command.prompt}`,
    targetBlock ? `\nORIGINAL TEXT TO REPLACE:\n${targetBlock.content}` : "",
    `\nCONTEXT:\n${JSON.stringify(context, null, 2)}`,
  ];

  const user = userParts.filter(Boolean).join("\n");

  let content = "";

  try {
    agent.clearTasks();
    agent.addTaskWithSystem(user, system, "gpt-4o");
    await agent.executeChain();

    content = cleanContent((agent.getLastResult() || "").trim());
  } catch (err) {
    console.warn("insight-edit: custom prompt failed.", err);
    content = targetBlock?.content || "Custom insight could not be generated.";
  }

  if (targetBlock) {
    return {
      updatedBlock: {
        ...targetBlock,
        content,
        source: "manual",
      },
      action: "replace",
    };
  }

  const maxOrder = currentBlocks.reduce((acc, block) => Math.max(acc, block.order), 0);

  return {
    updatedBlock: {
      id: generateCustomBlockId(currentBlocks),
      kind: "custom",
      title: deriveTitleFromPrompt(command.prompt),
      content,
      source: "manual",
      order: maxOrder + 1,
    },
    action: "append",
  };
}

// === Helpers ===

function mergePreservedBlocks(generated: InsightBlock[], preserved?: InsightBlock[]): InsightBlock[] {
  if (!preserved?.length) {
    return generated;
  }

  const preservedById = new Map<string, InsightBlock>();

  for (const block of preserved) {
    if (block.source === "manual" || block.pinned) {
      preservedById.set(block.id, block);
    }
  }

  if (!preservedById.size) {
    return generated;
  }

  const merged = generated.map((block) => preservedById.get(block.id) || block);
  const usedIds = new Set(merged.map((block) => block.id));

  const baseOrder = merged.length;
  let extraIndex = 0;

  for (const [id, block] of preservedById) {
    if (!usedIds.has(id)) {
      merged.push({
        ...block,
        order: baseOrder + extraIndex,
      });
      extraIndex++;
    }
  }

  return merged;
}

function stripPreservedFromInput(input: ReportInsightBlocksInput): Omit<ReportInsightBlocksInput, "preservedBlocks"> {
  const { preservedBlocks: _omit, ...rest } = input;
  return rest;
}

function buildInstructionForCommand(
  command: Exclude<InsightEditCommand, { type: "custom-prompt" }>
): string {
  switch (command.type) {
    case "rephrase":
      return "Rephrase the insight below in different wording while keeping the same meaning, length, and data points.";

    case "shorten":
      return "Shorten the insight below to a single concise sentence. Keep the most important data point. Do not lose factual content.";

    case "expand":
      return "Expand the insight below into 2-3 sentences. Add useful interpretation grounded in the context, but do not invent numbers.";

    case "translate-he":
      return "Translate the insight below into natural, professional Hebrew. Keep numbers and metric names as they are.";

    case "translate-en":
      return "Translate the insight below into natural, professional English. Keep numbers and metric names as they are.";

    default: {
      const _never: never = command;
      throw new Error(`Unknown edit command: ${JSON.stringify(_never)}`);
    }
  }
}

function extractJson(input: string): string {
  const text = String(input ?? "").trim();

  if (text.startsWith("{") && text.endsWith("}")) {
    return text;
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in AI response.");
  }

  return match[0];
}

function cleanContent(raw: string): string {
  let text = raw.trim();

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  }

  return text;
}

function generateCustomBlockId(currentBlocks: InsightBlock[]): string {
  const customCount = currentBlocks.filter((block) => block.id.startsWith("custom-")).length;
  return `custom-${customCount + 1}`;
}

function deriveTitleFromPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 60 ? `${words.slice(0, 60)}...` : words;
}
