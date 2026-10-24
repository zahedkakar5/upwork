import { describe, expect, it, vi } from "vitest";
import { generateDraft, validateDraft } from "../src/lib/server/ai/drafting";
import {
  normalizeProfile,
  type ProfileStore,
} from "../src/lib/server/profile-store";
import { draftRequestSchema } from "../src/lib/schemas";
import type { AIConfig } from "../src/lib/server/ai/config";
const draft = {
  proposal_body: "A tailored proposal for the client’s project.",
  screening_answers: [],
  unsupported_claims: [],
  missing_information: [],
};
const profile = normalizeProfile({
  companyName: "NordStone",
  memberName: "Jags",
  about: "We provide accessibility reviews for storefronts.",
});
const input = () =>
  draftRequestSchema.parse({
    title: "Shopify accessibility review",
    summary: "Review keyboard navigation.",
    questions: [],
    profileVersion: profile.version,
    generateRequested: true,
  });
const store = (): ProfileStore => ({
  load: vi.fn(async () => profile),
  save: vi.fn(),
});
const gemini: AIConfig = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKey: "synthetic-test-key",
};
function mockProvider(result = draft, finish = "STOP") {
  return vi.fn<typeof fetch>(async () =>
    Response.json({
      candidates: [
        {
          finishReason: finish,
          content: {
            parts: [
              { thought: true, text: "Do not expose internal thoughts" },
              { text: JSON.stringify(result) },
            ],
          },
        },
      ],
    }),
  );
}
describe("AI proposal drafting", () => {
  it("uses canonical saved company data and Gemini native authentication", async () => {
    const fetcher = mockProvider();
    const result = await generateDraft(input(), store(), gemini, fetcher);
    expect(result.profileVersion).toBe(profile.version);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(options?.headers).toMatchObject({
      "x-goog-api-key": "synthetic-test-key",
    });
    const body = JSON.parse(options?.body as string),
      context = JSON.parse(body.contents[0].parts[0].text);
    expect(context.company_profile.about).toBe(profile.about);
    expect(context.evidence_library).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(
      body.generationConfig.responseJsonSchema.properties.evidence_ids,
    ).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("synthetic-test-key");
  });
  it("blocks stale profiles and client restrictions before making AI requests", async () => {
    const fetcher = mockProvider();
    for (const request of [
      { ...input(), profileVersion: "outdated" },
      { ...input(), noAI: true },
      { ...input(), noAgency: true },
    ])
      await expect(
        generateDraft(request, store(), gemini, fetcher),
      ).rejects.toHaveProperty("status");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a result if the company profile changes during generation", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ ...profile, version: "changed" });
    await expect(
      generateDraft(input(), { load, save: vi.fn() }, gemini, mockProvider()),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects incomplete model output and malformed screening answers", async () => {
    await expect(
      generateDraft(
        input(),
        store(),
        gemini,
        mockProvider(draft, "MAX_TOKENS"),
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(() => validateDraft(draft, ["Question"])).toThrow();
    expect(() =>
      validateDraft(
        {
          ...draft,
          screening_answers: [{ question_id: "q2", answer_or_null: "wrong" }],
        },
        ["Question"],
      ),
    ).toThrow();
  });
  it("keeps unknown screening facts explicit", () => {
    const result = validateDraft(
      {
        ...draft,
        screening_answers: [{ question_id: "q1", answer_or_null: null }],
      },
      ["Question"],
    );
    expect(result.missing_information).toHaveLength(1);
    expect(result.screening_answers[0].answer_or_null).toBeNull();
  });
  it("does not send a request without an API key", async () => {
    const fetcher = mockProvider();
    await expect(
      generateDraft(
        input(),
        store(),
        { ...gemini, apiKey: undefined },
        fetcher,
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves the OpenAI adapter and store=false setting", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        status: "completed",
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(draft) }] },
        ],
      }),
    );
    await generateDraft(
      input(),
      store(),
      { provider: "openai", model: "gpt-5.4-mini", apiKey: "test-only" },
      fetcher,
    );
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(JSON.parse(options?.body as string).store).toBe(false);
  });
});
