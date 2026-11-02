"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./workspace-provider";
import { PageHeading } from "../ui/page-heading";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { apiRequest } from "@/lib/client/api";
import {
  projectSearches,
  matchingProjects,
  type SuggestedJob,
} from "@/lib/job-suggestions";
export function Dashboard() {
  const { status, task, reset, updateJob } = useWorkspace();
  const router = useRouter();
  const [category, setCategory] = useState(projectSearches[0].category);
  const [jobs, setJobs] = useState<SuggestedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SuggestedJob | null>(null);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (!status.upworkConnected) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setJobs([]);
    setSearched(false);
    apiRequest<{ jobs: SuggestedJob[] }>("/api/upwork/suggestions", {
      method: "POST",
      headers: { "X-Desk-Token": status.csrf },
      body: JSON.stringify({ category }),
      signal: abort.signal,
    })
      .then((result) => {
        setJobs(result.jobs);
        setSearched(true);
      })
      .catch((cause) => {
        if (!abort.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Could not fetch jobs.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [category, status.csrf, status.upworkConnected]);
  async function refreshJobs() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ jobs: SuggestedJob[] }>(
        "/api/upwork/suggestions",
        {
          method: "POST",
          headers: { "X-Desk-Token": status.csrf },
          body: JSON.stringify({ category }),
        },
      );
      setJobs(result.jobs);
      setSearched(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not fetch jobs.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function connect() {
    try {
      const result = await apiRequest<{ url: string }>("/api/upwork/login", {
        method: "POST",
        body: "{}",
      });
      window.location.assign(result.url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not connect Upwork.",
      );
    }
  }
  function useJob(job: SuggestedJob) {
    if (task.job.title || task.job.summary || task.draft) {
      setSelected(job);
      return;
    }
    openJob(job);
  }
  function openJob(job: SuggestedJob) {
    setSelected(null);
    reset();
    updateJob({
      title: job.title,
      url: job.url,
      summary: job.summary,
      questions: "",
      noAI: false,
      noAgency: false,
    });
    router.push("/proposals");
  }
  return (
    <>
      <PageHeading
        title="Suggested jobs"
        subtitle="Find opportunities that fit the work we’ve already delivered."
        eyebrow="YOUR EXPERIENCE. YOUR NEXT OPPORTUNITY."
        action={
          <Button
            disabled={loading || !status.upworkConnected}
            onClick={() => void refreshJobs()}
          >
            {loading ? "Finding jobs…" : "Refresh jobs"}
          </Button>
        }
      />
      <section className="card suggestion-source">
        <h2>Match jobs to our projects</h2>
        <p>Choose an area of experience to discover related jobs on Upwork.</p>
        <div className="suggestion-filters">
          {projectSearches.map((s) => (
            <button
              className={`button ${category === s.category ? "primary" : "secondary"}`}
              key={s.category}
              aria-pressed={category === s.category}
              disabled={loading}
              onClick={() => setCategory(s.category)}
            >
              {s.category}
            </button>
          ))}
        </div>
        <div className="project-matches">
          {matchingProjects(category).map((p) => (
            <span key={p.name}>{p.name}</span>
          ))}
        </div>
      </section>
      {!status.upworkConnected && (
        <section className="card suggestion-source">
          <h2>Connect Upwork to find your next project</h2>
          <p>
            Search real jobs through Upwork MCP, then choose one to prepare a
            tailored proposal.
          </p>
          <Button onClick={() => void connect()}>Connect Upwork MCP</Button>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p role="status">Searching Upwork for relevant opportunities…</p>
      )}
      {searched && !loading && !jobs.length && (
        <section className="card suggestion-source">
          <h2>No matching jobs found</h2>
          <p>Try another project category or refresh for new opportunities.</p>
        </section>
      )}
      <div className="projects-grid">
        {jobs.map((job) => (
          <article className="card project-card" key={job.url}>
            <span className="project-category">
              Similar to{" "}
              {matchingProjects(category)
                .map((p) => p.name)
                .join(", ")}
            </span>
            <h2>
              <button className="job-title-button" onClick={() => useJob(job)}>
                {job.title}
              </button>
            </h2>
            <p className="suggested-description">{job.summary}</p>
            <div className="suggested-actions">
              <a href={job.url} target="_blank" rel="noreferrer">
                View on Upwork ↗
              </a>
              <Button onClick={() => useJob(job)}>Prepare proposal →</Button>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <Dialog
          title="Replace your current proposal?"
          onClose={() => setSelected(null)}
        >
          <p>
            Opening “{selected.title}” will clear your current job and draft.
          </p>
          <Button onClick={() => openJob(selected)}>
            Replace and continue
          </Button>{" "}
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Keep current proposal
          </Button>
        </Dialog>
      )}
    </>
  );
}
