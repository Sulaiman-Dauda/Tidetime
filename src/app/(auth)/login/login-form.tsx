"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginResult } from "../actions";
import { WaveMark } from "@/components/wave-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Logging in…" : "Log in"}
    </Button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<LoginResult, FormData>(loginAction, {});
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push("/dashboard");
      return;
    }
    setSignedIn(true);
    const t = setTimeout(() => router.push("/dashboard"), 1150);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  return (
    <>
      {signedIn ? <SignInSplash /> : null}
      <form action={formAction} className="space-y-5">
        {state.error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          {state.fieldErrors?.email && <FieldError msg={state.fieldErrors.email} />}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state.fieldErrors?.password && <FieldError msg={state.fieldErrors.password} />}
        </div>
        {state.needsTotp ? (
          <div className="space-y-1.5">
            <Label htmlFor="totp" className="text-[13px] font-medium">
              Two-factor code
            </Label>
            <Input
              id="totp"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={8}
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
        ) : null}
        <SubmitButton />
      </form>
    </>
  );
}

/** Brief, premium sign-in confirmation shown before the dashboard loads. */
function SignInSplash() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      style={{ animation: "tt-fade 0.25s ease both" }}
      aria-hidden
    >
      <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col items-center gap-5">
        <WaveMark size={72} />
        <p
          className="text-lg font-semibold tracking-tight text-foreground"
          style={{ animation: "tt-rise 0.5s cubic-bezier(0.22,1,0.36,1) 0.25s both" }}
        >
          Welcome back
        </p>
        <p
          className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground"
          style={{ animation: "tt-fade 0.5s ease 0.55s both" }}
        >
          Loading your dashboard
        </p>
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-xs text-destructive">{msg}</p>;
}
