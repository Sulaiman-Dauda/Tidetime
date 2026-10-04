"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldHint } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AvatarUpload } from "./avatar-upload";
import {
  updateProfileAction,
  updatePasswordAction,
  signOutOtherSessionsAction,
  beginTotpSetupAction,
  enableTotpAction,
  disableTotpAction,
  requestEmailChangeAction,
  type SettingsState,
} from "./actions";
import { WEEKDAY_SHORT } from "@/lib/format";

interface UserView {
  name: string | null;
  position: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  timeZone: string;
  timeFormat: number;
  weekStart: number;
  locale: string;
  hasPassword: boolean;
  totpEnabled: boolean;
}

const LOCALES: { value: string; label: string }[] = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "Deutsch" },
  { value: "fr-FR", label: "Français" },
  { value: "es-ES", label: "Español" },
  { value: "pt-BR", label: "Português (BR)" },
  { value: "it-IT", label: "Italiano" },
  { value: "nl-NL", label: "Nederlands" },
];

export function SettingsForms({ user, timeZones }: { user: UserView; timeZones: string[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pwMismatch, setPwMismatch] = useState(false);

  const [profileState, profileAction, profilePending] = useActionState<SettingsState, FormData>(
    updateProfileAction,
    null,
  );
  const [pwState, pwAction, pwPending] = useActionState<SettingsState, FormData>(updatePasswordAction, null);
  const [sessionsState, sessionsAction, sessionsPending] = useActionState<SettingsState, FormData>(
    signOutOtherSessionsAction,
    null,
  );

  useEffect(() => {
    if (sessionsState?.ok) toast({ title: "Signed out everywhere else", description: "Only this device stays signed in." });
    if (sessionsState?.error) toast({ title: "Couldn't sign out other sessions", variant: "destructive" });
  }, [sessionsState, toast]);

  useEffect(() => {
    if (profileState?.ok) toast({ title: "Changes saved", description: "Your profile has been updated." });
    if (profileState?.error)
      toast({
        title: "Couldn't save changes",
        description: profileState.error || "Please check your details and try again.",
        variant: "destructive",
      });
  }, [profileState, toast]);

  useEffect(() => {
    if (pwState?.ok) toast({ title: "Password updated" });
    if (pwState?.error)
      toast({
        title: "Couldn't update password",
        description: pwState.error || "Please check your details and try again.",
        variant: "destructive",
      });
  }, [pwState, toast]);

  return (
    <div>
      <FormSection
        title="Profile"
        description="How you appear to teammates and customers, and how dates and times are shown to you."
        footer={
          <Button type="submit" form="profile-form" loading={profilePending}>
            Save changes
          </Button>
        }
      >
        {/* refresh server-rendered avatars (sidebar/topbar) after an upload */}
        <AvatarUpload
          currentUrl={user.avatarUrl}
          name={user.name ?? user.username}
          onUploaded={() => router.refresh()}
        />
        <form id="profile-form" action={profileAction} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" defaultValue={user.name ?? ""} />
            </Field>
            <Field label="Username" htmlFor="username">
              <Input id="username" name="username" defaultValue={user.username} required />
            </Field>
          </div>
          <Field
            label="Position"
            htmlFor="position"
            hint="Your job title, shown with your name and photo on the public booking page."
          >
            <Input
              id="position"
              name="position"
              defaultValue={user.position ?? ""}
              placeholder="e.g. Consultant"
              maxLength={128}
            />
          </Field>
          <div className="-mx-5 grid gap-4 border-t px-5 pt-5 sm:grid-cols-2">
            <Field label="Time zone" htmlFor="timeZone">
              <SelectField
                id="timeZone"
                name="timeZone"
                defaultValue={user.timeZone}
                options={timeZones.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
              />
            </Field>
            <Field label="Date format" htmlFor="locale">
              <SelectField
                id="locale"
                name="locale"
                defaultValue={LOCALES.some((l) => l.value === user.locale) ? user.locale : "en-US"}
                options={LOCALES}
              />
            </Field>
            <Field label="Time format" htmlFor="timeFormat">
              <SelectField
                id="timeFormat"
                name="timeFormat"
                defaultValue={String(user.timeFormat)}
                options={[
                  { value: "12", label: "12-hour" },
                  { value: "24", label: "24-hour" },
                ]}
              />
            </Field>
            <Field label="Week starts" htmlFor="weekStart">
              <SelectField
                id="weekStart"
                name="weekStart"
                defaultValue={String(user.weekStart)}
                options={WEEKDAY_SHORT.map((d, i) => ({ value: String(i), label: d }))}
              />
            </Field>
          </div>
        </form>
      </FormSection>

      <EmailSection currentEmail={user.email} />

      <FormSection
        title="Password"
        description={
          user.hasPassword
            ? "Use at least 8 characters. Changing it signs you out on every other device."
            : "Add a password so you can sign in with your email address. Use at least 8 characters."
        }
        footer={
          <Button type="submit" form="password-form" loading={pwPending}>
            {user.hasPassword ? "Update password" : "Set password"}
          </Button>
        }
      >
        <form
          id="password-form"
          action={(formData) => {
            if (formData.get("next") !== formData.get("confirm")) {
              setPwMismatch(true);
              return;
            }
            setPwMismatch(false);
            pwAction(formData);
          }}
          onChange={() => setPwMismatch(false)}
          className="grid gap-4 sm:grid-cols-2"
        >
          {user.hasPassword ? (
            <Field label="Current password" htmlFor="current">
              <Input id="current" name="current" type="password" autoComplete="current-password" />
            </Field>
          ) : null}
          <Field label="New password" htmlFor="next" className="sm:col-start-1">
            <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={pwMismatch || undefined}
            />
            {pwMismatch ? <p className="text-meta text-destructive">Passwords don&apos;t match.</p> : null}
          </Field>
        </form>
      </FormSection>

      <TwoFactorSection enabled={user.totpEnabled} />

      <FormSection
        title="Sessions"
        description="Sign out of devices you no longer use."
      >
        <form
          action={sessionsAction}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">Other devices</p>
            <p className="text-meta text-muted-foreground">
              Signs you out of every other browser and device. This one stays signed in.
            </p>
          </div>
          <Button type="submit" variant="outline" size="sm" loading={sessionsPending}>
            Sign out other devices
          </Button>
        </form>
      </FormSection>
    </div>
  );
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<SettingsState, FormData>(requestEmailChangeAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast({
        title: "Check your new inbox",
        description: "We sent a confirmation link to the new address. Your email changes once you click it.",
      });
      setEditing(false);
    }
    if (state?.error) toast({ title: "Couldn't start email change", description: state.error, variant: "destructive" });
  }, [state, toast]);

  // Feedback after returning from the emailed confirmation link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("email_changed")) {
      toast({ title: "Email updated", description: "Use your new address next time you sign in." });
    } else if (params.get("email_change_error")) {
      toast({ title: "Email change failed", description: params.get("email_change_error") ?? undefined, variant: "destructive" });
    }
    if (params.get("email_changed") || params.get("email_change_error")) {
      params.delete("email_changed");
      params.delete("email_change_error");
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FormSection
      title="Email"
      description="The address you sign in with."
      footer={
        editing ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" form="email-form" loading={pending}>
              Send link
            </Button>
          </>
        ) : undefined
      }
    >
      {editing ? (
        <form id="email-form" action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="New email address" htmlFor="new-email">
            <Input id="new-email" name="email" type="email" required placeholder="new@company.com" autoFocus />
          </Field>
          <Field label="Current password" htmlFor="email-password">
            <Input
              id="email-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <FieldHint className="sm:col-span-2">
            We&apos;ll email a confirmation link to the new address. Nothing changes until you click it.
          </FieldHint>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">Email address</p>
            <p className="truncate text-meta text-muted-foreground">{currentEmail}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Change email
          </Button>
        </div>
      )}
    </FormSection>
  );
}

/** The account label an authenticator app shows, taken from the otpauth URI. */
function totpAccountLabel(uri: string) {
  const match = uri.match(/totp\/([^?]+)/)?.[1];
  return match ? decodeURIComponent(match) : "Tidetime";
}

function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [enableState, enableAction, enabling] = useActionState<SettingsState, FormData>(enableTotpAction, null);
  const [disableState, disableAction, disabling] = useActionState<SettingsState, FormData>(disableTotpAction, null);

  useEffect(() => {
    if (enableState?.ok) {
      toast({ title: "Two-factor authentication enabled", description: "You'll be asked for a code at sign-in." });
      setSetup(null);
    }
    if (enableState?.error) toast({ title: "Couldn't enable 2FA", description: enableState.error, variant: "destructive" });
  }, [enableState, toast]);

  useEffect(() => {
    if (disableState?.ok) toast({ title: "Two-factor authentication disabled" });
    if (disableState?.error) toast({ title: "Couldn't disable 2FA", description: disableState.error, variant: "destructive" });
  }, [disableState, toast]);

  let footer: React.ReactNode;
  if (enabled) {
    footer = (
      <Button type="submit" form="totp-disable-form" variant="outline" loading={disabling}>
        Turn off
      </Button>
    );
  } else if (setup) {
    footer = (
      <>
        <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
          Cancel
        </Button>
        <Button type="submit" form="totp-enable-form" loading={enabling}>
          Verify &amp; enable
        </Button>
      </>
    );
  }

  return (
    <FormSection
      title="Two-factor authentication"
      description="Ask for a 6-digit code from an authenticator app at sign-in."
      footer={footer}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Authenticator app</p>
            {enabled ? (
              <Badge variant="success" dot>
                On
              </Badge>
            ) : (
              <Badge variant="secondary">Off</Badge>
            )}
          </div>
          <p className="text-meta text-muted-foreground">
            {enabled
              ? "You're asked for a code from your app each time you sign in."
              : "Google Authenticator, 1Password, Authy or any other authenticator app."}
          </p>
        </div>
        {!enabled && !setup ? (
          <Button variant="outline" size="sm" onClick={async () => setSetup(await beginTotpSetupAction())}>
            Set up 2FA
          </Button>
        ) : null}
      </div>

      {enabled ? (
        <form id="totp-disable-form" action={disableAction} className="-mx-5 grid gap-4 border-t px-5 pt-5">
          <Field
            label="Current code"
            htmlFor="totp-disable"
            hint="Enter a code from your app to turn two-factor authentication off."
            className="sm:max-w-xs"
          >
            <Input id="totp-disable" name="code" inputMode="numeric" maxLength={8} placeholder="123456" required />
          </Field>
        </form>
      ) : setup ? (
        <form id="totp-enable-form" action={enableAction} className="-mx-5 grid gap-5 border-t px-5 pt-5">
          <input type="hidden" name="secret" value={setup.secret} />
          <Field
            label="1. Add this key to your authenticator app"
            hint={
              <>
                Choose &ldquo;enter a setup key&rdquo;, account name &ldquo;{totpAccountLabel(setup.uri)}&rdquo;,
                time-based.
              </>
            }
          >
            <p className="select-all break-all rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm tracking-wider">
              {setup.secret}
            </p>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="2. Enter the 6-digit code it shows" htmlFor="totp-enable">
              <Input
                id="totp-enable"
                name="code"
                inputMode="numeric"
                maxLength={8}
                placeholder="123456"
                required
                autoFocus
              />
            </Field>
            <Field label="3. Confirm your password" htmlFor="totp-password">
              <Input
                id="totp-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          </div>
        </form>
      ) : null}
    </FormSection>
  );
}

function SelectField({
  id,
  name,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
