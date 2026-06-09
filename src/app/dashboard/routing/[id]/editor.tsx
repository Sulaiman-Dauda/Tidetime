"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react";
import type {
  RoutingAction,
  RoutingField,
  RoutingFieldType,
  RoutingRoute,
} from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveRoutingFormAction } from "../actions";

interface EventTypeOpt {
  id: number;
  title: string;
}

interface FormData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  fields: RoutingField[];
  routes: RoutingRoute[];
  fallback: RoutingAction | null;
  active: boolean;
}

const FIELD_TYPES: { value: RoutingFieldType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
];

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "is_any_of", label: "is any of (comma list)" },
] as const;

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

/** Editor for a single RoutingAction (used by routes + fallback). */
function ActionEditor({
  action,
  eventTypes,
  onChange,
}: {
  action: RoutingAction | null;
  eventTypes: EventTypeOpt[];
  onChange: (a: RoutingAction) => void;
}) {
  const type = action?.type ?? "event_type";
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select
        value={type}
        onValueChange={(v) => {
          if (v === "event_type") onChange({ type: "event_type", eventTypeId: eventTypes[0]?.id ?? 0 });
          else if (v === "external_url") onChange({ type: "external_url", url: "" });
          else onChange({ type: "message", message: "" });
        }}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="event_type">Book a service</SelectItem>
          <SelectItem value="external_url">Go to a URL</SelectItem>
          <SelectItem value="message">Show a message</SelectItem>
        </SelectContent>
      </Select>

      {action?.type === "event_type" ? (
        <Select
          value={String(action.eventTypeId)}
          onValueChange={(v) => onChange({ type: "event_type", eventTypeId: Number(v) })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose a service" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((et) => (
              <SelectItem key={et.id} value={String(et.id)}>
                {et.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : action?.type === "external_url" ? (
        <Input
          className="flex-1"
          placeholder="https://…"
          value={action.url}
          onChange={(e) => onChange({ type: "external_url", url: e.target.value })}
        />
      ) : (
        <Input
          className="flex-1"
          placeholder="Message to show the respondent"
          value={action?.type === "message" ? action.message : ""}
          onChange={(e) => onChange({ type: "message", message: e.target.value })}
        />
      )}
    </div>
  );
}

export function RoutingFormEditor({
  appUrl,
  form,
  eventTypes,
}: {
  appUrl: string;
  form: FormData;
  eventTypes: EventTypeOpt[];
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? "");
  const [active, setActive] = useState(form.active);
  const [fields, setFields] = useState<RoutingField[]>(form.fields);
  const [routes, setRoutes] = useState<RoutingRoute[]>(form.routes);
  const [fallback, setFallback] = useState<RoutingAction | null>(
    form.fallback ?? { type: "message", message: "Thanks! We'll be in touch." },
  );

  function addField() {
    setFields((f) => [...f, { id: uid(), label: "", type: "short_text", required: false }]);
  }
  function updateField(id: string, patch: Partial<RoutingField>) {
    setFields((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeField(id: string) {
    setFields((f) => f.filter((x) => x.id !== id));
    setRoutes((rs) =>
      rs.map((r) => ({ ...r, conditions: r.conditions.filter((c) => c.fieldId !== id) })),
    );
  }

  function addRoute() {
    setRoutes((rs) => [
      ...rs,
      {
        id: uid(),
        conditions: fields[0] ? [{ fieldId: fields[0].id, operator: "equals", value: "" }] : [],
        action: { type: "event_type", eventTypeId: eventTypes[0]?.id ?? 0 },
      },
    ]);
  }
  function updateRoute(id: string, patch: Partial<RoutingRoute>) {
    setRoutes((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRoute(id: string) {
    setRoutes((rs) => rs.filter((r) => r.id !== id));
  }

  function save() {
    startTransition(async () => {
      const res = await saveRoutingFormAction({
        id: form.id,
        name: name.trim(),
        description: description.trim() || null,
        fields,
        routes,
        fallback,
        active,
      });
      if (res?.ok) toast({ title: "Form saved" });
      else toast({ title: "Couldn't save", description: res?.error, variant: "destructive" });
    });
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/routing" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Routing forms
        </Link>
        <div className="flex items-center gap-3">
          <a href={`${appUrl}/forms/${form.slug}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">
            /forms/{form.slug}
          </a>
          <Button onClick={save} disabled={pending}>
            <Check className="h-4 w-4" /> {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Section title="Form details">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Intro (optional)</Label>
          <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-medium">Live</span>
            <p className="text-xs text-muted-foreground">When off, the public form returns not found.</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
      </Section>

      <Section title="Questions" description="What you ask the respondent. Reference these in routes below.">
        <div className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          ) : null}
          {fields.map((f) => (
            <div key={f.id} className="space-y-2 rounded-xl border border-border/60 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  className="flex-1"
                  placeholder="Question label"
                  value={f.label}
                  onChange={(e) => updateField(f.id, { label: e.target.value })}
                />
                <Select value={f.type} onValueChange={(v) => updateField(f.id, { type: v as RoutingFieldType })}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={f.required} onCheckedChange={(v) => updateField(f.id, { required: v })} />
                  Required
                </label>
                <Button variant="ghost" size="icon" onClick={() => removeField(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {f.type === "select" ? (
                <Input
                  placeholder="Options, comma-separated"
                  value={(f.options ?? []).join(", ")}
                  onChange={(e) =>
                    updateField(f.id, {
                      options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                    })
                  }
                />
              ) : null}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus className="h-4 w-4" /> Add question
          </Button>
        </div>
      </Section>

      <Section title="Routes" description="The first route whose conditions all match decides where the respondent goes.">
        <div className="space-y-4">
          {routes.map((r, idx) => (
            <div key={r.id} className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Route {idx + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeRoute(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {r.conditions.map((c, ci) => (
                  <div key={ci} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={c.fieldId}
                      onValueChange={(v) =>
                        updateRoute(r.id, {
                          conditions: r.conditions.map((x, i) => (i === ci ? { ...x, fieldId: v } : x)),
                        })
                      }
                    >
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue placeholder="Question" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label || "(untitled)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={c.operator}
                      onValueChange={(v) =>
                        updateRoute(r.id, {
                          conditions: r.conditions.map((x, i) =>
                            i === ci ? { ...x, operator: v as typeof c.operator } : x,
                          ),
                        })
                      }
                    >
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="flex-1"
                      placeholder="Value"
                      value={c.value}
                      onChange={(e) =>
                        updateRoute(r.id, {
                          conditions: r.conditions.map((x, i) => (i === ci ? { ...x, value: e.target.value } : x)),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateRoute(r.id, { conditions: r.conditions.filter((_, i) => i !== ci) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={fields.length === 0}
                  onClick={() =>
                    updateRoute(r.id, {
                      conditions: [
                        ...r.conditions,
                        { fieldId: fields[0]?.id ?? "", operator: "equals", value: "" },
                      ],
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Add condition
                </Button>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Then</Label>
                <div className="mt-1.5">
                  <ActionEditor
                    action={r.action}
                    eventTypes={eventTypes}
                    onChange={(a) => updateRoute(r.id, { action: a })}
                  />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRoute}>
            <Plus className="h-4 w-4" /> Add route
          </Button>
        </div>
      </Section>

      <Section title="Fallback" description="Where to send respondents when no route matches.">
        <ActionEditor action={fallback} eventTypes={eventTypes} onChange={setFallback} />
      </Section>
    </div>
  );
}
