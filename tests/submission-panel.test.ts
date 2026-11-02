import { it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const { workspace } = vi.hoisted(() => ({
  workspace: {
    task: {
      job: {
        url: "https://www.upwork.com/jobs/~021234567890",
        title: "Synthetic job",
        questions: "",
        noAI: false,
        noAgency: false,
      },
      draft: { proposal_body: "Synthetic proposal", screening_answers: [] },
      approved: true,
      profileSnapshot: { version: "a".repeat(64) },
    },
    profile: { version: "a".repeat(64) },
    status: { upworkConnected: false, csrf: "test" },
    notify: vi.fn(),
    recordMcpSubmission: vi.fn(),
  },
}));
vi.mock("../src/components/workspace/workspace-provider", () => ({
  useWorkspace: () => workspace,
}));
import { SubmissionPanel } from "../src/components/proposals/submission-panel";
it("shows manual fallback without exposing a submit button while disconnected", () => {
  const html = renderToStaticMarkup(createElement(SubmissionPanel));
  expect(html).toContain("Reconnect Upwork MCP");
  expect(html).not.toContain("Confirm &amp; submit");
});
it("starts with a read-only account check when connected, not submission", () => {
  workspace.status.upworkConnected = true;
  const html = renderToStaticMarkup(createElement(SubmissionPanel));
  expect(html).toContain("Check account &amp; Connects");
  expect(html).not.toContain("Confirm &amp; submit");
  workspace.status.upworkConnected = false;
});
