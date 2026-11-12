"use client";
import { useWorkspace } from "../workspace/workspace-provider";
import { CardHeader } from "../ui/card-header";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { screeningQuestions } from "@/lib/client/task-state";
export function ApprovedProposal() {
  const { task, copy, finish, moveToStep } = useWorkspace();
  if (!task.approved || !task.draft) return null;
  const text = task.draft.proposal_body;
  const questions = screeningQuestions(task.job.questions);
  return (
    <>
      <CardHeader
        title="Ready for your next step."
        subtitle="Copy the reviewed proposal and submit it yourself on Upwork."
        label="REVIEWED"
      />
      <div className="card-body">
        <div className="field">
          <label>Approved proposal</label>
          <div className="generated">{text}</div>
        </div>
        {task.draft.screening_answers.map((answer, index) => (
          <div className="field" key={answer.question_id}>
            <label>{questions[index]}</label>
            <div className="generated">{answer.answer_or_null}</div>
            <button
              className="text-button"
              onClick={() => void copy(answer.answer_or_null ?? "")}
            >
              <Icon name="copy" />
              Copy this answer
            </button>
          </div>
        ))}
        <div className="complete">
          <div className="success-symbol">✓</div>
          <h2>
            Thoughtfully prepared.
            <br />
            Personally submitted.
          </h2>
          <p>Copy the final proposal, then submit it in Upwork.</p>
          <Button onClick={() => void copy(text, true)}>
            <Icon name="copy" />
            Copy approved proposal
          </Button>
          <div className="finish-actions">
            <button className="text-button" onClick={() => finish(false)}>
              Finish & clear task
              <Icon name="arrow" />
            </button>
            <button className="text-button" onClick={() => finish(true)}>
              I submitted it in Upwork
            </button>
          </div>
        </div>
      </div>
      <div className="card-actions">
        <button className="text-button" onClick={() => moveToStep(2)}>
          <Icon name="back" />
          Back to review
        </button>
        <small>
          <Icon name="shield" />
          Your confirmation is required
        </small>
      </div>
    </>
  );
}
