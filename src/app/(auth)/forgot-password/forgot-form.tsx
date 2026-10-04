"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordResetAction, type ResetActionResult } from "../actions";
import { FormAlert } from "../_components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending}>
      Send reset link
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ResetActionResult, FormData>(
    requestPasswordResetAction,
    {},
  );

  if (state.sent) {
    return (
      <FormAlert tone="success">
        If an account exists for that email, a reset link is on its way. Check your inbox.
      </FormAlert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>
      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
