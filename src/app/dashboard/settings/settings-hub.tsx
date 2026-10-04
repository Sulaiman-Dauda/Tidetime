"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { CompanySettings } from "@/lib/company-settings";
import { DIALLING_COUNTRIES, countryFor, normalizeDiallingCountry } from "@/lib/phone";
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

function SaveButton({ label = "Save changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
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
    /* Ordered by how often they are touched. Domain is a one-time DNS chore,
       so it goes last; Brand is what an owner opens Settings to change. */
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList>
        <TabsTrigger value="general">Brand</TabsTrigger>
        <TabsTrigger value="booking">Booking</TabsTrigger>
        <TabsTrigger value="legal">Legal</TabsTrigger>
        <TabsTrigger value="domain">Domain</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSection profile={settings.profile} />
      </TabsContent>
      <TabsContent value="booking">
        <BookingSection booking={settings.booking} />
      </TabsContent>
      <TabsContent value="legal">
        <LegalSection legal={settings.legal} />
      </TabsContent>
      <TabsContent value="domain">
        <DomainSection customDomain={customDomain} />
      </TabsContent>
    </Tabs>
  );
}

/* --------------------------------- General -------------------------------- */

/** The native colour picker only takes #rrggbb; the field also accepts #rgb. */
function pickerHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v.slice(1).split("").map((c) => c + c).join("")}`;
  return null;
}

function GeneralSection({ profile }: { profile: CompanySettings["profile"] }) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyProfileAction,
    null,
  );
  const [brandColor, setBrandColor] = useState(profile.brandColor);
  const [phoneCountry, setPhoneCountry] = useState(() => normalizeDiallingCountry(profile.phoneCountry));
  useSavedToast(state, "brand settings");
  return (
    <form action={action}>
      <FormSection
        title="Brand"
        description="What customers see when they book with you."
      >
        <Field label="Company name" htmlFor="name" hint="Shown to customers on your public booking pages.">
          <Input id="name" name="name" defaultValue={profile.name} required />
        </Field>
        <Field label="Company logo">
          <CompanyLogoUpload defaultValue={profile.logoUrl} />
        </Field>
        <Field
          label="Brand colour"
          htmlFor="brandColor"
          hint="Used for buttons, links and highlights on your public booking, confirmation and legal pages. A colour that would be hard to read is adjusted so links stay legible, and dark mode uses a lighter shade. The dashboard keeps Tidetime's own colours."
        >
          <div className="relative sm:max-w-60">
            <input
              type="color"
              aria-label="Pick brand colour"
              value={pickerHex(brandColor) ?? pickerHex(profile.brandColor) ?? "#000000"}
              onChange={(e) => setBrandColor(e.target.value)}
              className="absolute left-2 top-1/2 size-5 -translate-y-1/2 cursor-pointer appearance-none overflow-hidden rounded border-0 bg-transparent p-0 ring-1 ring-inset ring-border [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0"
            />
            <Input
              id="brandColor"
              name="brandColor"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="pl-9 font-mono"
            />
          </div>
        </Field>
      </FormSection>
      <FormSection
        title="Booking form"
        description="Defaults for the fields customers fill in when they book."
        footer={<SaveButton />}
      >
        <Field
          label="Default phone country"
          htmlFor="phoneCountry"
          hint="Preselected in phone fields on the booking form. Customers can still change it."
        >
          {/* Posted through our own hidden input: React resets the form after each
              save, which sends Radix's hidden native select back to the value the
              page loaded with, so a later save would quietly post the old country. */}
          <input type="hidden" name="phoneCountry" value={phoneCountry} />
          <Select value={phoneCountry} onValueChange={setPhoneCountry}>
            <SelectTrigger id="phoneCountry" className="sm:max-w-sm">
              {/* Label passed in so it is in the server HTML; Radix only fills an
                  empty SelectValue after hydration, which flashes a blank field. */}
              <SelectValue>
                {countryFor(phoneCountry).name} (+{countryFor(phoneCountry).dial})
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DIALLING_COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name} (+{country.dial})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>
    </form>
  );
}

/* -------------------------------- Booking --------------------------------- */

function SwitchRow({
  name,
  defaultChecked,
  title,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 px-5 py-4">
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-meta text-muted-foreground">{description}</span>
      </span>
      <Switch name={name} defaultChecked={defaultChecked} className="mt-0.5" />
    </label>
  );
}

function BookingSection({ booking }: { booking: CompanySettings["booking"] }) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyBookingAction,
    null,
  );
  useSavedToast(state, "booking defaults");
  return (
    <form action={action}>
      <FormSection
        title="Public booking"
        description="Control how your public booking page behaves."
        contentClassName="gap-0 divide-y p-0"
        footer={<SaveButton />}
      >
        <SwitchRow
          name="bookingDisabled"
          defaultChecked={booking.bookingDisabled}
          title="Disable public bookings"
          description="Your booking page shows a maintenance message and no one can book."
        />
        <SwitchRow
          name="spamProtectionEnabled"
          defaultChecked={booking.spamProtectionEnabled}
          title="Spam protection (ALTCHA)"
          description="Adds a privacy-friendly proof-of-work check to the booking form. No third-party services and no tracking, but automated spam bookings become costly to send."
        />
      </FormSection>
    </form>
  );
}

/* ------------------------------ Legal contents ---------------------------- */

function DisplaySwitch({ name, defaultChecked, label }: { name: string; defaultChecked: boolean; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-meta text-muted-foreground">
      Display
      <Switch name={name} defaultChecked={defaultChecked} aria-label={label} />
    </label>
  );
}

function LegalSection({ legal }: { legal: CompanySettings["legal"] }) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyLegalAction,
    null,
  );
  useSavedToast(state, "legal settings");
  return (
    <form action={action}>
      <FormSection
        title="Policies"
        description="Shown on your public booking pages when switched on and filled in."
      >
        <Field
          label="Cookie notice"
          htmlFor="cookieNoticeContent"
          aside={
            <DisplaySwitch
              name="cookieNoticeEnabled"
              defaultChecked={legal.cookieNoticeEnabled}
              label="Display cookie notice"
            />
          }
        >
          <Textarea
            id="cookieNoticeContent"
            name="cookieNoticeContent"
            defaultValue={legal.cookieNoticeContent}
            rows={3}
            placeholder="Cookie notice content."
          />
        </Field>
        <Field
          label="Terms and conditions"
          htmlFor="termsContent"
          aside={
            <DisplaySwitch
              name="termsEnabled"
              defaultChecked={legal.termsEnabled}
              label="Display terms and conditions"
            />
          }
        >
          <Textarea
            id="termsContent"
            name="termsContent"
            defaultValue={legal.termsContent}
            rows={5}
            placeholder="Terms and conditions content."
          />
        </Field>
        <Field
          label="Privacy policy"
          htmlFor="privacyContent"
          aside={
            <DisplaySwitch
              name="privacyEnabled"
              defaultChecked={legal.privacyEnabled}
              label="Display privacy policy"
            />
          }
        >
          <Textarea
            id="privacyContent"
            name="privacyContent"
            defaultValue={legal.privacyContent}
            rows={5}
            placeholder="Privacy policy content."
          />
        </Field>
      </FormSection>
      <FormSection
        title="Links"
        description="Optional links to pages you host elsewhere, shown in the footer of your booking pages."
        contentClassName="sm:grid-cols-2"
      >
        <Field label="Legal notice URL" htmlFor="legalNoticeUrl">
          <Input
            id="legalNoticeUrl"
            name="legalNoticeUrl"
            type="url"
            defaultValue={legal.legalNoticeUrl}
            placeholder="https://…"
          />
        </Field>
        <Field label="Imprint URL" htmlFor="imprintUrl">
          <Input
            id="imprintUrl"
            name="imprintUrl"
            type="url"
            defaultValue={legal.imprintUrl}
            placeholder="https://…"
          />
        </Field>
      </FormSection>
      <FormSection
        title="Data retention"
        description="Remove old booking data automatically."
        footer={<SaveButton />}
      >
        <Field
          label="Delete bookings after"
          htmlFor="dataRetentionDays"
          hint="Bookings, with the customer details they hold, are deleted this many days after they end. Set to 0 to keep them."
        >
          <div className="flex items-center gap-2">
            <Input
              id="dataRetentionDays"
              name="dataRetentionDays"
              type="number"
              min={0}
              defaultValue={legal.dataRetentionDays}
              className="w-28 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </Field>
      </FormSection>
    </form>
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
                description: `https://${result.domain} is serving your booking pages with a valid certificate.`,
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
    <form action={action}>
      <FormSection
        title="Custom domain"
        description="Serve your booking pages from your own domain over HTTPS. The certificate is issued and renewed automatically, with no certificate files or server changes."
        footer={
          <>
            <Button type="button" variant="outline" onClick={checkStatus} loading={checking} disabled={!saved}>
              {checking ? "Checking…" : "Check status"}
            </Button>
            <SaveButton />
          </>
        }
      >
        <Field label="Domain" htmlFor="domain">
          <Input
            id="domain"
            name="domain"
            defaultValue={customDomain ?? ""}
            placeholder="calendar.example.com"
            autoComplete="off"
          />
          <div className="space-y-2 text-meta text-muted-foreground">
            {/* Two steps set on one line read as a wall of text. */}
            <ol className="ml-4 list-decimal space-y-1">
              <li>Create a DNS A record for the domain pointing at this server&apos;s IP.</li>
              <li>
                Save, then use <span className="font-medium text-foreground">Check status</span>.
              </li>
            </ol>
            <p>
              Booking links, emails and calendar redirects switch to the domain automatically.
              Leave the field empty to remove it.
            </p>
          </div>
        </Field>
        {saved && liveStatus !== null ? (
          liveStatus ? (
            <p className="flex items-center gap-1.5 text-meta font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              https://{saved} is live.
            </p>
          ) : (
            <p className="text-meta text-muted-foreground">
              https://{saved} isn&apos;t answering yet. DNS may still be propagating.
            </p>
          )
        ) : null}
      </FormSection>
    </form>
  );
}
