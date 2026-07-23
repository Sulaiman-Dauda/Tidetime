"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
  hasPassword: boolean;
  totpEnabled: boolean;
}

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
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="mt-5">
          {/* refresh server-rendered avatars (sidebar/topbar) after an upload */}
          <AvatarUpload
            currentUrl={user.avatarUrl}
            name={user.name ?? user.username}
            onUploaded={() => router.refresh()}
          />
        </div>
        <form action={profileAction} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={user.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" defaultValue={user.username} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              name="position"
              defaultValue={user.position ?? ""}
              placeholder="e.g. Consultant"
              maxLength={128}
            />
            <p className="text-xs text-muted-foreground">
              Your job title, shown with your name and photo on the public booking page.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Time zone</Label>
              <SelectField name="timeZone" defaultValue={user.timeZone} options={timeZones.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Time format</Label>
              <SelectField
                name="timeFormat"
                defaultValue={String(user.timeFormat)}
                options={[
                  { value: "12", label: "12-hour" },
                  { value: "24", label: "24-hour" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Week starts</Label>
              <SelectField
                name="weekStart"
                defaultValue={String(user.weekStart)}
                options={WEEKDAY_SHORT.map((d, i) => ({ value: String(i), label: d }))}
              />
            </div>
          </div>
          <Button type="submit" loading={profilePending}>
            Save changes
          </Button>
        </form>
      </Card>

      <EmailCard currentEmail={user.email} />

      <Card className="p-6">
        <h2 className="text-base font-semibold">{user.hasPassword ? "Change password" : "Set password"}</h2>
        <form
          action={(formData) => {
            if (formData.get("next") !== formData.get("confirm")) {
              setPwMismatch(true);
              return;
            }
            setPwMismatch(false);
            pwAction(formData);
          }}
          className="mt-5 max-w-sm space-y-4"
        >
          {user.hasPassword ? (
            <div className="space-y-1.5">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" autoComplete="current-password" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="next">New password</Label>
            <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
            {pwMismatch ? <p className="text-xs text-destructive">Passwords don&apos;t match.</p> : null}
          </div>
          <Button type="submit" variant="outline" loading={pwPending}>
            Update password
          </Button>
        </form>
      </Card>

      <TwoFactorCard enabled={user.totpEnabled} />

      <Card className="p-6">
        <h2 className="text-base font-semibold">Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          If you signed in on a shared or lost device, sign out everywhere else. This device stays
          signed in.
        </p>
        <form action={sessionsAction} className="mt-4">
          <Button type="submit" variant="outline" loading={sessionsPending}>
            Sign out other devices
          </Button>
        </form>
      </Card>
    </div>
  );
}

function EmailCard({ currentEmail }: { currentEmail: string }) {
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
    <Card className="p-6">
      <h2 className="text-base font-semibold">Email</h2>
      <p className="mt-1 text-sm text-muted-foreground">{currentEmail}</p>
      {editing ? (
        <form action={action} className="mt-4 flex max-w-sm items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-email">New email address</Label>
            <Input id="new-email" name="email" type="email" required placeholder="new@company.com" autoFocus />
          </div>
          <Button type="submit" loading={pending}>Send link</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </form>
      ) : (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
          Change email
        </Button>
      )}
      {editing ? (
        <p className="mt-2 text-xs text-muted-foreground">
          We&apos;ll email a confirmation link to the new address — nothing changes until you click it.
        </p>
      ) : null}
    </Card>
  );
}

function TwoFactorCard({ enabled }: { enabled: boolean }) {
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

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Two-factor authentication</h2>
        {enabled ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">On</span> : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Protect your account with a 6-digit code from an authenticator app (Google Authenticator,
        1Password, Authy…) at sign-in.
      </p>

      {enabled ? (
        <form action={disableAction} className="mt-4 flex max-w-sm items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="totp-disable">Current code</Label>
            <Input id="totp-disable" name="code" inputMode="numeric" maxLength={8} placeholder="123456" required />
          </div>
          <Button type="submit" variant="outline" loading={disabling}>
            Turn off
          </Button>
        </form>
      ) : setup ? (
        <div className="mt-4 max-w-md space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
            <p className="font-medium">1. Add this key to your authenticator app</p>
            <p className="mt-2 select-all break-all rounded bg-background px-2 py-1.5 font-mono text-[13px] tracking-wider">
              {setup.secret}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Choose “enter a setup key”, account name “{setup.uri.match(/totp\/([^?]+)/)?.[1] ? decodeURIComponent(setup.uri.match(/totp\/([^?]+)/)![1]) : "Tidetime"}”, time-based.
            </p>
          </div>
          <form action={enableAction} className="flex items-end gap-2">
            <input type="hidden" name="secret" value={setup.secret} />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="totp-enable">2. Enter the 6-digit code it shows</Label>
              <Input id="totp-enable" name="code" inputMode="numeric" maxLength={8} placeholder="123456" required autoFocus />
            </div>
            <Button type="submit" loading={enabling}>Verify &amp; enable</Button>
          </form>
          <Button variant="ghost" size="sm" onClick={() => setSetup(null)}>Cancel</Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="mt-4"
          onClick={async () => setSetup(await beginTotpSetupAction())}
        >
          Set up 2FA
        </Button>
      )}
    </Card>
  );
}

function SelectField({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger>
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
