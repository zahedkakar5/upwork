"use client";
import { useWorkspace } from "./workspace-provider";
import { PageHeading } from "../ui/page-heading";
export function Settings() {
  const { status, profile } = useWorkspace();
  const rows = [
    [
      `${status.provider === "gemini" ? "Google Gemini" : "OpenAI"} · ${status.model}`,
      status.aiConfigured
        ? "The key is configured on the server. Access is verified when you generate."
        : "Configure the provider API key locally and restart the app.",
      status.aiConfigured ? "Configured" : "Not connected",
    ],
    [
      "Upwork",
      status.upworkConnected
        ? "Upwork authorization is active. Paste a job URL to import its title and brief. Submission remains manual."
        : "Connect Upwork from the login page to import jobs. Manual entry is available.",
      status.upworkConnected ? "Connected" : "Not connected",
    ],
    [
      "Workspace",
      `${profile.memberName} / ${profile.companyName}. ${status.upworkConnected ? "Upwork authorization active." : "Preview workspace."}`,
      "Preview",
    ],
    [
      "About us",
      "Your saved company profile is kept on this computer and used for AI drafting.",
      "Saved locally",
    ],
    [
      "Active jobs",
      "Your active brief and proposal are saved on this computer. Clearing a task or signing out removes active content.",
      "Saved locally",
    ],
    [
      "Idle clearing",
      "The workspace clears active content and signs out after 60 minutes without interaction.",
      "60 minutes",
    ],
  ];
  return (
    <>
      <PageHeading
        title="Your local workspace."
        subtitle="Connections and workspace settings."
      />
      <section className="card">
        <div className="card-body">
          {rows.map(([title, detail, value]) => (
            <div className="settings-row" key={title}>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
              <span className="setting-value">{value}</span>
            </div>
          ))}
          <p className="hint">
            Generate sends the brief, screening questions and saved About us
            profile to the configured AI provider. Provider retention rules
            apply. API keys never go to the browser.
          </p>
        </div>
      </section>
    </>
  );
}
