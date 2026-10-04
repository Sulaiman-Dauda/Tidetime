import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import { WaveMark } from "@/components/wave-mark";
import { cn } from "@/lib/utils";

/**
 * The pieces every sign-in screen and the first-run setup share: a centred
 * column on the canvas, the Tidetime mark above a single card, and quiet links
 * underneath it.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5 rounded-md">
          <WaveMark size={28} />
          <span className="text-base font-semibold tracking-tight text-foreground">Tidetime</span>
        </Link>
        {children}
      </div>
    </main>
  );
}

export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Quiet links under the card (forgot password, back to log in). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="rounded-xl bg-card p-6 shadow-popover sm:p-8">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description ? <p className="text-balance text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
      {footer ? (
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      ) : null}
    </>
  );
}

export const authLinkClassName =
  "rounded-sm font-medium text-foreground underline-offset-4 hover:underline";

export function AuthLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return <Link className={cn(authLinkClassName, className)} {...props} />;
}

/** A form-level message: what went wrong, or that the request went through. */
export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-lg px-3 py-2.5 text-sm",
        tone === "error" ? "bg-destructive-subtle text-destructive" : "bg-success-subtle text-success",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

/** Renders nothing until there is a message, so callers can pass it unconditionally. */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-meta text-destructive">{children}</p>;
}
