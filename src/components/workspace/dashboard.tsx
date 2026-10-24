"use client";
import Link from "next/link";
import { useWorkspace } from "./workspace-provider";
import { PageHeading } from "../ui/page-heading";
import { Icon, type IconName } from "../ui/icon";
export function Dashboard() {
  const { profile, task, counts } = useWorkspace();
  const links: {
    href: string;
    icon: IconName;
    title: string;
    subtitle: string;
  }[] = [
    {
      href: "/about",
      icon: "book",
      title: `Tell AI about ${profile.companyName}`,
      subtitle: "Save your skills, services and real experience.",
    },
    {
      href: "/settings",
      icon: "settings",
      title: "Check your workspace",
      subtitle: "Manage your AI connection and workspace.",
    },
  ];
  return (
    <>
      <PageHeading
        title={`Welcome back, ${profile.memberName}.`}
        subtitle="A fresh opportunity. A little focus. A proposal that sounds like you."
        eyebrow="YOUR WORKSPACE, AT A GLANCE"
        action={
          <span className="session-user">
            {profile.memberName} / {profile.companyName}
          </span>
        }
      />
      <section className="card overview-hero">
        <div>
          <div className="eyebrow">MAKE YOUR NEXT MOVE</div>
          <h2>Good proposals start with good preparation.</h2>
          <p>
            Add the job details. AI combines the brief with your saved About us
            profile to write a tailored proposal.
          </p>
          <Link href="/proposals" className="button primary">
            <Icon name="plus" />
            {task.draft ? "Continue your proposal" : "Create an AI proposal"}
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          ✳
        </div>
      </section>
      <div className="stat-grid">
        {[
          ["Drafts prepared", counts.prepared],
          ["Proposals copied", counts.copied],
          ["Submitted manually", counts.submitted],
        ].map(([label, value]) => (
          <div className="card stat" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span className="hint">This session</span>
          </div>
        ))}
      </div>
      <div className="overview-columns">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Your next steps</h2>
              <p>Everything you need to get started.</p>
            </div>
          </div>
          <div className="card-body">
            {links.map((link) => (
              <Link href={link.href} key={link.href} className="quick-link">
                <span className="section-icon">
                  <Icon name={link.icon} />
                </span>
                <span>
                  <strong>{link.title}</strong>
                  <small>{link.subtitle}</small>
                </span>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>A simple, human workflow</h2>
              <p>Your judgement at every step.</p>
            </div>
          </div>
          <div className="card-body">
            <ol className="workflow-list">
              {[
                ["Select & prepare", "Paste the job link, title and brief."],
                [
                  "Generate & review",
                  "AI writes the proposal and screening answers.",
                ],
                [
                  "Approve & copy",
                  "Approve the final version. Submit in Upwork yourself.",
                ],
              ].map(([title, detail]) => (
                <li key={title}>
                  <div>
                    <strong>{title}</strong>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </>
  );
}
