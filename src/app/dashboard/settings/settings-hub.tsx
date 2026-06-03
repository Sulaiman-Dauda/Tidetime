"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { WEEKDAY_SHORT } from "@/lib/format";
import type { CompanySettings } from "@/lib/company-settings";
import { EmailSettings } from "./email-settings";
import { PaymentSettings } from "./payment-settings";
import { ReviewSettings, type ReviewSettingsView } from "./review-settings";
import { ApiKeys, type ApiKeyRow } from "./api-keys";
import {
  updateCompanyBookingAction,
  updateCompanyLegalAction,
  updateCompanyLocalizationAction,
  updateCompanyProfileAction,
  type CompanySettingsState,
} from "./company-actions";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

function useSavedToast(state: CompanySettingsState) {
  const { toast } = useToast();
  useEffect(() => {
    if (state?.ok) toast({ title: "Settings saved" });
    if (state?.error) toast({ title: state.error, variant: "destructive" });
  }, [state, toast]);
}

export function SettingsHub({
  settings,
  timeZones,
  review,
  apiKeys,
}: {
  settings: CompanySettings;
  timeZones: string[];
  review: ReviewSettingsView;
  apiKeys: ApiKeyRow[];
}) {
  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="flex-wrap">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="localization">Localization</TabsTrigger>
        <TabsTrigger value="business">Booking rules</TabsTrigger>
        <TabsTrigger value="email">Email</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="api">API keys</TabsTrigger>
        <TabsTrigger value="legal">Legal</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSection profile={settings.profile} />
      </TabsContent>
      <TabsContent value="localization">
        <LocalizationSection localization={settings.localization} timeZones={timeZones} />
      </TabsContent>
      <TabsContent value="business">
        <BusinessSection booking={settings.booking} />
      </TabsContent>
      <TabsContent value="email">
        <EmailSettings />
      </TabsContent>
      <TabsContent value="payments">
        <PaymentSettings />
      </TabsContent>
      <TabsContent value="reviews">
        <ReviewSettings review={review} />
      </TabsContent>
      <TabsContent value="api">
        <ApiKeys keys={apiKeys} />
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
  useSavedToast(state);
  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Company</h2>
          <p className="text-xs text-muted-foreground">Your branding across the booking page and emails.</p>
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
          label="Company logo URL"
          htmlFor="logoUrl"
          hint="Displayed on the public booking page and notification emails."
        >
          <Input id="logoUrl" name="logoUrl" type="url" defaultValue={profile.logoUrl} placeholder="https://example.com/logo.png" />
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

/* ------------------------------ Localization ------------------------------ */

function LocalizationSection({
  localization,
  timeZones,
}: {
  localization: CompanySettings["localization"];
  timeZones: string[];
}) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyLocalizationAction,
    null,
  );
  useSavedToast(state);
  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Localization</h2>
          <p className="text-xs text-muted-foreground">Default formats used for new records.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date format" htmlFor="dateFormat" hint="D – Date, M – Month, Y – Year.">
            <select id="dateFormat" name="dateFormat" defaultValue={localization.dateFormat} className={SELECT_CLASS}>
              <option value="DMY">DMY (31/12/2025)</option>
              <option value="MDY">MDY (12/31/2025)</option>
              <option value="YMD">YMD (2025/12/31)</option>
            </select>
          </Field>
          <Field label="Time format" htmlFor="timeFormat" hint="12-hour or 24-hour clock.">
            <select id="timeFormat" name="timeFormat" defaultValue={localization.timeFormat} className={SELECT_CLASS}>
              <option value={12}>H:MM AM/PM</option>
              <option value={24}>HH:MM</option>
            </select>
          </Field>
          <Field label="First day of week" htmlFor="weekStart" hint="The first day of the calendar week.">
            <select id="weekStart" name="weekStart" defaultValue={localization.weekStart} className={SELECT_CLASS}>
              {WEEKDAY_SHORT.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default language" htmlFor="defaultLocale" hint="Default locale for new records.">
            <select id="defaultLocale" name="defaultLocale" defaultValue={localization.defaultLocale} className={SELECT_CLASS}>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </Field>
          <Field label="Default timezone" htmlFor="defaultTimeZone" hint="Default timezone for new records.">
            <select id="defaultTimeZone" name="defaultTimeZone" defaultValue={localization.defaultTimeZone} className={SELECT_CLASS}>
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <SaveButton />
      </form>
    </Card>
  );
}

/* ------------------------------ Business logic ---------------------------- */

function BusinessSection({ booking }: { booking: CompanySettings["booking"] }) {
  const [state, action] = useActionState<CompanySettingsState, FormData>(
    updateCompanyBookingAction,
    null,
  );
  useSavedToast(state);
  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Business logic</h2>
          <p className="text-xs text-muted-foreground">Default booking rules for the whole company.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Future booking limit (days)"
            htmlFor="futureBookingLimitDays"
            hint="How far ahead customers can book via the public page."
          >
            <Input
              id="futureBookingLimitDays"
              name="futureBookingLimitDays"
              type="number"
              min={0}
              defaultValue={booking.futureBookingLimitDays}
            />
          </Field>
          <Field
            label="Minimum booking notice (minutes)"
            htmlFor="minimumBookingNoticeMinutes"
            hint="Lead time required before a slot can be booked."
          >
            <Input
              id="minimumBookingNoticeMinutes"
              name="minimumBookingNoticeMinutes"
              type="number"
              min={0}
              defaultValue={booking.minimumBookingNoticeMinutes}
            />
          </Field>
          <Field
            label="Reschedule / cancel cut-off (minutes)"
            htmlFor="rescheduleCancelTimeoutMinutes"
            hint="Customers cannot reschedule or cancel within this window before the start."
          >
            <Input
              id="rescheduleCancelTimeoutMinutes"
              name="rescheduleCancelTimeoutMinutes"
              type="number"
              min={0}
              defaultValue={booking.rescheduleCancelTimeoutMinutes}
            />
          </Field>
        </div>
        <Field
          label="Appointment status options"
          htmlFor="appointmentStatuses"
          hint="Comma-separated list used in the calendar. The first one is the default."
        >
          <Input
            id="appointmentStatuses"
            name="appointmentStatuses"
            defaultValue={booking.appointmentStatuses.join(", ")}
          />
        </Field>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Disable booking</span>
            <Hint>When on, the public booking page is disabled and no new appointments can be made.</Hint>
          </span>
          <Switch name="bookingDisabled" defaultChecked={booking.bookingDisabled} />
        </label>
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
  useSavedToast(state);
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
