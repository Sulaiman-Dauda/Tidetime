"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { resetPasswordAction, type ResetActionResult } from "../actions";
import { FormAlert } from "../_components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending}>
      Update password
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ResetActionResult, FormData>(resetPasswordAction, {});

  if (state.done) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">
          Your password has been updated. You can now log in with it.
        </FormAlert>
        <Button asChild className="w-full">
          <Link href="/login">Go to log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
