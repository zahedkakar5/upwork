import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-state">
      <h1>Page not found.</h1>
      <Link className="button primary" href="/dashboard">
        Open workspace
      </Link>
    </main>
  );
}
