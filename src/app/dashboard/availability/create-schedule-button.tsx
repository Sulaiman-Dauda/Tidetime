"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createScheduleAction } from "./actions";

export function CreateScheduleButton({ targetUserId }: { targetUserId?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const data = new FormData();
          if (targetUserId) data.set("targetUserId", String(targetUserId));
          await createScheduleAction(data);
          router.refresh();
        })
      }
    >
      <Plus className="h-4 w-4" /> Create schedule
    </Button>
  );
}
