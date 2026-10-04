"use client";

import { MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { useRef, useState, useTransition } from "react";
import { ImageIcon, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const isWebUrl = (value: string) => /^https?:\/\//i.test(value);

/**
 * Company logo field for the Brand form. An upload goes to /api/company/logo,
 * which validates it and returns a data URL; the form persists whatever value
 * this field holds on save. The value always posts as `logoUrl` through the
 * hidden input, so an uploaded data URL never has to sit in a visible text box.
 * A pasted http(s) URL is still supported behind the URL toggle.
 */
export function CompanyLogoUpload({ defaultValue }: { defaultValue: string }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [value, setValue] = useState(defaultValue);
  const [showUrl, setShowUrl] = useState(() => isWebUrl(defaultValue));

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
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
        setValue(data.url);
        setShowUrl(false);
        toast({ title: "Logo uploaded", description: "Now press Save changes to make it live." });
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
    <div className="grid gap-3">
      <input type="hidden" name="logoUrl" value={value} />
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Company logo" className="size-full object-contain p-2" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          )}
          {pending ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80" aria-hidden>
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
            >
              <ImageUp />
              {value ? "Change" : "Upload"}
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue("")} disabled={pending}>
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-meta text-muted-foreground">PNG, JPG, GIF or WebP, under 1&nbsp;MB.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {showUrl ? (
        <Input
          id="logoUrl"
          type="text"
          inputMode="url"
          aria-label="Logo image URL"
          value={value.startsWith("data:") ? "" : value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://example.com/logo.png"
        />
      ) : (
        <Button
          type="button"
          variant="link"
          className="justify-self-start text-meta"
          onClick={() => setShowUrl(true)}
        >
          Use an image URL instead
        </Button>
      )}
    </div>
  );
}
