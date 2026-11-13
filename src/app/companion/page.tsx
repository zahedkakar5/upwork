import { headers } from "next/headers";
import { CompanionSetup } from "@/components/companion-setup";
export default async function CompanionPage() {
  const host = (await headers()).get("host");
  if (process.env.VERCEL === "1" || host !== "127.0.0.1:8765")
    return (
      <main style={{ padding: 40 }}>
        <h1>Open the companion on your computer</h1>
        <p>
          Start the local app, then open{" "}
          <a href="http://127.0.0.1:8765/companion">companion setup</a>.
        </p>
      </main>
    );
  return <CompanionSetup />;
}
