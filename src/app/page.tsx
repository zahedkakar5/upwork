import { redirect } from "next/navigation";
import { readSession } from "@/lib/server/session";
import { LoginScreen } from "@/components/login-screen";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const { connection } = await searchParams;
  if (!connection && (await readSession())) redirect("/dashboard");
  const message =
    connection === "expired"
      ? "The Upwork sign-in link expired. Start a fresh connection below and finish it in this browser."
      : connection === "failed"
        ? "Upwork sign-in did not complete. Start a fresh connection below. If Upwork reports an account restriction, resolve it on Upwork first."
        : "";
  return <LoginScreen connectionError={message} />;
}
