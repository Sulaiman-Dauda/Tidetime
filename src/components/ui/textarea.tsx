import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClassName } from "@/components/ui/input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(fieldClassName, "flex min-h-20 px-3 py-2 leading-6", className)}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
