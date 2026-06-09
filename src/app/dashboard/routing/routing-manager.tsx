"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Workflow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyLinkButton } from "@/app/dashboard/_components/copy-link-button";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { createRoutingFormAction, deleteRoutingFormAction } from "./actions";

interface FormRow {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  fields: number;
  routes: number;
}

export function RoutingManager({ appUrl, forms }: { appUrl: string; forms: FormRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const res = await createRoutingFormAction(name);
      if (res?.ok && res.id) {
        setName("");
        router.push(`/dashboard/routing/${res.id}`);
      } else {
        toast({ title: "Couldn't create form", description: res?.error, variant: "destructive" });
      }
    });
  }

  function remove(id: number, formName: string) {
    startTransition(async () => {
      const res = await deleteRoutingFormAction(id);
      if (res?.ok) {
        toast({ title: `Deleted “${formName}”` });
        router.refresh();
      } else {
        toast({ title: "Couldn't delete", variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Input
          placeholder="New form name, e.g. Sales triage"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
        />
        <Button onClick={create} disabled={pending || !name.trim()}>
          <Plus className="h-4 w-4" /> Create form
        </Button>
      </Card>

      {forms.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No routing forms yet"
          description="Create one to triage incoming requests and route them to the right place."
        />
      ) : (
        <div className="grid gap-3">
          {forms.map((f) => (
            <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/routing/${f.id}`} className="font-medium hover:underline">
                    {f.name}
                  </Link>
                  <Badge variant={f.active ? "success" : "secondary"}>
                    {f.active ? "Live" : "Draft"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {f.fields} field{f.fields === 1 ? "" : "s"} · {f.routes} route
                  {f.routes === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CopyLinkButton url={`${appUrl}/forms/${f.slug}`} label={`/forms/${f.slug}`} />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/routing/${f.id}`}>Edit</Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(f.id, f.name)} disabled={pending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
