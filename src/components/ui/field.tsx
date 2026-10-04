import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * One form field: label, control, optional hint. Keeps the label-to-control
 * and control-to-hint spacing identical on every form.
 *
 *   <Field label="Company name" htmlFor="name" hint="Shown on booking pages.">
 *     <Input id="name" name="name" />
 *   </Field>
 */
function Field({
  label,
  htmlFor,
  hint,
  aside,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  /** Sits at the right end of the label row (an InfoTip, a counter, a link). */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {aside}
      </div>
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-meta text-muted-foreground", className)} {...props} />;
}

export { Field, FieldHint };
