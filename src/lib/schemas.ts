import { z } from "zod";

export const profileFieldsSchema = z.object({
  companyName: z.string().trim().min(1, "Enter a company name.").max(120),
  memberName: z
    .string()
    .trim()
    .min(1, "Enter the represented member.")
    .max(120),
  about: z
    .string()
    .trim()
    .max(20_000, "About us must be under 20,000 characters."),
});
export const profileSchema = profileFieldsSchema.extend({
  version: z.string().regex(/^[a-f0-9]{64}$/),
});
export const draftRequestSchema = z.object({
  title: z.string().trim().min(1, "Add a job title.").max(20_000),
  summary: z.string().trim().min(1, "Add the job brief.").max(20_000),
  questions: z.array(z.string().trim().min(1).max(2_000)).max(30),
  profileVersion: z.string().regex(/^[a-f0-9]{64}$/),
  noAI: z.boolean().default(false),
  noAgency: z.boolean().default(false),
  generateRequested: z.literal(true),
});
export const draftResultSchema = z.strictObject({
  proposal_body: z.string().trim().min(1).max(16_000),
  screening_answers: z
    .array(
      z.strictObject({
        question_id: z.string(),
        answer_or_null: z.string().nullable(),
      }),
    )
    .max(30),
  unsupported_claims: z.array(z.string().max(2_000)).max(50),
  missing_information: z.array(z.string().max(2_000)).max(50),
});
export type CompanyProfile = z.infer<typeof profileSchema>;
export type ProfileFields = z.infer<typeof profileFieldsSchema>;
export type DraftRequest = z.infer<typeof draftRequestSchema>;
export type DraftResult = z.infer<typeof draftResultSchema>;
