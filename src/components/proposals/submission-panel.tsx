"use client";
import { useState } from "react";
import { useWorkspace } from "../workspace/workspace-provider";
import { apiRequest } from "@/lib/client/api";
import { Button } from "../ui/button";
import { screeningQuestions } from "@/lib/client/task-state";
import type {
  SubmissionInspection,
  SubmissionQuote,
  SubmissionSnapshot,
} from "@/lib/submission";
function Detail({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>Not provided</span>;
  if (Array.isArray(value))
    return (
      <ul>
        {value.map((v, i) => (
          <li key={i}>
            <Detail value={v} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === "object")
    return (
      <dl className="submission-details">
        {Object.entries(value).map(([key, v]) => (
          <div key={key}>
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>
              <Detail value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span style={{ whiteSpace: "pre-wrap" }}>{String(value)}</span>;
}
export function SubmissionPanel() {
  const { task, profile } = useWorkspace();
  // Remount the review whenever the approved content or profile changes.
  return (
    <SubmissionForm
      key={JSON.stringify([
        task.job,
        task.draft,
        profile.version,
        task.approved,
      ])}
    />
  );
}
function SubmissionForm() {
  const { task, profile, status, notify, recordMcpSubmission } = useWorkspace();
  const [inspection, setInspection] = useState<SubmissionInspection | null>(
    null,
  );
  const [accountId, setAccountId] = useState("");
  const [bid, setBid] = useState("");
  const [quote, setQuote] = useState<SubmissionQuote | null>(null);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [spendApproved, setSpendApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [proposalId, setProposalId] = useState("");
  const [reviewedSnapshot, setReviewedSnapshot] =
    useState<SubmissionSnapshot | null>(null);
  const allowed =
    task.approved &&
    task.draft &&
    task.profileSnapshot?.version === profile.version &&
    !task.job.noAI &&
    !task.job.noAgency;
  async function request<T>(payload: unknown) {
    return apiRequest<T>("/api/upwork/application", {
      method: "POST",
      headers: { "X-Desk-Token": status.csrf },
      body: JSON.stringify(payload),
    });
  }
  async function inspect(id?: string) {
    setBusy(true);
    setError("");
    setQuote(null);
    try {
      setInspection(
        await request<SubmissionInspection>({
          action: "inspect",
          url: task.job.url,
          accountId: id || undefined,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not read Upwork details.",
      );
    } finally {
      setBusy(false);
    }
  }
  function invalidate() {
    setQuote(null);
    setSpendApproved(false);
    setPreviewApproved(false);
    setReviewedSnapshot(null);
  }
  async function preview() {
    if (!allowed || !task.draft || !previewApproved) return;
    const questions = screeningQuestions(task.job.questions);
    const snapshot: SubmissionSnapshot = {
      url: task.job.url,
      title: task.job.title,
      body: `AI-assisted proposal; reviewed by ${task.profileSnapshot?.memberName ?? "Jags"}.\n\n${task.draft.proposal_body}`,
      answers: task.draft.screening_answers.map((a, i) => ({
        question: questions[i],
        answer: a.answer_or_null ?? "",
      })),
      profileVersion: profile.version,
      accountId,
      bid: Number(bid),
      noAI: false,
      noAgency: false,
      approved: true,
    };
    setBusy(true);
    setError("");
    setQuote(null);
    setSpendApproved(false);
    try {
      const result = await request<SubmissionQuote>({
        action: "preview",
        snapshot,
        approvePreview: true,
      });
      setReviewedSnapshot(snapshot);
      setQuote(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not prepare a submission preview.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (
      !quote?.canConfirm ||
      !reviewedSnapshot ||
      !spendApproved ||
      quote.cost === null ||
      attempted
    )
      return;
    setBusy(true);
    setAttempted(true);
    setError("");
    try {
      const result = await request<{ state: "submitted"; proposalId: string }>({
        action: "confirm",
        snapshot: reviewedSnapshot,
        reviewId: quote.reviewId,
        maxConnects: quote.cost,
        confirmSpend: true,
      });
      setProposalId(result.proposalId);
      recordMcpSubmission();
      notify("Upwork confirmed and verified your submission.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Submission status is uncertain. Check Upwork before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="submission-panel" aria-label="Submit through Upwork">
      <h2>Review & submit on Upwork</h2>
      <p>
        Your approved proposal will be sent only after you confirm the account,
        bid and Connects preview. No Connects purchases or automatic boosting.
      </p>
      {!status.upworkConnected ? (
        <p>
          Reconnect Upwork MCP to use this feature. You can still copy and
          submit manually.
        </p>
      ) : (
        <>
          {!allowed && (
            <p role="alert">
              Generate and approve this proposal with the current company
              profile first.
            </p>
          )}
          {!inspection && (
            <Button
              disabled={busy || !allowed || !task.job.url}
              onClick={() => void inspect()}
            >
              {busy ? "Checking Upwork…" : "Check account & Connects"}
            </Button>
          )}
          {inspection && (
            <>
              <div className="field">
                <label htmlFor="submission-account">Submit as</label>
                <select
                  id="submission-account"
                  value={accountId}
                  disabled={busy || attempted}
                  onChange={(event) => {
                    setAccountId(event.target.value);
                    invalidate();
                    void inspect(event.target.value);
                  }}
                >
                  <option value="">Choose your account</option>
                  {inspection.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ·{" "}
                      {account.role === "FL_AGENCY" ? "Agency" : "Freelancer"}
                    </option>
                  ))}
                </select>
              </div>
              {inspection.wallet !== undefined && (
                <details open>
                  <summary>Your Connects wallet</summary>
                  <Detail value={inspection.wallet} />
                </details>
              )}
              {inspection.job !== undefined && (
                <details>
                  <summary>Job details from Upwork</summary>
                  <Detail value={inspection.job} />
                </details>
              )}
              <div className="field">
                <label htmlFor="submission-bid">
                  Your bid in USD (hourly rate for hourly jobs; total for
                  fixed-price jobs)
                </label>
                <input
                  id="submission-bid"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={bid}
                  disabled={busy || attempted}
                  onChange={(event) => {
                    setBid(event.target.value);
                    invalidate();
                  }}
                />
              </div>
              <p>
                Submitting: <strong>{task.job.title}</strong>. The approved
                proposal and screening answers are shown above.
              </p>
              <label className="review-check">
                <input
                  type="checkbox"
                  checked={previewApproved}
                  disabled={busy || attempted}
                  onChange={(event) => setPreviewApproved(event.target.checked)}
                />
                I reviewed the proposal, answers and bid. Prepare an Upwork
                preview without attachments or paid boosting.
              </label>
              <Button
                disabled={
                  busy ||
                  !allowed ||
                  !accountId ||
                  !inspection.job ||
                  !previewApproved ||
                  Number(bid) <= 0 ||
                  attempted
                }
                onClick={() => void preview()}
              >
                {busy ? "Checking…" : "Prepare submission preview"}
              </Button>
            </>
          )}
          {quote && (
            <div className="submission-quote">
              <h3>Final Upwork preview</h3>
              <p>
                Connects required:{" "}
                <strong>{quote.cost ?? "Not verified"}</strong> · Balance:{" "}
                <strong>{quote.balance ?? "Not verified"}</strong>
              </p>
              <p>
                Review every detail below. This preview expires at{" "}
                {new Date(quote.expiresAt).toLocaleTimeString()}.
              </p>
              <Detail value={quote.preview} />
              {!quote.canConfirm && (
                <p role="alert">{quote.reason} Submission is blocked.</p>
              )}
              <label className="review-check">
                <input
                  type="checkbox"
                  checked={spendApproved}
                  disabled={!quote.canConfirm || busy || attempted}
                  onChange={(event) => setSpendApproved(event.target.checked)}
                />
                I confirm this exact application and authorize spending{" "}
                {quote.cost ?? "the displayed"} Connects, with no paid boost.
              </label>
              <Button
                disabled={
                  busy ||
                  !quote.canConfirm ||
                  !spendApproved ||
                  attempted ||
                  Date.now() >= quote.expiresAt
                }
                onClick={() => void confirm()}
              >
                {busy
                  ? "Submitting once…"
                  : proposalId
                    ? "Submission verified"
                    : "Confirm & submit"}
              </Button>
            </div>
          )}
          {proposalId && (
            <p role="status">
              Submission verified. Proposal reference: {proposalId}
            </p>
          )}
          {attempted && !proposalId && !busy && (
            <p>
              Do not retry this application until you check your proposals and
              Connects on Upwork. This app blocks duplicate attempts.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
