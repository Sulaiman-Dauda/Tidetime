"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { setupAction, type SetupResult } from "./actions";
import { AuthCard, FieldError, FormAlert } from "@/app/(auth)/_components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

const STEPS = ["Your account", "Company details"] as const;

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="flex-1" loading={pending}>
      Finish setup
    </Button>
  );
}

export function SetupForm() {
  const [state, formAction] = useActionState<SetupResult, FormData>(setupAction, {});
  const [tz, setTz] = useState("UTC");
  const [step, setStep] = useState<1 | 2>(1);

  // Step-1 account fields, kept controlled so we can validate before advancing.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* keep UTC */
    }
  }, []);

  // A server-side error always belongs to the account step, so surface it there.
  useEffect(() => {
    if (state.fieldErrors?.name || state.fieldErrors?.email || state.fieldErrors?.password || state.fieldErrors?.confirmPassword) {
      setStep(1);
    }
  }, [state.fieldErrors]);

  function validateAccount(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = "Enter a valid email";
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (confirmPassword !== password) errs.confirmPassword = "Passwords do not match";
    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const err = (field: string) => clientErrors[field] ?? state.fieldErrors?.[field];
  const invalid = (field: string) => (err(field) ? true : undefined);

  return (
    <AuthCard
      title="Welcome to Tidetime"
      description={
        step === 1
          ? "Create the owner account for this instance."
          : "Name your company. Next, you'll create your first service."
      }
    >
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="timeZone" value={tz} />

        <StepIndicator step={step} />

        {state.error ? <FormAlert>{state.error}</FormAlert> : null}

        {/* Step 1, the account. Hidden (not unmounted) on step 2 so its values still submit. */}
        <div className={cn("space-y-4", step === 2 && "hidden")}>
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" placeholder="Jane Rivers" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={invalid("name")} />
            <FieldError>{err("name")}</FieldError>
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid("email")} />
            <FieldError>{err("email")}</FieldError>
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={invalid("password")} />
            <FieldError>{err("password")}</FieldError>
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword">
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={invalid("confirmPassword")} />
            <FieldError>{err("confirmPassword")}</FieldError>
          </Field>
          <div className="pt-1">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (validateAccount()) setStep(2);
              }}
            >
              Continue <ArrowRight />
            </Button>
          </div>
        </div>

        {/* Step 2, company details. */}
        <div className={cn("space-y-4", step === 1 && "hidden")}>
          <Field label="Company name" htmlFor="instanceName" hint="Shown on your public booking pages.">
            <Input id="instanceName" name="instanceName" placeholder="Acme Scheduling" aria-invalid={state.fieldErrors?.instanceName ? true : undefined} />
            <FieldError>{state.fieldErrors?.instanceName}</FieldError>
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft /> Back
            </Button>
            <FinishButton />
          </div>
        </div>
      </form>
    </AuthCard>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <ol className="grid grid-cols-2 gap-2" aria-label={`Step ${step} of ${STEPS.length}`}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        return (
          <li key={label} className="space-y-2" aria-current={n === step ? "step" : undefined}>
            <span
              className={cn("block h-1 rounded-sm", n <= step ? "bg-primary" : "bg-border")}
              aria-hidden
            />
            <span
              className={cn(
                "block text-meta",
                n === step ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {n}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
