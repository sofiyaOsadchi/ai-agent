// src/jobs/client-reports-edit-job.ts
// Code in English. Comments can be Hebrew.

import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import {
  executeInsightEdit,
  type InsightEditCommand,
  type InsightEditContext,
  type InsightEditOutput,
  type InsightBlock,
} from "./subjobs/report-insights.js";

export type ClientReportsEditPayload = {
  command: InsightEditCommand;
  currentBlocks: InsightBlock[];
  context: InsightEditContext;
};

export type ClientReportsEditResult = {
  ok: true;
  updatedBlock: InsightBlock;
  action: "replace" | "append";
};

export class ClientReportsEditJob {
  constructor(private agent: AIAgent) {}

  async runFromEnv(): Promise<void> {
    const payload = this.readPayloadFromEnv();
    const result = await this.run(payload);

    // אותו pattern של JSON markers כמו ב-client-reports-job - server-demo
    // יודע לקרוא את התוצאה הזו ולהעביר ל-UI דרך ה-socket.
    console.log("CLIENT_REPORT_EDIT_RESULT_JSON_START");
    console.log(JSON.stringify(result));
    console.log("CLIENT_REPORT_EDIT_RESULT_JSON_END");
  }

  async run(payload: ClientReportsEditPayload): Promise<ClientReportsEditResult> {
    this.validatePayload(payload);

    console.log(chalk.blue("✏️  Starting Client Reports Edit job."));
    console.log(chalk.cyan(`Command type: ${payload.command.type}`));

    if (payload.command.type !== "custom-prompt") {
      console.log(chalk.cyan(`Target block: ${payload.command.blockId}`));
    } else {
      console.log(chalk.cyan(`Custom prompt: ${payload.command.prompt.slice(0, 80)}`));
    }

    const editResult: InsightEditOutput = await executeInsightEdit(this.agent, {
      command: payload.command,
      currentBlocks: payload.currentBlocks,
      context: payload.context,
    });

    console.log(chalk.green(`✅ Edit complete. Action: ${editResult.action}, block: ${editResult.updatedBlock.id}`));

    return {
      ok: true,
      updatedBlock: editResult.updatedBlock,
      action: editResult.action,
    };
  }

  private readPayloadFromEnv(): ClientReportsEditPayload {
    const raw = process.env.DYNAMIC_PAYLOAD || "{}";

    try {
      return JSON.parse(raw) as ClientReportsEditPayload;
    } catch {
      throw new Error("client-reports-edit: DYNAMIC_PAYLOAD is not valid JSON.");
    }
  }

  private validatePayload(payload: ClientReportsEditPayload): void {
    if (!payload.command || !payload.command.type) {
      throw new Error("client-reports-edit: Missing command.");
    }

    if (!Array.isArray(payload.currentBlocks)) {
      throw new Error("client-reports-edit: currentBlocks must be an array.");
    }

    if (!payload.context) {
      throw new Error("client-reports-edit: Missing context.");
    }

    if (payload.command.type === "custom-prompt") {
      if (!payload.command.prompt || !payload.command.prompt.trim()) {
        throw new Error("client-reports-edit: custom-prompt requires a non-empty prompt.");
      }
    } else {
      if (!payload.command.blockId) {
        throw new Error(`client-reports-edit: command "${payload.command.type}" requires blockId.`);
      }
    }
  }
}