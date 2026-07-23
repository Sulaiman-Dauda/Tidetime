"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createScheduleAction } from "./actions";

export function CreateScheduleButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          await createScheduleAction();
          router.refresh();
        })
      }
    >
      <Plus className="h-4 w-4" /> Create schedule
    </Button>
  );
}
