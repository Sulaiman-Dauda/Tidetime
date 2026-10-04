import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { AuthShell } from "./_components/auth-card";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAnyUser())) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <AuthShell>{children}</AuthShell>;
}
