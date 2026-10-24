import { upworkConfigured } from "@/lib/server/upwork/connection";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/server/session";
import { LoginScreen } from "@/components/login-screen";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const params = await searchParams;
  if (params.connection !== "failed" && (await readSession()))
    redirect("/dashboard");
  return (
    <LoginScreen
      upworkConfigured={upworkConfigured()}
      connectionFailed={params.connection === "failed"}
    />
  );
}
