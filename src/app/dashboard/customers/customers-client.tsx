"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { CustomerFieldDef } from "@/db/schema";
import { MAX_CUSTOMER_FIELDS, isValidFieldId } from "@/lib/customer-fields";
import { updateCustomerAction, saveCustomerFieldsAction } from "./actions";

/* ---- per-customer editor (notes + custom field answers) ------------------- */

export function CustomerEditor({
  customer,
  fieldDefs,
}: {
  customer: { id: number; name: string; notes: string | null; customFields: Record<string, string> };
  fieldDefs: CustomerFieldDef[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [values, setValues] = useState<Record<string, string>>(customer.customFields ?? {});

  function save() {
    start(async () => {
      const res = await updateCustomerAction(customer.id, { notes, customFields: values });
      if (res?.ok) {
        toast({ title: "Customer updated" });
        setOpen(false);
        router.refresh();
      } else {
        toast({ title: "Couldn't save", description: res?.error, variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${customer.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
          <DialogDescription>Notes and custom fields are private to your team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {fieldDefs.map((def) => (
            <div key={def.id} className="space-y-1.5">
              <Label htmlFor={`cf_${def.id}`}>
                {def.label}
                {def.required ? <span className="text-destructive"> *</span> : null}
              </Label>
              {def.type === "textarea" ? (
                <Textarea
                  id={`cf_${def.id}`}
                  rows={2}
                  value={values[def.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [def.id]: e.target.value }))}
                />
              ) : def.type === "select" ? (
                <Select
                  value={values[def.id] ?? ""}
                  onValueChange={(val) => setValues((v) => ({ ...v, [def.id]: val }))}
                >
                  <SelectTrigger id={`cf_${def.id}`}>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(def.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`cf_${def.id}`}
                  type={def.type === "number" ? "number" : def.type === "phone" ? "tel" : "text"}
                  value={values[def.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [def.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <Button className="w-full" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- admin: manage custom field definitions ------------------------------- */

const TYPE_LABELS: Record<CustomerFieldDef["type"], string> = {
  text: "Text",
  textarea: "Long text",
  number: "Number",
  phone: "Phone",
  select: "Dropdown",
};

export function CustomerFieldsManager({ fieldDefs }: { fieldDefs: CustomerFieldDef[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [defs, setDefs] = useState<CustomerFieldDef[]>(fieldDefs);

  function addField() {
    if (defs.length >= MAX_CUSTOMER_FIELDS) return;
    setDefs((d) => [...d, { id: "", label: "", type: "text", required: false }]);
  }
  function patch(i: number, p: Partial<CustomerFieldDef>) {
    setDefs((d) => d.map((f, j) => (j === i ? { ...f, ...p } : f)));
  }

  function save() {
    for (const d of defs) {
      if (!d.label.trim()) return toast({ title: "Every field needs a label", variant: "destructive" });
      if (!isValidFieldId(d.id)) {
        return toast({
          title: `Invalid key "${d.id}"`,
          description: "Use lowercase letters, numbers and underscores; start with a letter.",
          variant: "destructive",
        });
      }
      if (d.type === "select" && !(d.options ?? []).length) {
        return toast({ title: `"${d.label}" needs dropdown options`, variant: "destructive" });
      }
    }
    start(async () => {
      const res = await saveCustomerFieldsAction(defs);
      if (res?.ok) {
        toast({ title: "Custom fields saved" });
        setOpen(false);
        router.refresh();
      } else {
        toast({ title: "Couldn't save", description: res?.error, variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4" /> Custom fields
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom customer fields</DialogTitle>
          <DialogDescription>
            Capture extra details on every customer (company, VAT number, plan tier…).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {defs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom fields yet.</p>
          ) : null}
          {defs.map((d, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={d.label}
                    placeholder="Company"
                    onChange={(e) => {
                      const label = e.target.value;
                      // auto-suggest a key from the label until the user edits it
                      const autoId = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                      patch(i, { label, ...(d.id === "" ? { id: autoId.slice(0, 32) } : {}) });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Key</Label>
                  <Input value={d.id} placeholder="company" onChange={(e) => patch(i, { id: e.target.value })} />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={d.type} onValueChange={(v) => patch(i, { type: v as CustomerFieldDef["type"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-1.5 pb-2 text-xs">
                  <input
                    type="checkbox"
                    checked={d.required}
                    onChange={(e) => patch(i, { required: e.target.checked })}
                  />
                  Required
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDefs((cur) => cur.filter((_, j) => j !== i))}
                  aria-label="Remove field"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {d.type === "select" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Options (comma-separated)</Label>
                  <Input
                    value={(d.options ?? []).join(", ")}
                    placeholder="Free, Pro, Enterprise"
                    onChange={(e) =>
                      patch(i, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={addField} disabled={defs.length >= MAX_CUSTOMER_FIELDS}>
              <Plus className="h-4 w-4" /> Add field
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save fields"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
