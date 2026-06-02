"use client";

import { useActionState, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createApiKeyAction, revokeApiKeyAction, type ApiKeyState } from "./api-keys-actions";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";

interface KeyRow {
  id: number;
  note: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export function ApiKeys({ keys }: { keys: KeyRow[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ApiKeyState, FormData>(createApiKeyAction, null);

  useEffect(() => {
    if (state?.plaintext) {
      setCreated(state.plaintext);
      setOpen(false);
    }
  }, [state]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">API keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">Authenticate REST requests to the Tidetime API.</p>
        </div>
        {!open ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New key
          </Button>
        ) : null}
      </div>

      {open ? (
        <form action={action} className="mt-4 flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="note">Label</Label>
            <Input id="note" name="note" placeholder="e.g. Zapier" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      ) : null}

      {created ? (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Copy your key now — it won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">{created}</code>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => {
                navigator.clipboard.writeText(created);
                toast({ title: "Copied to clipboard" });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 divide-y">
        {keys.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{k.note ?? "Untitled key"}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                  </p>
                </div>
              </div>
              <form action={revokeApiKeyAction}>
                <input type="hidden" name="id" value={k.id} />
                <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
