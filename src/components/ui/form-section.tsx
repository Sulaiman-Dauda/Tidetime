import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Settings-style section: title and help text on the left, the controls in a
 * card on the right. Stacks on narrow screens. Use a run of these for any
 * long form (service editor, company settings, profile).
 *
 *   <FormSection title="Branding" description="What customers see.">
 *     <Field ...>...</Field>
 *   </FormSection>
 *
 * Pass `footer` for a per-section Save button (rendered in a CardFooter-style
 * strip), or leave it out when the whole page saves from its header.
 */
function FormSection({
  title,
  description,
  footer,
  className,
  contentClassName,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-x-10 gap-y-4 border-t py-8 first-of-type:border-t-0 first-of-type:pt-0 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 self-start rounded-xl border bg-card shadow-xs">
        <div className={cn("grid gap-5 p-5", contentClassName)}>{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 rounded-b-xl border-t bg-muted/50 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export { FormSection };
