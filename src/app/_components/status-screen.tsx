import type { LucideIcon } from "lucide-react";

/**
 * Full-page message for the 404 and error boundaries: centred on the canvas,
 * one icon, a title, a sentence and the way back. Deliberately unbranded, as
 * it also shows to customers who followed a broken booking link.
 */
export function StatusScreen({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** The action(s) out of here. */
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex size-10 items-center justify-center rounded-lg border bg-card shadow-xs">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-balance text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div>
      </div>
    </main>
  );
}
