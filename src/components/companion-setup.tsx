"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import { Button } from "./ui/button";
export function CompanionSetup() {
  const [csrf, setCsrf] = useState("");
  const [connected, setConnected] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void apiRequest<{ csrf: string; upworkConnected: boolean }>("/api/status")
      .then((s) => {
        setCsrf(s.csrf);
        setConnected(s.upworkConnected);
      })
      .catch(() => {});
  }, []);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest<{ url: string }>("/api/upwork/login", {
        method: "POST",
        body: JSON.stringify({ returnTo: "/companion" }),
      });
      window.location.assign(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect.");
      setBusy(false);
    }
  }
  async function pair() {
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest<{ code: string }>("/api/companion/pair", {
        method: "POST",
        headers: { "X-Desk-Token": csrf },
        body: "{}",
      });
      setCode(r.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create pairing.");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/companion/pair", {
        method: "DELETE",
        headers: { "X-Desk-Token": csrf },
      });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke pairing.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: 24 }}>
      <section className="card suggestion-source">
        <h1>Upwork companion</h1>
        <p>
          This app runs on your computer and connects to Upwork MCP using a
          localhost callback. Keep it running while using the website.
        </p>
        {!connected ? (
          <Button disabled={busy} onClick={() => void connect()}>
            Connect Upwork locally
          </Button>
        ) : (
          <>
            <p role="status">Upwork is connected locally.</p>
            <p>
              Generate a private pairing code to allow{" "}
              <strong>upwork-application-omega.vercel.app</strong> to read jobs
              through this connection. A new code replaces the previous pairing.
              Pairing expires within 12 hours or when you sign out locally.
            </p>
            <Button disabled={busy} onClick={() => void pair()}>
              Generate pairing code
            </Button>
            {code && (
              <div className="field">
                <label htmlFor="local-pairing-code">
                  Copy this code into the website’s companion settings
                </label>
                <input
                  id="local-pairing-code"
                  type="password"
                  readOnly
                  value={code}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(code)
                      .catch(() =>
                        setError("Select the code and copy it manually."),
                      )
                  }
                >
                  Copy code
                </Button>
              </div>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void revoke()}
            >
              Revoke website pairing
            </Button>
            <p>
              <a
                href="https://upwork-application-omega.vercel.app/settings"
                target="_blank"
                rel="noreferrer"
              >
                Open website settings ↗
              </a>
            </p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
