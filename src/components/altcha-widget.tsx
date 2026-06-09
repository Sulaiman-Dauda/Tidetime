"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber: number;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Privacy-friendly proof-of-work check (ALTCHA protocol). Fetches a challenge
 * from our own server, brute-forces the answer in the browser, and reports the
 * signed solution token via {@link onChange}. No third-party scripts or cookies.
 */
export function AltchaWidget({ onChange }: { onChange: (token: string | null) => void }) {
  const [status, setStatus] = useState<"idle" | "solving" | "done" | "error">("idle");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const solve = useCallback(async () => {
    setStatus("solving");
    onChangeRef.current(null);
    try {
      const res = await fetch("/api/altcha/challenge", { cache: "no-store" });
      if (!res.ok) throw new Error("challenge failed");
      const challenge = (await res.json()) as AltchaChallenge;
      for (let number = 0; number <= challenge.maxnumber; number++) {
        const hash = await sha256Hex(challenge.salt + number);
        if (hash === challenge.challenge) {
          onChangeRef.current(
            JSON.stringify({
              algorithm: challenge.algorithm,
              challenge: challenge.challenge,
              number,
              salt: challenge.salt,
              signature: challenge.signature,
            }),
          );
          setStatus("done");
          return;
        }
      }
      throw new Error("no solution");
    } catch {
      setStatus("error");
      onChangeRef.current(null);
    }
  }, []);

  useEffect(() => {
    void solve();
  }, [solve]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
      {status === "done" ? (
        <>
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Verified — you&apos;re human.</span>
        </>
      ) : status === "error" ? (
        <>
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <button type="button" onClick={() => void solve()} className="underline-offset-2 hover:underline">
            Verification failed — tap to retry
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Verifying you&apos;re human…</span>
        </>
      )}
    </div>
  );
}
