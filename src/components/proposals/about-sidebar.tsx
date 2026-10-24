"use client";
import Link from "next/link";
import { useWorkspace } from "../workspace/workspace-provider";
import { Icon } from "../ui/icon";
export function AboutSidebar() {
  const { task, profile: savedProfile } = useWorkspace();
  const profile = task.profileSnapshot ?? savedProfile;
  return (
    <aside className="right-stack">
      <section className="card evidence-card">
        <div className="panel-title">
          <Icon name="book" />
          About us
          <span className="counter">
            {profile.about ? "Used by AI" : "Not added yet"}
          </span>
        </div>
        <h3 className="about-company">{profile.companyName}</h3>
        <p className="about-preview">
          {profile.about
            ? profile.about.length > 650
              ? `${profile.about.slice(0, 650)}…`
              : profile.about
            : "Add your company’s skills, services and real experience. Until then, AI focuses on the job and a proposed approach."}
        </p>
        <Link className="button secondary full-width" href="/about">
          <Icon name="file" />
          {profile.about ? "Edit About us" : "Add About us"}
        </Link>
      </section>
    </aside>
  );
}
