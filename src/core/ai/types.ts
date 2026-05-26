// src/core/ai/types.ts

export type AIProvider = "openai" | "anthropic";

export type AIModelRequest = {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens: number;
};

export type AIModelResponse = {
  text: string;
  tokens: number;
};