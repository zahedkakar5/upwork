"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/client/api";
import { Button } from "../ui/button";
import { useWorkspace } from "./workspace-provider";
import { PageHeading } from "../ui/page-heading";
export function Settings() {
  const { status, profile } = useWorkspace();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  async function reconnect() {
    setConnecting(true);
    setError("");
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
      setConnecting(false);
    }
  }
  const rows = [
    [
      `${status.provider === "gemini" ? "Google Gemini" : "OpenAI"} · ${status.model}`,
      status.aiConfigured
        ? "The key is configured on the server. Access is verified when you generate."
        : "Add your provider API key to enable AI drafting.",
      status.aiConfigured ? "Configured" : "Not connected",
    ],
    [
      "Upwork",
      status.upworkConnected
        ? "Upwork authorization is active. Paste a job URL to import its title and brief. Review proposals here and submit manually on Upwork."
        : "Your Upwork connection is missing or expired. Reconnect below.",
      status.upworkConnected ? "Connected" : "Not connected",
    ],
    [
      "Workspace",
      `${profile.memberName} / ${profile.companyName}. ${status.upworkConnected ? "Upwork authorization active." : "Manual job entry."}`,
      "Active",
    ],
    [
      "About us",
      "Your saved company profile is used for AI drafting.",
      "Saved",
    ],
    [
      "Active jobs",
      "Your active brief and proposal are saved in this browser. Clearing a task or signing out removes active content.",
      "Saved",
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
        title="Your workspace."
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
          <Button disabled={connecting} onClick={() => void reconnect()}>
            {connecting ? "Connecting…" : "Reconnect Upwork MCP"}
          </Button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
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
