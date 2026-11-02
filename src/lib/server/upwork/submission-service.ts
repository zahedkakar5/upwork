import "server-only";
import { AppError } from "../errors";
import { profileStore } from "../profile-store";
import { jobIdFromUrl } from "./jobs";
import {
  withSubmissionClient,
  record,
  unwrap,
  type Data,
} from "./submission-client";
import { submissionStore, reserveSubmission } from "./submission-state";
import type {
  SubmissionSnapshot,
  SubmissionAccount,
  SubmissionQuote,
} from "../../submission";
function rows(value: unknown, key: string): Data[] {
  const r = unwrap(value);
  const list = Array.isArray(value) ? value : r[key];
  return Array.isArray(list) ? list.map(record) : [];
}
function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
async function accountFor(
  call: (name: string, args: Data) => Promise<unknown>,
  id?: string,
) {
  const accounts = rows(
    await call("upwork__list_accounts", {}),
    "accounts",
  ).filter((a) => a.role === "TALENT" || a.role === "FL_AGENCY");
  const selected = accounts.find((a) => a.org_uid === id);
  if (id && !selected)
    throw new AppError(403, "Choose an Upwork account you can access.");
  return {
    selected,
    accounts: accounts.map((a) => ({
      id: String(a.org_uid),
      name: String(a.name ?? a.role_label ?? a.role),
      role: String(a.role),
    })) as SubmissionAccount[],
  };
}
function jobRecord(value: unknown): Data {
  const r = unwrap(value);
  return Object.keys(record(r.job)).length
    ? record(r.job)
    : Object.keys(record(r.marketplaceJobPosting)).length
      ? record(r.marketplaceJobPosting)
      : r;
}
async function readContext(
  call: (name: string, args: Data) => Promise<unknown>,
  account: Data,
  url: string,
) {
  jobIdFromUrl(url);
  const job = jobRecord(
    await call("upwork__find_jobs", {
      action: "get",
      org_uid: account.org_uid,
      params: { id: url },
    }),
  );
  const wallet = unwrap(
    await call(
      account.role === "FL_AGENCY"
        ? "upwork__get_freelancer_financials"
        : "upwork__get_profile",
      { action: "connects_balance", org_uid: account.org_uid, params: {} },
    ),
  );
  return { job, wallet };
}
export async function inspectApplication(
  token: string,
  url: string,
  accountId?: string,
) {
  return withSubmissionClient(token, async (call) => {
    const { accounts, selected } = await accountFor(call, accountId);
    if (!selected) return { accounts };
    return { accounts, ...(await readContext(call, selected, url)) };
  });
}
function sameJob(row: Data, job: Data, url: string): boolean {
  const linked = record(row.job);
  return [row.job_id, linked.id, row.job_url, linked.url].some(
    (v) => v !== undefined && (String(v) === String(job.id) || v === url),
  );
}
async function checkDuplicates(
  call: (name: string, args: Data) => Promise<unknown>,
  accountId: string,
  job: Data,
  url: string,
) {
  for (const action of ["invitations", "list"]) {
    let cursor: unknown;
    let complete = false;
    for (let page = 0; page < 20; page++) {
      const params: Data = action === "list" ? { status: "Pending" } : {};
      if (cursor) params.cursor = cursor;
      const result = unwrap(
        await call("upwork__list_freelancer_proposals", {
          action,
          org_uid: accountId,
          params,
        }),
      );
      const entries =
        action === "invitations" ? result.invitations : result.proposals;
      if (!Array.isArray(entries))
        throw new AppError(
          409,
          "Existing invitations and applications could not be verified. Submit directly on Upwork.",
        );
      if (entries.map(record).some((row) => sameJob(row, job, url)))
        throw new AppError(
          409,
          "There is already an invitation or application for this job. Continue it on Upwork.",
        );
      cursor = result.next_cursor ?? record(result.pageInfo).endCursor;
      if (
        result.hasMore !== true &&
        record(result.pageInfo).hasNextPage !== true
      ) {
        complete = true;
        break;
      }
      if (!cursor) break;
    }
    if (!complete)
      throw new AppError(
        409,
        "The duplicate-application check is incomplete. Submit directly on Upwork.",
      );
  }
}
export async function previewApplication(
  token: string,
  owner: string,
  snapshot: SubmissionSnapshot,
): Promise<SubmissionQuote> {
  if ((await profileStore.load()).version !== snapshot.profileVersion)
    throw new AppError(
      409,
      "About us changed. Generate and approve the updated proposal first.",
    );
  return withSubmissionClient(token, async (call) => {
    const { selected } = await accountFor(call, snapshot.accountId);
    if (!selected) throw new AppError(403, "Choose your submitting account.");
    const { job, wallet } = await readContext(call, selected, snapshot.url);
    if (job.applied === true)
      throw new AppError(409, "You have already applied for this job.");
    if (typeof job.id !== "string" || !/^\d+$/.test(job.id))
      throw new AppError(
        409,
        "Upwork did not return a verified numeric job ID. Submit directly on Upwork.",
      );
    // Do not guess Upwork question identifiers or silently omit required answers.
    if (
      snapshot.answers.length ||
      (Array.isArray(job.screening_questions) && job.screening_questions.length)
    )
      throw new AppError(
        409,
        "This job has screening questions. Their submission field mapping needs live verification; copy the reviewed answers and submit on Upwork for now.",
      );
    await checkDuplicates(call, snapshot.accountId, job, snapshot.url);
    const raw = unwrap(
      await call("upwork__manage_proposals", {
        action: "create",
        org_uid: snapshot.accountId,
        params: {
          job_id: job.id,
          cover_letter: snapshot.body,
          charged_amount: snapshot.bid,
        },
      }),
    );
    const preview = Object.keys(record(raw.preview)).length
      ? record(raw.preview)
      : raw;
    const previewId = raw.preview_id ?? preview.preview_id;
    const type = raw.type ?? preview.type;
    if (typeof previewId !== "string" || typeof type !== "string")
      throw new AppError(
        502,
        "Upwork did not return a recognizable confirmation preview. Nothing has been confirmed.",
      );
    const cost = numeric(
      preview.connects_required ??
        preview.connects_cost ??
        raw.connects_required,
    );
    const balance = numeric(
      preview.connects_balance ?? raw.connects_balance ?? wallet.balance,
    );
    const canConfirm =
      cost !== null &&
      balance !== null &&
      cost <= balance &&
      preview.can_apply === true;
    const reason = canConfirm
      ? ""
      : cost === null || balance === null
        ? "Upwork did not provide a verified Connects quote and balance."
        : cost > balance
          ? "You do not have enough Connects. Add them on Upwork."
          : "Upwork has not explicitly confirmed eligibility for this application.";
    const { id, record: stored } = submissionStore.add({
      owner,
      snapshot,
      previewId,
      type,
      cost,
      balance,
      preview: raw,
      canConfirm,
      reason,
    });
    return {
      reviewId: id,
      expiresAt: stored.expiresAt,
      cost,
      balance,
      preview: raw,
      canConfirm,
      reason,
    };
  });
}
export async function confirmApplication(
  token: string,
  owner: string,
  id: string,
  snapshot: SubmissionSnapshot,
  maxConnects: number,
) {
  if ((await profileStore.load()).version !== snapshot.profileVersion)
    throw new AppError(409, "The saved profile changed. Create a new preview.");
  const entry = submissionStore.claim(id, owner, snapshot, maxConnects);
  try {
    const receipt = await reserveSubmission(snapshot.accountId, snapshot.url);
    return await withSubmissionClient(token, async (call) => {
      const response = unwrap(
        await call("upwork__confirm_preview", {
          action: "confirm",
          org_uid: snapshot.accountId,
          params: {
            type: entry.type,
            preview_id: entry.previewId,
            boost_connects: 0,
          },
        }),
      );
      const proposalId = response.proposal_id;
      // A successful HTTP response alone is not evidence of a submitted proposal.
      if (
        typeof proposalId !== "string" ||
        !(response.success === true || response.status === "submitted")
      )
        throw new AppError(
          502,
          "Submission status is uncertain. Check submitted proposals and your Connects on Upwork. Do not retry automatically.",
        );
      const verify = unwrap(
        await call("upwork__list_freelancer_proposals", {
          action: "get",
          org_uid: snapshot.accountId,
          params: { id: proposalId },
        }),
      );
      const proposal = Object.keys(record(verify.proposal)).length
        ? record(verify.proposal)
        : verify;
      if (String(proposal.id ?? proposal.proposal_id) !== proposalId)
        throw new AppError(
          502,
          "Upwork returned a submission response, but verification is incomplete. Check Upwork directly before retrying.",
        );
      await receipt(proposalId);
      entry.state = "submitted";
      return { state: "submitted" as const, proposalId };
    });
  } catch (error) {
    entry.state = "uncertain";
    throw error;
  }
}
