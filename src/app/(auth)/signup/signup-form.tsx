"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction, type ActionResult } from "../actions";
import { FieldError, FormAlert } from "../_components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending}>
      Create account
    </Button>
  );
}

export function SignupForm({
  inviteToken,
  inviteEmail,
}: {
  inviteToken: string;
  inviteEmail: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(signupAction, {});
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="inviteToken" value={inviteToken} />
      <input type="hidden" name="timeZone" value={timeZone} />

      {state.error ? <FormAlert>{state.error}</FormAlert> : null}

      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          placeholder="Your full name"
          aria-invalid={fieldError("name") ? true : undefined}
        />
        <FieldError>{fieldError("name")}</FieldError>
      </Field>

      <Field label="Email" htmlFor="email" hint="This is the address your invitation was sent to.">
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={inviteEmail}
          readOnly
          className="bg-muted text-muted-foreground"
        />
      </Field>

      <Field label="Username" htmlFor="username">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          placeholder="yourname"
          aria-invalid={fieldError("username") ? true : undefined}
        />
        <FieldError>{fieldError("username")}</FieldError>
      </Field>

      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={fieldError("password") ? true : undefined}
        />
        <FieldError>{fieldError("password")}</FieldError>
      </Field>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
