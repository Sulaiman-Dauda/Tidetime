"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/empty-state";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
  type CategoryState,
} from "./actions";

interface Category {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  eventTypeCount: number;
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <CreateForm />
      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create a category to start organising your services."
        />
      ) : (
        <div className="space-y-2">
          {categories.map((cat) =>
            editingId === cat.id ? (
              <EditForm key={cat.id} category={cat} onDone={() => setEditingId(null)} />
            ) : (
              <Card key={cat.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                    style={{ backgroundColor: cat.color ?? "transparent" }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{cat.name}</p>
                    {cat.description && (
                      <p className="truncate text-xs text-muted-foreground">{cat.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {cat.eventTypeCount} {cat.eventTypeCount === 1 ? "service" : "services"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(cat.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={cat.id} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="submit">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function CreateForm() {
  const [state, action] = useActionState<CategoryState, FormData>(createCategoryAction, null);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Category created" });
      setOpen(false);
    }
    if (state?.error)
      toast({ title: "Couldn't create category", description: state.error, variant: "destructive" });
  }, [state, toast]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" /> New category
      </Button>
    );
  }

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" name="name" required placeholder="Consultations" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-color">Colour</Label>
            <Input id="new-color" name="color" type="color" defaultValue="#4f46e5" className="h-9 w-16 p-1" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-description">Description</Label>
          <Textarea id="new-description" name="description" rows={2} placeholder="Optional short description." />
        </div>
        <div className="flex items-center gap-2">
          <SubmitButton>Create category</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EditForm({ category, onDone }: { category: Category; onDone: () => void }) {
  const [state, action] = useActionState<CategoryState, FormData>(updateCategoryAction, null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Category updated" });
      onDone();
    }
    if (state?.error)
      toast({ title: "Couldn't update category", description: state.error, variant: "destructive" });
  }, [state, toast, onDone]);

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={category.id} />
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${category.id}`}>Name</Label>
            <Input id={`name-${category.id}`} name="name" required defaultValue={category.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`color-${category.id}`}>Colour</Label>
            <Input
              id={`color-${category.id}`}
              name="color"
              type="color"
              defaultValue={category.color ?? "#4f46e5"}
              className="h-9 w-16 p-1"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`desc-${category.id}`}>Description</Label>
          <Textarea id={`desc-${category.id}`} name="description" rows={2} defaultValue={category.description ?? ""} />
        </div>
        <div className="flex items-center gap-2">
          <SubmitButton>Save</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
