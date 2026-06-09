"use client";

import { useState, useTransition } from "react";
import { Video, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { startInstantMeetingAction } from "./instant-actions";

const DURATIONS = [15, 30, 45, 60];

export function InstantMeetingButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(30);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ joinUrl: string; shareUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function start() {
    startTransition(async () => {
      const res = await startInstantMeetingAction(duration);
      if (res.ok && res.joinUrl && res.shareUrl) {
        setResult({ joinUrl: res.joinUrl, shareUrl: res.shareUrl });
      } else {
        toast({ title: "Couldn't start meeting", description: res.error, variant: "destructive" });
      }
    });
  }

  async function copyShare() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  function reset(next: boolean) {
    setOpen(next);
    if (!next) setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Video className="h-4 w-4" /> Meet now
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start an instant meeting</DialogTitle>
          <DialogDescription>
            Spin up a video room right now and share the link. Requires a connected video app (Zoom or Daily).
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Shareable link</Label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={result.shareUrl}
                  className="flex-1 rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyShare}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button asChild className="w-full">
              <a href={result.joinUrl} target="_blank" rel="noreferrer" className="gap-1">
                Join now <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
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
            <Button className="w-full" onClick={start} disabled={pending}>
              {pending ? "Starting…" : "Start meeting"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
