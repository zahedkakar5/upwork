import { accessToken } from "@/lib/server/upwork/connection";
import { redirect } from "next/navigation";
import { readSession, csrfForSession } from "@/lib/server/session";
import { profileStore } from "@/lib/server/profile-store";
import { getAIConfig } from "@/lib/server/ai/config";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { AppShell } from "@/components/workspace/app-shell";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/");
  const profile = await profileStore.load(),
    config = getAIConfig();
  return (
    <WorkspaceProvider
      initialProfile={profile}
      status={{
        provider: config.provider,
        model: config.model,
        aiConfigured: Boolean(config.apiKey),
        upworkConnected: Boolean(await accessToken(session)),
        csrf: csrfForSession(session),
      }}
    >
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
