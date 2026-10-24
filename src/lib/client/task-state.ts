import type { CompanyProfile, DraftResult } from "../types";

export type ProposalStep = 0 | 1 | 2 | 3;
export interface JobInput {
  url: string;
  title: string;
  summary: string;
  questions: string;
  noAI: boolean;
  noAgency: boolean;
}
export interface ProposalState {
  job: JobInput;
  step: ProposalStep;
  phase: "idle" | "generating" | "ready" | "error";
  draft: DraftResult | null;
  profileSnapshot: CompanyProfile | null;
  approved: boolean;
  error: string;
}
export const emptyJob = (): JobInput => ({
  url: "",
  title: "",
  summary: "",
  questions: "",
  noAI: false,
  noAgency: false,
});
export const initialTask = (): ProposalState => ({
  job: emptyJob(),
  step: 0,
  phase: "idle",
  draft: null,
  profileSnapshot: null,
  approved: false,
  error: "",
});
export type ProposalAction =
  | { type: "job_changed"; patch: Partial<JobInput> }
  | { type: "generation_started" }
  | { type: "draft_received"; draft: DraftResult; profile: CompanyProfile }
  | { type: "generation_failed"; error: string }
  | { type: "body_changed"; body: string }
  | { type: "answer_changed"; index: number; answer: string }
  | { type: "notes_resolved" }
  | { type: "step_changed"; step: ProposalStep }
  | { type: "review" }
  | { type: "approve" }
  | { type: "profile_changed" }
  | { type: "reset" };
export const screeningQuestions = (value: string) =>
  value
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean);
export const wordCount = (value: string) =>
  value.trim() ? value.trim().split(/\s+/).length : 0;
export const reviewNotes = (state: ProposalState) =>
  state.draft
    ? [...state.draft.unsupported_claims, ...state.draft.missing_information]
    : [];
export function canReview(state: ProposalState): boolean {
  return (
    state.phase === "ready" &&
    Boolean(state.draft?.proposal_body.trim()) &&
    Boolean(
      state.draft?.screening_answers.every((answer) =>
        answer.answer_or_null?.trim(),
      ),
    )
  );
}
export const canApprove = (state: ProposalState) =>
  canReview(state) && reviewNotes(state).length === 0;
export function validUpworkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["www.upwork.com", "upwork.com"].includes(url.hostname) &&
      /^\/(?:jobs\/|freelance-jobs\/apply\/)/.test(url.pathname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function proposalReducer(
  state: ProposalState,
  action: ProposalAction,
): ProposalState {
  switch (action.type) {
    case "job_changed":
      return { ...initialTask(), job: { ...state.job, ...action.patch } };
    case "generation_started":
      return {
        ...state,
        step: 1,
        phase: "generating",
        draft: null,
        profileSnapshot: null,
        approved: false,
        error: "",
      };
    case "draft_received":
      return {
        ...state,
        step: 1,
        phase: "ready",
        draft: action.draft,
        profileSnapshot: action.profile,
        approved: false,
        error: "",
      };
    case "generation_failed":
      return {
        ...state,
        step: 1,
        phase: "error",
        approved: false,
        error: action.error,
      };
    case "body_changed":
      return state.draft
        ? {
            ...state,
            draft: { ...state.draft, proposal_body: action.body },
            approved: false,
            step: state.step === 3 ? 2 : state.step,
          }
        : state;
    case "answer_changed":
      return state.draft
        ? {
            ...state,
            draft: {
              ...state.draft,
              screening_answers: state.draft.screening_answers.map(
                (answer, i) =>
                  i === action.index
                    ? { ...answer, answer_or_null: action.answer }
                    : answer,
              ),
            },
            approved: false,
            step: state.step === 3 ? 2 : state.step,
          }
        : state;
    case "notes_resolved":
      return state.draft
        ? {
            ...state,
            approved: false,
            draft: {
              ...state.draft,
              unsupported_claims: [],
              missing_information: [],
            },
          }
        : state;
    case "step_changed":
      return action.step <= state.step
        ? {
            ...state,
            step: action.step,
            approved: action.step === 3 && state.approved,
          }
        : state;
    case "review":
      return canReview(state) ? { ...state, step: 2, approved: false } : state;
    case "approve":
      return canApprove(state) ? { ...state, step: 3, approved: true } : state;
    case "profile_changed":
      return { ...initialTask(), job: state.job };
    case "reset":
      return initialTask();
  }
}
