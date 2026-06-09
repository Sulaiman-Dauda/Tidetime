"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, BarChart2, Vote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CopyLinkButton } from "@/app/dashboard/_components/copy-link-button";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { createPollAction } from "./actions";

interface PollRow {
  id: number;
  token: string;
  title: string;
  status: string;
}

const DURATIONS = [15, 30, 45, 60, 90];

export function PollsManager({
  appUrl,
  defaultTimeZone,
  polls,
}: {
  appUrl: string;
  defaultTimeZone: string;
  polls: PollRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState(30);
  const [options, setOptions] = useState<string[]>([""]);
  const [visibility, setVisibility] = useState<"full" | "scores_only" | "limited">("full");
  const [hideParticipants, setHideParticipants] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setLocation("");
    setDuration(30);
    setOptions([""]);
    setVisibility("full");
    setHideParticipants(false);
  }

  function create() {
    const isoOptions = options
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      })
      .filter((v): v is string => v !== null);

    if (!title.trim()) {
      toast({ title: "Add a title", variant: "destructive" });
      return;
    }
    if (isoOptions.length === 0) {
      toast({ title: "Add at least one time option", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const res = await createPollAction({
        title,
        description: description || undefined,
        location: location || undefined,
        durationMinutes: duration,
        timeZone:
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : defaultTimeZone,
        options: isoOptions,
        visibility,
        hideParticipants,
      });
      if (res?.ok) {
        setOpen(false);
        reset();
        toast({ title: "Poll created", description: "Share the voting link with your group." });
        router.refresh();
      } else {
        toast({ title: "Couldn't create poll", description: res?.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : (setOpen(false), reset()))}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New poll
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New meeting poll</DialogTitle>
              <DialogDescription>
                Propose times in your timezone ({defaultTimeZone}). Participants vote, you book the winner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quarterly planning" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description (optional)</Label>
                <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="loc">Location (optional)</Label>
                  <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Online / address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Time options</Label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="datetime-local"
                      value={opt}
                      onChange={(e) =>
                        setOptions((os) => os.map((o, j) => (j === i ? e.target.value : o)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOptions((os) => (os.length === 1 ? os : os.filter((_, j) => j !== i)))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setOptions((os) => [...os, ""])}>
                  <Plus className="h-4 w-4" /> Add time option
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>Result visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Everyone sees all votes</SelectItem>
                    <SelectItem value="scores_only">Show totals only (hide who voted)</SelectItem>
                    <SelectItem value="limited">Each voter sees only their own vote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {visibility === "full" ? (
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Hide participant names</Label>
                    <p className="text-xs text-muted-foreground">Show votes as “Participant 1, 2…”.</p>
                  </div>
                  <Switch checked={hideParticipants} onCheckedChange={setHideParticipants} />
                </div>
              ) : null}

              <Button className="w-full" onClick={create} disabled={pending}>
                {pending ? "Creating…" : "Create poll"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {polls.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No meeting polls yet"
          description="Create a poll to find a time that works for a whole group."
        />
      ) : (
        <div className="grid gap-3">
          {polls.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/polls/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <Badge
                    variant={
                      p.status === "finalized" ? "success" : p.status === "cancelled" ? "secondary" : "outline"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.status === "open" ? (
                  <CopyLinkButton url={`${appUrl}/poll/${p.token}`} label={`/poll/${p.token.slice(0, 8)}…`} />
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/polls/${p.id}`}>
                    <BarChart2 className="h-4 w-4" /> Results
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
