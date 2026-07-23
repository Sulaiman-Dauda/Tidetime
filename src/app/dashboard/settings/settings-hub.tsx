"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { CompanySettings } from "@/lib/company-settings";
import { CompanyLogoUpload } from "./company-logo-upload";
import {
  updateCompanyLegalAction,
  updateCompanyProfileAction,
  updateCompanyBookingAction,
  type CompanySettingsState,
} from "./company-actions";
import {
  checkCustomDomainAction,
  updateCustomDomainAction,
  type DomainState,
} from "./domain-actions";

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

function SaveButton({ label = "Save changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function useSavedToast(state: CompanySettingsState, area: string) {
  const { toast } = useToast();
  useEffect(() => {
    if (state?.ok) toast({ title: "Changes saved", description: `Your ${area} have been updated.` });
    if (state?.error)
      toast({
        title: "Couldn't save changes",
        description: state.error || "Please check your details and try again.",
        variant: "destructive",
      });
  }, [state, toast, area]);
}

export function SettingsHub({
  settings,
  customDomain,
}: {
  settings: CompanySettings;
  customDomain: string | null;
}) {
  return (
    <Tabs defaultValue="domain" className="space-y-6">
      <TabsList className="flex-wrap">
        <TabsTrigger value="domain">Domain</TabsTrigger>
        <TabsTrigger value="general">Brand</TabsTrigger>
        <TabsTrigger value="booking">Booking</TabsTrigger>
        <TabsTrigger value="legal">Legal</TabsTrigger>
      </TabsList>

      <TabsContent value="domain">
        <DomainSection customDomain={customDomain} />
      </TabsContent>
      <TabsContent value="general">
        <GeneralSection profile={settings.profile} />
      </TabsContent>
      <TabsContent value="booking">
        <BookingSection booking={settings.booking} />
      </TabsContent>
      <TabsContent value="legal">
        <LegalSection legal={settings.legal} />
      </TabsContent>
    </Tabs>
  );
}

/* --------------------------------- General -------------------------------- */

function GeneralSection({ profile }: { profile: CompanySettings["profile"] }) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyProfileAction,
    null,
  );
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl);
  useSavedToast(state, "brand settings");
  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Brand & company</h2>
          <p className="text-xs text-muted-foreground">What customers see across the booking page and emails.</p>
        </div>
        <Field
          label="Company name"
          htmlFor="name"
          hint="Company name will be displayed everywhere on the system (required)."
        >
          <Input id="name" name="name" defaultValue={profile.name} required />
        </Field>
        <Field
          label="Company email"
          htmlFor="email"
          hint="Used as the sender and reply-to address of system emails."
        >
          <Input id="email" name="email" type="email" defaultValue={profile.email} placeholder="noreply@example.com" />
        </Field>
        <Field
          label="Company website"
          htmlFor="websiteUrl"
          hint="Should point to the official website of the company."
        >
          <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={profile.websiteUrl} placeholder="https://example.com" />
        </Field>
        <Field
          label="Company logo"
          htmlFor="logoUrl"
          hint="Upload an image (under 1 MB) or paste a URL. Shown on the public booking page and emails."
        >
          <div className="space-y-2">
            <CompanyLogoUpload value={logoUrl} onChange={setLogoUrl} />
            <Input
              id="logoUrl"
              name="logoUrl"
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </Field>
        <Field
          label="Brand colour"
          htmlFor="brandColor"
          hint="Applied across the app so it uses your branding. Hex value, e.g. #4f46e5."
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-hidden
              tabIndex={-1}
              defaultValue={profile.brandColor}
              onChange={(e) => {
                const t = document.getElementById("brandColor") as HTMLInputElement | null;
                if (t) t.value = e.target.value;
              }}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
            />
            <Input id="brandColor" name="brandColor" defaultValue={profile.brandColor} className="font-mono" />
          </div>
        </Field>
        <SaveButton />
      </form>
    </Card>
  );
}

/* --------------------------------- Domain --------------------------------- */

function DomainSection({ customDomain }: { customDomain: string | null }) {
  const [state, action] = useActionState<DomainState, FormData>(updateCustomDomainAction, null);
  const [checking, setChecking] = useState(false);
  const [liveStatus, setLiveStatus] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.ok) {
      setLiveStatus(null);
      toast({
        title: state.domain ? "Domain saved" : "Domain removed",
        description: state.domain
          ? `Point your DNS A record at this server, then use "Check status" to activate HTTPS.`
          : "The instance is back on its install address.",
      });
    }
    if (state?.error) {
      toast({ title: "Couldn't save domain", description: state.error, variant: "destructive" });
    }
  }, [state, toast]);

  async function checkStatus() {
    setChecking(true);
    try {
      const result = await checkCustomDomainAction();
      if (result?.error) {
        toast({ title: "Couldn't check domain", description: result.error, variant: "destructive" });
      } else {
        setLiveStatus(result?.live ?? false);
        toast(
          result?.live
            ? {
                title: "Your domain is live",
                description: `https://${result.domain} is serving Tidetime with a valid certificate.`,
              }
            : {
                title: "Not reachable yet",
                description:
                  "The certificate isn't active yet. Confirm the A record points at this server, ports 80/443 are open, and try again in a few minutes.",
                variant: "destructive",
              },
        );
      }
    } finally {
      setChecking(false);
    }
  }

  const saved = state?.ok ? state.domain ?? null : customDomain;

  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Custom domain</h2>
          <p className="text-xs text-muted-foreground">
            Serve Tidetime from your own domain over HTTPS. The certificate is obtained and renewed
            automatically — no certificate files or server changes needed.
          </p>
        </div>
        <Field
          label="Domain"
          htmlFor="domain"
          hint={
            <>
              1. Create a DNS A record for the domain pointing at this server&apos;s IP.&nbsp;
              2. Save, then use &quot;Check status&quot;. Booking links, emails, and calendar
              redirects switch to the domain automatically. Leave empty to remove it.
            </>
          }
        >
          <Input
            id="domain"
            name="domain"
            defaultValue={customDomain ?? ""}
            placeholder="calendar.example.com"
            autoComplete="off"
          />
        </Field>
        {saved && liveStatus !== null && (
          <p className={`text-xs ${liveStatus ? "text-emerald-600" : "text-muted-foreground"}`}>
            {liveStatus
              ? `✓ https://${saved} is live.`
              : `https://${saved} isn't answering yet — DNS may still be propagating.`}
          </p>
        )}
        <div className="flex items-center gap-2">
          <SaveButton />
          <Button type="button" variant="outline" onClick={checkStatus} disabled={checking || !saved}>
            {checking ? "Checking…" : "Check status"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* -------------------------------- Booking --------------------------------- */

function BookingSection({ booking }: { booking: CompanySettings["booking"] }) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyBookingAction,
    null,
  );
  useSavedToast(state, "booking defaults");
  return (
    <Card className="p-6">
      <form action={action} className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold">Booking defaults</h2>
          <p className="text-xs text-muted-foreground">Control how your public booking page behaves.</p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium">Disable public bookings</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, your booking page shows a maintenance message and no one can book.
              </p>
            </div>
            <Switch name="bookingDisabled" defaultChecked={booking.bookingDisabled} />
          </label>
          <label className="mt-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium">Spam protection (ALTCHA)</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adds a privacy-friendly proof-of-work check to the booking form. No third-party
                services, no tracking — it just makes automated spam bookings expensive.
              </p>
            </div>
            <Switch name="spamProtectionEnabled" defaultChecked={booking.spamProtectionEnabled} />
          </label>
        </div>

        <Field
          label="Future booking limit (days)"
          htmlFor="futureBookingLimitDays"
          hint="How far into the future customers can book."
        >
          <Input id="futureBookingLimitDays" name="futureBookingLimitDays" type="number" min={1} max={3650} defaultValue={booking.futureBookingLimitDays} />
        </Field>
        <Field
          label="Minimum booking notice (minutes)"
          htmlFor="minimumBookingNoticeMinutes"
          hint="How much lead time is required before a slot can be booked."
        >
          <Input id="minimumBookingNoticeMinutes" name="minimumBookingNoticeMinutes" type="number" min={0} defaultValue={booking.minimumBookingNoticeMinutes} />
        </Field>
        <Field
          label="Reschedule/cancel timeout (minutes)"
          htmlFor="rescheduleCancelTimeoutMinutes"
          hint="How close to the start reschedule or cancel is blocked."
        >
          <Input id="rescheduleCancelTimeoutMinutes" name="rescheduleCancelTimeoutMinutes" type="number" min={0} defaultValue={booking.rescheduleCancelTimeoutMinutes} />
        </Field>
        <Field
          label="Appointment status labels"
          htmlFor="appointmentStatuses"
          hint="Comma-separated list of available status labels."
        >
          <Input id="appointmentStatuses" name="appointmentStatuses" defaultValue={booking.appointmentStatuses.join(", ")} />
        </Field>
        <SaveButton />
      </form>
    </Card>
  );
}

/* ------------------------------ Legal contents ---------------------------- */

function LegalSection({ legal }: { legal: CompanySettings["legal"] }) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyLegalAction,
    null,
  );
  useSavedToast(state, "legal settings");
  return (
    <Card className="p-6">
      <form action={action} className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold">Legal contents</h2>
          <p className="text-xs text-muted-foreground">Shown on the public booking page for compliance.</p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Display cookie notice</span>
            <Switch name="cookieNoticeEnabled" defaultChecked={legal.cookieNoticeEnabled} />
          </label>
          <Textarea name="cookieNoticeContent" defaultValue={legal.cookieNoticeContent} rows={3} placeholder="Cookie notice content." />
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Display terms &amp; conditions</span>
            <Switch name="termsEnabled" defaultChecked={legal.termsEnabled} />
          </label>
          <Textarea name="termsContent" defaultValue={legal.termsContent} rows={4} placeholder="Terms and conditions content." />
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Display privacy policy</span>
            <Switch name="privacyEnabled" defaultChecked={legal.privacyEnabled} />
          </label>
          <Textarea name="privacyContent" defaultValue={legal.privacyContent} rows={4} placeholder="Privacy policy content." />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Legal notice URL" htmlFor="legalNoticeUrl" hint="Link to your legal notice page.">
            <Input id="legalNoticeUrl" name="legalNoticeUrl" type="url" defaultValue={legal.legalNoticeUrl} placeholder="https://…" />
          </Field>
          <Field label="Imprint URL" htmlFor="imprintUrl" hint="Link to your imprint page.">
            <Input id="imprintUrl" name="imprintUrl" type="url" defaultValue={legal.imprintUrl} placeholder="https://…" />
          </Field>
        </div>

        <Field
          label="Data retention (days)"
          htmlFor="dataRetentionDays"
          hint="Days after which customer data is automatically deleted. Set to 0 to disable."
        >
          <Input id="dataRetentionDays" name="dataRetentionDays" type="number" min={0} defaultValue={legal.dataRetentionDays} />
        </Field>

        <SaveButton />
      </form>
    </Card>
  );
}
