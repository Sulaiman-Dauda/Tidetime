import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites, teams } from "@/db/schema";
import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="w-full max-w-sm space-y-7">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invalid invitation</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This invite link is invalid or has expired. Please ask your team admin for a new invitation.
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Go to login
          </Link>
        </p>
      </div>
    );
  }

  const [team] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, inviteRow.teamId))
    .limit(1);

  return (
    <div className="w-full max-w-sm space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Join {team?.name ?? "the team"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You&apos;ve been invited to join. Create your account to get started.
        </p>
      </div>

      <SignupForm inviteToken={invite} inviteEmail={inviteRow.email} />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
