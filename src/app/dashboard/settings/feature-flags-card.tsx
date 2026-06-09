"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { setFeatureFlagAction } from "./feature-actions";
import type { FeatureFlags } from "@/server/feature-flags";

const FEATURES: { flag: keyof FeatureFlags; title: string; description: string }[] = [
  {
    flag: "crm",
    title: "CRM sync",
    description:
      "Push each booking to a connected CRM (HubSpot, …). Shows CRM apps in Integrations.",
  },
];

/**
 * Admin toggles for the heavier business features. Off by default to keep the
 * default product lean; flipping one immediately reveals its nav + integrations.
 */
export function FeatureFlagsCard({ flags }: { flags: FeatureFlags }) {
  const { toast } = useToast();
  const [state, setState] = useState<FeatureFlags>(flags);
  const [pending, startTransition] = useTransition();

  function toggle(flag: keyof FeatureFlags, enabled: boolean) {
    setState((s) => ({ ...s, [flag]: enabled }));
    startTransition(async () => {
      const res = await setFeatureFlagAction(flag, enabled);
      if (res?.ok) {
        toast({ title: "Saved", description: `${enabled ? "Enabled" : "Disabled"} successfully.` });
      } else {
        setState((s) => ({ ...s, [flag]: !enabled }));
        toast({
          title: "Couldn't save",
          description: res?.error ?? "Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Card id="features" className="scroll-mt-20 p-6">
      <h2 className="text-base font-semibold">Business features</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Power features for multi-provider businesses, off by default so the core stays a 5-minute
        setup. Enable only what you need.
      </p>
      <div className="mt-5 space-y-4">
        {FEATURES.map((f) => (
          <div key={f.flag} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor={`feature-${f.flag}`} className="text-sm font-medium">
                {f.title}
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
            </div>
            <Switch
              id={`feature-${f.flag}`}
              checked={state[f.flag]}
              disabled={pending}
              onCheckedChange={(v) => toggle(f.flag, v)}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
