"use client";
import { useState, useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./workspace-provider";
import { PageHeading } from "../ui/page-heading";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { apiRequest } from "@/lib/client/api";
import { type SuggestedJob } from "@/lib/job-suggestions";
import {
  discoverySchema,
  specialties,
  discoverySkills,
  discoveryCategories,
  openingKeyword,
  clientRestrictions,
  type DiscoveryFilters,
} from "@/lib/job-discovery";
export function Dashboard() {
  const { status, task, reset, updateJob } = useWorkspace();
  const router = useRouter();
  const [filters, setFilters] = useState<DiscoveryFilters>(
    discoverySchema.parse({}),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchedAt, setSearchedAt] = useState("");
  const [coverage, setCoverage] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  function change(patch: Partial<DiscoveryFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setNextCursor(null);
    setSearched(false);
  }

  const [jobs, setJobs] = useState<SuggestedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SuggestedJob | null>(null);
  const [searched, setSearched] = useState(false);
  async function refreshJobs(more = false) {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{
        jobs: SuggestedJob[];
        searchedAt: string;
        coverage: string;
        nextCursor: string | null;
      }>("/api/upwork/suggestions", {
        method: "POST",
        headers: { "X-Desk-Token": status.csrf },
        body: JSON.stringify({
          ...filters,
          ...(more && nextCursor ? { cursor: nextCursor } : {}),
        }),
      });
      setJobs((current) =>
        more
          ? [
              ...new Map(
                [...current, ...result.jobs].map((job) => [job.url, job]),
              ).values(),
            ]
          : result.jobs,
      );
      setNextCursor(result.nextCursor);
      setSearchedAt(result.searchedAt);
      setCoverage(result.coverage);
      setSearched(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not fetch jobs.",
      );
    } finally {
      setLoading(false);
    }
  }
  const initialSearchStarted = useRef(false);
  const loadInitialJobs = useEffectEvent(() => void refreshJobs());
  useEffect(() => {
    if (!status.upworkConnected) {
      initialSearchStarted.current = false;
      return;
    }
    if (!status.csrf || initialSearchStarted.current) return;
    initialSearchStarted.current = true;
    loadInitialJobs();
  }, [status.upworkConnected, status.csrf]);

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
  async function openJob(job: SuggestedJob) {
    setPreparing(true);
    setError("");
    try {
      const details = await apiRequest<{
        title: string;
        summary: string;
        questions: string[];
      }>("/api/upwork/job", {
        method: "POST",
        headers: { "X-Desk-Token": status.csrf },
        body: JSON.stringify({ url: job.url }),
      });
      setSelected(null);
      reset();
      updateJob({
        title: details.title,
        url: job.url,
        summary: details.summary,
        questions: (details.questions ?? []).join("\n"),
        ...clientRestrictions(details.summary),
      });
      router.push("/proposals");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load the complete job. Try again.",
      );
    } finally {
      setPreparing(false);
    }
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
        <Button
          variant="secondary"
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
        >
          <span aria-hidden="true">☷</span>
          Filters
        </Button>
        {filtersOpen && (
          <Dialog
            title="Filter jobs"
            className="discovery-filter-dialog"
            onClose={() => setFiltersOpen(false)}
          >
            <p>
              Default coverage includes all categories, both job types, all
              experience levels, scopes and durations. Location and talent-type
              preferences do not exclude jobs.
            </p>
            <div className="two-col">
              <div className="field">
                <label htmlFor="discovery-keywords">Additional keywords</label>
                <input
                  disabled={loading}
                  id="discovery-keywords"
                  value={filters.keywords}
                  onChange={(e) => change({ keywords: e.target.value })}
                  placeholder="Fitness, payments, learning platforms…"
                />
              </div>
              <div className="field">
                <label htmlFor="discovery-specialty">Specialty</label>
                <select
                  disabled={loading}
                  id="discovery-specialty"
                  value={filters.specialty ?? ""}
                  onChange={(e) =>
                    change({
                      specialty: e.target.value
                        ? (e.target.value as DiscoveryFilters["specialty"])
                        : undefined,
                    })
                  }
                >
                  <option value="">All specialties</option>
                  {specialties.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="discovery-category">Upwork category</label>
                <select
                  disabled={loading}
                  id="discovery-category"
                  value={filters.category}
                  onChange={(e) => change({ category: e.target.value })}
                >
                  {discoveryCategories.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="discovery-age">Posting age</label>
                <select
                  disabled={loading}
                  id="discovery-age"
                  value={filters.maxAgeMinutes}
                  onChange={(e) =>
                    change({ maxAgeMinutes: Number(e.target.value) })
                  }
                >
                  {[
                    [8, "Within 8 minutes"],
                    [60, "Past hour"],
                    [240, "Past 4 hours"],
                    [1440, "Past 24 hours"],
                    [10080, "Past 7 days"],
                  ].map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {(
                [
                  ["jobType", "Job type", ["all", "hourly", "fixed"]],
                  [
                    "experience",
                    "Experience",
                    ["all", "entry_level", "intermediate", "expert"],
                  ],
                  ["scope", "Scope", ["all", "small", "medium", "large"]],
                  [
                    "duration",
                    "Duration (hourly only)",
                    [
                      "all",
                      "less_than_1_month",
                      "1_to_3_months",
                      "3_to_6_months",
                      "more_than_6_months",
                    ],
                  ],
                ] as const
              ).map(([key, label, options]) => (
                <div className="field" key={key}>
                  <label htmlFor={"filter-" + key}>{label}</label>
                  <select
                    disabled={loading}
                    id={"filter-" + key}
                    value={filters[key]}
                    onChange={(e) =>
                      change({
                        [key]: e.target.value,
                      } as Partial<DiscoveryFilters>)
                    }
                  >
                    {options.map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p>
              Skills to include in discovery (any match; these do not establish
              company credentials)
            </p>
            <div className="suggestion-filters">
              {discoverySkills.map((skill) => (
                <button
                  key={skill}
                  disabled={loading}
                  aria-pressed={filters.skills.includes(skill)}
                  className={`button ${filters.skills.includes(skill) ? "primary" : "secondary"}`}
                  onClick={() =>
                    change({
                      skills: filters.skills.includes(skill)
                        ? filters.skills.filter((s) => s !== skill)
                        : [...filters.skills, skill],
                    })
                  }
                >
                  {skill}
                </button>
              ))}
            </div>
            <p className="hint">
              Jobs load automatically when you open this page. Use Refresh jobs
              to apply filters or check for new posts. No background polling.
              Unknown posting dates and unrelated jobs are excluded; scope
              filters exclude jobs with unknown scope. Category restrictions can
              miss miscategorized jobs.
            </p>
          </Dialog>
        )}
        {searchedAt && (
          <p role="status">
            Last checked: {new Date(searchedAt).toLocaleTimeString()}.{" "}
            {coverage}
          </p>
        )}
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
              {job.score}/100 fit ·{" "}
              {job.postedAt
                ? new Date(job.postedAt).toLocaleString()
                : "Date unavailable"}
            </span>
            <h2>
              <button className="job-title-button" onClick={() => useJob(job)}>
                {job.title}
              </button>
            </h2>
            <p>
              {job.jobType ?? "Job type unavailable"} · {job.skills?.join(", ")}
            </p>
            <p className="suggested-description">{job.summary}</p>
            <p>{job.reasons?.join(" · ")}</p>
            <p>
              Related projects:{" "}
              {job.matchedProjects?.join(", ") || "General product development"}
            </p>
            <p>
              Client: payment{" "}
              {job.client?.paymentVerified === null
                ? "unknown"
                : job.client?.paymentVerified
                  ? "verified"
                  : "unverified"}{" "}
              · hire rate {job.client?.hireRate ?? "unknown"}% · spend{" "}
              {job.client?.spent === null ? "unknown" : "$" + job.client?.spent}{" "}
              · jobs posted {job.client?.jobsPosted ?? "unknown"}
            </p>
            {openingKeyword(job.summary) && (
              <p>
                Required opening: <strong>{openingKeyword(job.summary)}</strong>
              </p>
            )}
            <div className="suggested-actions">
              <a href={job.url} target="_blank" rel="noreferrer">
                View on Upwork ↗
              </a>
              <Button disabled={preparing} onClick={() => useJob(job)}>
                Prepare proposal →
              </Button>
            </div>
          </article>
        ))}
      </div>
      {nextCursor && (
        <Button disabled={loading} onClick={() => void refreshJobs(true)}>
          Load more results
        </Button>
      )}
      {selected && (
        <Dialog
          title="Replace your current proposal?"
          onClose={() => setSelected(null)}
        >
          <p>
            Opening “{selected.title}” will clear your current job and draft.
          </p>
          <Button disabled={preparing} onClick={() => void openJob(selected)}>
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
