"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(signupAction, {});
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* keep UTC */
    }
  }, []);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="timeZone" value={tz} />
      {state.error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-[13px] font-medium">
          Name
        </Label>
        <Input id="name" name="name" autoComplete="name" required placeholder="Jane Rivers" />
        {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-[13px] font-medium">
          Username
        </Label>
        <div className="flex h-9 items-center overflow-hidden rounded-md border border-input bg-card text-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <span className="select-none border-r border-input bg-secondary px-3 text-muted-foreground">
            tidetime.app/
          </span>
          <input
            id="username"
            name="username"
            required
            placeholder="jane"
            className="h-full flex-1 bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        {state.fieldErrors?.username && <FieldError msg={state.fieldErrors.username} />}
      </div>
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
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
        />
        {state.fieldErrors?.password && <FieldError msg={state.fieldErrors.password} />}
      </div>
      <SubmitButton />
    </form>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-xs text-destructive">{msg}</p>;
}
