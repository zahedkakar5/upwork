import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../errors";
import type { SubmissionSnapshot } from "../../submission";
export const snapshotHash = (snapshot: SubmissionSnapshot) =>
  createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
export interface PendingSubmission {
  owner: string;
  snapshot: SubmissionSnapshot;
  hash: string;
  previewId: string;
  type: string;
  cost: number | null;
  balance: number | null;
  preview: unknown;
  expiresAt: number;
  state: "ready" | "confirming" | "submitted" | "uncertain";
  canConfirm: boolean;
  reason: string;
}
export function createSubmissionStore(now: () => number = Date.now) {
  const pending = new Map<string, PendingSubmission>();
  return {
    add(entry: Omit<PendingSubmission, "hash" | "expiresAt" | "state">) {
      for (const [key, value] of pending)
        if (value.expiresAt < now() && value.state === "ready")
          pending.delete(key);
      const id = randomUUID();
      const record = {
        ...entry,
        hash: snapshotHash(entry.snapshot),
        expiresAt: now() + 5 * 60_000,
        state: "ready" as const,
      };
      pending.set(id, record);
      return { id, record };
    },
    claim(
      id: string,
      owner: string,
      snapshot: SubmissionSnapshot,
      maxConnects: number,
    ) {
      const entry = pending.get(id);
      if (!entry || entry.owner !== owner)
        throw new AppError(
          404,
          "This submission review was not found. Create a new preview.",
        );
      if (entry.state !== "ready")
        throw new AppError(
          409,
          "This submission was already attempted. Check your Upwork proposals and Connects before doing anything else.",
        );
      if (entry.expiresAt <= now() || entry.hash !== snapshotHash(snapshot))
        throw new AppError(
          409,
          "The proposal or terms changed, or the review expired. Create a new preview.",
        );
      if (
        !entry.canConfirm ||
        entry.cost === null ||
        entry.balance === null ||
        entry.cost > maxConnects ||
        entry.cost > entry.balance
      )
        throw new AppError(
          409,
          "Connects or eligibility could not be verified. Submission is blocked.",
        );
      entry.state = "confirming";
      return entry;
    },
  };
}
const globals = globalThis as typeof globalThis & {
  nordstoneSubmissions?: ReturnType<typeof createSubmissionStore>;
};
export const submissionStore = (globals.nordstoneSubmissions ??=
  createSubmissionStore());
/** Persist only a one-way account/job fingerprint, never proposal or client text. */
export async function reserveSubmission(accountId: string, jobUrl: string) {
  const dir = path.join(
    process.env.PROFILE_DATA_DIR ?? path.join(process.cwd(), "data"),
    "submission-receipts",
  );
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const key = createHash("sha256")
    .update(
      accountId +
        "\n" +
        (new URL(jobUrl).pathname.match(/~02\d+/)?.[0] ??
          new URL(jobUrl).pathname),
    )
    .digest("hex");
  const file = path.join(dir, key + ".json");
  try {
    await writeFile(
      file,
      JSON.stringify({ state: "uncertain", attemptedAt: Date.now() }),
      { flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new AppError(
        409,
        "An application for this job was already attempted. Check Upwork before trying again.",
      );
    throw error;
  }
  return async (proposalId: string) =>
    writeFile(
      file,
      JSON.stringify({
        state: "submitted",
        proposalId,
        verifiedAt: Date.now(),
      }),
      { mode: 0o600 },
    );
}
