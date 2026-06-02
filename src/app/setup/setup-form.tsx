"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { setupAction, type SetupResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Setting up…" : "Create owner account"}
    </Button>
  );
}

export function SetupForm() {
  const [state, formAction] = useActionState<SetupResult, FormData>(setupAction, {});
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* keep UTC */
    }
  }, []);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="timeZone" value={tz} />
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="instanceName">Workspace name</Label>
        <Input id="instanceName" name="instanceName" placeholder="Acme Scheduling" />
        {state.fieldErrors?.instanceName && <FieldError msg={state.fieldErrors.instanceName} />}
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required placeholder="Jane Rivers" />
        {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="flex items-center rounded-md border border-input bg-transparent pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
          <span className="select-none">/</span>
          <input
            id="username"
            name="username"
            required
            placeholder="jane"
            className="h-9 flex-1 bg-transparent px-1 text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {state.fieldErrors?.username && <FieldError msg={state.fieldErrors.username} />}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        {state.fieldErrors?.email && <FieldError msg={state.fieldErrors.email} />}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required placeholder="At least 8 characters" />
        {state.fieldErrors?.password && <FieldError msg={state.fieldErrors.password} />}
      </div>
      <SubmitButton />
    </form>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-xs text-destructive">{msg}</p>;
}
