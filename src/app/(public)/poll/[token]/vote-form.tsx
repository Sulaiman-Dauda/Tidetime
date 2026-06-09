"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { PollChoice } from "@/lib/polls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { submitVotesAction, myVotesAction } from "../actions";

interface VoteOption {
  id: number;
  start: string;
  yes: number;
  ifNeedBe: number;
}

const CHOICES: { value: PollChoice; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "if_need_be", label: "If need be" },
  { value: "no", label: "No" },
];

function fmt(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PollVoteForm({
  token,
  timeZone,
  options,
}: {
  token: string;
  timeZone: string;
  options: VoteOption[];
}) {
  const [pending, startTransition] = useTransition();
  // Show every option in the voter's own timezone (options are stored as absolute
  // instants, so this is just a display conversion and is DST-correct). Falls
  // back to the poll's timezone for SSR to avoid a hydration mismatch.
  const [viewerTz, setViewerTz] = useState(timeZone);
  useEffect(() => {
    try {
      setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone);
    } catch {
      /* keep poll timezone */
    }
  }, [timeZone]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [choices, setChoices] = useState<Record<number, PollChoice>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);

  // When a returning voter enters their email, prefill their prior response so
  // they edit rather than start over (their re-vote replaces the old one).
  function loadExisting() {
    const e = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return;
    startTransition(async () => {
      const prior = await myVotesAction({ token, voterEmail: e });
      if (!prior) {
        setEditing(false);
        return;
      }
      setName((n) => n || prior.voterName);
      setChoices(Object.fromEntries(prior.choices.map((c) => [c.optionId, c.choice])));
      setEditing(true);
    });
  }

  function submit() {
    setError(null);
    const picked = Object.entries(choices).map(([optionId, choice]) => ({
      optionId: Number(optionId),
      choice,
    }));
    startTransition(async () => {
      const res = await submitVotesAction({ token, voterName: name, voterEmail: email, choices: picked });
      if (res?.ok) setDone(true);
      else setError(res?.error ?? "Could not submit your vote.");
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium">Thanks for voting!</p>
        <p className="text-sm text-muted-foreground">The organizer will confirm the final time.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name *</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={loadExisting}
          />
        </div>
      </div>

      {editing ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          You&apos;ve voted before — your previous response is loaded. Submitting will update it.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Times shown in your timezone ({viewerTz.replace(/_/g, " ")}).
      </p>

      <div className="space-y-2">
        {options.map((o) => (
          <div
            key={o.id}
            className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">{fmt(o.start, viewerTz)}</p>
              <p className="text-xs text-muted-foreground">
                {o.yes} yes · {o.ifNeedBe} if need be
              </p>
            </div>
            <div className="flex gap-1.5">
              {CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChoices((prev) => ({ ...prev, [o.id]: c.value }))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    choices[o.id] === c.value
                      ? c.value === "yes"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : c.value === "if_need_be"
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-border bg-secondary text-foreground"
                      : "border-border/60 hover:border-primary/40 hover:bg-primary/10",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update votes" : "Submit votes"}
      </Button>
    </form>
  );
}
