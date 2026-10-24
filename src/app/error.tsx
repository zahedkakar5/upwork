"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone-state">
      <h1>The workspace couldn’t open.</h1>
      <p>Your saved profile has not been changed.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
