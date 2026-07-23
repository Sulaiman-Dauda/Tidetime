"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createServiceAction } from "../services/actions";

export function NewServiceButton({
  size = "sm",
  label = "New service",
}: {
  size?: "sm" | "default";
  label?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <form
      action={createServiceAction}
      onSubmit={() => start(() => {})}
    >
      <Button type="submit" size={size} loading={pending}>
        <Plus className="h-3.5 w-3.5" />
        {label}
      </Button>
    </form>
  );
}
