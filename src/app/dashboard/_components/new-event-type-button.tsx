"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createEventTypeAction } from "../event-types/actions";

export function NewEventTypeButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [pending, start] = useTransition();

  return (
    <form
      action={createEventTypeAction}
      onSubmit={() => start(() => {})}
    >
      <Button type="submit" size={size} loading={pending}>
        <Plus className="h-3.5 w-3.5" />
        New event type
      </Button>
    </form>
  );
}
