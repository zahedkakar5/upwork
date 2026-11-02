import { redirect } from "next/navigation";
import { readSession } from "@/lib/server/session";
import { LoginScreen } from "@/components/login-screen";
export default async function LoginPage() {
  if (await readSession()) redirect("/dashboard");
  return <LoginScreen />;
}
