import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import type { AIProvider } from "../core/ai/types.js";
import { FaqDemandService, type FaqOpportunity, type FaqDemandPhrase, type FaqDemandResult } from "../services/faq-demand.js";
import { SheetsService } from "../services/sheets.js";
import {
  createDuplicateCheckPrompt,
  createSourceVerifyPrompt,
  createGrammarCheckPrompt,
} from "./faq-from-scratch.js";

/**
 * =========================
 * Types
 * =========================
 */

// PromptBuilder type (legacy builder mode)
export type PromptBuilder = {
  system?: string;
  user?: string;
  sources?: string;
  tone?: string;
};

// Legacy playground config (old mode: hotels + steps + prompts)
export type PlaygroundConfig = {
  hotels: string[];
  steps: { q: boolean; a: boolean; qa: boolean };
  prompts: {
    q: PromptBuilder;
    a: PromptBuilder;
    dup?: string;
    verify?: string;
    grammar?: string;
  };
};

// UI Tasks mode (new UI: subjects + tasks)
export type UiTask = {
  id: number;
  enabled: boolean;
  name?: string;
  system?: string;
  user: string;
  provider?: AIProvider | string;
  model?: string;
  outputMode?: "append_column" | "replace_base_tsv" | string;
};

export type UiTasksConfig = {
  subjects: string[];
  tasks: UiTask[];
  faqDemand?: {
    enabled?: boolean;
    websiteUrl?: string;
    dateRange?: {
      startDate?: string;
      endDate?: string;
    };
    analytics?: {
      enabled?: boolean;
      accountId?: string;
      propertyId?: string;
    };
    searchConsole?: {
      enabled?: boolean;
      siteUrl?: string;
    };
    limit?: number;
    maxPhrases?: number;
    questionsPerPhrase?: number;
  };
};

// Union input for runFaqPlayground
type AnyPlaygroundConfig = PlaygroundConfig | UiTasksConfig | any;

/**
 * =========================
 * Helpers
 * =========================
 */

function replaceVars(text: string, vars: Record<string, string>): string {
  let out = text || "";
  for (const [key, value] of Object.entries(vars)) {
    const safeValue = String(value ?? "").replace(/\$/g, "$$$$");
    const regex = new RegExp(`{{${key}}}|\\$\\{${key}\\}|\\[${key}\\]`, "gi");
    out = out.replace(regex, safeValue);
  }
  return out;
}

// Assemble prompt for legacy builder mode (supports tone + sources + variable replacement)
function assemblePrompt(
  builder: PromptBuilder,
  vars: Record<string, string>
): { system: string; user: string } {
  let system = builder.system || "You are a helpful AI assistant.";
  let user = builder.user || "";

  if (builder.tone) {
    user += `\n\nTONE & STYLE:\n${builder.tone}`;
  }

  if (builder.sources) {
    user += `\n\nAPPROVED SOURCES (Use these strictly):\n${builder.sources}`;
  }

  // Replace variables
  for (const [key, value] of Object.entries(vars)) {
    const safeValue = String(value ?? "").replace(/\$/g, "$$$$");
    const regex = new RegExp(`{{${key}}}|\\$\\{${key}\\}|\\[${key}\\]`, "gi");
    system = system.replace(regex, safeValue);
    user = user.replace(regex, safeValue);
  }

  return { system, user };
}

// Prepare QA prompt: either from UI custom prompt or default generators from faq-from-scratch
function prepareQaPrompt(
  customUserPrompt: string | undefined,
  defaultGenerator: (data: string) => string,
  data: string
): string {
  if (customUserPrompt && customUserPrompt.trim().length > 5) {
    let p = customUserPrompt;

    if (p.includes("{{data}}") || p.includes("[data]")) {
      p = p.replace(/{{data}}|\[data\]/gi, data);
    } else {
      p += `\n\nDATA TO CHECK:\n${data}`;
    }
    return p;
  }

  return defaultGenerator(data);
}

// Parse QA results into a column array
function parseQA(text: string, expectedRows?: number): string[] {
  const raw = String(text || "")
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (raw.length === 0) return [];

  const dataIdx = raw.findIndex((l) => l.toUpperCase() === "DATA");
  let body = dataIdx !== -1 ? raw.slice(dataIdx + 1) : raw;

  if (dataIdx === -1 && raw[0].toUpperCase() === "HEADER") {
    body = raw.slice(2);
  }

  body = body.filter((line) => {
    const upper = line.toUpperCase();
    return upper !== "HEADER" && !/^ROW\s*(\t|\||,|$)/i.test(line);
  });

  if (!expectedRows || expectedRows <= 0) return body;

  const mapped = Array.from({ length: expectedRows }, () => "");
  const sequential: string[] = [];
  let sawNumbered = false;

  for (const line of body) {
    const tabParts = line.split("\t");
    if (tabParts.length >= 2 && /^(?:Q)?\d+$/i.test(tabParts[0].trim())) {
      const idx = Number(tabParts[0].trim().replace(/^Q/i, "")) - 1;
      if (idx >= 0 && idx < expectedRows) {
        mapped[idx] = tabParts.slice(1).join(" ").trim();
        sawNumbered = true;
        continue;
      }
    }

    const match = line.match(/^(?:Q)?(\d+)\s*(?:\||[.:)\]-]|–|—)\s*(.+)$/i);
    if (match) {
      const idx = Number(match[1]) - 1;
      if (idx >= 0 && idx < expectedRows) {
        mapped[idx] = match[2].trim();
        sawNumbered = true;
        continue;
      }
    }

    sequential.push(line);
  }

  if (sawNumbered) return mapped;

  while (sequential.length < expectedRows) sequential.push("");
  return sequential.slice(0, expectedRows);
}

function looksLikeTsv(tsv: string): boolean {
  const text = String(tsv || "").trim();
  if (!text) return false;
  const lines = text.split("\n");
  if (lines.length < 2) return false;
  return lines[0].includes("\t");
}

function padToDataRows(arr: string[], dataRowCount: number): string[] {
  const res = [...arr];
  while (res.length < dataRowCount) res.push("");
  return res.slice(0, dataRowCount);
}

function buildNumberedTsv(tsv: string): string {
  const rows = String(tsv || "")
    .trim()
    .split("\n")
    .map((r) => r.split("\t"));

  if (rows.length === 0 || !rows[0]?.length) return "Row";

  return [
    ["Row", ...rows[0]].join("\t"),
    ...rows.slice(1).map((row, idx) => [String(idx + 1), ...row].join("\t")),
  ].join("\n");
}

function isBaseTsvReplacementTask(task: UiTask | undefined): boolean {
  return task?.outputMode === "replace_base_tsv";
}

function isAiProvider(value: unknown): value is AIProvider {
  return value === "openai" || value === "anthropic";
}

function resolveTaskAi(task: UiTask): { provider?: AIProvider; model: string } {
  const rawProvider = String(task.provider || "").trim().toLowerCase();
  const rawModel = String(task.model || "").trim();
  const encoded = rawModel.match(/^(openai|anthropic):(.+)$/i);

  if (encoded) {
    const provider = encoded[1].toLowerCase();
    const model = encoded[2].trim();
    return {
      provider: isAiProvider(provider) ? provider : undefined,
      model: model || (provider === "anthropic" ? "claude-sonnet-4-6" : "o3"),
    };
  }

  const provider = isAiProvider(rawProvider)
    ? rawProvider
    : /^claude/i.test(rawModel)
    ? "anthropic"
    : undefined;

  return {
    provider,
    model: rawModel || (provider === "anthropic" ? "claude-sonnet-4-6" : "o3"),
  };
}

function sourceDemandPhrases(result: FaqDemandResult): FaqDemandPhrase[] {
  return (Array.isArray(result.phrases) ? result.phrases : [])
    .filter((phrase) => phrase.source !== "starter-intent");
}

function automaticFaqOpportunities(result: FaqDemandResult): FaqOpportunity[] {
  return (Array.isArray(result.opportunities) ? result.opportunities : [])
    .filter((opportunity) =>
      opportunity.strength === "strong"
      && opportunity.risk !== "high"
      && opportunity.verificationStatus !== "needs_verification"
    );
}

function buildAutomaticDemandBrief(result: FaqDemandResult, questionsPerPhrase: number): string {
  const opportunities = automaticFaqOpportunities(result);
  if (!opportunities.length) return "";

  return [
    `SEARCH-DEMAND FAQ BRIEF FOR ${result.subject}`,
    "",
    "Add these scored FAQ opportunities as mandatory candidate questions in the Research questions task. They do not replace factual answer sources.",
    "For final answers, verify facts against official or otherwise approved sources.",
    "Only strong, low-risk, query-supported opportunities are included automatically. Raw source phrases are not used directly in automatic mode.",
    "Use the candidate question itself as the preferred row wording. Keep it close to the source query intent; do not broaden it into nearby amenities, attractions, reviews or sales claims.",
    "Skip a mandatory candidate only if it duplicates another row, violates source rules, or cannot be answered safely from approved sources.",
    "",
    "MANDATORY FAQ OPPORTUNITIES TO INCLUDE:",
    `Create at most ${questionsPerPhrase} row(s) from each opportunity, and merge duplicates across similar topics.`,
    ...opportunities.map((opportunity) => [
      `- ${opportunity.candidateQuestion}`,
      `Topic: ${opportunity.topic}`,
      `Category: ${opportunity.category}`,
      `Evidence: ${opportunity.metrics.impressions} impressions, ${opportunity.metrics.clicks} clicks`,
      opportunity.pages.length ? `Pages: ${opportunity.pages.join(", ")}` : "",
      opportunity.sourceQueries.length ? `Source queries: ${opportunity.sourceQueries.join(", ")}` : "",
      `Verification: ${opportunity.verificationStatus || "query_supported"}`,
      `Reason: ${opportunity.reason}`,
    ].filter(Boolean).join(" | ")),
  ].join("\n");
}

/**
 * =========================
 * UI Mode Runner (subjects + tasks)
 * Keeps your UI intact (5 cards), server adapts to it.
 * Task ids 1-5 are treated as:
 * 1 Questions, 2 Answers, 3 Duplicate, 4 Source, 5 Grammar
 * Variables supported: {{subject}}, {{hotel}}, {{last}}, {{answersTsv}}
 * =========================
 */
async function runFromUiTasks(agent: AIAgent, sheets: SheetsService, cfg: UiTasksConfig) {
  console.log(chalk.magenta("🎡 Starting Creator Studio (UI Tasks Mode)"));

  const subjects = Array.isArray(cfg.subjects)
    ? cfg.subjects.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const tasks = Array.isArray(cfg.tasks) ? [...cfg.tasks] : [];
  tasks.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
  const demandConfig = cfg.faqDemand?.enabled === true ? cfg.faqDemand : null;
  const demandService = demandConfig ? new FaqDemandService() : null;

  if (subjects.length === 0) {
    console.log(chalk.yellow("⚠️ No subjects provided."));
    return;
  }

  for (let i = 0; i < subjects.length; i++) {
    const subject = subjects[i];
    console.log(chalk.blue(`\n🏨 [${i + 1}/${subjects.length}] Processing Subject: ${subject}`));

    let last = "";
    let automaticDemandBrief = "";

    const outputsById = new Map<number, string>();

    if (demandService && tasks.some((task) => task?.enabled === true && task.id === 1)) {
      const questionsPerPhrase = Math.max(1, Math.min(Number(demandConfig?.questionsPerPhrase || 1), 5));

      try {
        console.log(chalk.gray("📈 Loading Analytics/Search Console question inspiration..."));
        const demandResult = await demandService.analyze({
          subject,
          websiteUrl: demandConfig?.websiteUrl,
          dateRange: demandConfig?.dateRange,
          analytics: demandConfig?.analytics,
          searchConsole: demandConfig?.searchConsole,
          limit: demandConfig?.limit || 250,
          maxPhrases: demandConfig?.maxPhrases || 5,
          questionsPerPhrase,
        });
        automaticDemandBrief = buildAutomaticDemandBrief(demandResult, questionsPerPhrase);

        const opportunityCount = automaticFaqOpportunities(demandResult).length;
        const phraseCount = sourceDemandPhrases(demandResult).length;
        if (opportunityCount) {
          console.log(chalk.green(`📈 Added ${opportunityCount} strong FAQ opportunit${opportunityCount === 1 ? "y" : "ies"} for this subject.`));
        } else {
          console.log(chalk.yellow(`⚠️ No strong low-risk FAQ opportunities found from ${phraseCount} source phrase(s). Continuing without automatic demand inspiration.`));
        }

        for (const warning of demandResult.sources?.warnings || []) {
          console.log(chalk.yellow(`⚠️ ${warning}`));
        }
      } catch (error: any) {
        console.log(chalk.yellow(`⚠️ Demand inspiration skipped: ${error?.message || "unknown error"}`));
      }
    }

    for (const t of tasks) {
      // Important: strict boolean check
      if (!t || t.enabled !== true) continue;

      const answersTsv = outputsById.get(2) || "";
      const vars = {
        subject,
        hotel: subject,
        last,
        answersTsv,
        answersTsvNumbered: answersTsv ? buildNumberedTsv(answersTsv) : "",
        baseTsv: answersTsv
      };

      const system = replaceVars(t.system || "", vars).trim();
      let user = replaceVars(t.user || "", vars).trim();
      if (t.id === 1 && automaticDemandBrief && !user.includes("SEARCH-DEMAND FAQ BRIEF")) {
        user += `\n\nSEARCH-DEMAND MANDATORY QUESTIONS:\n${automaticDemandBrief}`;
      }
      const { provider, model } = resolveTaskAi(t);

      console.log(chalk.yellow(`🧩 Running Task #${t.id}${t.name ? `: ${t.name}` : ""} [${provider || "openai"}:${model}]`));

      agent.clearTasks();
      if (system) agent.addTaskWithSystem(user, system, model, provider);
      else agent.addTask(user, model, provider);

      try {
        await agent.executeChain();
      } catch (e) {
        console.error(chalk.red(`❌ Task #${t.id} Failed:`), e);
        break;
      }

      const out = agent.getLastResult() || "";
      last = out;
      outputsById.set(t.id, out);
    }

    // 1) Choose the base TSV output
    const enabledIds = tasks.filter((t) => t?.enabled === true).map((t) => t.id);

    const preferId = 2; // default behavior: task #2 is the TSV
    let baseTaskId: number | null = null;
    let baseTsv = "";

    if (enabledIds.includes(preferId) && looksLikeTsv(outputsById.get(preferId) || "")) {
      baseTaskId = preferId;
      baseTsv = outputsById.get(preferId) || "";
    } else {
      // fallback: last enabled task that looks like TSV
      for (let k = enabledIds.length - 1; k >= 0; k--) {
        const id = enabledIds[k];
        const out = outputsById.get(id) || "";
        if (looksLikeTsv(out)) {
          baseTaskId = id;
          baseTsv = out;
          break;
        }
      }
    }

    if (!baseTaskId || !baseTsv) {
      console.log(chalk.red("⚠️ Skipping export: No TSV output was produced by any enabled task."));
      continue;
    }

    const enabledTasksSorted = tasks
      .filter((t) => t?.enabled === true)
      .slice()
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    for (const t of enabledTasksSorted) {
      if (!t || !isBaseTsvReplacementTask(t) || (t.id ?? 0) <= baseTaskId) continue;

      const polishedTsv = outputsById.get(t.id) || "";
      if (looksLikeTsv(polishedTsv)) {
        baseTsv = polishedTsv;
        console.log(chalk.green(`✨ Task #${t.id} applied polish directly to the final TSV.`));
      } else if (polishedTsv.trim()) {
        console.log(
          chalk.yellow(
            `⚠️ Task #${t.id} was set to polish the final TSV, but did not return TSV. Keeping the original answer table.`
          )
        );
      }
    }

    // Parse base TSV
    const rows = baseTsv.trim().split("\n").map((r) => r.split("\t"));
    if (rows.length < 2) {
      console.log(chalk.red("⚠️ Skipping export: TSV has too few rows."));
      continue;
    }

    const headerRow = rows[0] || [];
    const dataRows = rows.slice(1);
    const dataRowCount = dataRows.length;

    // 2) Build extra columns from tasks AFTER the base TSV task
    const extraCols: Array<{ header: string; values: string[] }> = [];

    const defaultHeader = (id: number) => {
      if (id === 3) return "Duplicate";
      if (id === 4) return "Source OK";
      if (id === 5) return "Grammar Fix";
      return `Task ${id}`;
    };

    for (const t of enabledTasksSorted) {
      if (!t) continue;

      // Only tasks after base TSV are treated as "column appenders"
      if ((t.id ?? 0) <= baseTaskId) continue;
      if (isBaseTsvReplacementTask(t)) continue;

      const out = outputsById.get(t.id) || "";
      if (!out.trim()) continue;

      // If the model returned TSV again, do NOT treat it as a column (it will break the sheet)
      if (looksLikeTsv(out)) {
        console.log(
          chalk.yellow(
            `⚠️ Task #${t.id} returned TSV-like output. Skipping it as an extra column to avoid breaking the table.`
          )
        );
        continue;
      }

      // Extract lines: prefer HEADER/DATA format, otherwise raw lines
      let values = parseQA(out, dataRowCount);
      if (values.length === 0) {
        values = out
          .trim()
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      }

      // Clean tabs to avoid column explosion
      values = values.map((v) => String(v).replace(/\t/g, " ").trim());

      const padded = padToDataRows(values, dataRowCount);

      const colHeader = t.name && t.name.trim() ? t.name.trim() : defaultHeader(t.id);
      extraCols.push({ header: colHeader, values: padded });
    }

    // 3) Combine into final TSV (dynamic number of columns)
    const finalRows: string[][] = [];

    finalRows.push([...headerRow, ...extraCols.map((c) => c.header)]);

    for (let r = 0; r < dataRowCount; r++) {
      finalRows.push([...dataRows[r], ...extraCols.map((c) => c.values[r] ?? "")]);
    }

    const finalTsv = finalRows.map((r) => r.join("\t")).join("\n");

    console.log(chalk.cyan("💾 Creating Spreadsheet..."));

    try {
      const sheetName = subject.trim() || "FAQ";
      const sheetId = await sheets.createSpreadsheet(sheetName);
      await sheets.uploadTsv(sheetId, finalTsv);
      await sheets.formatSheet(sheetId);
      console.log(chalk.green(`🎉 SUCCESS! Sheet created: https://docs.google.com/spreadsheets/d/${sheetId}`));
    } catch (e) {
      console.error(chalk.red("❌ Error uploading to sheets:"), e);
    }
  }
}

/**
 * =========================
 * Legacy Runner (hotels + steps + prompts)
 * This is your existing code, kept as-is with minor safety.
 * =========================
 */
async function runFaqPlaygroundLegacy(agent: AIAgent, sheets: SheetsService, config: PlaygroundConfig) {
  console.log(chalk.magenta("🎡 Starting Creator Studio (Builder Mode)"));

  for (let i = 0; i < config.hotels.length; i++) {
    const hotelName = config.hotels[i];
    console.log(
      chalk.blue(`\n🏨 [${i + 1}/${config.hotels.length}] Processing Subject: ${hotelName}`)
    );

    let step1Output = ""; // Questions
    let step2Output = ""; // Answers

    // STEP 1: Questions
    if (config.steps.q) {
      console.log(chalk.yellow("📝 Step 1: Generating Questions..."));

      const { system, user } = assemblePrompt(config.prompts.q, {
        hotel: hotelName,
        subject: hotelName,
      });

      agent.clearTasks();
      agent.addTaskWithSystem(user, system, "o3");

      try {
        await agent.executeChain();
        step1Output = agent.getLastResult() || "";
      } catch (e) {
        console.error(chalk.red("❌ Step 1 Failed:"), e);
        continue;
      }

      if (!step1Output) {
        console.error(chalk.red("❌ Step 1 Output is empty"));
        continue;
      }
    }

    // STEP 2: Answers
    if (config.steps.a) {
      if (!step1Output && config.steps.q) {
        console.error(chalk.red("⚠️ Skipping Step 2: Missing input from Step 1."));
      } else {
        console.log(chalk.yellow("💬 Step 2: Generating Answers..."));

        const contextText = step1Output || "(No questions generated in Step 1)";

        const contextVars = {
          hotel: hotelName,
          context: contextText,
          questions: contextText,
          subject: hotelName,
        };

        const { system, user } = assemblePrompt(config.prompts.a, contextVars);

        let finalUser = user;
        if (
          step1Output &&
          !user.includes(step1Output) &&
          !user.includes("{{context}}") &&
          !user.includes("{{questions}}")
        ) {
          finalUser += `\n\nINPUT DATA (Questions):\n${step1Output}`;
        }

        agent.clearTasks();
        agent.addTaskWithSystem(finalUser, system, "o3");

        try {
          await agent.executeChain();
          step2Output = agent.getLastResult() || "";
        } catch (e) {
          console.error(chalk.red("❌ Step 2 Failed:"), e);
          continue;
        }
      }
    }

    // STEP 3: QA + Export
    if (config.steps.qa && step2Output) {
      console.log(chalk.yellow("🧪 Step 3: QA & Analysis (3 Sub-tasks)..."));
      const preQaRows = step2Output.trim().split("\n").map((r) => r.split("\t"));
      const preQaDataRowCount = Math.max(0, preQaRows.length - 1);

      // 3.1 Duplicate
      console.log(chalk.gray("   ↳ 3.1 Checking Duplicates..."));
      const dupPrompt = prepareQaPrompt(config.prompts.dup, createDuplicateCheckPrompt, step2Output);
      agent.clearTasks();
      agent.addTask(dupPrompt);
      await agent.executeChain();
      const dupCol = parseQA(agent.getLastResult() || "", preQaDataRowCount);

      // 3.2 Source verify
      console.log(chalk.gray("   ↳ 3.2 Verifying Sources..."));
      const verifyPrompt = prepareQaPrompt(
        config.prompts.verify,
        createSourceVerifyPrompt,
        step2Output
      );
      agent.clearTasks();
      agent.addTask(verifyPrompt);
      await agent.executeChain();
      const verifyCol = parseQA(agent.getLastResult() || "", preQaDataRowCount);

      // 3.3 Grammar
      console.log(chalk.gray("   ↳ 3.3 Checking Grammar..."));
      const grammarPrompt = prepareQaPrompt(
        config.prompts.grammar,
        createGrammarCheckPrompt,
        step2Output
      );
      agent.clearTasks();
      agent.addTask(grammarPrompt);
      await agent.executeChain();
      const grammarCol = parseQA(agent.getLastResult() || "", preQaDataRowCount);

      console.log(chalk.cyan("💾 Creating Spreadsheet..."));

      if (!looksLikeTsv(step2Output)) {
        console.error(
          chalk.red(
            "❌ Output format invalid (not TSV) - Cannot create sheet. Raw output preview:\n" +
              step2Output.slice(0, 200)
          )
        );
        continue;
      }

      const rows = step2Output.trim().split("\n").map((r) => r.split("\t"));
      if (rows.length < 2) {
        console.error(chalk.red("❌ Output has too few rows - Cannot create sheet."));
        continue;
      }

      const dataRowCount = rows.length - 1;

      const dupReady = padToDataRows(dupCol, dataRowCount);
      const verifyReady = padToDataRows(verifyCol, dataRowCount);
      const grammarReady = padToDataRows(grammarCol, dataRowCount);

      const combinedRows = [
        [...(rows[0] || []), "Duplicate", "Source OK", "Grammar Fix"],
        ...rows.slice(1).map((r, idx) => [...r, dupReady[idx], verifyReady[idx], grammarReady[idx]]),
      ];

      const combinedTsv = combinedRows.map((r) => r.join("\t")).join("\n");

      try {
        const sheetName = hotelName.trim() || "FAQ";
        const sheetId = await sheets.createSpreadsheet(sheetName);
        await sheets.uploadTsv(sheetId, combinedTsv);
        await sheets.formatSheet(sheetId);
        console.log(
          chalk.green(`🎉 SUCCESS! Sheet created: https://docs.google.com/spreadsheets/d/${sheetId}`)
        );
      } catch (e) {
        console.error(chalk.red("❌ Error uploading to sheets:"), e);
      }
    } else if (config.steps.qa && !step2Output) {
      console.log(chalk.red("⚠️ Skipping QA: No content generated in Step 2."));
    }
  }
}

/**
 * =========================
 * Public Export
 * Auto-detects which mode to run based on config shape.
 * =========================
 */
export async function runFaqPlayground(agent: AIAgent, sheets: SheetsService, config: AnyPlaygroundConfig) {
  // UI mode: subjects + tasks
  if (Array.isArray(config?.tasks)) {
    const subjects = Array.isArray(config?.subjects)
      ? config.subjects.map((s: any) => String(s).trim()).filter(Boolean)
      : [];

    return runFromUiTasks(agent, sheets, { subjects, tasks: config.tasks, faqDemand: config.faqDemand });
  }

  // Legacy mode: hotels + steps + prompts
  return runFaqPlaygroundLegacy(agent, sheets, config as PlaygroundConfig);
}
