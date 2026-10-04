"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { deleteCustomerAction } from "../actions";

export function DeleteCustomerButton({ id, name }: { id: number; name: string }) {
  const [pending, start] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive-subtle hover:text-destructive"
        >
          <Trash2 />
          Delete customer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes them from the customer directory permanently. Their past bookings are kept for
            your records. If they book again, a fresh customer record is created.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form
            action={(formData) => {
              start(async () => {
                await deleteCustomerAction(formData);
              });
            }}
          >
            <input type="hidden" name="id" value={id} />
            <AlertDialogAction
              type="submit"
              className={buttonVariants({ variant: "destructive", className: "w-full sm:w-auto" })}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete customer"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
