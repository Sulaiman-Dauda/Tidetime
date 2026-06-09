"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { setupAction, type SetupResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORTED_CURRENCIES } from "@/lib/company-settings";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

const CURRENCY_NAMES: Record<string, string> = {
  usd: "US Dollar",
  eur: "Euro",
  gbp: "British Pound",
  cad: "Canadian Dollar",
  aud: "Australian Dollar",
  nzd: "New Zealand Dollar",
  ngn: "Nigerian Naira",
  zar: "South African Rand",
  inr: "Indian Rupee",
  jpy: "Japanese Yen",
  cny: "Chinese Yuan",
  brl: "Brazilian Real",
  mxn: "Mexican Peso",
  chf: "Swiss Franc",
  sek: "Swedish Krona",
  aed: "UAE Dirham",
};

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? "Setting up…" : "Finish setup"}
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

  // A server-side error always belongs to the account step — surface it there.
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

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="timeZone" value={tz} />

      <Steps step={step} />

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      {/* Step 1 — account. Hidden (not unmounted) on step 2 so values still submit. */}
      <div className={cn("space-y-4", step === 2 && "hidden")}>
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Jane Rivers" value={name} onChange={(e) => setName(e.target.value)} />
          {err("name") && <FieldError msg={err("name")!} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {err("email") && <FieldError msg={err("email")!} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err("password") && <FieldError msg={err("password")!} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          {err("confirmPassword") && <FieldError msg={err("confirmPassword")!} />}
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            if (validateAccount()) setStep(2);
          }}
        >
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Step 2 — company details. */}
      <div className={cn("space-y-4", step === 1 && "hidden")}>
        <div className="space-y-2">
          <Label htmlFor="instanceName">Company name</Label>
          <Input id="instanceName" name="instanceName" placeholder="Acme Scheduling" />
          <p className="text-xs text-muted-foreground">Displayed across the booking page and emails.</p>
          {state.fieldErrors?.instanceName && <FieldError msg={state.fieldErrors.instanceName} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyEmail">Company email</Label>
          <Input id="companyEmail" name="companyEmail" type="email" placeholder="noreply@acme.com" />
          <p className="text-xs text-muted-foreground">Reply-to address for system emails (optional).</p>
          {state.fieldErrors?.companyEmail && <FieldError msg={state.fieldErrors.companyEmail} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyWebsite">Company website</Label>
          <Input id="companyWebsite" name="companyWebsite" type="url" placeholder="https://acme.com" />
          {state.fieldErrors?.companyWebsite && <FieldError msg={state.fieldErrors.companyWebsite} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultCurrency">Default currency</Label>
          <select
            id="defaultCurrency"
            name="defaultCurrency"
            defaultValue="usd"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()} — {CURRENCY_NAMES[c] ?? c.toUpperCase()}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Used for pricing, checkout and revenue reporting.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <FinishButton />
        </div>
      </div>
    </form>
  );
}

function Steps({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className={cn(step === 1 && "text-foreground")}>1. Your account</span>
      <span className="h-px w-6 bg-border" />
      <span className={cn(step === 2 && "text-foreground")}>2. Company details</span>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-xs text-destructive">{msg}</p>;
}
