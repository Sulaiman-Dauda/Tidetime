"use client";

import { useRef, useTransition } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Company-logo uploader. Uploads to /api/company/logo (validate → data URL) and
 * reports the URL upward; the Brand form persists it on save. Also accepts a
 * pasted URL via the sibling text input the parent renders.
 */
export function CompanyLogoUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      toast({ title: "Couldn't upload logo", description: "Image must be under 1 MB.", variant: "destructive" });
      return;
    }
    start(async () => {
      try {
        const res = await fetch("/api/company/logo", {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        onChange(data.url);
        toast({ title: "Logo uploaded", description: "Remember to save your changes." });
      } catch (err) {
        toast({
          title: "Couldn't upload logo",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-secondary/40">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Company logo" className="h-full w-full object-contain" />
        ) : (
          <ImageUp className="h-5 w-5 text-muted-foreground" />
        )}
        {pending ? (
          <span className="absolute" aria-hidden>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
          <ImageUp className="h-3.5 w-3.5" /> {value ? "Change" : "Upload"}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onChange("")}
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
