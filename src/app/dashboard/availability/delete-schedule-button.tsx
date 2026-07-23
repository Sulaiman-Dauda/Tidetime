"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteScheduleAction } from "./actions";

export function DeleteScheduleButton({ scheduleId, scheduleName }: { scheduleId: number; scheduleName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
          Delete schedule
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{scheduleName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes this schedule and all its availability rules. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form
            action={async (formData) => {
              start(async () => {
                const res = await deleteScheduleAction(formData);
                if (res.ok) {
                  toast({ title: "Schedule deleted" });
                  router.refresh();
                } else {
                  toast({ variant: "destructive", title: "Couldn't delete schedule", description: res.error });
                }
              });
            }}
          >
            <input type="hidden" name="scheduleId" value={scheduleId} />
            <AlertDialogAction
              type="submit"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/88"
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete schedule"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
