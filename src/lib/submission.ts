import { z } from "zod";
export const submissionSnapshotSchema = z.object({
  url: z.string().max(2048),
  title: z.string().trim().min(1).max(20_000),
  body: z.string().trim().min(1).max(16_000),
  answers: z
    .array(
      z.object({
        question: z.string().min(1).max(2000),
        answer: z.string().trim().min(1).max(16000),
      }),
    )
    .max(30),
  profileVersion: z.string().regex(/^[a-f0-9]{64}$/),
  accountId: z.string().min(1).max(200),
  bid: z.number().positive().max(1_000_000),
  noAI: z.literal(false),
  noAgency: z.literal(false),
  approved: z.literal(true),
});
export type SubmissionSnapshot = z.infer<typeof submissionSnapshotSchema>;
export interface SubmissionAccount {
  id: string;
  name: string;
  role: string;
}
export interface SubmissionInspection {
  accounts: SubmissionAccount[];
  job?: unknown;
  wallet?: unknown;
}
export interface SubmissionQuote {
  reviewId: string;
  expiresAt: number;
  cost: number | null;
  balance: number | null;
  preview: unknown;
  canConfirm: boolean;
  reason: string;
}
