import "server-only";
import { AppError } from "../errors";
import type { AIConfig } from "./config";
import { SYSTEM_INSTRUCTIONS, outputSchema, type PromptInput } from "./prompt";
interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
}
interface OpenAIResponse {
  status?: string;
  output?: { content?: { type: string; text?: string }[] }[];
}
export async function requestDraft(
  config: AIConfig,
  input: PromptInput,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!config.apiKey)
    throw new AppError(
      503,
      "AI is not configured. Add the provider API key on the server.",
    );
  const gemini = config.provider === "gemini",
    schema = outputSchema(input.questions.length);
  const url = gemini
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`
    : "https://api.openai.com/v1/responses";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (gemini) headers["x-goog-api-key"] = config.apiKey;
  else headers.Authorization = `Bearer ${config.apiKey}`;
  const body = gemini
    ? {
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          maxOutputTokens: 4_000,
        },
      }
    : {
        model: config.model,
        store: false,
        instructions: SYSTEM_INSTRUCTIONS,
        input: JSON.stringify(input),
        max_output_tokens: 4_000,
        text: {
          format: {
            type: "json_schema",
            name: "proposal_draft",
            strict: true,
            schema,
          },
        },
      };
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new AppError(502, "The AI service did not respond. Try again.");
  }
  if (!response.ok)
    throw new AppError(
      502,
      [401, 403].includes(response.status)
        ? "The AI provider rejected this key or its permissions."
        : response.status === 429
          ? "AI quota or rate limit reached. Check the provider account."
          : response.status === 404
            ? "The configured AI model is not available."
            : "The AI service could not complete the draft.",
    );
  try {
    let text: string;
    if (gemini) {
      const result = (await response.json()) as GeminiResponse,
        candidate = result.candidates?.[0];
      if (candidate?.finishReason !== "STOP") throw new Error("Incomplete");
      text = (candidate.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("");
    } else {
      const result = (await response.json()) as OpenAIResponse;
      if (result.status !== "completed") throw new Error("Incomplete");
      text = (result.output ?? [])
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("");
    }
    return JSON.parse(text);
  } catch {
    throw new AppError(
      502,
      "AI returned an incomplete or invalid result. No new draft was imported.",
    );
  }
}
