"use client";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  pairCompanion,
  disconnectCompanion,
  companionPaired,
  companionChanged,
} from "@/lib/client/companion";
export function CompanionPanel() {
  const [code, setCode] = useState("");
  const [paired, setPaired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const changed = () => setPaired(companionPaired());
    changed();
    window.addEventListener(companionChanged, changed);
    return () => window.removeEventListener(companionChanged, changed);
  }, []);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      await pairCompanion(code);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pair companion.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card suggestion-source">
      <h2>Upwork companion</h2>
      <p>
        Connect through this computer. Keep the companion running while using
        Upwork jobs here. Your Upwork credentials stay on your computer.
      </p>
      <p>
        <a
          href="http://127.0.0.1:8765/companion"
          target="_blank"
          rel="noreferrer"
        >
          Open companion setup ↗
        </a>
      </p>
      {paired ? (
        <>
          <p role="status">Companion paired for this tab.</p>
          <Button variant="secondary" onClick={disconnectCompanion}>
            Disconnect companion
          </Button>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="companion-code">
              Pairing code from your companion
            </label>
            <input
              id="companion-code"
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button
            disabled={busy || !code.trim()}
            onClick={() => void connect()}
          >
            {busy ? "Checking companion…" : "Pair companion"}
          </Button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">
        Chrome may ask to access your local network. Pairing allows this website
        to read jobs through your signed-in Upwork account. It cannot submit
        proposals or spend Connects. Closing this tab clears the saved pairing.
      </p>
    </section>
  );
}
