"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  teamId,
  role,
}: {
  inviteToken: string;
  inviteEmail: string;
  teamId: number;
  role: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(signupAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="inviteToken" value={inviteToken} />
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="role" value={role} />

      {state.error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-[13px] font-medium">Name</Label>
        <Input id="name" name="name" required placeholder="Your full name" />
        {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
        <Input id="email" name="email" type="email" required defaultValue={inviteEmail} readOnly />
        <p className="text-xs text-muted-foreground">This email was invited to join the team.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-[13px] font-medium">Username</Label>
        <Input id="username" name="username" required placeholder="yourname" />
        {state.fieldErrors?.username && <FieldError msg={state.fieldErrors.username} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        {state.fieldErrors?.password && <FieldError msg={state.fieldErrors.password} />}
      </div>

      <SubmitButton />
    </form>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-xs text-destructive">{msg}</p>;
}
