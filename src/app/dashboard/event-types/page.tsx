import Link from "next/link";
import type { Route } from "next";
import { Clock, Copy, ExternalLink, EyeOff, Settings2, Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  listEventTypes,
  duplicateEventTypeAction,
  toggleHiddenAction,
} from "./actions";
import { NewEventTypeButton } from "../_components/new-event-type-button";
import { DeleteEventButton } from "../_components/delete-event-button";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { env } from "@/lib/env";
import { locationLabel } from "@/lib/locations";

export const metadata = { title: "Services" };

export default async function EventTypesPage() {
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
        <EmptyState />
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
                      <Badge variant="default" className="text-[11px]">
                        Paid
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

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
        <Zap className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground">Create your first service</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        Services are the things people can book with you — like a 30-minute intro call or a haircut.
      </p>
      <div className="mt-5">
        <NewEventTypeButton />
      </div>
    </div>
  );
}
