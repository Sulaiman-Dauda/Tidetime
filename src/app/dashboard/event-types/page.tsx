import Link from "next/link";
import type { Route } from "next";
import { Clock, Copy, ExternalLink, EyeOff, Settings2, Zap, ChevronUp, ChevronDown } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  listEventTypes,
  duplicateEventTypeAction,
  toggleHiddenAction,
  reorderEventTypesAction,
} from "./actions";
import { NewEventTypeButton } from "../_components/new-event-type-button";
import { DeleteEventButton } from "../_components/delete-event-button";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { env } from "@/lib/env";
import { locationLabel } from "@/lib/locations";

export const metadata = { title: "Services" };

interface Props {
  searchParams: Promise<{ welcome?: string }>;
}

export default async function EventTypesPage({ searchParams }: Props) {
  const { welcome } = await searchParams;
  const user = (await getCurrentUser())!;
  const items = await listEventTypes(user.id);

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Services</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Create the services people can book with you — like a 30-minute consultation.
          </p>
        </div>
        <NewEventTypeButton />
      </div>

      {items.length === 0 ? (
        <EmptyState firstRun={welcome === "1"} />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
          {items.map((et) => {
            const publicUrl = `${env.appUrl}/${user.username}/${et.slug}`;
            return (
              <div
                key={et.id}
                className="group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/70" />

                <Link
                  href={`/dashboard/event-types/${et.id}` as Route}
                  className="min-w-0 flex-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-foreground">{et.title}</span>
                    {et.hidden && (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <EyeOff className="h-2.5 w-2.5" />
                        Hidden
                      </Badge>
                    )}
                    {et.requiresConfirmation && (
                      <Badge variant="outline" className="text-[11px]">
                        Confirmation required
                      </Badge>
                    )}
                    {et.price > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        Price set
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
                    <span className="font-mono">
                      /{user.username}/{et.slug}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(et.length)}
                    </span>
                    {et.locations.length > 0 && (
                      <span>{locationLabel(et.locations[0])}</span>
                    )}
                    {et.seatsPerTimeSlot && et.seatsPerTimeSlot > 1 && (
                      <span>{et.seatsPerTimeSlot} seats</span>
                    )}
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-0.5">
                  {/* Move up / down controls */}
                  <form action={reorderEventTypesAction} className="flex">
                    <input type="hidden" name="id" value={et.id} />
                    <button
                      type="submit"
                      name="direction"
                      value="up"
                      title="Move up"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="submit"
                      name="direction"
                      value="down"
                      title="Move down"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </form>

                  <DeleteEventButton id={et.id} label={et.title} />
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Preview"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <form action={duplicateEventTypeAction}>
                    <input type="hidden" name="id" value={et.id} />
                    <button
                      type="submit"
                      title="Duplicate"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <form action={toggleHiddenAction}>
                    <input type="hidden" name="id" value={et.id} />
                    <input type="hidden" name="hidden" value={String(et.hidden)} />
                    <button
                      type="submit"
                      title={et.hidden ? "Show" : "Hide"}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <Link
                    href={`/dashboard/event-types/${et.id}` as Route}
                    title="Edit"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ firstRun = false }: { firstRun?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      {firstRun ? <Badge variant="secondary" className="mb-4">Step 2 of 2</Badge> : null}
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Zap className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">Create your first service</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {firstRun
          ? "Your workspace is ready. Create the first service people can book with you — we’ll open the editor right away so you can adjust duration, availability, questions, pricing, and more."
          : "Services are what people book — like a 30-minute consultation, a haircut, or a class. Each one gets its own booking page."}
      </p>
      <div className="mt-6">
        <NewEventTypeButton label="Create your first service" size="default" />
      </div>
      <div className="mt-8 max-w-md space-y-3 text-left text-xs text-muted-foreground">
        <p className="font-medium text-foreground/70">After you create a service you can:</p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] text-emerald-600">1</span>
            Set your weekly availability under <strong>Availability</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] text-emerald-600">2</span>
            Share your link <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/yourname</code> with clients
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] text-emerald-600">3</span>
            Connect Google Calendar, Stripe, and email in <strong>Settings</strong>
          </li>
        </ul>
      </div>
    </div>
  );
}
