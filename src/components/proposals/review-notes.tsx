"use client";
import { reviewNotes } from "@/lib/client/task-state";
import { useWorkspace } from "../workspace/workspace-provider";
export function ReviewNotes() {
  const { task, resolveNotes } = useWorkspace(),
    notes = reviewNotes(task);
  if (!notes.length) return null;
  return (
    <section className="info-banner">
      <strong>AI needs these details checked</strong>
      <ul>
        {notes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
      <button className="text-button" onClick={resolveNotes}>
        I’ve corrected these details
      </button>
    </section>
  );
}
