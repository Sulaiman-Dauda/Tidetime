import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites, teams } from "@/db/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthLink } from "../_components/auth-card";
import { Button } from "@/components/ui/button";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

interface Props {
  searchParams: Promise<{ invite?: string }>;
}

export default async function SignupPage({ searchParams }: Props) {
  const { invite } = await searchParams;

  // No invite token → redirect to login (signup is invite-only)
  if (!invite) {
    redirect("/login");
  }

  // Validate the invite
  const [inviteRow] = await db
    .select({
      token: invites.token,
      email: invites.email,
      teamId: invites.teamId,
      role: invites.role,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .where(and(eq(invites.token, invite), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .limit(1);

  if (!inviteRow) {
    return (
      <AuthCard
        title="Invalid invitation"
        description="This invite link is invalid or has expired. Ask your team admin for a new one."
      >
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to log in</Link>
        </Button>
      </AuthCard>
    );
  }

  const [team] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, inviteRow.teamId))
    .limit(1);

  return (
    <AuthCard
      title={`Join ${team?.name ?? "the team"}`}
      description="You've been invited to join. Create your account to get started."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <SignupForm inviteToken={invite} inviteEmail={inviteRow.email} />
    </AuthCard>
  );
}
