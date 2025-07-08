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

// ממשק למשימה בודדת
interface Task {
  id: number;
  prompt: string;
  model?: string;
  response?: string;
}

export class AIAgent {
  private tasks: Task[] = [];
  private taskCounter = 0;
  private openai: OpenAI; // 🔧 העברתי לכאן

  constructor(private safety: SafetyManager) {
    // 🔧 יוצר את OpenAI client כאן, אחרי שה-.env נטען
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  addTask(prompt: string, model: string = "o1"): void {
    if (!this.safety.canAddTask(this.tasks.length)) return;

    this.taskCounter++;
    this.tasks.push({
      id: this.taskCounter,
      prompt,
      model
    });

    console.log(
      chalk.green(
        `➕ Task ${this.taskCounter} [${model}]: ${prompt.slice(0, 50)}...`
      )
    );
  }

  async executeTask(task: Task): Promise<string> {
  if (!this.safety.canMakeCall()) throw new Error("Safety limit exceeded");

  const limits  = this.safety.getLimits();
  const status  = this.safety.getStatus();
  const spinner = ora(`🤔 Task ${task.id} (${status.calls + 1}/${status.maxCalls})`).start();

  try {
    const isOseries = task.model?.startsWith("o");   // o1 / o3 / o4-mini
    const completion = isOseries
      ? await this.openai.responses.create({
          model: task.model!,                         // o1 / o3-mini …
          input: [{ role: "user", content: task.prompt }],
          store: false
        })
      : await this.openai.chat.completions.create({
          model: task.model ?? "gpt-4o",
          messages: [{ role: "user", content: task.prompt }],
          max_tokens: limits.maxTokens,
          temperature: 0.7,
        });

    const responseText = isOseries
      ? (completion as any).output_text             // responses API
      : (completion as any).choices[0].message.content;

    const tokens = isOseries
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
}