"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./ui/brand";
import { Icon } from "./ui/icon";
import { Button } from "./ui/button";
import { apiRequest } from "@/lib/client/api";

export function LoginScreen({
  connectionError = "",
}: {
  connectionError?: string;
}) {
  const [error, setError] = useState(connectionError);
  const [opening, setOpening] = useState(false);
  const router = useRouter();
  async function connectMcp() {
    setOpening(true);
    setError("");
    try {
      const result = await apiRequest<{ url: string }>("/api/upwork/login", {
        method: "POST",
        body: "{}",
      });
      window.location.assign(result.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not connect Upwork MCP.",
      );
      setOpening(false);
    }
  }
  async function openWorkspace(destination = "/dashboard") {
    setOpening(true);
    setError("");
    try {
      await apiRequest("/api/session", {
        method: "POST",
        body: JSON.stringify({ preview: true }),
      });
      router.push(destination);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The workspace could not open.",
      );
      setOpening(false);
    }
  }
  return (
    <div className="signed-out">
      <section className="login-page" aria-label="Open workspace">
        <div className="login-story">
          <Brand />
          <div className="login-story-content">
            <span className="login-kicker">LESS ADMIN. MORE POSSIBILITY.</span>
            <h1>
              Your next opportunity
              <br />
              deserves a<br /> <em>thoughtful start.</em>
            </h1>
            <p>
              A private space to prepare better proposals.
              <br />
              Bring your experience. We’ll help you put it into words.
            </p>
            <div className="login-illustration" aria-hidden="true">
              <div className="illustration-orbit" />
              <div className="mini-evidence">
                <span>✳</span>The right experience
              </div>
              <div className="mini-proposal">
                <div className="mini-heading">
                  <span className="mini-avatar">J</span>
                  <div>
                    <strong>A proposal, with purpose.</strong>
                    <small>Prepared by you. Reviewed by you.</small>
                  </div>
                  <span className="mini-check">✓</span>
                </div>
                <div className="mini-line long" />
                <div className="mini-line" />
                <div className="mini-line short" />
                <div className="mini-proof">
                  <span>✓</span>Grounded in your work
                </div>
              </div>
              <div className="mini-ready">
                <span>✓</span>Ready for your final say
              </div>
            </div>
          </div>
          <div className="login-story-footer">
            <span>Human judgement, always.</span>
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-topline">
            <span className="offline-pill">
              <span />
              Online AI workspace
            </span>
          </div>
          <div className="login-form-wrap">
            <div className="login-welcome">YOUR NORDSTONE WORKSPACE</div>
            <h2>Welcome back.</h2>
            <p className="login-description">
              Your company experience, projects and proposal tools in one place.
            </p>
            <Button
              className="login-submit"
              onClick={() => void connectMcp()}
              disabled={opening}
            >
              Connect Upwork MCP
              <Icon name="external" />
            </Button>
            <Button
              variant="secondary"
              disabled={opening}
              onClick={() => void openWorkspace("/settings")}
            >
              Connect through this computer
            </Button>
            <div className="login-divider">
              <span>or enter jobs manually</span>
            </div>
            <Button
              variant="secondary"
              className="preview-workspace"
              onClick={() => void openWorkspace()}
              disabled={opening}
            >
              {opening ? "Opening workspace…" : "Open workspace"}
              <Icon name="arrow" />
            </Button>
            <p id="login-error" role="status">
              {error}
            </p>
          </div>
          <div className="login-bottomline">
            © 2026 NordStone
            <span>Thoughtful proposals. Personal connections.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
