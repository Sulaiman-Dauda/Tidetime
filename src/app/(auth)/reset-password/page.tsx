import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="w-full max-w-sm space-y-7">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invalid link</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This password reset link is missing or malformed.
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-foreground underline-offset-4 hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pick a strong password you don&apos;t use elsewhere.
        </p>
      </div>

      <ResetPasswordForm token={token} />
    </div>
  );
}
