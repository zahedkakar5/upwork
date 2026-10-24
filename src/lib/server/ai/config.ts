import "server-only";
import type { AIProvider } from "../../types";
export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string | undefined;
}
export function getAIConfig(): AIConfig {
  return process.env.AI_PROVIDER === "openai"
    ? {
        provider: "openai",
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        apiKey: process.env.OPENAI_API_KEY,
      }
    : {
        provider: "gemini",
        model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        apiKey: process.env.GEMINI_API_KEY,
      };
}
