"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { initials } from "@/lib/format";

export function AvatarUpload({
  currentUrl,
  name,
  onUploaded,
}: {
  currentUrl: string | null;
  name: string;
  onUploaded?: (url: string | null) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [pending, start] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1_000_000) {
      toast({ title: "Image must be under 1 MB", variant: "destructive" });
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    start(async () => {
      try {
        const res = await fetch("/api/avatar", {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPreview(data.avatarUrl);
        onUploaded?.(data.avatarUrl);
        toast({ title: "Photo updated" });
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
        setPreview(currentUrl);
      }
    });
  }

  function remove() {
    start(async () => {
      try {
        const res = await fetch("/api/avatar", { method: "POST", body: "" });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPreview(null);
        onUploaded?.(null);
        toast({ title: "Photo removed" });
      } catch {
        toast({ title: "Failed to remove photo", variant: "destructive" });
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="h-16 w-16 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
          {preview && <AvatarImage src={preview} alt="" />}
          <AvatarFallback className="text-lg font-semibold bg-primary/15 text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
        >
          <Camera className="h-3.5 w-3.5" />
          {preview ? "Change" : "Upload"}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={remove}
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
