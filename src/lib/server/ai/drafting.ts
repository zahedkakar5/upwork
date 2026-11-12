import "server-only";
import { openingKeyword, clientRestrictions } from "../../job-discovery";
import {
  draftResultSchema,
  type DraftRequest,
  type DraftResult,
} from "../../schemas";
import type { ProfileStore } from "../profile-store";
import { AppError } from "../errors";
import { getAIConfig, type AIConfig } from "./config";
import { buildPromptInput } from "./prompt";
import { requestDraft } from "./providers";
export function validateDraft(
  value: unknown,
  questions: string[],
): DraftResult {
  const parsed = draftResultSchema.safeParse(value);
  if (!parsed.success)
    throw new AppError(
      502,
      "AI output did not pass validation. No new draft was imported.",
    );
  const draft = parsed.data;
  if (
    draft.screening_answers.length !== questions.length ||
    draft.screening_answers.some(
      (answer, i) => answer.question_id !== `q${i + 1}`,
    )
  )
    throw new AppError(
      502,
      "AI screening answers did not match the supplied questions.",
    );
  draft.screening_answers.forEach((answer, i) => {
    if (!answer.answer_or_null?.trim()) {
      const note = `Screening answer ${i + 1} needs a fact from your company profile.`;
      if (!draft.missing_information.includes(note))
        draft.missing_information.push(note);
    }
  });
  return draft;
}
export async function generateDraft(
  request: DraftRequest,
  store: ProfileStore,
  config: AIConfig = getAIConfig(),
  fetchImpl: typeof fetch = fetch,
) {
  if (
    request.noAI ||
    request.noAgency ||
    Object.values(clientRestrictions(request.summary)).some(Boolean)
  )
    throw new AppError(
      400,
      "The client’s restrictions block this AI agency proposal.",
    );
  const profile = await store.load();
  if (profile.version !== request.profileVersion)
    throw new AppError(
      409,
      "About us changed. Reload the profile before generating.",
    );
  const draft = validateDraft(
    await requestDraft(config, buildPromptInput(request, profile), fetchImpl),
    request.questions,
  );
  const opening = openingKeyword(request.summary);
  if (opening && !draft.proposal_body.startsWith(opening)) {
    draft.proposal_body = opening + "\n" + draft.proposal_body;
  }
  if ((await store.load()).version !== profile.version)
    throw new AppError(
      409,
      "About us changed during generation. Generate again with the updated profile.",
    );
  return {
    draft,
    provider: config.provider,
    model: config.model,
    profileVersion: profile.version,
  };
}
