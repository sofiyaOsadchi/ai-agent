// src/core/ai/anthropic-provider.ts

import Anthropic from "@anthropic-ai/sdk";
import type { AIModelRequest, AIModelResponse } from "./types.js";

export class AnthropicProvider {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY in environment variables");
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async run(request: AIModelRequest): Promise<AIModelResponse> {
    const message = await this.client.messages.create({
      model:
        request.model ||
        process.env.ANTHROPIC_MODEL ||
        "claude-sonnet-4-6",
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const tokens =
      (message.usage?.input_tokens ?? 0) +
      (message.usage?.output_tokens ?? 0);

    return {
      text,
      tokens,
    };
  }
}