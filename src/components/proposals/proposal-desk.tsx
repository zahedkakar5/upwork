"use client";
import { useWorkspace } from "../workspace/workspace-provider";
import { PageHeading } from "../ui/page-heading";
import { Icon } from "../ui/icon";
import { Button } from "../ui/button";
import type { ProposalStep } from "@/lib/client/task-state";
import { JobIntake } from "./job-intake";
import { DraftEditor } from "./draft-editor";
import { FinalReview } from "./final-review";
import { ApprovedProposal } from "./approved-proposal";
import { AboutSidebar } from "./about-sidebar";
const screens = [JobIntake, DraftEditor, FinalReview, ApprovedProposal];
export function ProposalDesk() {
  const { task, reset, skip, moveToStep } = useWorkspace();
  const Screen = screens[task.step];
  return (
    <>
      <PageHeading
        title="Good work starts here."
        subtitle="A focused space to turn the right opportunity into a thoughtful proposal."
        action={
          <Button variant="secondary" onClick={reset}>
            <Icon name="plus" />
            New proposal
          </Button>
        }
      />
      <nav className="stepper" aria-label="Proposal progress">
        {["Prepare", "Generate", "Review", "Copy & finish"].map(
          (label, index) => (
            <div className="step-item" key={label}>
              {index > 0 && <span className="step-line" />}
              <button
                className={`step ${task.step === index ? "current" : index < task.step ? "done" : ""}`}
                disabled={index > task.step}
                aria-current={index === task.step ? "step" : undefined}
                onClick={() => moveToStep(index as ProposalStep)}
              >
                <span className="step-number">
                  {index < task.step ? "✓" : index + 1}
                </span>
                {label}
              </button>
            </div>
          ),
        )}
      </nav>
      <div className={`desk-grid ${task.step === 0 ? "intake-only" : ""}`}>
        <section className="card">
          <Screen />
        </section>
        {task.step > 0 && <AboutSidebar />}
      </div>
      <div className="session-strip">
        <span>
          <Icon name="clock" />
          Clears after 60 minutes of inactivity
        </span>
        <span>
          <Icon name="lock" />
          Saved on this computer
        </span>
        <button className="text-button push" onClick={skip}>
          Skip this job
        </button>
        <button className="text-button" onClick={reset}>
          <Icon name="reset" />
          Clear workspace
        </button>
      </div>
    </>
  );
}
