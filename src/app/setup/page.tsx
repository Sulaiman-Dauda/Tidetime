import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { AuthShell } from "@/app/(auth)/_components/auth-card";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up Tidetime" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Once an owner exists, onboarding is closed.
  if (await hasAnyUser()) redirect("/login");

  return (
    <AuthShell>
      <SetupForm />
    </AuthShell>
  );
}
