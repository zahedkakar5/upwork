import { describe, expect, it } from "vitest";
import {
  initialTask,
  proposalReducer,
  canApprove,
  validUpworkUrl,
  type ProposalState,
} from "../src/lib/client/task-state";
import type { CompanyProfile } from "../src/lib/types";
const profile: CompanyProfile = {
  companyName: "NordStone",
  memberName: "Jags",
  about: "",
  version: "test-version",
};
const ready = (): ProposalState =>
  proposalReducer(initialTask(), {
    type: "draft_received",
    profile,
    draft: {
      proposal_body: "A proposal.",
      screening_answers: [],
      unsupported_claims: [],
      missing_information: [],
    },
  });
describe("proposal state and review integrity", () => {
  it("invalidates approval when proposal text changes", () => {
    const approved = proposalReducer(ready(), { type: "approve" });
    expect(approved.approved).toBe(true);
    const edited = proposalReducer(approved, {
      type: "body_changed",
      body: "Edited text",
    });
    expect(edited.approved).toBe(false);
    expect(edited.step).toBe(2);
  });
  it("clears a stale draft when the job or saved profile changes", () => {
    expect(
      proposalReducer(ready(), {
        type: "job_changed",
        patch: { title: "Different job" },
      }).draft,
    ).toBeNull();
    expect(
      proposalReducer(ready(), { type: "profile_changed" }).draft,
    ).toBeNull();
  });
  it("blocks approval for unanswered screening questions or unresolved model notes", () => {
    const state = ready();
    state.draft!.screening_answers.push({
      question_id: "q1",
      answer_or_null: null,
    });
    expect(canApprove(state)).toBe(false);
    state.draft!.screening_answers[0].answer_or_null = "Truthful answer";
    state.draft!.missing_information = ["Check this"];
    expect(proposalReducer(state, { type: "approve" }).approved).toBe(false);
  });
  it("removes all active task content on reset", () => {
    const state = ready();
    state.job.summary = "private-canary";
    expect(
      JSON.stringify(proposalReducer(state, { type: "reset" })),
    ).not.toContain("private-canary");
    expect(
      proposalReducer(state, { type: "reset" }).profileSnapshot,
    ).toBeNull();
  });
  it("allows real Upwork job URL forms while rejecting lookalike hosts", () => {
    expect(validUpworkUrl("https://www.upwork.com/jobs/~123")).toBe(true);
    expect(
      validUpworkUrl("https://www.upwork.com/freelance-jobs/apply/Test_~123/"),
    ).toBe(true);
    expect(validUpworkUrl("https://upwork.com.attacker.test/jobs/~123")).toBe(
      false,
    );
    expect(validUpworkUrl("javascript:alert(1)")).toBe(false);
  });
});
