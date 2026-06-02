"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeamAction, type TeamState } from "./actions";
import { Plus } from "lucide-react";

export function CreateTeam() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TeamState, FormData>(createTeamAction, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New team
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="sr-only">
          Team name
        </Label>
        <Input id="name" name="name" placeholder="Team name" autoFocus required className="w-48" />
        {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
