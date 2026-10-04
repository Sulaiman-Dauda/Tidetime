"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createManualBookingAction } from "./actions";

export interface CalendarService {
  slug: string;
  teamSlug: string;
  title: string;
  length: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** YYYY-MM-DD the booking is being created on (host timezone). */
  date: string | null;
  /** BCP-47 locale for the date in the description, from the viewer's profile */
  locale?: string;
  services: CalendarService[];
  /** team roster: managers can book on behalf of a provider; empty otherwise */
  providers?: { id: number; name: string }[];
}

/**
 * Quick-create a booking from the calendar. Opened by the per-day "+" affordance
 * or by drag-creating on an empty day. The host picks a service, time, and
 * attendee; the booking is confirmed immediately (manual host booking).
 */
export function QuickBookingDialog({
  open,
  onOpenChange,
  date,
  locale,
  services,
  providers = [],
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [slug, setSlug] = useState(services[0]?.slug ?? "");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(services[0]?.length ?? 30);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [providerId, setProviderId] = useState<number | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Reset volatile fields each time the dialog opens for a new day.
  useEffect(() => {
    if (open) {
      const first = services[0];
      setSlug((s) => s || first?.slug || "");
      setName("");
      setEmail("");
      setNotes("");
      setConflictWarning(null);
    }
  }, [open, services]);

  // Keep the duration in step with the selected service's default length.
  function onSelectService(next: string) {
    setSlug(next);
    const svc = services.find((s) => s.slug === next);
    if (svc) setDuration(svc.length);
  }

  function submit(allowConflict = false) {
    if (!date) return;
    start(async () => {
      const res = await createManualBookingAction({
        slug,
        teamSlug: services.find((service) => service.slug === slug)?.teamSlug ?? "",
        date,
        time,
        durationMin: duration,
        name,
        email,
        notes,
        preferredHostId: providerId ?? undefined,
        allowConflict,
      });
      if (res?.ok) {
        toast({ title: "Booking created", description: "The attendee was sent a confirmation." });
        onOpenChange(false);
        router.refresh();
      } else if (res?.conflict) {
        setConflictWarning(res.error ?? "That provider already has a booking in this time range.");
      } else {
        toast({
          title: "Couldn't create booking",
          description: res?.error ?? "Please check the details and try again.",
          variant: "destructive",
        });
      }
    });
  }

  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
          <DialogDescription>{dateLabel ? `Add an appointment on ${dateLabel}.` : ""}</DialogDescription>
        </DialogHeader>

        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Create a service first, then you can add bookings from the calendar.
          </p>
        ) : (
          <>
            <div className="grid gap-4">
              <Field label="Service" htmlFor="qb-service">
                <Select value={slug} onValueChange={onSelectService}>
                  <SelectTrigger id="qb-service">
                    <SelectValue placeholder="Pick a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.slug} value={s.slug}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {providers.length > 1 ? (
                <Field label="Provider" htmlFor="qb-provider">
                  <Select
                    value={providerId === null ? "auto" : String(providerId)}
                    onValueChange={(value) => {
                      setProviderId(value === "auto" ? null : Number(value));
                      setConflictWarning(null);
                    }}
                  >
                    <SelectTrigger id="qb-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-assign (least busy)</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Start time" htmlFor="qb-time">
                  <Input
                    id="qb-time"
                    type="time"
                    className="tabular-nums"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </Field>
                <Field label="Duration (min)" htmlFor="qb-duration">
                  <Input
                    id="qb-duration"
                    type="number"
                    min={5}
                    step={5}
                    className="tabular-nums"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field label="Attendee name" htmlFor="qb-name">
                <Input
                  id="qb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </Field>
              <Field label="Attendee email" htmlFor="qb-email">
                <Input
                  id="qb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </Field>
              <Field label="Notes (optional)" htmlFor="qb-notes">
                <Textarea
                  id="qb-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Anything the attendee should know"
                />
              </Field>

              {conflictWarning ? (
                <p
                  role="alert"
                  className="rounded-lg border border-warning/20 bg-warning-subtle px-3 py-2.5 text-meta text-warning"
                >
                  {conflictWarning} Booking anyway creates an overlapping appointment.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              {conflictWarning ? (
                <Button variant="destructive" onClick={() => submit(true)} loading={pending}>
                  {pending ? "Creating…" : "Book anyway"}
                </Button>
              ) : (
                <Button
                  onClick={() => submit()}
                  loading={pending}
                  disabled={!slug || !name || !email}
                >
                  {pending ? "Creating…" : "Create booking"}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
