// src/core/agent.ts - הסוכן החכם (נקי ומתוקן)
// ===================================================
// תפקיד: המוח של המערכת - מנהל ומבצע משימות AI
// מה הוא עושה:
// 1. מקבל משימות מהמשתמש ושומר אותן
// 2. מתחבר ל-OpenAI API ושולח בקשות
// 3. מבצע שרשרת משימות (כל תשובה מועברת הלאה)
// 4. מנהל הקשר בין משימות (זיכרון)
// 5. מציג תוצאות ומעקב אחר ביצועים
// ===================================================

import OpenAI from "openai";
import chalk from "chalk";
import ora from "ora";
import { SafetyManager } from "../config/safety.js";
import { AnthropicProvider } from "./ai/anthropic-provider.js";
import type { AIProvider } from "./ai/types.js";

// ממשק למשימה בודדת
interface Task {
  id: number;
  prompt: string;
  provider?: AIProvider;
  model?: string;
  response?: string;
  system?: string;
  useWebSearch?: boolean;
  usedWebSearch?: boolean;
  webSearchCallsCount?: number;
}

type TaskRunOptions = {
  useWebSearch?: boolean;
};

type ProviderOrOptions = AIProvider | TaskRunOptions;

export class AIAgent {
  private tasks: Task[] = [];
  private taskCounter = 0;
  private openai: OpenAI; // 🔧 העברתי לכאן
  private anthropicProvider?: AnthropicProvider;

 constructor(private safety: SafetyManager) {
  this.openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  if (process.env.ANTHROPIC_API_KEY) {
    this.anthropicProvider = new AnthropicProvider();
  }
}

private getDefaultProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER;

  if (provider === "anthropic" || provider === "openai") {
    return provider;
  }

  return "openai";
}

private getDefaultModel(provider: AIProvider): string {
  if (process.env.AI_MODEL) {
    return process.env.AI_MODEL;
  }

  return provider === "anthropic" ? "claude-sonnet-4-6" : "o3";
}

private resolveProviderAndOptions(
  providerOrOptions?: ProviderOrOptions,
  options: TaskRunOptions = {}
): { provider?: AIProvider; options: TaskRunOptions } {
  const provider = typeof providerOrOptions === "string" ? providerOrOptions : undefined;
  const optionsFromProviderArg =
    providerOrOptions && typeof providerOrOptions === "object" ? providerOrOptions : {};

  return {
    provider,
    options: {
      ...optionsFromProviderArg,
      ...options,
    },
  };
}

addTask(
  prompt: string,
  model?: string,
  providerOrOptions?: ProviderOrOptions,
  options: TaskRunOptions = {}
): void {
  if (!this.safety.canAddTask(this.tasks.length)) return;

  const resolved = this.resolveProviderAndOptions(providerOrOptions, options);
  const resolvedProvider = resolved.provider ?? this.getDefaultProvider();
  const resolvedModel = model ?? this.getDefaultModel(resolvedProvider);

  this.taskCounter++;
  this.tasks.push({
    id: this.taskCounter,
    prompt,
    model: resolvedModel,
    provider: resolvedProvider,
    useWebSearch: resolved.options.useWebSearch,
  });

  console.log(
    chalk.green(
      `➕ Task ${this.taskCounter} [${resolvedProvider}:${resolvedModel}]: ${prompt.slice(0, 50)}...`
    )
  );
}

 addTaskWithSystem(
  userPrompt: string,
  system?: string,
  model?: string,
  providerOrOptions?: ProviderOrOptions,
  options: TaskRunOptions = {}
): void {
  if (!this.safety.canAddTask(this.tasks.length)) return;

  const resolved = this.resolveProviderAndOptions(providerOrOptions, options);
  const resolvedProvider = resolved.provider ?? this.getDefaultProvider();
  const resolvedModel = model ?? this.getDefaultModel(resolvedProvider);

  this.taskCounter++;
  this.tasks.push({
    id: this.taskCounter,
    prompt: userPrompt,
    model: resolvedModel,
    provider: resolvedProvider,
    system,
    useWebSearch: resolved.options.useWebSearch,
  });

  console.log(
    chalk.green(
      `➕ Task ${this.taskCounter} [${resolvedProvider}:${resolvedModel}] (system+user)`
    )
  );
}

  async executeTask(task: Task): Promise<string> {
  if (!this.safety.canMakeCall()) throw new Error("Safety limit exceeded");

  const limits  = this.safety.getLimits();
  const status  = this.safety.getStatus();
  const spinner = ora(`🤔 Task ${task.id} (${status.calls + 1}/${status.maxCalls})`).start();

  try {

if (task.provider === "anthropic") {

    if (!this.anthropicProvider) {

      throw new Error("Anthropic provider is not configured. Missing ANTHROPIC_API_KEY.");

    }

    if (task.useWebSearch === true) {

      throw new Error("Anthropic provider does not support web search in this agent. Use OpenAI for web-search tasks.");

    }

    const { text, tokens } = await this.anthropicProvider.run({

      prompt: task.prompt,

      system: task.system,

      model: task.model,

      maxTokens: limits.maxTokens,

    });

    task.response = text;

    task.usedWebSearch = false;

    task.webSearchCallsCount = 0;

    this.safety.recordCall(tokens);

    spinner.succeed(chalk.green(`✅ Task ${task.id} (${tokens} tokens)`));

    console.log(chalk.yellow(`📝 ${text.slice(0, 100)}...`));

    return text;

  }

    
const model = task.model ?? "o3";

const shouldUseResponsesApi =
  model.startsWith("o") ||
  model.startsWith("gpt-5");

const responseRequest: any = {
  model,
  input: [
    { role: "user" as const, content: task.prompt },
  ],
  instructions: task.system,
  store: false,
};

if (task.useWebSearch !== false) {
  responseRequest.tools = [{ type: "web_search_preview" as const }];
  responseRequest.tool_choice = "auto";
}

const completion = shouldUseResponsesApi
  ? await this.openai.responses.create(responseRequest)
  : await this.openai.chat.completions.create({
      model,
      messages: [
        ...(task.system ? [{ role: "system" as const, content: task.system }] : []),
        { role: "user" as const, content: task.prompt },
      ],
      max_tokens: limits.maxTokens,
      temperature: 0.7,
    });

    const responseText = shouldUseResponsesApi
  ? (completion as any).output_text
  : (completion as any).choices[0].message.content;

if (shouldUseResponsesApi) {
        const outputItems = Array.isArray((completion as any).output)
        ? (completion as any).output
        : [];

      const webCalls = outputItems.filter((x: any) => x?.type === "web_search_call");
      task.usedWebSearch = webCalls.length > 0;
      task.webSearchCallsCount = webCalls.length;

      const badge = task.usedWebSearch ? "🌐 web_search: YES" : "🌐 web_search: NO";
      console.log(chalk.magenta(`   ${badge} (calls: ${task.webSearchCallsCount})`));
    }

   const tokens = shouldUseResponsesApi

  ? (completion as any).usage.total_tokens ?? 0

  : completion.usage?.total_tokens ?? 0;

    task.response = responseText;
    this.safety.recordCall(tokens);

    spinner.succeed(chalk.green(`✅ Task ${task.id} (${tokens} tokens)`));
    console.log(chalk.yellow(`📝 ${responseText.slice(0, 100)}...`));
    return responseText;
  } catch (err) {
    spinner.fail(chalk.red(`❌ Task ${task.id} failed`));
    console.error(chalk.red("Error:"), err);
    throw err;
  }
}

  async executeChain(): Promise<void> {
    if (this.tasks.length === 0) {
      console.log(chalk.yellow("⚠️ No tasks to execute"));
      return;
    }

    const limits = this.safety.getLimits();
    console.log(chalk.blue(`\n🔄 Executing ${this.tasks.length} tasks...`));
    console.log(chalk.yellow(`⏱️ ~${this.tasks.length * (limits.delay / 1000)}s estimated`));
    console.log(chalk.cyan("🔥 Each task = NEW independent chat with ChatGPT"));

    // ביצוע כל משימה כצ'אט נפרד (ללא הקשר קודם)
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      
      console.log(chalk.blue(`\n📤 Starting task ${task.id} as NEW chat session`));
      
      // כל משימה רצה בנפרד - ללא הקשר
      await this.executeTask(task);

      // השהיה בין משימות
      if (i < this.tasks.length - 1) {
        console.log(chalk.gray(`⏳ ${limits.delay / 1000}s...`));
        await new Promise(resolve => setTimeout(resolve, limits.delay));
      }
    }

    console.log(chalk.green("\n🎉 All tasks completed!"));
    this.safety.showStatus();
  }

  showTasks(): void {
    if (this.tasks.length === 0) {
      console.log(chalk.yellow("📋 No tasks"));
      return;
    }

    console.log(chalk.blue("\n📋 Tasks:"));
    this.tasks.forEach(task => {
      console.log(chalk.white(`${task.id}. ${task.prompt.slice(0, 70)}...`));
      if (task.response) {
        console.log(chalk.gray(`   ↳ ${task.response.slice(0, 70)}...`));
      }
    });

    const limits = this.safety.getLimits();
    console.log(chalk.white(`\n🔢 ${this.tasks.length}/${limits.maxTasks} tasks`));
  }

  clearTasks(): void {
    this.tasks = [];
    this.taskCounter = 0;
    console.log(chalk.yellow("🗑️ Tasks cleared"));
  }

  get hasTasks(): boolean {
    return this.tasks.length > 0;
  }

  getLastResult(): string | null {
    if (this.tasks.length === 0) return null;
    const lastTask = this.tasks[this.tasks.length - 1];
    return lastTask.response || null;
  }

  getTaskResult(taskId: number): string | null {
    const task = this.tasks.find(t => t.id === taskId);
    return task?.response || null;
  }


  async run(
  prompt: string,
  model?: string,
  providerOrOptions?: ProviderOrOptions,
  options: TaskRunOptions = {}
): Promise<string> {
  this.clearTasks();
  this.addTask(prompt, model, providerOrOptions, options);
  await this.executeChain();
  return this.getLastResult() ?? "";
}

async runWithSystem(
  userPrompt: string,
  system?: string,
  model?: string,
  providerOrOptions?: ProviderOrOptions,
  options: TaskRunOptions = {}
): Promise<string> {
  this.clearTasks();
  this.addTaskWithSystem(userPrompt, system, model, providerOrOptions, options);
  await this.executeChain();
  return this.getLastResult() ?? "";
}
}
