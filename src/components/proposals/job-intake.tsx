"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import { useWorkspace } from "../workspace/workspace-provider";
import { CardHeader } from "../ui/card-header";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
export function JobIntake() {
  const {
    task: { job },
    updateJob,
    generate,
    status,
  } = useWorkspace();
  const [fetching, setFetching] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const latestJob = useRef(job);
  latestJob.current = job;
  useEffect(() => () => request.current?.abort(), []);
  async function importJob() {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    const snapshot = job;
    setFetching(true);
    setImportMessage("");
    try {
      const details = await apiRequest<{ title: string; summary: string }>(
        "/api/upwork/job",
        {
          method: "POST",
          headers: { "X-Desk-Token": status.csrf },
          signal: abort.signal,
          body: JSON.stringify({ url: snapshot.url }),
        },
      );
      if (abort.signal.aborted) return;
      if (latestJob.current !== snapshot) {
        setImportMessage(
          "Job details changed while fetching. Fetch again to import.",
        );
        return;
      }
      updateJob({
        title: details.title,
        summary: details.summary,
      });
      setImportMessage(
        "Title and brief imported from Upwork. Check screening questions and restrictions before generating.",
      );
    } catch (cause) {
      if (!abort.signal.aborted)
        setImportMessage(
          cause instanceof Error ? cause.message : "Could not import this job.",
        );
    } finally {
      if (request.current === abort) setFetching(false);
    }
  }
  return (
    <>
      <CardHeader
        title="A brief in. A proposal out."
        subtitle="Share the job. Let AI handle the first draft."
        label="AI PROPOSALS"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
      >
        <div className="card-body">
          <div className="field">
            <label htmlFor="job-url">Job link</label>
            <div className="input-wrap">
              <Icon name="link" />
              <input
                id="job-url"
                type="url"
                value={job.url}
                onChange={(event) => updateJob({ url: event.target.value })}
                placeholder="https://www.upwork.com/jobs/…"
              />
            </div>
            <div className="job-import-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={fetching || !job.url.trim()}
                onClick={() => void importJob()}
              >
                {fetching ? "Fetching details…" : "Fetch job details"}
              </Button>
              {!status.upworkConnected && (
                <button
                  type="button"
                  className="text-button"
                  onClick={async () => {
                    try {
                      const result = await apiRequest<{ url: string }>(
                        "/api/upwork/login",
                        { method: "POST", body: "{}" },
                      );
                      window.location.assign(result.url);
                    } catch (cause) {
                      setImportMessage(
                        cause instanceof Error
                          ? cause.message
                          : "Could not connect Upwork.",
                      );
                    }
                  }}
                >
                  Connect Upwork
                </button>
              )}
            </div>
            <p className="hint" role="status">
              {importMessage}
            </p>
          </div>
          <div className="field">
            <label htmlFor="job-title">
              Job title <b>*</b>
            </label>
            <input
              id="job-title"
              required
              maxLength={20_000}
              value={job.title}
              onChange={(event) => updateJob({ title: event.target.value })}
              placeholder="e.g. Fix a React Native checkout crash"
            />
          </div>
          <div className="field">
            <label htmlFor="job-summary">
              Job brief <b>*</b>
            </label>
            <textarea
              id="job-summary"
              required
              maxLength={20_000}
              className="brief-editor"
              value={job.summary}
              onChange={(event) => updateJob({ summary: event.target.value })}
              placeholder="Paste the client’s requirements here…"
            />
          </div>
          <details className="extra-options">
            <summary>
              Screening questions & client restrictions <span>optional</span>
            </summary>
            <div className="field options-field">
              <label htmlFor="job-questions">
                Screening questions <span>one per line</span>
              </label>
              <textarea
                id="job-questions"
                value={job.questions}
                onChange={(event) =>
                  updateJob({ questions: event.target.value })
                }
                placeholder="AI drafts a separate answer for each question."
              />
            </div>
            <label className="review-check">
              <input
                type="checkbox"
                checked={job.noAI}
                onChange={(event) => updateJob({ noAI: event.target.checked })}
              />
              Client does not allow AI
            </label>
            <label className="review-check">
              <input
                type="checkbox"
                checked={job.noAgency}
                onChange={(event) =>
                  updateJob({ noAgency: event.target.checked })
                }
              />
              Client does not allow agencies
            </label>
          </details>
          <p className="hint">
            Paste an Upwork job link and fetch its title and brief, or enter
            them manually. AI uses these details and your saved About us
            profile.
          </p>
        </div>
        <div className="card-actions">
          <small>
            <Icon name="shield" />
            Review once. Copy when ready.
          </small>
          <Button type="submit" disabled={fetching}>
            ✳ Generate proposal
            <Icon name="arrow" />
          </Button>
        </div>
      </form>
    </>
  );
}
