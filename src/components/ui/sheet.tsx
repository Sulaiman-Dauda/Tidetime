"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-black/60",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-popover transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
          side === "left"
            ? "inset-y-0 left-0 h-full w-72 max-w-[85vw] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
            : "inset-y-0 right-0 h-full w-72 max-w-[85vw] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
};
