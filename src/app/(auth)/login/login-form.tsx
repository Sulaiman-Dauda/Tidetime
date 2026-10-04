"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginResult } from "../actions";
import {
  AuthCard,
  AuthLink,
  FieldError,
  FormAlert,
  authLinkClassName,
} from "../_components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function SubmitButton({ busy }: { busy: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending || busy}>
      Log in
    </Button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<LoginResult, FormData>(loginAction, {});
  // Controlled so React's reset after each submission keeps them, and the
  // two-factor step can send them again alongside the code.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // "Use a different account" hides the current result until the next submission.
  const [dismissed, setDismissed] = useState<LoginResult | null>(null);
  const result: LoginResult = state === dismissed ? {} : state;
  const codeStep = Boolean(result.needsTotp);

  useEffect(() => {
    if (state.ok) router.push("/dashboard");
  }, [state.ok, router]);

  return (
    <AuthCard
      title={codeStep ? "Two-factor authentication" : "Welcome back"}
      description={
        codeStep
          ? "Enter the 6-digit code from your authenticator app."
          : "Log in to manage your bookings and availability."
      }
      footer={
        codeStep ? (
          <button type="button" className={authLinkClassName} onClick={() => setDismissed(state)}>
            Use a different account
          </button>
        ) : (
          <AuthLink href="/forgot-password">Forgot your password?</AuthLink>
        )
      }
    >
      <form action={formAction} className="space-y-4">
        {result.error ? <FormAlert>{result.error}</FormAlert> : null}

        <div className={cn("space-y-4", codeStep && "hidden")}>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={result.fieldErrors?.email ? true : undefined}
            />
            <FieldError>{result.fieldErrors?.email}</FieldError>
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={result.fieldErrors?.password ? true : undefined}
            />
            <FieldError>{result.fieldErrors?.password}</FieldError>
          </Field>
        </div>

        {codeStep ? (
          <Field label="Authentication code" htmlFor="totp">
            <Input
              id="totp"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={8}
              autoFocus
              required
              className="tabular-nums"
            />
          </Field>
        ) : null}

        <div className="pt-1">
          <SubmitButton busy={Boolean(state.ok)} />
        </div>
      </form>
    </AuthCard>
  );
}
