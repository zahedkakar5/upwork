import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createSubmissionStore,
  reserveSubmission,
} from "../src/lib/server/upwork/submission-state";
import {
  submissionSnapshotSchema,
  type SubmissionSnapshot,
} from "../src/lib/submission";
const snapshot: SubmissionSnapshot = {
  url: "https://www.upwork.com/jobs/~021234567890",
  title: "Synthetic testing job",
  body: "A synthetic reviewed proposal.",
  answers: [],
  profileVersion: "a".repeat(64),
  accountId: "test-account",
  bid: 25,
  noAI: false,
  noAgency: false,
  approved: true,
};
const entry = {
  owner: "session-a",
  snapshot,
  previewId: "test-preview",
  type: "test-proposal",
  cost: 12,
  balance: 30,
  preview: {},
  canConfirm: true,
  reason: "",
};
describe("submission safety", () => {
  it("requires explicit approval and blocks restricted proposals", () => {
    expect(
      submissionSnapshotSchema.safeParse({ ...snapshot, approved: false })
        .success,
    ).toBe(false);
    expect(
      submissionSnapshotSchema.safeParse({ ...snapshot, noAI: true }).success,
    ).toBe(false);
    expect(
      submissionSnapshotSchema.safeParse({ ...snapshot, bid: 0 }).success,
    ).toBe(false);
  });
  it("binds a preview to its session and exact proposal and terms", () => {
    const store = createSubmissionStore(() => 1000);
    const { id } = store.add(entry);
    expect(() => store.claim(id, "other-session", snapshot, 12)).toThrow(
      "not found",
    );
    expect(() =>
      store.claim(id, "session-a", { ...snapshot, bid: 26 }, 12),
    ).toThrow("changed");
    expect(() =>
      store.claim(id, "session-a", { ...snapshot, body: "Edited" }, 12),
    ).toThrow("changed");
    expect(() => store.claim(id, "session-a", snapshot, 11)).toThrow("blocked");
    expect(store.claim(id, "session-a", snapshot, 12).state).toBe("confirming");
    expect(() => store.claim(id, "session-a", snapshot, 12)).toThrow(
      "already attempted",
    );
  });
  it("blocks expired, unknown-cost and insufficient-balance previews", () => {
    let now = 1000;
    const store = createSubmissionStore(() => now);
    const { id } = store.add(entry);
    now += 300001;
    expect(() => store.claim(id, "session-a", snapshot, 12)).toThrow("expired");
    for (const changes of [
      { cost: null },
      { balance: 2 },
      { canConfirm: false },
    ]) {
      const { id: other } = store.add({ ...entry, ...changes });
      expect(() => store.claim(other, "session-a", snapshot, 12)).toThrow(
        "blocked",
      );
    }
  });
  it("reserves once even under concurrent attempts and across restarts", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "nordstone-receipts-"));
    const old = process.env.PROFILE_DATA_DIR;
    process.env.PROFILE_DATA_DIR = dir;
    try {
      const results = await Promise.allSettled([
        reserveSubmission("account", snapshot.url),
        reserveSubmission("account", snapshot.url),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await expect(reserveSubmission("account", snapshot.url)).rejects.toThrow(
        "already attempted",
      );
    } finally {
      if (old === undefined) delete process.env.PROFILE_DATA_DIR;
      else process.env.PROFILE_DATA_DIR = old;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
