import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
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
  model?: string;
};

export type UiTasksConfig = {
  subjects: string[];
  tasks: UiTask[];
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
function parseQA(text: string): string[] {
  const raw = String(text || "")
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (raw.length === 0) return [];

  const dataIdx = raw.findIndex((l) => l.toUpperCase() === "DATA");
  if (dataIdx !== -1) return raw.slice(dataIdx + 1);

  if (raw[0].toUpperCase() === "HEADER") {
    return raw.slice(2);
  }

  return raw;
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

/**
 * =========================
 * UI Mode Runner (subjects + tasks)
 * Keeps your UI intact (5 cards), server adapts to it.
 * Task ids 1-5 are treated as:
 * 1 Questions, 2 Answers, 3 Duplicate, 4 Source, 5 Grammar
 * Variables supported: {{subject}}, {{hotel}}, {{last}}
 * =========================
 */
async function runFromUiTasks(agent: AIAgent, sheets: SheetsService, cfg: UiTasksConfig) {
  console.log(chalk.magenta("🎡 Starting Creator Studio (UI Tasks Mode)"));

  const subjects = Array.isArray(cfg.subjects)
    ? cfg.subjects.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const tasks = Array.isArray(cfg.tasks) ? [...cfg.tasks] : [];
  tasks.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));

  if (subjects.length === 0) {
    console.log(chalk.yellow("⚠️ No subjects provided."));
    return;
  }

  for (let i = 0; i < subjects.length; i++) {
    const subject = subjects[i];
    console.log(chalk.blue(`\n🏨 [${i + 1}/${subjects.length}] Processing Subject: ${subject}`));

    let last = "";

    const outputsById = new Map<number, string>();

    for (const t of tasks) {
      // Important: strict boolean check
      if (!t || t.enabled !== true) continue;

      const vars = { subject, hotel: subject, last };

      const system = replaceVars(t.system || "", vars).trim();
      const user = replaceVars(t.user || "", vars).trim();
      const model = t.model || "o3";

      console.log(chalk.yellow(`🧩 Running Task #${t.id}${t.name ? `: ${t.name}` : ""}`));

      agent.clearTasks();
      if (system) agent.addTaskWithSystem(user, system, model);
      else agent.addTask(user, model);

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

    const enabledTasksSorted = tasks
      .filter((t) => t?.enabled === true)
      .slice()
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    for (const t of enabledTasksSorted) {
      if (!t) continue;

      // Only tasks after base TSV are treated as "column appenders"
      if ((t.id ?? 0) <= baseTaskId) continue;

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
      let values = parseQA(out);
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
      const safeName = subject.replace(/[^a-zA-Z0-9 ]/g, "");
      const sheetId = await sheets.createSpreadsheet(`Creator: ${safeName}`);
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

      // 3.1 Duplicate
      console.log(chalk.gray("   ↳ 3.1 Checking Duplicates..."));
      const dupPrompt = prepareQaPrompt(config.prompts.dup, createDuplicateCheckPrompt, step2Output);
      agent.clearTasks();
      agent.addTask(dupPrompt);
      await agent.executeChain();
      const dupCol = parseQA(agent.getLastResult() || "");

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
      const verifyCol = parseQA(agent.getLastResult() || "");

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
      const grammarCol = parseQA(agent.getLastResult() || "");

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
        const safeName = hotelName.replace(/[^a-zA-Z0-9 ]/g, "");
        const sheetId = await sheets.createSpreadsheet(`Creator: ${safeName}`);
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

    return runFromUiTasks(agent, sheets, { subjects, tasks: config.tasks });
  }

  // Legacy mode: hotels + steps + prompts
  return runFaqPlaygroundLegacy(agent, sheets, config as PlaygroundConfig);
}
