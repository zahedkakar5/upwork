"use client";
import Link from "next/link";
import { canReview } from "@/lib/client/task-state";
import { useWorkspace } from "../workspace/workspace-provider";
import { CardHeader } from "../ui/card-header";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ProposalFields } from "./proposal-fields";
import { ReviewNotes } from "./review-notes";
export function DraftEditor() {
  const { task, generate, review, moveToStep } = useWorkspace();
  const generating = task.phase === "generating";
  return (
    <>
      <CardHeader
        title={
          generating
            ? "Writing your proposal…"
            : task.draft
              ? "Your AI draft is ready."
              : "Generation couldn’t complete."
        }
        subtitle={
          generating
            ? "Turning your brief and company profile into a tailored response."
            : task.draft
              ? "Generated from your brief. Make any final adjustments."
              : "Check the message below and try again."
        }
        label="AI GENERATED"
      />
      <div className="card-body">
        {generating ? (
          <div className="ai-generating" role="status">
            <div className="ai-spinner">✳</div>
            <h3>A thoughtful response is taking shape.</h3>
            <p>
              Understanding the brief · drafting the proposal · preparing
              answers
            </p>
          </div>
        ) : task.draft ? (
          <>
            <ReviewNotes />
            <ProposalFields />
          </>
        ) : (
          <div className="ai-setup-state">
            <span>✳</span>
            <h3>Let’s try that again.</h3>
            <p role="alert">{task.error || "AI is not configured yet."}</p>
            <Link href="/settings" className="button secondary">
              Connection settings
              <Icon name="arrow" />
            </Link>
          </div>
        )}
        {!generating && (
          <button className="text-button" onClick={() => void generate()}>
            ✳ {task.draft ? "Regenerate proposal" : "Try generation again"}
          </button>
        )}
      </div>
      <div className="card-actions">
        <button className="text-button" onClick={() => moveToStep(0)}>
          <Icon name="back" />
          Edit job details
        </button>
        <Button disabled={!canReview(task)} onClick={review}>
          Review & finish
          <Icon name="arrow" />
        </Button>
      </div>
    </>
  );
}
