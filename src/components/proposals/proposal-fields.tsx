"use client";
import { screeningQuestions, wordCount } from "@/lib/client/task-state";
import { useWorkspace } from "../workspace/workspace-provider";
export function ProposalFields({ review = false }: { review?: boolean }) {
  const { task, updateBody, updateAnswer } = useWorkspace();
  if (!task.draft) return null;
  const questions = screeningQuestions(task.job.questions);
  return (
    <>
      <div className="field">
        <label htmlFor="proposal-body">
          {review
            ? `Proposal · ${task.profileSnapshot?.companyName} / ${task.profileSnapshot?.memberName}`
            : "Your proposal"}
        </label>
        <textarea
          id="proposal-body"
          className="proposal-editor"
          maxLength={16_000}
          value={task.draft.proposal_body}
          onChange={(event) => updateBody(event.target.value)}
        />
        <div className="word-count">
          {wordCount(task.draft.proposal_body)} words
        </div>
      </div>
      {task.draft.screening_answers.map((answer, index) => (
        <div className="field" key={answer.question_id}>
          <label htmlFor={`screening-${index}`}>
            {index + 1}. {questions[index]}
          </label>
          <textarea
            id={`screening-${index}`}
            className="screening-editor"
            value={answer.answer_or_null ?? ""}
            onChange={(event) => updateAnswer(index, event.target.value)}
            placeholder="AI needs more information for this answer. Add a truthful response."
          />
        </div>
      ))}
    </>
  );
}
