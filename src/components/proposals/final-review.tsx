"use client";
import { canApprove } from "@/lib/client/task-state";
import { useWorkspace } from "../workspace/workspace-provider";
import { CardHeader } from "../ui/card-header";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ProposalFields } from "./proposal-fields";
import { ReviewNotes } from "./review-notes";
export function FinalReview() {
  const { task, approve, moveToStep } = useWorkspace();
  return (
    <>
      <CardHeader
        title="One final look."
        subtitle="Review the AI draft, then approve the version you want to copy."
        label="FINAL REVIEW"
      />
      <div className="card-body">
        <ReviewNotes />
        <ProposalFields review />
        <p className="hint">
          Approve confirms you have checked the facts, identity and answers.
          Edits reset approval.
        </p>
      </div>
      <div className="card-actions">
        <button className="text-button" onClick={() => moveToStep(1)}>
          <Icon name="back" />
          Back to draft
        </button>
        <Button disabled={!canApprove(task)} onClick={approve}>
          <Icon name="check" />
          Approve proposal
        </Button>
      </div>
    </>
  );
}
