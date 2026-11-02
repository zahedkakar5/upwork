"use client";
import { useWorkspace } from "./workspace-provider";
import { PageHeading } from "../ui/page-heading";
import { Icon } from "../ui/icon";
export function Activity() {
  const { counts } = useWorkspace();
  return (
    <>
      <PageHeading
        title="Small steps. Clear progress."
        subtitle="Counts for this browser session. No job history or client details."
      />
      <div className="stat-grid">
        {[
          ["Drafts prepared", counts.prepared],
          ["Proposals copied", counts.copied],
          ["Submissions recorded", counts.submitted],
        ].map(([label, count]) => (
          <div className="card stat" key={label}>
            <small>{label}</small>
            <strong>{count}</strong>
            <span className="hint">This session</span>
          </div>
        ))}
      </div>
      <div className="card empty-state">
        <Icon name="chart" />
        <p>A quieter kind of activity log.</p>Copying never counts as
        submission.
        <br />
        Skipped jobs: {counts.skipped}. Counts reset when the workspace reloads.
      </div>
    </>
  );
}
