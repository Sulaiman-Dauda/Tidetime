"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { resetPasswordAction, type ResetActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ResetActionResult, FormData>(resetPasswordAction, {});

  if (state.done) {
    return (
      <div className="space-y-5">
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/8 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mb-2 h-5 w-5" />
          Your password has been updated. You can now log in with your new password.
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Go to log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[13px] font-medium">
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="At least 8 characters"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
