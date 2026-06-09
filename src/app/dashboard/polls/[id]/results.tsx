"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Star, ThumbsUp, ThumbsDown, CircleHelp, CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/app/dashboard/_components/copy-link-button";
import { useToast } from "@/hooks/use-toast";
import { finalizePollAction, cancelPollAction } from "../actions";

interface OptionResult {
  id: number;
  start: string;
  end: string;
  yes: number;
  ifNeedBe: number;
  no: number;
}

interface PollView {
  id: number;
  token: string;
  title: string;
  status: string;
  timeZone: string;
  finalizedOptionId: number | null;
  finalizedBookingUid: string | null;
}

function fmt(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PollResults({
  appUrl,
  poll,
  options,
  bestOptionId,
  voterCount,
}: {
  appUrl: string;
  poll: PollView;
  options: OptionResult[];
  bestOptionId: number | null;
  voterCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function finalize(optionId: number) {
    startTransition(async () => {
      const res = await finalizePollAction(poll.id, optionId);
      if (res?.ok) {
        toast({ title: "Poll finalized", description: "Everyone who's in has been booked & notified." });
        router.refresh();
      } else {
        toast({ title: "Couldn't finalize", description: res?.error, variant: "destructive" });
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      const res = await cancelPollAction(poll.id);
      if (res?.ok) {
        toast({ title: "Poll cancelled" });
        router.refresh();
      }
    });
  }

  const isOpen = poll.status === "open";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/polls" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Meeting polls
        </Link>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <>
              <CopyLinkButton url={`${appUrl}/poll/${poll.token}`} label="Voting link" />
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Cancel poll
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{poll.title}</h1>
          <Badge variant={poll.status === "finalized" ? "success" : poll.status === "cancelled" ? "secondary" : "outline"}>
            {poll.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {voterCount} participant{voterCount === 1 ? "" : "s"} voted · times shown in {poll.timeZone}
        </p>
      </div>

      {poll.status === "finalized" && poll.finalizedBookingUid ? (
        <Card className="flex items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm">
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
            This poll has been booked.
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`${appUrl}/booking/${poll.finalizedBookingUid}`} target="_blank" rel="noreferrer">
              View booking
            </a>
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {options.map((o) => {
          const recommended = o.id === bestOptionId;
          const finalized = o.id === poll.finalizedOptionId;
          return (
            <Card key={o.id} className={`p-4 ${finalized ? "border-emerald-500/40" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{fmt(o.start, poll.timeZone)}</span>
                  {recommended && isOpen ? (
                    <Badge variant="success" className="gap-1">
                      <Star className="h-3 w-3" /> Best
                    </Badge>
                  ) : null}
                  {finalized ? <Badge variant="success">Chosen</Badge> : null}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <ThumbsUp className="h-3.5 w-3.5" /> {o.yes}
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <CircleHelp className="h-3.5 w-3.5" /> {o.ifNeedBe}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <ThumbsDown className="h-3.5 w-3.5" /> {o.no}
                  </span>
                  {isOpen ? (
                    <Button size="sm" onClick={() => finalize(o.id)} disabled={pending}>
                      <Check className="h-4 w-4" /> Book this
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
