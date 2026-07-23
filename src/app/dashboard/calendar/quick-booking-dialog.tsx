"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
  services: CalendarService[];
}

/**
 * Quick-create a booking from the calendar. Opened by the per-day "+" affordance
 * or by drag-creating on an empty day. The host picks a service, time, and
 * attendee; the booking is confirmed immediately (manual host booking).
 */
export function QuickBookingDialog({ open, onOpenChange, date, services }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [slug, setSlug] = useState(services[0]?.slug ?? "");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(services[0]?.length ?? 30);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Reset volatile fields each time the dialog opens for a new day.
  useEffect(() => {
    if (open) {
      const first = services[0];
      setSlug((s) => s || first?.slug || "");
      setName("");
      setEmail("");
      setNotes("");
    }
  }, [open, services]);

  // Keep the duration in step with the selected service's default length.
  function onSelectService(next: string) {
    setSlug(next);
    const svc = services.find((s) => s.slug === next);
    if (svc) setDuration(svc.length);
  }

  function submit() {
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
      });
      if (res?.ok) {
        toast({ title: "Booking created", description: "The attendee was sent a confirmation." });
        onOpenChange(false);
        router.refresh();
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
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
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
          <p className="py-4 text-sm text-muted-foreground">
            Create a service first, then you can add bookings from the calendar.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select value={slug} onValueChange={onSelectService}>
                <SelectTrigger>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qb-time">Start time</Label>
                <Input id="qb-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qb-duration">Duration (min)</Label>
                <Input
                  id="qb-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qb-name">Attendee name</Label>
              <Input id="qb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qb-email">Attendee email</Label>
              <Input
                id="qb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qb-notes">Notes (optional)</Label>
              <Textarea
                id="qb-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Anything the attendee should know"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending || !slug || !name || !email}>
                {pending ? "Creating…" : "Create booking"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
