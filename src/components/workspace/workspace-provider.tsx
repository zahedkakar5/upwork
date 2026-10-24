"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ClientError } from "@/lib/client/api";
import {
  canApprove,
  canReview,
  initialTask,
  proposalReducer,
  screeningQuestions,
  validUpworkUrl,
  type JobInput,
  type ProposalStep,
} from "@/lib/client/task-state";
import type {
  CompanyProfile,
  ConnectionStatus,
  DraftResult,
  ProfileFields,
  SessionCounts,
} from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";

function useWorkspaceState(
  initialProfile: CompanyProfile,
  status: ConnectionStatus,
) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [task, dispatch] = useReducer(proposalReducer, undefined, initialTask);
  const [counts, setCounts] = useState<SessionCounts>({
    prepared: 0,
    copied: 0,
    submitted: 0,
    skipped: 0,
  });
  const [notice, setNotice] = useState<{ message: string; id: number } | null>(
    null,
  );
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const revision = useRef(0),
    controller = useRef<AbortController | null>(null),
    lastActivity = useRef(0);
  const notify = (message: string) => setNotice({ message, id: Date.now() });
  const invalidateRequest = () => {
    revision.current++;
    controller.current?.abort();
    controller.current = null;
  };
  const updateJob = (patch: Partial<JobInput>) => {
    invalidateRequest();
    dispatch({ type: "job_changed", patch });
  };
  const reset = () => {
    invalidateRequest();
    dispatch({ type: "reset" });
    setManualCopy(null);
  };
  const logout = async () => {
    reset();
    try {
      await apiRequest("/api/session", {
        method: "DELETE",
        headers: { "X-Desk-Token": status.csrf },
      });
      router.replace("/");
      router.refresh();
    } catch (error) {
      if (error instanceof ClientError && error.status === 401) {
        router.replace("/");
        router.refresh();
      } else
        notify(error instanceof Error ? error.message : "Could not sign out.");
    }
  };
  useEffect(() => {
    lastActivity.current = Date.now();
    const record = () => {
      lastActivity.current = Date.now();
    };
    for (const event of ["pointerdown", "keydown", "input"])
      window.addEventListener(event, record);
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= 60 * 60 * 1_000) {
        lastActivity.current = Date.now();
        void logout();
      }
    }, 30_000);
    return () => {
      window.clearInterval(timer);
      for (const event of ["pointerdown", "keydown", "input"])
        window.removeEventListener(event, record);
      controller.current?.abort();
    };
    // The session token is fixed for the lifetime of this workspace layout.
  }, [status.csrf]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const saveProfile = async (fields: ProfileFields) => {
    const result = await apiRequest<{ profile: CompanyProfile }>(
      "/api/profile",
      {
        method: "POST",
        headers: { "X-Desk-Token": status.csrf },
        body: JSON.stringify({ ...fields, version: profile.version }),
      },
    );
    if (result.profile.version !== profile.version) {
      invalidateRequest();
      dispatch({ type: "profile_changed" });
    }
    setProfile(result.profile);
    notify("About us saved. AI will use it for your next proposal.");
    return result.profile;
  };
  const generate = async () => {
    if (task.phase === "generating") return;
    if (!task.job.title.trim() || !task.job.summary.trim())
      return notify("Add the job title and brief first.");
    if (task.job.url && !validUpworkUrl(task.job.url))
      return notify("Use a valid Upwork job link, or leave the link blank.");
    if (task.job.noAI || task.job.noAgency)
      return notify("The client’s restriction blocks this AI agency proposal.");
    invalidateRequest();
    const requestRevision = revision.current;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 95_000);
    dispatch({ type: "generation_started" });
    try {
      const result = await apiRequest<{
        draft: DraftResult;
        profileVersion: string;
      }>("/api/draft", {
        method: "POST",
        headers: { "X-Desk-Token": status.csrf },
        signal: abort.signal,
        body: JSON.stringify({
          title: task.job.title,
          summary: task.job.summary,
          questions: screeningQuestions(task.job.questions),
          noAI: task.job.noAI,
          noAgency: task.job.noAgency,
          profileVersion: profile.version,
          generateRequested: true,
        }),
      });
      if (
        revision.current !== requestRevision ||
        result.profileVersion !== profile.version
      )
        return;
      dispatch({
        type: "draft_received",
        draft: result.draft,
        profile: { ...profile },
      });
      setCounts((current) => ({ ...current, prepared: current.prepared + 1 }));
      notify("Your AI proposal is ready.");
    } catch (error) {
      if (revision.current !== requestRevision) return;
      if (error instanceof ClientError && error.status === 401) {
        reset();
        router.replace("/");
        return;
      }
      dispatch({
        type: "generation_failed",
        error: abort.signal.aborted
          ? "Generation timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Could not generate a proposal.",
      });
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === abort) controller.current = null;
    }
  };
  const updateBody = (body: string) => {
    revision.current++;
    dispatch({ type: "body_changed", body });
  };
  const updateAnswer = (index: number, answer: string) => {
    revision.current++;
    dispatch({ type: "answer_changed", index, answer });
  };
  const moveToStep = (step: ProposalStep) => {
    if (task.phase === "generating") {
      invalidateRequest();
      dispatch({ type: "profile_changed" });
      return;
    }
    dispatch({ type: "step_changed", step });
  };
  const review = () => {
    if (!canReview(task))
      return notify("Complete the proposal and every screening answer first.");
    dispatch({ type: "review" });
  };
  const approve = () => {
    if (!canApprove(task))
      return notify(
        "Resolve the review notes and complete every answer first.",
      );
    dispatch({ type: "approve" });
  };
  const copy = async (text: string, proposal = false) => {
    if (proposal && !task.approved)
      return notify("Approve the current proposal before copying.");
    try {
      await navigator.clipboard.writeText(text);
      if (proposal)
        setCounts((current) => ({ ...current, copied: current.copied + 1 }));
      notify("Copied to clipboard.");
    } catch {
      setManualCopy(text);
    }
  };
  const finish = (submitted = false) => {
    if (submitted)
      setCounts((current) => ({
        ...current,
        submitted: current.submitted + 1,
      }));
    reset();
    notify(
      submitted ? "Manual submission recorded. Task cleared." : "Task cleared.",
    );
  };
  const skip = () => {
    setCounts((current) => ({ ...current, skipped: current.skipped + 1 }));
    reset();
    notify("Job skipped.");
  };
  return {
    profile,
    status,
    task,
    counts,
    notice,
    manualCopy,
    setManualCopy,
    notify,
    updateJob,
    updateBody,
    updateAnswer,
    moveToStep,
    review,
    approve,
    reset,
    logout,
    saveProfile,
    generate,
    copy,
    finish,
    skip,
    resolveNotes: () => dispatch({ type: "notes_resolved" }),
  };
}

type WorkspaceContextValue = ReturnType<typeof useWorkspaceState>;
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function WorkspaceProvider({
  initialProfile,
  status,
  children,
}: {
  initialProfile: CompanyProfile;
  status: ConnectionStatus;
  children: ReactNode;
}) {
  const workspace = useWorkspaceState(initialProfile, status);
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
      <div
        id="toast"
        className={workspace.notice ? "visible" : ""}
        role="status"
      >
        {workspace.notice?.message}
      </div>
      {workspace.manualCopy !== null && (
        <Dialog
          title="Copy manually"
          onClose={() => workspace.setManualCopy(null)}
        >
          <p>
            Your browser did not allow clipboard access. Select and copy the
            text below.
          </p>
          <textarea
            className="manual-copy"
            readOnly
            value={workspace.manualCopy}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Text to copy"
          />
        </Dialog>
      )}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace context is missing.");
  return value;
}
