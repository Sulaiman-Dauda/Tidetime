import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared by Input, Textarea and SelectTrigger so every field looks the same. */
const fieldClassName =
  "w-full min-w-0 rounded-lg border border-input bg-background text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClassName,
          "flex h-9 px-3 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, fieldClassName };
