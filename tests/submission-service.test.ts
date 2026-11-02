import { describe, it, expect, vi } from "vitest";
import type { SubmissionSnapshot } from "../src/lib/submission";
const { call, load } = vi.hoisted(() => ({ call: vi.fn(), load: vi.fn() }));
vi.mock("../src/lib/server/profile-store", () => ({ profileStore: { load } }));
vi.mock(
  "../src/lib/server/upwork/submission-client",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("../src/lib/server/upwork/submission-client")
      >();
    return {
      ...original,
      withSubmissionClient: async (
        _token: string,
        work: (caller: typeof call) => unknown,
      ) => work(call),
    };
  },
);
import { previewApplication } from "../src/lib/server/upwork/submission-service";
const snapshot: SubmissionSnapshot = {
  url: "https://www.upwork.com/jobs/~021234567890",
  title: "Synthetic test",
  body: "A synthetic proposal",
  answers: [],
  profileVersion: "a".repeat(64),
  accountId: "test-account",
  bid: 25,
  noAI: false,
  noAgency: false,
  approved: true,
};
function setup(override: Record<string, unknown> = {}) {
  call.mockReset();
  load.mockResolvedValue({ version: snapshot.profileVersion });
  call.mockImplementation(
    async (name: string, args: Record<string, unknown>) => {
      if (name === "upwork__list_accounts")
        return {
          accounts: [
            {
              org_uid: "test-account",
              name: "Synthetic freelancer",
              role: "TALENT",
            },
          ],
        };
      if (name === "upwork__find_jobs")
        return { id: "1234567890", ...override };
      if (name === "upwork__get_profile") return { balance: 30 };
      if (name === "upwork__list_freelancer_proposals")
        return args.action === "list" ? { proposals: [] } : { invitations: [] };
      if (name === "upwork__manage_proposals")
        return {
          preview_id: "test-preview",
          type: "test-proposal",
          preview: {
            connects_required: 12,
            connects_balance: 30,
            can_apply: true,
          },
        };
      throw new Error("Unexpected tool");
    },
  );
}
describe("Upwork review preparation", () => {
  it("prepares a quote with exact approved bid but never confirms or spends", async () => {
    setup();
    const quote = await previewApplication(
      "synthetic-token",
      "session",
      snapshot,
    );
    expect(quote.cost).toBe(12);
    expect(quote.canConfirm).toBe(true);
    expect(call).toHaveBeenCalledWith("upwork__manage_proposals", {
      action: "create",
      org_uid: "test-account",
      params: {
        job_id: "1234567890",
        cover_letter: snapshot.body,
        charged_amount: 25,
      },
    });
    expect(
      call.mock.calls.some(([name]) => name === "upwork__confirm_preview"),
    ).toBe(false);
  });
  it("does not create a preview for unverified screening questions", async () => {
    setup({
      screening_questions: [{ id: "q-real", question: "Synthetic question" }],
    });
    await expect(
      previewApplication("test", "session", snapshot),
    ).rejects.toThrow("screening");
    expect(
      call.mock.calls.some(([name]) => name === "upwork__manage_proposals"),
    ).toBe(false);
  });
  it("checks the current profile before contacting Upwork", async () => {
    setup();
    load.mockResolvedValue({ version: "b".repeat(64) });
    await expect(
      previewApplication("test", "session", snapshot),
    ).rejects.toThrow("About us changed");
    expect(call).not.toHaveBeenCalled();
  });
  it("blocks a job already applied to before any write-capable call", async () => {
    setup({ applied: true });
    await expect(
      previewApplication("test", "session", snapshot),
    ).rejects.toThrow("already applied");
    expect(
      call.mock.calls.some(([name]) => name === "upwork__manage_proposals"),
    ).toBe(false);
  });
});
