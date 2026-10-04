import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../_components/auth-card";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard title="Invalid link" description="This password reset link is missing or malformed.">
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick a strong password you don't use elsewhere."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
