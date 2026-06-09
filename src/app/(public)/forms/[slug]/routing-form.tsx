"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import type { RoutingField } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { submitRoutingFormAction } from "../actions";

export function PublicRoutingForm({ slug, fields }: { slug: string; fields: RoutingField[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function set(id: string, value: string) {
    setErrors((e) => {
      if (!e[id]) return e;
      const next = { ...e };
      delete next[id];
      return next;
    });
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const res = await submitRoutingFormAction(slug, answers);
      if (!res) return;
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        if (res.error) setFormError(res.error);
        return;
      }
      const dest = res.destination;
      if (dest.kind === "path") router.push(dest.value as never);
      else if (dest.kind === "url") window.location.href = dest.value;
      else setMessage(dest.value);
    });
  }

  if (message) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm text-muted-foreground">{message}</p>
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
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={f.id}>
            {f.label}
            {f.required ? " *" : ""}
          </Label>
          {f.type === "long_text" ? (
            <Textarea id={f.id} rows={3} value={answers[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)} />
          ) : f.type === "select" ? (
            <Select value={answers[f.id] ?? ""} onValueChange={(v) => set(f.id, v)}>
              <SelectTrigger id={f.id}>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {(f.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={f.id}
              type={f.type === "email" ? "email" : f.type === "number" ? "number" : f.type === "phone" ? "tel" : "text"}
              value={answers[f.id] ?? ""}
              onChange={(e) => set(f.id, e.target.value)}
              aria-invalid={Boolean(errors[f.id])}
            />
          )}
          {errors[f.id] ? <p className="text-xs text-destructive">{errors[f.id]}</p> : null}
        </div>
      ))}

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
      </Button>
    </form>
  );
}
