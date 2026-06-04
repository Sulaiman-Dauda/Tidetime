import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { hasAnyUser } from "@/lib/auth";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up Tidetime" };

export default async function SetupPage() {
  // Once an owner exists, onboarding is closed.
  if (await hasAnyUser()) redirect("/login");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Welcome to Tidetime</CardTitle>
          <CardDescription>
            Create the owner account for this instance. Next, you’ll create your first service and share its booking link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm />
        </CardContent>
      </Card>
    </div>
  );
}
